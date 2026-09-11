import type { Kit } from "@/lib/types";

export function RequirementsList({ kit }: { kit: Kit }) {
  return (
    <section className="card p-5 sm:p-6">
      <p className="kicker mb-1">Role</p>
      <h2 className="mb-1 font-semibold tracking-tight">
        {kit.role.title || "Role"}
        {kit.role.seniority ? <span className="font-normal text-muted"> · {kit.role.seniority}</span> : null}
      </h2>

      {kit.role.responsibilities.length > 0 && (
        <ul className="mb-4 mt-2 list-disc pl-5 text-sm text-muted">
          {kit.role.responsibilities.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      <h3 className="label mb-2 mt-5 border-t border-border pt-4">Requirements</h3>
      {kit.role.requirements.length === 0 ? (
        <p className="text-sm text-muted">
          The description didn&apos;t give us much to extract requirements from.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {kit.role.requirements.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <span
                className={`badge mt-0.5 shrink-0 ${
                  r.priority === "must" ? "bg-danger-soft text-danger" : "bg-background text-muted"
                }`}
              >
                {r.priority}
              </span>
              <span className="badge mt-0.5 shrink-0 bg-accent-soft text-accent">{r.kind}</span>
              <span className="pt-0.5">{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
