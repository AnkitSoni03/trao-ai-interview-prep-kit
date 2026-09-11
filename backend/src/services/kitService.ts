import { KitRecord, type KitStatus } from "../models/Kit.js";
import { HttpError } from "../middleware/errorHandler.js";
import { hashJdAndCompany } from "../utils/contentHash.js";
import { runPipeline, type PipelineProgressEvent } from "../pipeline/index.js";
import { crawlCompanySite } from "../pipeline/crawlCompanySite.js";
import { synthesizeCompanyBrief } from "../pipeline/synthesizeCompanyBrief.js";
import { generateQuestionsForCategory } from "../pipeline/generateQuestions.js";
import { checkCoverage } from "../pipeline/checkCoverage.js";
import { buildSchedule } from "../pipeline/buildSchedule.js";
import { validateKit } from "../pipeline/validateKit.js";
import type { Kit, QuestionCategory, RequirementKind } from "../types/kit.js";
import { logger } from "../utils/logger.js";

const KIND_FOR_CATEGORY: Partial<Record<QuestionCategory, RequirementKind>> = {
  technical: "technical",
  behavioural: "behavioural",
  "company-fit": "domain",
  "system-design": "technical",
};

export async function createKit(userId: string, input: { jd: string; company_url: string; days: number }) {
  const contentHash = hashJdAndCompany(input.jd, input.company_url);
  const existing = await KitRecord.findOne({ userId, contentHash });
  if (existing) {
    // Section 10: same description+company submitted twice - hand back the existing kit
    // (created or in progress) instead of silently re-running the whole pipeline.
    return existing;
  }

  const record = await KitRecord.create({
    userId,
    input,
    contentHash,
    status: "pending" satisfies KitStatus,
  });

  // Fire and forget: the caller gets the record id immediately and polls/subscribes for
  // progress, since generation can take 30-90+ seconds (Section 13).
  void processKitInBackground(record.id, userId, input);

  return record;
}

async function processKitInBackground(
  kitId: string,
  userId: string,
  input: { jd: string; company_url: string; days: number },
): Promise<void> {
  const setProgress = async (status: KitStatus, event?: PipelineProgressEvent) => {
    await KitRecord.updateOne(
      { _id: kitId },
      {
        status,
        progress: { step: event?.step ?? status, message: event?.message ?? "", updatedAt: new Date() },
      },
    );
  };

  try {
    await setProgress("researching");
    const result = await runPipeline({ id: kitId, jd: input.jd, company_url: input.company_url, days: input.days }, (event) => {
      const status: KitStatus =
        event.step === "generate_questions" || event.step === "coverage_gap_fill" ? "generating" : "researching";
      void setProgress(status, event);
    });

    if (result.status === "ok") {
      await KitRecord.updateOne(
        { _id: kitId },
        { status: "ready", kit: result.kit, error: null, progress: { step: "done", message: "Kit ready", updatedAt: new Date() } },
      );
    } else {
      await KitRecord.updateOne(
        { _id: kitId },
        { status: "failed", error: result.error, progress: { step: "failed", message: result.error?.message ?? "", updatedAt: new Date() } },
      );
    }
  } catch (err) {
    logger.error("Background kit generation crashed", { kitId, userId, err: err instanceof Error ? err.stack : err });
    await KitRecord.updateOne(
      { _id: kitId },
      { status: "failed", error: { code: "UNKNOWN", message: "Unexpected error during generation" } },
    );
  }
}

export async function listKits(userId: string) {
  return KitRecord.find({ userId }).sort({ createdAt: -1 });
}

export async function getOwnedKit(userId: string, kitId: string) {
  const record = await KitRecord.findOne({ _id: kitId, userId });
  if (!record) throw new HttpError(404, "KIT_NOT_FOUND", "No kit with that id");
  return record;
}

export async function deleteOwnedKit(userId: string, kitId: string) {
  const record = await getOwnedKit(userId, kitId);
  await record.deleteOne();
}

/** Replaces the stored kit wholesale with a client-edited version, after re-validating it. */
export async function saveEditedKit(userId: string, kitId: string, kit: Kit) {
  const record = await getOwnedKit(userId, kitId);
  const validation = validateKit(kit);
  if (!validation.ok) {
    throw new HttpError(422, "INVALID_KIT", `Edited kit failed validation: ${validation.errors.join("; ")}`);
  }
  record.kit = kit;
  await record.save();
  return record;
}

function nextIdOffset(ids: string[], prefix: string): number {
  let max = 0;
  for (const id of ids) {
    const match = id.match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

/**
 * Regenerates one section of an already-generated kit without discarding edits made
 * elsewhere. For a question category, questions the user edited, pinned, or added by hand
 * are kept; only the remaining generated questions in that category are replaced.
 * See README "Builder state model" for the full rationale.
 */
export async function regenerateSection(
  userId: string,
  kitId: string,
  section: "company_brief" | "schedule" | QuestionCategory,
): Promise<Kit> {
  const record = await getOwnedKit(userId, kitId);
  if (!record.kit) throw new HttpError(409, "KIT_NOT_READY", "Kit has not finished generating yet");
  const kit = record.kit as Kit;

  if (section === "company_brief") {
    const crawl = await crawlCompanySite(kit.source.company_url);
    kit.company_brief = await synthesizeCompanyBrief({
      companyName: kit.source.company,
      companyUrl: kit.source.company_url,
      pages: crawl.pages,
    });
  } else if (section === "schedule") {
    kit.schedule = buildSchedule({
      questions: kit.questions,
      requirements: kit.role.requirements,
      daysAvailable: kit.schedule.days_available,
    });
  } else {
    const category = section;
    const kind = KIND_FOR_CATEGORY[category];
    const relevantRequirements = kind ? kit.role.requirements.filter((r) => r.kind === kind) : [];

    const preserved = kit.questions.filter(
      (q) => q.category !== category || q.origin === "edited" || q.origin === "user-added" || q.pinned,
    );

    const idOffset = nextIdOffset(kit.questions.map((q) => q.id), "q");
    const regenerated = await generateQuestionsForCategory({
      category,
      requirements: relevantRequirements,
      companyContext: kit.company_brief.summary,
      hiringProcessNotes: "",
      idOffset,
    });

    kit.questions = [...preserved, ...regenerated];
    kit.coverage = {
      uncovered_requirement_ids: checkCoverage(kit.role.requirements, kit.questions),
      passes: kit.coverage.passes + 1,
    };
    kit.schedule = buildSchedule({
      questions: kit.questions,
      requirements: kit.role.requirements,
      daysAvailable: kit.schedule.days_available,
    });
  }

  const validation = validateKit(kit);
  if (!validation.ok) {
    throw new HttpError(500, "REGENERATION_FAILED", `Regenerated kit failed validation: ${validation.errors.join("; ")}`);
  }

  record.kit = kit;
  await record.save();
  return kit;
}
