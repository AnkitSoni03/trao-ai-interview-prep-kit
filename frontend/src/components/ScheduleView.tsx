import type { Kit } from "@/lib/types";
import { IconRefresh } from "./icons";

export function ScheduleView({
  kit,
  onRegenerate,
  regenerating,
}: {
  kit: Kit;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const questionById = new Map(kit.questions.map((q) => [q.id, q]));

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="kicker mb-1">Study schedule</p>
          <h2 className="font-semibold tracking-tight">
            {kit.schedule.days_available} day{kit.schedule.days_available === 1 ? "" : "s"} to prepare
          </h2>
        </div>
        <button type="button" onClick={onRegenerate} disabled={regenerating} className="btn btn-secondary btn-sm">
          <IconRefresh className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      <ol className="flex flex-col gap-2.5">
        {kit.schedule.days.map((day) => (
          <li key={day.day} className="card flex items-start gap-4 p-4">
            <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-soft py-2 text-accent">
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Day</span>
              <span className="text-lg font-bold leading-none">{day.day}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{day.focus}</span>
                <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted">{day.minutes} min</span>
              </div>
              {day.question_ids.length === 0 ? (
                <p className="text-xs text-muted">No new material — light review.</p>
              ) : (
                <ul className="list-disc pl-4 text-xs text-muted">
                  {day.question_ids.map((id) => (
                    <li key={id}>
                      {questionById.get(id)?.prompt ?? id}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
