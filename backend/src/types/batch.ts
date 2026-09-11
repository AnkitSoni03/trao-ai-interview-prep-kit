// Batch entry point shapes — must match Appendix B exactly.
import type { Kit } from "./kit.js";

export interface BatchCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export type BatchErrorCode =
  | "COMPANY_UNREACHABLE"
  | "INVALID_INPUT"
  | "LLM_FAILURE"
  | "VALIDATION_FAILED"
  | "UNKNOWN";

export interface BatchError {
  code: BatchErrorCode;
  message: string;
}

export interface BatchKitResult {
  id: string;
  status: "ok" | "failed";
  kit: Kit | null;
  error: BatchError | null;
}

export interface BatchOutput {
  version: string;
  generated_at: string;
  kits: BatchKitResult[];
}
