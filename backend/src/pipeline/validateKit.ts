import { z } from "zod";

const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
  origin: z.enum(["generated", "edited", "user-added"]).optional(),
});

const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  origin: z.enum(["generated", "edited", "user-added"]).optional(),
  pinned: z.boolean().optional(),
});

const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  origin: z.enum(["generated", "edited", "user-added"]).optional(),
  pinned: z.boolean().optional(),
});

const scheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative(),
});

export const kitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().nonnegative(),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: z.object({
    days_available: z.number().int().positive(),
    days: z.array(scheduleDaySchema),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().nonnegative(),
  }),
});

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validates a generated kit against Appendix A's structure AND the cross-reference rules
 * the brief calls out explicitly: every question/flashcard requirement_id must point at a
 * requirement that exists, and every schedule question_id must point at a question that
 * exists. Run before persisting (Section 13) and before writing a batch result "ok".
 */
export function validateKit(candidate: unknown): ValidationResult {
  const parsed = kitSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }

  const kit = parsed.data;
  const errors: string[] = [];

  const requirementIds = new Set(kit.role.requirements.map((r) => r.id));
  const questionIds = new Set(kit.questions.map((q) => q.id));

  for (const q of kit.questions) {
    for (const rid of q.requirement_ids) {
      if (!requirementIds.has(rid)) errors.push(`question ${q.id} references unknown requirement ${rid}`);
    }
  }
  for (const f of kit.flashcards) {
    for (const rid of f.requirement_ids) {
      if (!requirementIds.has(rid)) errors.push(`flashcard ${f.id} references unknown requirement ${rid}`);
    }
  }
  for (const day of kit.schedule.days) {
    for (const qid of day.question_ids) {
      if (!questionIds.has(qid)) errors.push(`schedule day ${day.day} references unknown question ${qid}`);
    }
  }
  if (kit.schedule.days.length !== kit.schedule.days_available) {
    errors.push(
      `schedule has ${kit.schedule.days.length} day entries but days_available is ${kit.schedule.days_available}`,
    );
  }
  for (const rid of kit.coverage.uncovered_requirement_ids) {
    if (!requirementIds.has(rid)) errors.push(`coverage references unknown requirement ${rid}`);
  }

  return { ok: errors.length === 0, errors };
}
