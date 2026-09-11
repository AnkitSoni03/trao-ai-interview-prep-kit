import type { Question, Requirement } from "../types/kit.js";

/**
 * Deterministic coverage check: a requirement is covered iff at least one question's
 * requirement_ids includes it. This is arithmetic set comparison, not a model decision
 * (Section 3: "Comparing the extracted requirements against the generated questions to
 * find the gaps is likewise your code's decision to make, not the model's").
 */
export function checkCoverage(requirements: Requirement[], questions: Question[]): string[] {
  const covered = new Set<string>();
  for (const q of questions) {
    for (const id of q.requirement_ids) covered.add(id);
  }
  return requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
}

/** Uncovered requirements, split so the caller can prioritise must-haves when filling gaps. */
export function splitUncoveredByPriority(
  requirements: Requirement[],
  uncoveredIds: string[],
): { mustHave: Requirement[]; niceToHave: Requirement[] } {
  const uncoveredSet = new Set(uncoveredIds);
  const uncovered = requirements.filter((r) => uncoveredSet.has(r.id));
  return {
    mustHave: uncovered.filter((r) => r.priority === "must"),
    niceToHave: uncovered.filter((r) => r.priority === "nice"),
  };
}
