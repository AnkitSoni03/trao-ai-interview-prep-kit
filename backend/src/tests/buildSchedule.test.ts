import { describe, expect, it } from "vitest";
import { buildSchedule } from "../pipeline/buildSchedule.js";
import type { Question, Requirement } from "../types/kit.js";

function req(id: string, priority: "must" | "nice"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(id: string, requirement_ids: string[], difficulty: 1 | 2 | 3 = 2): Question {
  return { id, requirement_ids, category: "technical", prompt: "p", answer_outline: "a", difficulty };
}

describe("buildSchedule", () => {
  it("produces exactly the number of days requested", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1"])];
    for (const days of [1, 3, 5, 14]) {
      const schedule = buildSchedule({ questions, requirements, daysAvailable: days });
      expect(schedule.days_available).toBe(days);
      expect(schedule.days).toHaveLength(days);
    }
  });

  it("every day has an integer minutes value", () => {
    const requirements = [req("r1", "must"), req("r2", "must"), req("r3", "nice")];
    const questions = [q("q1", ["r1"], 3), q("q2", ["r2"], 2), q("q3", ["r3"], 1)];
    const schedule = buildSchedule({ questions, requirements, daysAvailable: 3 });
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
    }
  });

  it("schedules every question exactly once across all days", () => {
    const requirements = [req("r1", "must"), req("r2", "must"), req("r3", "nice")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])];
    const schedule = buildSchedule({ questions, requirements, daysAvailable: 2 });
    const scheduledIds = schedule.days.flatMap((d) => d.question_ids).sort();
    expect(scheduledIds).toEqual(["q1", "q2", "q3"]);
  });

  it("places must-have and harder questions on earlier days than nice-to-have/easier ones", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const questions = [q("hard-must", ["r1"], 3), q("easy-nice", ["r2"], 1)];
    const schedule = buildSchedule({ questions, requirements, daysAvailable: 2 });
    expect(schedule.days[0].question_ids).toContain("hard-must");
    expect(schedule.days[1].question_ids).toContain("easy-nice");
  });

  it("handles a 1-day schedule by packing everything into that single day", () => {
    const requirements = [req("r1", "must"), req("r2", "must")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    const schedule = buildSchedule({ questions, requirements, daysAvailable: 1 });
    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].question_ids.sort()).toEqual(["q1", "q2"]);
  });

  it("handles a schedule with far more days than questions without dropping any day", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1"])];
    const schedule = buildSchedule({ questions, requirements, daysAvailable: 60 });
    expect(schedule.days).toHaveLength(60);
    const totalScheduled = schedule.days.flatMap((d) => d.question_ids);
    expect(totalScheduled).toEqual(["q1"]);
    expect(schedule.days.filter((d) => d.question_ids.length === 0).every((d) => d.minutes === 0)).toBe(true);
  });
});
