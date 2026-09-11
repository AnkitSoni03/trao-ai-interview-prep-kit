import dns from "node:dns/promises";
import net from "node:net";
import { env } from "../config/env.js";

/**
 * SSRF guard for URLs we are about to fetch (company sites, discovered links).
 * Resolves the hostname and rejects loopback/private/link-local/multicast ranges
 * unless ALLOW_PRIVATE_NETWORK_FETCH is explicitly set (used by `npm run evaluate`
 * against a locally-served fixture site per the brief's batch requirements).
 */

const BLOCKED_V4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
];

function ipToLong(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isBlockedV4(ip: string): boolean {
  const target = ipToLong(ip);
  return BLOCKED_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (ipToLong(base) & mask);
  });
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") ||
    lower.startsWith("fd") || // unique local
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.")
  );
}

export class UnsafeUrlError extends Error {
  code = "UNSAFE_URL" as const;
}

export function isHttpUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Throws UnsafeUrlError if the URL should not be fetched. Call this immediately
 * before every outbound fetch of an untrusted (crawled) URL, not just once up front,
 * since a redirect can point somewhere new.
 */
export async function assertSafeToFetch(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  if (env.ALLOW_PRIVATE_NETWORK_FETCH) {
    // Explicitly opted in (evaluate command against a local fixture site).
    return;
  }

  const hostname = url.hostname;

  if (hostname === "localhost") {
    throw new UnsafeUrlError("Refusing to fetch localhost in this environment");
  }

  if (net.isIP(hostname)) {
    if (net.isIP(hostname) === 4 && isBlockedV4(hostname)) {
      throw new UnsafeUrlError(`Refusing to fetch private/loopback address: ${hostname}`);
    }
    if (net.isIP(hostname) === 6 && isBlockedV6(hostname)) {
      throw new UnsafeUrlError(`Refusing to fetch private/loopback address: ${hostname}`);
    }
    return;
  }

  const records = await dns.lookup(hostname, { all: true });
  for (const record of records) {
    if (record.family === 4 && isBlockedV4(record.address)) {
      throw new UnsafeUrlError(`Hostname ${hostname} resolves to a private address`);
    }
    if (record.family === 6 && isBlockedV6(record.address)) {
      throw new UnsafeUrlError(`Hostname ${hostname} resolves to a private address`);
    }
  }
}
