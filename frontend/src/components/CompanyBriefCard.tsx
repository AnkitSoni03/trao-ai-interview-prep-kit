import type { Kit } from "@/lib/types";

export function CompanyBriefCard({
  kit,
  onEditField,
  onRegenerate,
  regenerating,
}: {
  kit: Kit;
  onEditField: (updater: (k: Kit) => Kit) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">
          Company brief
          {kit.source.company ? <span className="text-neutral-500"> · {kit.source.company}</span> : null}
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

      <label className="flex flex-col gap-1 text-sm">
        Summary
        <textarea
          rows={3}
          value={kit.company_brief.summary}
          onChange={(e) =>
            onEditField((k) => ({
              ...k,
              company_brief: { ...k.company_brief, summary: e.target.value },
            }))
          }
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        What they do
        <textarea
          rows={3}
          value={kit.company_brief.what_they_do}
          onChange={(e) =>
            onEditField((k) => ({
              ...k,
              company_brief: { ...k.company_brief, what_they_do: e.target.value },
            }))
          }
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      {kit.company_brief.sources.length > 0 && (
        <details className="mt-3 text-xs text-neutral-500">
          <summary className="cursor-pointer">{kit.company_brief.sources.length} source(s)</summary>
          <ul className="mt-1 list-disc pl-5">
            {kit.company_brief.sources.map((s) => (
              <li key={s} className="truncate">
                <a href={s} target="_blank" rel="noreferrer" className="underline">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
