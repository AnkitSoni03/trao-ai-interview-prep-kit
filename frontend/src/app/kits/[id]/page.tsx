"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { ProgressView } from "@/components/ProgressView";
import { CoverageBanner } from "@/components/CoverageBanner";
import { CompanyBriefCard } from "@/components/CompanyBriefCard";
import { RequirementsList } from "@/components/RequirementsList";
import { QuestionsBoard } from "@/components/QuestionsBoard";
import { FlashcardsBoard } from "@/components/FlashcardsBoard";
import { ScheduleView } from "@/components/ScheduleView";
import { api, ApiError } from "@/lib/api";
import { useDebouncedCallback } from "@/lib/useDebouncedCallback";
import type { Kit, KitRecord, QuestionCategory } from "@/lib/types";

function FailedView({ record, onRetry, retrying }: { record: KitRecord; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-10 text-center dark:border-red-900 dark:bg-red-950">
      <p className="font-medium text-red-800 dark:text-red-300">Generation failed</p>
      <p className="max-w-md text-sm text-red-700 dark:text-red-400">
        {record.error?.message ?? "Something went wrong while generating this kit."}
      </p>
      {record.error?.code && (
        <code className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">
          {record.error.code}
        </code>
      )}
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

function Builder({ id, record }: { id: string; record: KitRecord }) {
  const [kit, setKit] = useState<Kit>(record.kit!);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  // Synced synchronously (never via an effect) so back-to-back edits in the same tick each
  // build on the other's result instead of racing on a stale snapshot.
  const kitRef = useRef(kit);

  function applyKit(next: Kit) {
    kitRef.current = next;
    setKit(next);
  }

  const persist = useCallback(
    async (next: Kit) => {
      setSaving(true);
      setSaveError(null);
      try {
        await api.updateKit(id, next);
      } catch (err) {
        setSaveError(err instanceof ApiError ? err.message : "Could not save your changes.");
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  const debouncedPersist = useDebouncedCallback((next: Kit) => persist(next), 700);

  function onEditField(updater: (k: Kit) => Kit) {
    const next = updater(kitRef.current);
    applyKit(next);
    debouncedPersist(next);
  }

  function onStructuralEdit(updater: (k: Kit) => Kit) {
    const next = updater(kitRef.current);
    applyKit(next);
    void persist(next);
  }

  async function handleRegenerate(section: "company_brief" | "schedule" | QuestionCategory) {
    setRegeneratingSection(section);
    setSaveError(null);
    try {
      const res = await api.regenerateSection(id, section);
      applyKit(res.kit);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Regeneration failed.");
    } finally {
      setRegeneratingSection(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{kit.role.title || "Untitled role"}</h1>
          <p className="text-sm text-neutral-500">
            {kit.source.company} ·{" "}
            <a href={kit.source.company_url} target="_blank" rel="noreferrer" className="underline">
              {kit.source.company_url}
            </a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400" aria-live="polite">
            {saving ? "Saving…" : "Saved"}
          </span>
          <Link
            href={`/kits/${id}/practice`}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Practice
          </Link>
        </div>
      </div>

      {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

      <CoverageBanner kit={kit} />
      <CompanyBriefCard
        kit={kit}
        onEditField={onEditField}
        onRegenerate={() => handleRegenerate("company_brief")}
        regenerating={regeneratingSection === "company_brief"}
      />
      <RequirementsList kit={kit} />
      <QuestionsBoard
        kit={kit}
        onEditField={onEditField}
        onStructuralEdit={onStructuralEdit}
        onRegenerate={handleRegenerate}
        regeneratingSection={regeneratingSection}
      />
      <FlashcardsBoard kit={kit} onEditField={onEditField} onStructuralEdit={onStructuralEdit} />
      <ScheduleView
        kit={kit}
        onRegenerate={() => handleRegenerate("schedule")}
        regenerating={regeneratingSection === "schedule"}
      />
    </div>
  );
}

function KitPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [record, setRecord] = useState<KitRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(() => {
    api
      .getKit(id)
      .then((d) => setRecord(d.kit))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!record) return;
    const inFlight = record.status !== "ready" && record.status !== "failed";
    if (!inFlight) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [record, load]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await api.retryKit(id);
      load();
    } finally {
      setRetrying(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p>This kit doesn&apos;t exist, or isn&apos;t yours.</p>
        <button type="button" onClick={() => router.push("/")} className="underline">
          Back to your kits
        </button>
      </div>
    );
  }

  if (!record) {
    return <p className="py-16 text-center text-sm text-neutral-500">Loading…</p>;
  }

  if (record.status === "failed") {
    return <FailedView record={record} onRetry={handleRetry} retrying={retrying} />;
  }

  if (record.status !== "ready" || !record.kit) {
    return <ProgressView record={record} />;
  }

  return <Builder id={id} record={record} />;
}

export default function KitPage() {
  return (
    <AuthGuard>
      <KitPageInner />
    </AuthGuard>
  );
}
