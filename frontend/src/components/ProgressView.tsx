import type { KitRecord } from "@/lib/types";

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
    <div className="flex flex-col items-center gap-6 rounded-lg border border-neutral-200 p-10 text-center dark:border-neutral-800" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
      <div>
        <p className="font-medium">Generating your prep kit…</p>
        <p className="mt-1 text-sm text-neutral-500">{record.progress.message || "Getting started…"}</p>
      </div>
      <ol className="flex flex-col gap-1.5 text-left text-sm">
        {STEPS.filter((s) => s.key !== "done").map((s, i) => {
          const done = currentIndex > i || (currentIndex === -1 && false);
          const active = s.key === record.progress.step;
          return (
            <li key={s.key} className={`flex items-center gap-2 ${active ? "font-medium" : "text-neutral-400"}`}>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  done ? "bg-green-500" : active ? "bg-amber-500" : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              />
              {s.label}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-neutral-400">This can take 30-90+ seconds.</p>
    </div>
  );
}
