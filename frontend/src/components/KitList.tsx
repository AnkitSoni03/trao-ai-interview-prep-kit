"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { KitRecord } from "@/lib/types";
import { IconArrowRight, IconLayers, IconTrash } from "./icons";

const STATUS_LABEL: Record<KitRecord["status"], string> = {
  pending: "Queued",
  researching: "Researching…",
  generating: "Generating…",
  checking_coverage: "Checking coverage…",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_DOT: Record<KitRecord["status"], string> = {
  pending: "bg-muted",
  researching: "bg-warning",
  generating: "bg-warning",
  checking_coverage: "bg-warning",
  ready: "bg-success",
  failed: "bg-danger",
};

const STATUS_CLASS: Record<KitRecord["status"], string> = {
  pending: "bg-background text-muted",
  researching: "bg-warning-soft text-warning",
  generating: "bg-warning-soft text-warning",
  checking_coverage: "bg-warning-soft text-warning",
  ready: "bg-success-soft text-success",
  failed: "bg-danger-soft text-danger",
};

const PULSE_STATUSES = new Set<KitRecord["status"]>(["pending", "researching", "generating", "checking_coverage"]);

export function KitList({ kits, onChange }: { kits: KitRecord[]; onChange: () => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deleteKit(id);
      onChange();
    } finally {
      setDeletingId(null);
    }
  }

  if (kits.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 border-dashed px-6 py-10 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted">
          <IconLayers className="h-5 w-5" />
        </span>
        <p className="text-sm text-muted">No kits yet. Paste a job description above to generate your first one.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {kits.map((k) => (
        <li key={k._id} className="card group flex items-center gap-3 p-3.5 transition-shadow hover:shadow-md">
          <Link href={`/kits/${k._id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {k.kit?.role.title || k.kit?.source.company || "Untitled role"}
                {k.kit?.source.company ? <span className="font-normal text-muted"> · {k.kit.source.company}</span> : null}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {k.input.days} day{k.input.days === 1 ? "" : "s"} to prepare · {new Date(k.createdAt).toLocaleString()}
              </p>
            </div>
            <IconArrowRight className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <span className={`badge shrink-0 ${STATUS_CLASS[k.status]}`}>
            <span className={`badge-dot ${STATUS_DOT[k.status]} ${PULSE_STATUSES.has(k.status) ? "animate-pulse" : ""}`} />
            {STATUS_LABEL[k.status]}
          </span>
          <button
            type="button"
            onClick={() => handleDelete(k._id)}
            disabled={deletingId === k._id}
            aria-label="Delete kit"
            className="btn btn-danger-ghost btn-sm shrink-0"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
