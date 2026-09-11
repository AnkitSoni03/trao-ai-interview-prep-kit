import { z } from "zod";
import { generateJson } from "./llm/geminiClient.js";
import { wrapUntrustedContent } from "../utils/promptSafety.js";
import type { Requirement, RoleBreakdown } from "../types/kit.js";

const llmShape = z.object({
  title: z.string().default(""),
  seniority: z.string().default(""),
  responsibilities: z.array(z.string()).default([]),
  requirements: z
    .array(
      z.object({
        text: z.string(),
        kind: z.enum(["technical", "behavioural", "domain"]),
        priority: z.enum(["must", "nice"]),
      }),
    )
    .default([]),
});

const SYSTEM_INSTRUCTION = `You extract structured facts from a single job description. You do not invent
requirements the text does not support - if the description is thin, return few or no requirements and say
so implicitly by returning a short list. Distinguish "must" (required, mandatory, "you have") from "nice"
(bonus, preferred, "nice to have") strictly by how the posting words each line - do not upgrade a bonus
line to a requirement. Classify each requirement's kind as "technical" (a specific skill/tool/experience),
"behavioural" (soft skill, collaboration, leadership), or "domain" (industry/business knowledge).
Respond with JSON only, matching the requested schema exactly.`;

/**
 * Extracts the role title/seniority/responsibilities and a requirement list from a pasted JD.
 * Pure LLM step - no retrieval needed, since the JD is pasted text (Section 3).
 */
export async function extractRequirements(jd: string): Promise<RoleBreakdown> {
  const prompt = [
    "Extract the role and its requirements from this job description.",
    "",
    wrapUntrustedContent("job-description", jd),
    "",
    "Schema:",
    `{
  "title": string,
  "seniority": string,
  "responsibilities": string[],
  "requirements": [ { "text": string, "kind": "technical"|"behavioural"|"domain", "priority": "must"|"nice" } ]
}`,
  ].join("\n");

  const parsed = await generateJson({ systemInstruction: SYSTEM_INSTRUCTION, prompt, schema: llmShape });

  const requirements: Requirement[] = parsed.requirements.map((r, i) => ({
    id: `r${i + 1}`,
    text: r.text,
    kind: r.kind,
    priority: r.priority,
    origin: "generated",
  }));

  return {
    title: parsed.title,
    seniority: parsed.seniority,
    responsibilities: parsed.responsibilities,
    requirements,
  };
}
