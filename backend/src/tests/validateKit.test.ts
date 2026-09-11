import { describe, expect, it } from "vitest";
import { validateKit } from "../pipeline/validateKit.js";
import type { Kit } from "../types/kit.js";

function baseKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.example.com",
      role: "Backend Engineer",
      location: "",
      jd_chars: 120,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: { summary: "s", what_they_do: "w", sources: [] },
    role: {
      title: "Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Build things"],
      requirements: [{ id: "r1", text: "5+ years with React", kind: "technical", priority: "must" }],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "?",
        answer_outline: "!",
        difficulty: 2,
      },
    ],
    flashcards: [{ id: "f1", front: "?", back: "!", requirement_ids: ["r1"] }],
    schedule: { days_available: 1, days: [{ day: 1, focus: "Technical", question_ids: ["q1"], minutes: 30 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe("validateKit", () => {
  it("accepts a well-formed kit", () => {
    const result = validateKit(baseKit());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a schedule that references a question id that does not exist", () => {
    const kit = baseKit();
    kit.schedule.days[0].question_ids.push("q-does-not-exist");
    const result = validateKit(kit);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("q-does-not-exist"))).toBe(true);
  });

  it("rejects a question that references a requirement id that does not exist", () => {
    const kit = baseKit();
    kit.questions[0].requirement_ids.push("r-does-not-exist");
    const result = validateKit(kit);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("r-does-not-exist"))).toBe(true);
  });

  it("rejects a non-integer minutes value", () => {
    const kit = baseKit();
    // minutes is typed as `number`, not a TS integer type - the constraint is a runtime zod check
    kit.schedule.days[0].minutes = 12.5;
    const result = validateKit(kit).ok;
    expect(result).toBe(false);
  });

  it("rejects a difficulty outside 1-3", () => {
    const kit = baseKit();
    // @ts-expect-error deliberately invalid for the test
    kit.questions[0].difficulty = 5;
    expect(validateKit(kit).ok).toBe(false);
  });

  it("rejects a mismatch between days_available and the number of schedule day entries", () => {
    const kit = baseKit();
    kit.schedule.days_available = 3;
    const result = validateKit(kit);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("days_available"))).toBe(true);
  });
});
