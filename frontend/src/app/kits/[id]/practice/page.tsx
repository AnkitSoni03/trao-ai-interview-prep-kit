"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { api, ApiError } from "@/lib/api";
import type { Confidence, Kit, KitRecord } from "@/lib/types";

const CONFIDENCE_LABEL: Record<Confidence, string> = { 1: "Low", 2: "Medium", 3: "High" };
const CONFIDENCE_COLOR: Record<Confidence, string> = {
  1: "bg-red-600 hover:bg-red-700",
  2: "bg-amber-500 hover:bg-amber-600",
  3: "bg-green-600 hover:bg-green-700",
};

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
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-1 font-semibold">Weak spots</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Requirements ranked by your lowest confidence first — review these before anything else.
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {rows.map(({ req, avg, reviewed, total }) => (
          <li key={req.id} className="flex items-center justify-between gap-3">
            <span className="truncate">{req.text}</span>
            <span className="shrink-0 text-xs text-neutral-500">
              {avg === null ? "not reviewed" : `avg ${avg.toFixed(1)}/3`} · {reviewed}/{total} card{total === 1 ? "" : "s"}
            </span>
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
    return <p className="text-sm text-neutral-500">This kit has no flashcards yet.</p>;
  }

  const sessionDone = index >= sessionOrder.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          {reviewedCount} of {kit.flashcards.length} flashcards covered
        </span>
        <span>
          Card {Math.min(index + 1, sessionOrder.length)} of {sessionOrder.length}
        </span>
      </div>

      {sessionDone || !card ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 p-10 text-center dark:border-neutral-800">
          <p className="font-medium">Session complete 🎉</p>
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setRevealed(false);
            }}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Go again
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 rounded-lg border border-neutral-200 p-10 text-center dark:border-neutral-800">
          <p className="max-w-lg text-lg">{card.front}</p>
          {revealed && (
            <p className="max-w-lg whitespace-pre-wrap text-left text-sm text-neutral-600 dark:text-neutral-400">
              {card.back}
            </p>
          )}
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
            >
              Show answer
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-neutral-500">How confident did you feel?</p>
              <div className="flex gap-2">
                {([1, 2, 3] as Confidence[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleRate(c)}
                    className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${CONFIDENCE_COLOR[c]}`}
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Practice</h1>
        <Link href={`/kits/${id}`} className="text-sm underline underline-offset-2">
          Back to builder
        </Link>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!record && !error && <p className="text-sm text-neutral-500">Loading…</p>}
      {record && !record.kit && <p className="text-sm text-neutral-500">This kit isn&apos;t ready yet.</p>}
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
