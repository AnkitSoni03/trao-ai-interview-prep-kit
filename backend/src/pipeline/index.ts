import type { BatchCase, BatchError, BatchKitResult } from "../types/batch.js";
import type { Kit, Question, QuestionCategory, Requirement, RequirementKind } from "../types/kit.js";
import { extractRequirements } from "./extractRequirements.js";
import { crawlCompanySite } from "./crawlCompanySite.js";
import { searchInterviewDiscussion } from "./searchInterviewDiscussion.js";
import { synthesizeCompanyBrief } from "./synthesizeCompanyBrief.js";
import { generateQuestionsForCategory } from "./generateQuestions.js";
import { generateFlashcards } from "./generateFlashcards.js";
import { checkCoverage, splitUncoveredByPriority } from "./checkCoverage.js";
import { buildSchedule } from "./buildSchedule.js";
import { validateKit } from "./validateKit.js";
import { logger } from "../utils/logger.js";

const MAX_GAP_FILL_PASSES = 2; // + the initial generation pass = 3 total, see coverage.passes

const KIND_TO_CATEGORY: Record<RequirementKind, QuestionCategory> = {
  technical: "technical",
  behavioural: "behavioural",
  domain: "company-fit",
};

function deriveCompanyName(companyUrl: string): string {
  try {
    const host = new URL(companyUrl).hostname.replace(/^www\./, "");
    const [name] = host.split(".");
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return companyUrl;
  }
}

function extractLocation(jd: string): string {
  const match = jd.match(/location:\s*([^\n,]{2,60})/i) ?? jd.match(/based in\s*([^\n,.]{2,60})/i);
  return match ? match[1].trim() : "";
}

function needsSystemDesign(seniority: string, hiringNotes: string): boolean {
  const senior = /senior|staff|lead|principal|architect/i.test(seniority);
  const mentionsSystemDesign = /system design/i.test(hiringNotes);
  return senior || mentionsSystemDesign;
}

async function generateQuestionsByKind(
  requirements: Requirement[],
  companyContext: string,
  hiringProcessNotes: string,
): Promise<Question[]> {
  const grouped = new Map<RequirementKind, Requirement[]>();
  for (const req of requirements) {
    grouped.set(req.kind, [...(grouped.get(req.kind) ?? []), req]);
  }

  const questions: Question[] = [];
  let idOffset = 0;

  for (const [kind, reqs] of grouped.entries()) {
    const generated = await generateQuestionsForCategory({
      category: KIND_TO_CATEGORY[kind],
      requirements: reqs,
      companyContext,
      hiringProcessNotes,
      idOffset,
    });
    questions.push(...generated);
    idOffset += generated.length;
  }

  const technicalReqs = grouped.get("technical") ?? [];
  const seniorityHint = requirements.length > 0 ? "" : "";
  if (technicalReqs.length > 0 && needsSystemDesign(seniorityHint, hiringProcessNotes)) {
    const generated = await generateQuestionsForCategory({
      category: "system-design",
      requirements: technicalReqs,
      companyContext,
      hiringProcessNotes,
      idOffset,
    });
    questions.push(...generated);
  }

  return questions;
}

function toBatchError(err: unknown): BatchError {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "UNKNOWN";
  if (code === "LLM_NOT_CONFIGURED" || code === "LLM_INVALID_JSON" || code === "LLM_RATE_LIMITED") {
    return { code: "LLM_FAILURE", message };
  }
  return { code: "UNKNOWN", message };
}

export interface PipelineProgressEvent {
  step: string;
  message: string;
}

export type ProgressReporter = (event: PipelineProgressEvent) => void;

/**
 * Runs the full research + generation + validation pipeline for one case. Used by both the
 * web app's kit-creation flow and the `npm run evaluate` batch entry point - the same code
 * path, per Section 9.
 */
export async function runPipeline(
  input: BatchCase,
  onProgress: ProgressReporter = () => {},
): Promise<BatchKitResult> {
  try {
    if (!input.jd || !input.jd.trim()) {
      return { id: input.id, status: "failed", kit: null, error: { code: "INVALID_INPUT", message: "jd is empty" } };
    }

    onProgress({ step: "extract_requirements", message: "Extracting requirements from the job description" });
    const role = await extractRequirements(input.jd);

    onProgress({ step: "crawl_company", message: `Crawling ${input.company_url}` });
    const crawl = await crawlCompanySite(input.company_url).catch((err) => {
      logger.warn("Crawl failed unexpectedly", { err: String(err) });
      return { pages: [], errors: [{ url: input.company_url, reason: String(err) }], hiringPageFound: false };
    });

    const companyName = deriveCompanyName(input.company_url);

    onProgress({ step: "search_discussion", message: "Looking for public discussion of the interview process" });
    const discussion = await searchInterviewDiscussion(companyName);

    onProgress({ step: "company_brief", message: "Summarising the company" });
    const companyBrief = await synthesizeCompanyBrief({
      companyName,
      companyUrl: input.company_url,
      pages: crawl.pages,
    });

    const hiringProcessNotes = discussion.snippets.map((s) => `${s.title}: ${s.snippet}`).join("\n") || discussion.note || "";
    const companyContext = companyBrief.summary;

    onProgress({ step: "generate_questions", message: "Generating question categories" });
    let questions = await generateQuestionsByKind(role.requirements, companyContext, hiringProcessNotes);

    let passes = 1;
    let uncovered = checkCoverage(role.requirements, questions);

    while (uncovered.length > 0 && passes <= MAX_GAP_FILL_PASSES) {
      onProgress({ step: "coverage_gap_fill", message: `Pass ${passes + 1}: filling ${uncovered.length} coverage gap(s)` });
      const { mustHave, niceToHave } = splitUncoveredByPriority(role.requirements, uncovered);
      const toFill = [...mustHave, ...niceToHave];

      const grouped = new Map<RequirementKind, Requirement[]>();
      for (const req of toFill) grouped.set(req.kind, [...(grouped.get(req.kind) ?? []), req]);

      let idOffset = questions.length;
      for (const [kind, reqs] of grouped.entries()) {
        const filled = await generateQuestionsForCategory({
          category: KIND_TO_CATEGORY[kind],
          requirements: reqs,
          companyContext,
          hiringProcessNotes,
          idOffset,
        });
        questions.push(...filled);
        idOffset += filled.length;
      }

      uncovered = checkCoverage(role.requirements, questions);
      passes += 1;
    }

    const flashcards = generateFlashcards(role.requirements, questions);
    const schedule = buildSchedule({ questions, requirements: role.requirements, daysAvailable: input.days });

    const pagesUsed = [...crawl.pages.map((p) => p.finalUrl), ...discussion.snippets.map((s) => s.url)];

    const kit: Kit = {
      source: {
        company: companyName,
        company_url: input.company_url,
        role: role.title,
        location: extractLocation(input.jd),
        jd_chars: input.jd.length,
        researched_at: new Date().toISOString(),
        pages_used: pagesUsed,
      },
      company_brief: companyBrief,
      role,
      questions,
      flashcards,
      schedule,
      coverage: { uncovered_requirement_ids: uncovered, passes },
    };

    const validation = validateKit(kit);
    if (!validation.ok) {
      return {
        id: input.id,
        status: "failed",
        kit: null,
        error: { code: "VALIDATION_FAILED", message: validation.errors.join("; ") },
      };
    }

    return { id: input.id, status: "ok", kit, error: null };
  } catch (err) {
    logger.error("Pipeline failed for case", { id: input.id, err: err instanceof Error ? err.stack : err });
    return { id: input.id, status: "failed", kit: null, error: toBatchError(err) };
  }
}
