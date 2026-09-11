import type { Question, Requirement, Schedule, ScheduleDay } from "../types/kit.js";

const MINUTES_BY_DIFFICULTY: Record<1 | 2 | 3, number> = { 1: 15, 2: 25, 3: 40 };

function priorityWeight(question: Question, requirementById: Map<string, Requirement>): number {
  let weight = 0;
  for (const id of question.requirement_ids) {
    const req = requirementById.get(id);
    if (req?.priority === "must") weight = Math.max(weight, 2);
    else if (req?.priority === "nice") weight = Math.max(weight, 1);
  }
  return weight;
}

/** Splits `total` items across `days` buckets, front-loading the remainder onto earlier days. */
function distributeCounts(total: number, days: number): number[] {
  const base = Math.floor(total / days);
  const remainder = total % days;
  return Array.from({ length: days }, (_, i) => base + (i < remainder ? 1 : 0));
}

function deriveFocus(dayQuestions: Question[], dayIndex: number, totalDays: number): string {
  if (dayQuestions.length === 0) {
    return dayIndex === totalDays - 1 ? "Final light review / rest" : "Buffer / light review";
  }
  const categoryCounts = new Map<string, number>();
  for (const q of dayQuestions) categoryCounts.set(q.category, (categoryCounts.get(q.category) ?? 0) + 1);
  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category]) => category);
  return `Focus: ${topCategories.join(" + ")}`;
}

/**
 * Allocates every generated question across exactly `daysAvailable` days. This is pure
 * arithmetic (Section 8: "This is arithmetic and allocation. It belongs in your code, not
 * in a prompt") - no model call. Questions are sorted must-have-and-harder-first so that
 * material lands earlier in the schedule rather than the night before the interview.
 */
export function buildSchedule(params: {
  questions: Question[];
  requirements: Requirement[];
  daysAvailable: number;
}): Schedule {
  const { questions, requirements, daysAvailable } = params;
  const days = Math.max(1, Math.trunc(daysAvailable));

  const requirementById = new Map(requirements.map((r) => [r.id, r]));
  const sorted = [...questions].sort((a, b) => {
    const weightDiff = priorityWeight(b, requirementById) - priorityWeight(a, requirementById);
    if (weightDiff !== 0) return weightDiff;
    return b.difficulty - a.difficulty;
  });

  const counts = distributeCounts(sorted.length, days);
  const scheduleDays: ScheduleDay[] = [];
  let cursor = 0;

  for (let i = 0; i < days; i++) {
    const count = counts[i];
    const dayQuestions = sorted.slice(cursor, cursor + count);
    cursor += count;

    const minutes = dayQuestions.reduce((sum, q) => sum + MINUTES_BY_DIFFICULTY[q.difficulty], 0);

    scheduleDays.push({
      day: i + 1,
      focus: deriveFocus(dayQuestions, i, days),
      question_ids: dayQuestions.map((q) => q.id),
      minutes,
    });
  }

  return { days_available: days, days: scheduleDays };
}
