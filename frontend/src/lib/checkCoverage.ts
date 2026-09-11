import type { Question, Requirement } from "./types";

/**
 * Mirrors backend/src/pipeline/checkCoverage.ts. Used to show a live coverage banner that
 * reflects the user's own edits (add/delete/move a question) immediately, rather than only
 * the coverage the server computed at generation time, which can go stale the moment someone
 * deletes the one question covering a requirement.
 */
export function checkCoverage(requirements: Requirement[], questions: Question[]): string[] {
  const covered = new Set<string>();
  for (const q of questions) for (const id of q.requirement_ids) covered.add(id);
  return requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
}
