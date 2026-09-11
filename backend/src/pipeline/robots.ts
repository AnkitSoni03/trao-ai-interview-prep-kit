// robots-parser ships a malformed index.d.ts (a bodyless ambient `declare module` alongside
// real top-level exports in the same file) that confuses NodeNext resolution into treating the
// default export as non-callable. Bypass its types and declare the shape we actually use.
import robotsParserImport from "robots-parser";
import { env } from "../config/env.js";
import { assertSafeToFetch } from "../utils/urlSafety.js";

interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

const robotsParser = robotsParserImport as unknown as (url: string, robotstxt: string) => Robot;

const cache = new Map<string, Robot | null>();

/** Fetches and caches robots.txt for a site's origin. Missing/unreachable robots.txt = allow all. */
export async function getRobotsForOrigin(origin: string): Promise<Robot | null> {
  if (cache.has(origin)) return cache.get(origin)!;

  const robotsUrl = new URL("/robots.txt", origin).toString();
  try {
    await assertSafeToFetch(robotsUrl);
    const res = await fetch(robotsUrl, { headers: { "User-Agent": env.CRAWL_USER_AGENT } });
    if (!res.ok) {
      cache.set(origin, null);
      return null;
    }
    const body = await res.text();
    const robots = robotsParser(robotsUrl, body);
    cache.set(origin, robots);
    return robots;
  } catch {
    cache.set(origin, null);
    return null;
  }
}

export async function isCrawlAllowed(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  const robots = await getRobotsForOrigin(origin);
  if (!robots) return true;
  return robots.isAllowed(url, env.CRAWL_USER_AGENT) ?? true;
}
