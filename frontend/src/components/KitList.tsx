"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { KitRecord } from "@/lib/types";

const STATUS_LABEL: Record<KitRecord["status"], string> = {
  pending: "Queued",
  researching: "Researching…",
  generating: "Generating…",
  checking_coverage: "Checking coverage…",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_CLASS: Record<KitRecord["status"], string> = {
  pending: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  researching: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  generating: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  checking_coverage: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

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
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        No kits yet. Paste a job description above to generate your first one.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {kits.map((k) => (
        <li
          key={k._id}
          className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <Link href={`/kits/${k._id}`} className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {k.kit?.role.title || k.kit?.source.company || "Untitled role"}
              {k.kit?.source.company ? (
                <span className="text-neutral-500"> · {k.kit.source.company}</span>
              ) : null}
            </p>
            <p className="text-xs text-neutral-500">
              {k.input.days} day{k.input.days === 1 ? "" : "s"} to prepare · {new Date(k.createdAt).toLocaleString()}
            </p>
          </Link>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[k.status]}`}>
            {STATUS_LABEL[k.status]}
          </span>
          <button
            type="button"
            onClick={() => handleDelete(k._id)}
            disabled={deletingId === k._id}
            aria-label="Delete kit"
            className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
