import type { Kit } from "@/lib/types";
import { checkCoverage } from "@/lib/checkCoverage";
import { IconAlert, IconCheck } from "./icons";

export function CoverageBanner({ kit }: { kit: Kit }) {
  // Computed live from the current question set, not the (possibly stale, if the user has
  // since edited/deleted questions) coverage.uncovered_requirement_ids the server persisted.
  const uncovered = checkCoverage(kit.role.requirements, kit.questions);
  if (uncovered.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <IconCheck className="h-3 w-3" />
        </span>
        Every requirement has at least one question covering it ({kit.coverage.passes} pass
        {kit.coverage.passes === 1 ? "" : "es"}).
      </div>
    );
  }

  const byId = new Map(kit.role.requirements.map((r) => [r.id, r]));
  return (
    <div className="flex gap-2.5 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
      <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{uncovered.length} requirement(s) still have no question:</p>
        <ul className="mt-1 list-disc pl-4 opacity-90">
          {uncovered.map((id) => (
            <li key={id}>{byId.get(id)?.text ?? id}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
