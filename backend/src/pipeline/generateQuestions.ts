import { z } from "zod";
import { generateJson } from "./llm/geminiClient.js";
import { wrapUntrustedContent } from "../utils/promptSafety.js";
import type { Question, QuestionCategory, Requirement } from "../types/kit.js";

const llmShape = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string(),
        answer_outline: z.string(),
        difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        requirement_id: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const CATEGORY_INSTRUCTIONS: Record<QuestionCategory, string> = {
  technical:
    "Write hands-on technical interview questions that probe real depth in the listed requirements " +
    "(e.g. a 'must have 5 years of React' requirement should produce a question that only someone who " +
    "actually used React at depth could answer well) - not trivia definitions.",
  behavioural:
    "Write behavioural interview questions (STAR-style) that probe the listed requirements - " +
    "collaboration, leadership, mentoring, conflict, ownership. Do not write technical trivia here.",
  "system-design":
    "Write system-design interview questions appropriate to the seniority and technical requirements given. " +
    "Scope each question to something answerable in 30-45 minutes on a whiteboard.",
  "company-fit":
    "Write company-fit / culture questions that connect the candidate's background to what this specific " +
    "company does and values, using the company context given. Avoid generic 'why do you want this job' filler.",
};

/**
 * Generates questions for ONE category from ONE set of requirements, with instructions specific
 * to that category (Section 3: a technical requirement and a behavioural one "should not come
 * from the same call with the same instructions").
 */
export async function generateQuestionsForCategory(params: {
  category: QuestionCategory;
  requirements: Requirement[];
  companyContext: string;
  hiringProcessNotes: string;
  idOffset: number;
}): Promise<Question[]> {
  const { category, requirements, companyContext, hiringProcessNotes, idOffset } = params;
  if (requirements.length === 0 && category !== "company-fit" && category !== "system-design") {
    return [];
  }

  const requirementList = requirements.map((r) => `- [${r.id}] (${r.priority}) ${r.text}`).join("\n") || "(none listed)";

  const prompt = [
    CATEGORY_INSTRUCTIONS[category],
    "",
    "Requirements to cover (reference their ids in requirement_id; use null only for company-fit questions",
    "that are about the company generally rather than one specific requirement):",
    requirementList,
    "",
    wrapUntrustedContent("company-context", companyContext || "(no company context available)"),
    wrapUntrustedContent("hiring-process-notes", hiringProcessNotes || "(nothing found)"),
    "",
    "Generate one question per requirement listed above (skip none), difficulty 1-3.",
    "Schema:",
    `{ "questions": [ { "prompt": string, "answer_outline": string, "difficulty": 1|2|3, "requirement_id": string|null } ] }`,
  ].join("\n");

  const raw = await generateJson<unknown>({ systemInstruction: CATEGORY_INSTRUCTIONS[category], prompt });
  const parsed = llmShape.parse(raw);

  const validIds = new Set(requirements.map((r) => r.id));

  return parsed.questions.map((q, i) => ({
    id: `q${idOffset + i + 1}`,
    requirement_ids: q.requirement_id && validIds.has(q.requirement_id) ? [q.requirement_id] : [],
    category,
    prompt: q.prompt,
    answer_outline: q.answer_outline,
    difficulty: q.difficulty,
    origin: "generated",
  }));
}
