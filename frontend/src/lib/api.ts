import type { Confidence, Kit, KitRecord, QuestionCategory, User } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. a network-level failure page)
  }

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? res.statusText);
  }

  return body as T;
}

export interface CreateKitInput {
  jd: string;
  company_url: string;
  days: number;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User | null }>("/api/auth/me"),

  listKits: () => request<{ kits: KitRecord[] }>("/api/kits"),
  getKit: (id: string) => request<{ kit: KitRecord }>(`/api/kits/${id}`),
  createKit: (input: CreateKitInput) =>
    request<{ kit: KitRecord }>("/api/kits", { method: "POST", body: JSON.stringify(input) }),
  createKitsBulk: (inputs: CreateKitInput[]) =>
    request<{ kits: KitRecord[] }>("/api/kits/bulk", { method: "POST", body: JSON.stringify(inputs) }),
  updateKit: (id: string, kit: Kit) =>
    request<{ kit: KitRecord }>(`/api/kits/${id}`, { method: "PATCH", body: JSON.stringify(kit) }),
  deleteKit: (id: string) => request<void>(`/api/kits/${id}`, { method: "DELETE" }),
  regenerateSection: (id: string, section: "company_brief" | "schedule" | QuestionCategory) =>
    request<{ kit: Kit }>(`/api/kits/${id}/regenerate`, { method: "POST", body: JSON.stringify({ section }) }),
  retryKit: (id: string) => request<{ kit: KitRecord }>(`/api/kits/${id}/retry`, { method: "POST" }),
  recordPractice: (id: string, flashcardId: string, confidence: Confidence) =>
    request<{ kit: Kit }>(`/api/kits/${id}/practice`, {
      method: "POST",
      body: JSON.stringify({ flashcardId, confidence }),
    }),
};
