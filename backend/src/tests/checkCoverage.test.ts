import { describe, expect, it } from "vitest";
import { checkCoverage, splitUncoveredByPriority } from "../pipeline/checkCoverage.js";
import type { Question, Requirement } from "../types/kit.js";

function req(id: string, priority: "must" | "nice" = "must"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(id: string, requirement_ids: string[]): Question {
  return { id, requirement_ids, category: "technical", prompt: "p", answer_outline: "a", difficulty: 1 };
}

describe("checkCoverage", () => {
  it("returns no gaps when every requirement has at least one question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    expect(checkCoverage(requirements, questions)).toEqual([]);
  });

  it("flags a requirement with zero referencing questions", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"])];
    expect(checkCoverage(requirements, questions)).toEqual(["r2"]);
  });

  it("a question can cover multiple requirements at once", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1", "r2"])];
    expect(checkCoverage(requirements, questions)).toEqual([]);
  });

  it("ignores requirement_ids on questions that don't correspond to any requirement", () => {
    const requirements = [req("r1")];
    const questions = [q("q1", ["r-does-not-exist"])];
    expect(checkCoverage(requirements, questions)).toEqual(["r1"]);
  });

  it("splits uncovered requirements into must-have and nice-to-have", () => {
    const requirements = [req("r1", "must"), req("r2", "nice"), req("r3", "must")];
    const uncovered = checkCoverage(requirements, [q("q1", ["r3"])]);
    const { mustHave, niceToHave } = splitUncoveredByPriority(requirements, uncovered);
    expect(mustHave.map((r) => r.id)).toEqual(["r1"]);
    expect(niceToHave.map((r) => r.id)).toEqual(["r2"]);
  });
});
