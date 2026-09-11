"use client";

import { useState } from "react";
import { api, ApiError, type CreateKitInput } from "@/lib/api";
import { IconAlert, IconArrowRight, IconFile, IconSpark } from "./icons";

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
    <div className="card-raised p-5 sm:p-6">
      <div className="mb-5 flex gap-1 rounded-lg bg-background p-1 text-sm" role="tablist" aria-label="Create kit mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "single"}
          onClick={() => setMode("single")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
            mode === "single" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          Single role
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "bulk"}
          onClick={() => setMode("bulk")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
            mode === "bulk" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          Upload multiple
        </button>
      </div>

      {mode === "single" ? (
        <form onSubmit={handleSingleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Job description</span>
            <textarea
              required
              rows={6}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              className="field px-3 py-2.5 font-mono text-xs leading-relaxed"
            />
          </label>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="label">Company website</span>
              <input
                type="url"
                required
                placeholder="https://example.com"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                className="field px-3 py-2 text-sm"
              />
            </label>
            <label className="flex w-full flex-col gap-1.5 sm:w-32">
              <span className="label">Days to prepare</span>
              <input
                type="number"
                min={1}
                max={365}
                required
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="field px-3 py-2 text-sm"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn btn-primary self-start">
            {submitting ? (
              "Starting…"
            ) : (
              <>
                <IconSpark className="h-4 w-4" />
                Generate prep kit
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Upload a JSON file: an array of{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
              {"{ jd, company_url, days? }"}
            </code>
            . Rows without their own <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">days</code> use the default below.
          </p>
          <label className="field flex cursor-pointer flex-col items-center gap-2 border-dashed px-4 py-6 text-center transition-colors hover:border-accent">
            <IconFile className="h-6 w-6 text-muted" />
            <span className="text-sm">
              {bulkFile ? (
                <span className="font-medium text-foreground">{bulkFile.name}</span>
              ) : (
                <>
                  <span className="font-medium text-accent">Choose a file</span>{" "}
                  <span className="text-muted">or drag it here</span>
                </>
              )}
            </span>
            <input
              type="file"
              accept="application/json"
              required
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          <label className="flex w-32 flex-col gap-1.5">
            <span className="label">Default days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="field px-3 py-2 text-sm"
            />
          </label>
          {error && (
            <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn btn-primary self-start">
            {submitting ? (
              "Starting…"
            ) : (
              <>
                Generate kits
                <IconArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
