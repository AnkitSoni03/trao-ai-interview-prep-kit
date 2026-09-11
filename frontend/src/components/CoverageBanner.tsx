import type { Kit } from "@/lib/types";
import { checkCoverage } from "@/lib/checkCoverage";

export function CoverageBanner({ kit }: { kit: Kit }) {
  // Computed live from the current question set, not the (possibly stale, if the user has
  // since edited/deleted questions) coverage.uncovered_requirement_ids the server persisted.
  const uncovered = checkCoverage(kit.role.requirements, kit.questions);
  if (uncovered.length === 0) {
    return (
      <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
        Every requirement has at least one question covering it ({kit.coverage.passes} pass
        {kit.coverage.passes === 1 ? "" : "es"}).
      </div>
    );
  }

  const byId = new Map(kit.role.requirements.map((r) => [r.id, r]));
  return (
    <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-300">
      <p className="font-medium">{uncovered.length} requirement(s) still have no question:</p>
      <ul className="mt-1 list-disc pl-5">
        {uncovered.map((id) => (
          <li key={id}>{byId.get(id)?.text ?? id}</li>
        ))}
      </ul>
    </div>
  );
}
