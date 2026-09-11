import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env.js";
import { withLlmRateLimit } from "./rateLimiter.js";

export class LlmNotConfiguredError extends Error {
  code = "LLM_NOT_CONFIGURED" as const;
  constructor() {
    super("GEMINI_API_KEY is not set. Add it to backend/.env to enable generation.");
  }
}

export class LlmInvalidJsonError extends Error {
  code = "LLM_INVALID_JSON" as const;
}

/**
 * Smaller/"lite" models sometimes ignore an object wrapper we asked for and return the bare
 * array instead (e.g. `[...]` instead of `{ "questions": [...] }`). Rather than burn a retry
 * (and free-tier quota) on that, detect the single-array-field-object shape and wrap the array
 * ourselves before validating.
 */
function coerceForSchema(raw: unknown, schema: z.ZodTypeAny): unknown {
  if (!Array.isArray(raw) || !(schema instanceof z.ZodObject)) return raw;
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const keys = Object.keys(shape);
  if (keys.length === 1 && shape[keys[0]] instanceof z.ZodArray) {
    return { [keys[0]]: raw };
  }
  return raw;
}

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!env.GEMINI_API_KEY) throw new LlmNotConfiguredError();
  if (!client) client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Asks Gemini for a JSON response, parses it, and validates it against `schema`. Retries a
 * couple of times on invalid JSON OR a validation failure (Section 10: "the model returns
 * invalid JSON or an incomplete kit" must be handled, not crash the run) on top of the
 * rate-limit retry already applied around the network call itself.
 */
export async function generateJson<S extends z.ZodTypeAny>(params: {
  systemInstruction: string;
  prompt: string;
  schema: S;
  jsonAttempts?: number;
}): Promise<z.infer<S>> {
  const { systemInstruction, prompt, schema, jsonAttempts = 2 } = params;
  const model = getClient().getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction,
    generationConfig: { responseMimeType: "application/json" },
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt < jsonAttempts; attempt++) {
    const result = await withLlmRateLimit(() => model.generateContent(prompt));
    const text = result.response.text();
    try {
      const parsedJson = JSON.parse(stripCodeFence(text));
      const validated = schema.safeParse(coerceForSchema(parsedJson, schema));
      if (validated.success) return validated.data;
      lastErr = validated.error;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new LlmInvalidJsonError(
    `Model did not return a validly-shaped JSON response after ${jsonAttempts} attempt(s): ${String(lastErr)}`,
  );
}
