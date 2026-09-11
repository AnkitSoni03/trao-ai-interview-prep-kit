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
import { IconAlert, IconArrowRight, IconRefresh } from "@/components/icons";

function FailedView({ record, onRetry, retrying }: { record: KitRecord; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="card-raised flex flex-col items-center gap-4 border-danger/30 bg-danger-soft p-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger/15 text-danger">
        <IconAlert className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-danger">Generation failed</p>
        <p className="mt-1 max-w-md text-sm text-danger/90">
          {record.error?.message ?? "Something went wrong while generating this kit."}
        </p>
      </div>
      {record.error?.code && (
        <code className="rounded-md bg-danger/10 px-2 py-1 text-xs text-danger">{record.error.code}</code>
      )}
      <button type="button" onClick={onRetry} disabled={retrying} className="btn btn-primary mt-1">
        <IconRefresh className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker mb-1">{kit.source.company || "Kit"}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{kit.role.title || "Untitled role"}</h1>
          <a
            href={kit.source.company_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm text-muted hover:text-accent hover:underline"
          >
            {kit.source.company_url}
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full ${saving ? "animate-pulse bg-warning" : "bg-success"}`} />
            {saving ? "Saving…" : "Saved"}
          </span>
          <Link href={`/kits/${id}/practice`} className="btn btn-primary">
            Practice
            <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {saveError && (
        <p className="flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <IconAlert className="h-3.5 w-3.5 shrink-0" />
          {saveError}
        </p>
      )}

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
        <p className="text-sm text-muted">This kit doesn&apos;t exist, or isn&apos;t yours.</p>
        <button type="button" onClick={() => router.push("/")} className="btn btn-secondary">
          Back to your kits
        </button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2.5 py-16 text-sm text-muted" role="status">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        Loading…
      </div>
    );
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
