import { GoogleGenerativeAI } from "@google/generative-ai";
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
 * Asks Gemini for a JSON response and parses it. Retries a couple of times on invalid JSON
 * (Section 10: "the model returns invalid JSON or an incomplete kit" must be handled, not crash
 * the run) on top of the rate-limit retry already applied around the network call itself.
 */
export async function generateJson<T = unknown>(params: {
  systemInstruction: string;
  prompt: string;
  jsonAttempts?: number;
}): Promise<T> {
  const { systemInstruction, prompt, jsonAttempts = 2 } = params;
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
      return JSON.parse(stripCodeFence(text)) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new LlmInvalidJsonError(`Model did not return valid JSON after ${jsonAttempts} attempt(s): ${String(lastErr)}`);
}
