"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { api, ApiError } from "@/lib/api";
import type { Confidence, Kit, KitRecord } from "@/lib/types";
import { IconAlert, IconArrowRight, IconSpark } from "@/components/icons";

const CONFIDENCE_LABEL: Record<Confidence, string> = { 1: "Low", 2: "Medium", 3: "High" };
const CONFIDENCE_BTN: Record<Confidence, string> = {
  1: "bg-danger text-white hover:opacity-90",
  2: "bg-warning text-white hover:opacity-90",
  3: "bg-success text-white hover:opacity-90",
};
const CONFIDENCE_BAR: Record<number, string> = { 0: "bg-border-strong", 1: "bg-danger", 2: "bg-warning", 3: "bg-success" };

function WeakSpots({ kit }: { kit: Kit }) {
  const practice = kit.practice ?? {};

  const rows = kit.role.requirements
    .map((req) => {
      const cards = kit.flashcards.filter((f) => f.requirement_ids.includes(req.id));
      const confidences = cards.map((c) => practice[c.id]?.confidence).filter((c): c is Confidence => c !== undefined);
      const avg = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
      return { req, avg, reviewed: confidences.length, total: cards.length };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => (a.avg ?? -1) - (b.avg ?? -1));

  if (rows.length === 0) return null;

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-1.5">
        <IconSpark className="h-4 w-4 text-accent" />
        <h2 className="font-semibold tracking-tight">Weak spots</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Requirements ranked by your lowest confidence first — review these before anything else.
      </p>
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map(({ req, avg, reviewed, total }) => (
          <li key={req.id}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate">{req.text}</span>
              <span className="shrink-0 text-xs text-muted">
                {avg === null ? "not reviewed" : `${avg.toFixed(1)}/3`} · {reviewed}/{total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
              <div
                className={`h-full rounded-full transition-all ${CONFIDENCE_BAR[Math.round(avg ?? 0)]}`}
                style={{ width: avg === null ? "6%" : `${(avg / 3) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PracticeSession({ id, kit: initialKit }: { id: string; kit: Kit }) {
  const [kit, setKit] = useState(initialKit);
  const [sessionOrder] = useState<string[]>(() =>
    [...kit.flashcards]
      .sort((a, b) => (kit.practice?.[a.id]?.confidence ?? 0) - (kit.practice?.[b.id]?.confidence ?? 0))
      .map((f) => f.id),
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cardId = sessionOrder[index];
  const card = kit.flashcards.find((f) => f.id === cardId);
  const reviewedCount = Object.keys(kit.practice ?? {}).length;

  async function handleRate(confidence: Confidence) {
    if (!card) return;
    setSubmitting(true);
    try {
      const res = await api.recordPractice(id, card.id, confidence);
      setKit(res.kit);
    } catch {
      // Non-fatal: keep going locally even if the save failed, so the session isn't blocked.
    } finally {
      setSubmitting(false);
      setRevealed(false);
      setIndex((i) => Math.min(i + 1, sessionOrder.length));
    }
  }

  if (kit.flashcards.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 border-dashed px-6 py-10 text-center">
        <p className="text-sm text-muted">This kit has no flashcards yet.</p>
      </div>
    );
  }

  const sessionDone = index >= sessionOrder.length;
  const progressPct = Math.round((Math.min(index, sessionOrder.length) / sessionOrder.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-muted">
          <span>
            {reviewedCount} of {kit.flashcards.length} flashcards covered
          </span>
          <span>
            Card {Math.min(index + 1, sessionOrder.length)} of {sessionOrder.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {sessionDone || !card ? (
        <div className="card-raised flex flex-col items-center gap-4 px-10 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
            <IconSpark className="h-5 w-5" />
          </span>
          <p className="font-semibold tracking-tight">Session complete</p>
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setRevealed(false);
            }}
            className="btn btn-primary"
          >
            Go again
            <IconArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="card-raised flex min-h-[20rem] flex-col items-center justify-center gap-7 px-10 py-12 text-center">
          <p className="max-w-lg text-lg font-medium tracking-tight">{card.front}</p>
          {revealed && (
            <p className="max-w-lg whitespace-pre-wrap rounded-lg bg-background px-4 py-3 text-left text-sm leading-relaxed text-muted">
              {card.back}
            </p>
          )}
          {!revealed ? (
            <button type="button" onClick={() => setRevealed(true)} className="btn btn-primary">
              Show answer
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <p className="label">How confident did you feel?</p>
              <div className="flex gap-2">
                {([1, 2, 3] as Confidence[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleRate(c)}
                    className={`btn disabled:opacity-50 ${CONFIDENCE_BTN[c]}`}
                  >
                    {CONFIDENCE_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <WeakSpots kit={kit} />
    </div>
  );
}

function PracticePageInner() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [record, setRecord] = useState<KitRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getKit(id)
      .then((d) => setRecord(d.kit))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this kit."));
  }, [id]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker mb-1">Practice mode</p>
          <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
        </div>
        <Link href={`/kits/${id}`} className="btn btn-secondary btn-sm">
          Back to builder
        </Link>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <IconAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {!record && !error && (
        <div className="flex items-center gap-2.5 py-10 text-sm text-muted" role="status">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
          Loading…
        </div>
      )}
      {record && !record.kit && <p className="text-sm text-muted">This kit isn&apos;t ready yet.</p>}
      {record?.kit && <PracticeSession id={id} kit={record.kit} />}
    </div>
  );
}

export default function PracticePage() {
  return (
    <AuthGuard>
      <PracticePageInner />
    </AuthGuard>
  );
}
