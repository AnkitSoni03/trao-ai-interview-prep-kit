import { env } from "../config/env.js";

export interface DiscussionSnippet {
  url: string;
  title: string;
  snippet: string;
}

export interface DiscussionSearchResult {
  found: boolean;
  snippets: DiscussionSnippet[];
  note?: string; // set when search could not run or found nothing, for an honest brief (Section 10)
}

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

/**
 * Looks for public discussion of a company's interview process (Glassdoor/Blind/blog posts/etc.)
 * via Tavily's search API. Best-effort: a missing key, a provider error, or zero results all
 * come back as a normal (not thrown) result so the pipeline can report "nothing found" honestly
 * rather than fail the run.
 */
export async function searchInterviewDiscussion(companyName: string): Promise<DiscussionSearchResult> {
  if (!env.TAVILY_API_KEY) {
    return { found: false, snippets: [], note: "TAVILY_API_KEY not configured; skipped interview-discussion search." };
  }
  if (!companyName.trim()) {
    return { found: false, snippets: [], note: "No company name available to search for." };
  }

  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query: `${companyName} interview process questions experience`,
        search_depth: "basic",
        max_results: 5,
      }),
    });

    if (!res.ok) {
      return { found: false, snippets: [], note: `Search provider returned HTTP ${res.status}` };
    }

    const data = (await res.json()) as { results?: Array<{ url: string; title: string; content: string }> };
    const results = data.results ?? [];
    const snippets = results.map((r) => ({ url: r.url, title: r.title, snippet: r.content }));

    return snippets.length > 0
      ? { found: true, snippets }
      : { found: false, snippets: [], note: "No public discussion of this company's interview process was found." };
  } catch (err) {
    return { found: false, snippets: [], note: `Search failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
