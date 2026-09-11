import type { KitRecord } from "@/lib/types";
import { IconCheck } from "./icons";

const STEPS = [
  { key: "extract_requirements", label: "Reading the job description" },
  { key: "crawl_company", label: "Crawling the company site" },
  { key: "search_discussion", label: "Searching for interview discussion" },
  { key: "company_brief", label: "Writing the brief & generating questions" },
  { key: "coverage_gap_fill", label: "Filling coverage gaps" },
  { key: "done", label: "Done" },
];

export function ProgressView({ record }: { record: KitRecord }) {
  const currentIndex = STEPS.findIndex((s) => s.key === record.progress.step);

  return (
    <div
      className="card-raised flex flex-col items-center gap-6 px-8 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent-soft" />
        <span className="relative h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </span>
      <div>
        <p className="font-semibold tracking-tight">Generating your prep kit…</p>
        <p className="mt-1 text-sm text-muted">{record.progress.message || "Getting started…"}</p>
      </div>
      <ol className="flex flex-col gap-2 text-left text-sm">
        {STEPS.filter((s) => s.key !== "done").map((s, i) => {
          const done = currentIndex > i;
          const active = s.key === record.progress.step;
          return (
            <li key={s.key} className={`flex items-center gap-2.5 ${active ? "font-medium text-foreground" : "text-muted"}`}>
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-success text-white" : active ? "bg-accent-soft" : "bg-background"
                }`}
              >
                {done ? (
                  <IconCheck className="h-2.5 w-2.5" />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-accent" : "bg-border-strong"}`} />
                )}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">This can take 30-90+ seconds.</p>
    </div>
  );
}
