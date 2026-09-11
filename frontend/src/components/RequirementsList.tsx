import type { Kit } from "@/lib/types";

export function RequirementsList({ kit }: { kit: Kit }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-1 font-semibold">
        {kit.role.title || "Role"}
        {kit.role.seniority ? <span className="text-neutral-500"> · {kit.role.seniority}</span> : null}
      </h2>

      {kit.role.responsibilities.length > 0 && (
        <ul className="mb-3 list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          {kit.role.responsibilities.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Requirements</h3>
      {kit.role.requirements.length === 0 ? (
        <p className="text-sm text-neutral-500">
          The description didn&apos;t give us much to extract requirements from.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {kit.role.requirements.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  r.priority === "must"
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                {r.priority}
              </span>
              <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
                {r.kind}
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
