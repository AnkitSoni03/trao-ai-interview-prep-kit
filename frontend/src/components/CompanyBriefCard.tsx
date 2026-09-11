import type { Kit } from "@/lib/types";
import { IconRefresh } from "./icons";

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
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="kicker mb-1">Company brief</p>
          <h2 className="font-semibold tracking-tight">{kit.source.company || "Company"}</h2>
        </div>
        <button type="button" onClick={onRegenerate} disabled={regenerating} className="btn btn-secondary btn-sm">
          <IconRefresh className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label">Summary</span>
        <textarea
          rows={3}
          value={kit.company_brief.summary}
          onChange={(e) =>
            onEditField((k) => ({
              ...k,
              company_brief: { ...k.company_brief, summary: e.target.value },
            }))
          }
          className="field px-3 py-2 text-sm leading-relaxed"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="label">What they do</span>
        <textarea
          rows={3}
          value={kit.company_brief.what_they_do}
          onChange={(e) =>
            onEditField((k) => ({
              ...k,
              company_brief: { ...k.company_brief, what_they_do: e.target.value },
            }))
          }
          className="field px-3 py-2 text-sm leading-relaxed"
        />
      </label>

      {kit.company_brief.sources.length > 0 && (
        <details className="mt-4 text-xs text-muted">
          <summary className="cursor-pointer font-medium hover:text-foreground">
            {kit.company_brief.sources.length} source(s)
          </summary>
          <ul className="mt-2 flex flex-col gap-1 border-l border-border pl-3">
            {kit.company_brief.sources.map((s) => (
              <li key={s} className="truncate">
                <a href={s} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
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
