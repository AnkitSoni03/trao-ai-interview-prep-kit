import { env } from "../config/env.js";
import { fetchPage, type FetchedPage, type FetchFailure } from "./fetchPage.js";
import { isCrawlAllowed } from "./robots.js";

const HIRING_PATH_KEYWORDS = [
  "career",
  "careers",
  "jobs",
  "job",
  "hiring",
  "join-us",
  "join_us",
  "joinus",
  "work-with-us",
  "open-positions",
  "openings",
  "opportunities",
  "vacan",
  "recruit",
];

const ABOUT_PATH_KEYWORDS = [
  "about",
  "company",
  "who-we-are",
  "mission",
  "team",
  "culture",
  "life-at",
  "life_at",
  "engineering-blog",
  "eng-blog",
  "blog",
  "handbook",
  "values",
  "interview",
  "hiring-process",
  "our-process",
];

const SKIP_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|mp4|mp3|ico|woff2?|xml)(\?|$)/i;

interface ScoredLink {
  url: string;
  score: number;
  depth: number;
}

function scoreLink(href: string, linkText: string): number {
  const path = (() => {
    try {
      return new URL(href).pathname.toLowerCase();
    } catch {
      return href.toLowerCase();
    }
  })();
  const text = linkText.toLowerCase();

  let score = 0;
  for (const kw of HIRING_PATH_KEYWORDS) {
    if (path.includes(kw)) score += 10;
    if (text.includes(kw)) score += 6;
  }
  for (const kw of ABOUT_PATH_KEYWORDS) {
    if (path.includes(kw)) score += 4;
    if (text.includes(kw)) score += 2;
  }

  // Prefer shallower pages, mild tie-breaker.
  const depth = path.split("/").filter(Boolean).length;
  score -= depth * 0.5;

  return score;
}

function isSameSite(candidate: string, rootOrigin: string): boolean {
  try {
    const candidateHost = new URL(candidate).hostname.replace(/^www\./, "");
    const rootHost = new URL(rootOrigin).hostname.replace(/^www\./, "");
    return candidateHost === rootHost || candidateHost.endsWith(`.${rootHost}`);
  } catch {
    return false;
  }
}

export interface CrawlResult {
  pages: FetchedPage[];
  errors: FetchFailure[];
  hiringPageFound: boolean;
}

/**
 * Crawls a company site starting from its homepage, ranking discovered links by how
 * likely they are to be a hiring/about page rather than relying on a fixed path list
 * (Section 2: "the path cannot be hard-coded").
 */
export async function crawlCompanySite(companyUrl: string): Promise<CrawlResult> {
  const pages: FetchedPage[] = [];
  const errors: FetchFailure[] = [];
  const visited = new Set<string>();

  let rootOrigin: string;
  try {
    rootOrigin = new URL(companyUrl).origin;
  } catch {
    return { pages, errors: [{ url: companyUrl, reason: "Invalid company URL" }], hiringPageFound: false };
  }

  const budget = env.CRAWL_MAX_PAGES_PER_SITE;
  const frontier: ScoredLink[] = [{ url: companyUrl, score: Number.POSITIVE_INFINITY, depth: 0 }];

  while (frontier.length > 0 && pages.length < budget) {
    frontier.sort((a, b) => b.score - a.score);
    const next = frontier.shift()!;
    if (visited.has(next.url)) continue;
    visited.add(next.url);

    if (next.depth > 0) {
      const allowed = await isCrawlAllowed(next.url).catch(() => true);
      if (!allowed) {
        errors.push({ url: next.url, reason: "Disallowed by robots.txt" });
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, env.CRAWL_MIN_DELAY_MS));
    }

    const result = await fetchPage(next.url);
    if (!result.ok) {
      errors.push(result.failure);
      continue;
    }

    pages.push(result.page);

    if (next.depth < 2) {
      for (const link of result.page.links) {
        if (visited.has(link.href)) continue;
        if (SKIP_EXTENSIONS.test(link.href)) continue;
        if (!isSameSite(link.href, rootOrigin)) continue;
        frontier.push({ url: link.href, score: scoreLink(link.href, link.text), depth: next.depth + 1 });
      }
    }
  }

  const hiringPageFound = pages.some((page) => {
    const haystack = `${page.finalUrl} ${page.title}`.toLowerCase();
    return HIRING_PATH_KEYWORDS.some((kw) => haystack.includes(kw));
  });

  return { pages, errors, hiringPageFound };
}
