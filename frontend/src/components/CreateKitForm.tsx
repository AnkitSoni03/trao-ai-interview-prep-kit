"use client";

import { useState } from "react";
import { api, ApiError, type CreateKitInput } from "@/lib/api";

export function CreateKitForm({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createKit({ jd, company_url: companyUrl, days });
      setJd("");
      setCompanyUrl("");
      setDays(5);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the kit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bulkFile) {
      setError("Choose a JSON file first.");
      return;
    }
    setSubmitting(true);
    try {
      const text = await bulkFile.text();
      const parsed = JSON.parse(text) as Array<{ jd: string; company_url: string; days?: number }>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('File must contain a JSON array of { "jd": "...", "company_url": "...", "days"?: number }');
      }
      const inputs: CreateKitInput[] = parsed.map((row) => ({
        jd: row.jd,
        company_url: row.company_url,
        days: row.days ?? days,
      }));
      await api.createKitsBulk(inputs);
      setBulkFile(null);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that file.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-4 flex gap-2 text-sm" role="tablist" aria-label="Create kit mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "single"}
          onClick={() => setMode("single")}
          className={`rounded-md px-3 py-1.5 ${mode === "single" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-neutral-300 dark:border-neutral-700"}`}
        >
          Single role
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "bulk"}
          onClick={() => setMode("bulk")}
          className={`rounded-md px-3 py-1.5 ${mode === "bulk" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-neutral-300 dark:border-neutral-700"}`}
        >
          Upload multiple
        </button>
      </div>

      {mode === "single" ? (
        <form onSubmit={handleSingleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Job description
            <textarea
              required
              rows={6}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              className="rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Company website
              <input
                type="url"
                required
                placeholder="https://example.com"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex w-32 flex-col gap-1 text-sm">
              Days to prepare
              <input
                type="number"
                min={1}
                max={365}
                required
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {submitting ? "Starting…" : "Generate prep kit"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Upload a JSON file: an array of{" "}
            <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
              {"{ jd, company_url, days? }"}
            </code>
            . Rows without their own <code>days</code> use the default below.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            File
            <input
              type="file"
              accept="application/json"
              required
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </label>
          <label className="flex w-32 flex-col gap-1 text-sm">
            Default days
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {submitting ? "Starting…" : "Generate kits"}
          </button>
        </form>
      )}
    </div>
  );
}
