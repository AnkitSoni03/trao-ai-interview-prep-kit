import * as cheerio from "cheerio";
import { env } from "../config/env.js";
import { assertSafeToFetch } from "../utils/urlSafety.js";

const MAX_BODY_BYTES = 2_000_000; // 2MB cap per page
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

export interface FetchedPage {
  url: string;
  finalUrl: string;
  title: string;
  text: string; // cleaned, human-readable text
  links: Array<{ href: string; text: string }>;
}

export interface FetchFailure {
  url: string;
  reason: string;
}

export type FetchResult =
  | { ok: true; page: FetchedPage }
  | { ok: false; failure: FetchFailure };

/**
 * Fetches and cleans a single page. Never throws — every failure mode (SSRF-blocked,
 * timeout, wrong content type, too large, non-2xx) comes back as a typed failure so the
 * caller can "skip and report a source that cannot be retrieved, rather than failing the
 * whole run" (Section 2).
 */
export async function fetchPage(url: string): Promise<FetchResult> {
  try {
    await assertSafeToFetch(url);
  } catch (err) {
    return { ok: false, failure: { url, reason: err instanceof Error ? err.message : "Unsafe URL" } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.CRAWL_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": env.CRAWL_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });

    if (!res.ok) {
      return { ok: false, failure: { url, reason: `HTTP ${res.status}` } };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType.includes(allowed))) {
      return { ok: false, failure: { url, reason: `Unsupported content type: ${contentType || "unknown"}` } };
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength && contentLength > MAX_BODY_BYTES) {
      return { ok: false, failure: { url, reason: `Response too large (${contentLength} bytes)` } };
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) {
      return { ok: false, failure: { url, reason: `Response too large (${buffer.byteLength} bytes)` } };
    }

    // The final URL after redirects could point at a different host - re-check it.
    if (res.url && res.url !== url) {
      await assertSafeToFetch(res.url);
    }

    const html = Buffer.from(buffer).toString("utf-8");
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, nav, footer").remove();

    const title = $("title").first().text().trim();
    const text = $("body").text().replace(/\s+/g, " ").trim();

    const links: Array<{ href: string; text: string }> = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const linkText = $(el).text().replace(/\s+/g, " ").trim();
      if (!href) return;
      try {
        const absolute = new URL(href, res.url || url).toString();
        links.push({ href: absolute, text: linkText });
      } catch {
        // ignore malformed hrefs (mailto:, javascript:, etc. that fail URL parsing)
      }
    });

    return { ok: true, page: { url, finalUrl: res.url || url, title, text, links } };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "Request timed out" : String(err);
    return { ok: false, failure: { url, reason } };
  } finally {
    clearTimeout(timeout);
  }
}
