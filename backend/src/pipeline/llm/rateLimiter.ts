import PQueue from "p-queue";

/**
 * Free-tier LLM providers throttle both requests/minute and tokens/minute. We can't see
 * token usage ahead of a call, so the practical defence is a shared queue capping both
 * concurrency and requests/minute, with exponential backoff whenever the provider says
 * "slow down" (429) or has a transient failure (5xx / network error).
 *
 * A single Gemini call regularly takes 30-100s+ end-to-end on this network (measured, not
 * our code adding latency), and one kit needs several independent calls (per requirement-kind
 * question generation, the company brief). Running those fully serialized would blow the
 * "5 cases in 15 minutes" budget from Section 9, so we allow a few in flight at once rather
 * than one-at-a-time, while still capping requests/minute conservatively for the free tier.
 */
const queue = new PQueue({ concurrency: 3, interval: 60_000, intervalCap: 12 });

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

export class LlmRateLimitError extends Error {
  code = "LLM_RATE_LIMITED" as const;
}

function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null) {
    const candidate = err as { status?: number; statusCode?: number };
    return candidate.status ?? candidate.statusCode;
  }
  return undefined;
}

/** Runs `fn` through the shared throttled queue, retrying with backoff on rate limits/5xx. */
export async function withLlmRateLimit<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 2000;

  return queue.add(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const status = extractStatus(err);
        const retryable = isRetryableStatus(status) || status === undefined;
        if (!retryable || attempt === retries) break;
        const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new LlmRateLimitError(String(lastErr));
  }) as Promise<T>;
}
