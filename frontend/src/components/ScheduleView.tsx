import type { Kit } from "@/lib/types";

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
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">
          Study schedule ({kit.schedule.days_available} day{kit.schedule.days_available === 1 ? "" : "s"})
        </h2>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      <ol className="flex flex-col gap-2">
        {kit.schedule.days.map((day) => (
          <li key={day.day} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">
                Day {day.day} · {day.focus}
              </span>
              <span className="text-neutral-500">{day.minutes} min</span>
            </div>
            {day.question_ids.length === 0 ? (
              <p className="text-xs text-neutral-500">No new material — light review.</p>
            ) : (
              <ul className="list-disc pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                {day.question_ids.map((id) => (
                  <li key={id} className="truncate">
                    {questionById.get(id)?.prompt ?? id}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
