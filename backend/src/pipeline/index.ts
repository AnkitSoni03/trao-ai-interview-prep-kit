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

/**
 * Companies often serve their careers/about content from a subdomain (about.gitlab.com,
 * jobs.stripe.com) - the registrable-domain label (second-from-last, ignoring the TLD) is a
 * much better guess at the company name than the leftmost label, which would read "About"
 * or "Jobs" instead of the actual company.
 */
function deriveCompanyName(companyUrl: string): string {
  try {
    const labels = new URL(companyUrl).hostname.split(".");
    const name = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
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

function groupByKind(requirements: Requirement[]): Map<RequirementKind, Requirement[]> {
  const grouped = new Map<RequirementKind, Requirement[]>();
  for (const req of requirements) {
    grouped.set(req.kind, [...(grouped.get(req.kind) ?? []), req]);
  }
  return grouped;
}

/** Reassigns sequential, final `q1..qN` ids. Safe to do once at the very end: nothing besides
 * checkCoverage/splitUncoveredByPriority reads a question's own id before that point, and
 * those only look at requirement_ids. */
function renumberQuestions(questions: Question[]): Question[] {
  return questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
}

/**
 * A single Gemini call on this network regularly takes 30-100s+ (measured - see
 * pipeline/llm/rateLimiter.ts), so the categories are generated concurrently (each is an
 * independent call with its own instructions per Section 3) rather than one after another -
 * otherwise a handful of categories alone could burn most of the 15-minute batch budget.
 */
async function generateQuestionsByKind(
  requirements: Requirement[],
  companyContext: string,
  hiringProcessNotes: string,
): Promise<Question[]> {
  const grouped = groupByKind(requirements);
  const tasks = [...grouped.entries()].map(([kind, reqs]) =>
    generateQuestionsForCategory({
      category: KIND_TO_CATEGORY[kind],
      requirements: reqs,
      companyContext,
      hiringProcessNotes,
      idOffset: 0,
    }),
  );

  const technicalReqs = grouped.get("technical") ?? [];
  if (technicalReqs.length > 0 && needsSystemDesign("", hiringProcessNotes)) {
    tasks.push(
      generateQuestionsForCategory({
        category: "system-design",
        requirements: technicalReqs,
        companyContext,
        hiringProcessNotes,
        idOffset: 0,
      }),
    );
  }

  const results = await Promise.all(tasks);
  return results.flat();
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
    const hiringProcessNotes = discussion.snippets.map((s) => `${s.title}: ${s.snippet}`).join("\n") || discussion.note || "";

    // A raw excerpt of the crawled pages, used as question-generation context so that step
    // doesn't have to wait on the polished company_brief LLM call - the two run concurrently.
    const rawCompanyContext =
      crawl.pages
        .slice(0, 3)
        .map((p) => `${p.title}: ${p.text.slice(0, 500)}`)
        .join("\n") || "(no information retrieved about this company)";

    onProgress({ step: "company_brief", message: "Summarising the company and generating question categories" });
    const [companyBrief, initialQuestions] = await Promise.all([
      synthesizeCompanyBrief({ companyName, companyUrl: input.company_url, pages: crawl.pages }),
      generateQuestionsByKind(role.requirements, rawCompanyContext, hiringProcessNotes),
    ]);

    const companyContext = companyBrief.summary;
    const questionBatches = [initialQuestions];

    let passes = 1;
    let uncovered = checkCoverage(role.requirements, initialQuestions);

    while (uncovered.length > 0 && passes <= MAX_GAP_FILL_PASSES) {
      onProgress({ step: "coverage_gap_fill", message: `Pass ${passes + 1}: filling ${uncovered.length} coverage gap(s)` });
      const { mustHave, niceToHave } = splitUncoveredByPriority(role.requirements, uncovered);
      const toFill = [...mustHave, ...niceToHave];
      const grouped = groupByKind(toFill);

      const fillTasks = [...grouped.entries()].map(([kind, reqs]) =>
        generateQuestionsForCategory({
          category: KIND_TO_CATEGORY[kind],
          requirements: reqs,
          companyContext,
          hiringProcessNotes,
          idOffset: 0,
        }),
      );
      const filledBatches = await Promise.all(fillTasks);
      questionBatches.push(...filledBatches);

      const coveredSoFar = questionBatches.flat();
      uncovered = checkCoverage(role.requirements, coveredSoFar);
      passes += 1;
    }

    const questions = renumberQuestions(questionBatches.flat());
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
