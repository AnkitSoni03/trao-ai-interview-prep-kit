// Mirrors backend/src/types/kit.ts and batch.ts - kept in sync by hand since the two
// workspaces don't share a package. See README "Repository layout".

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type ItemOrigin = "generated" | "edited" | "user-added";
export type Confidence = 1 | 2 | 3;

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
  origin?: ItemOrigin;
}

export interface RoleBreakdown {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  origin?: ItemOrigin;
  pinned?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  origin?: ItemOrigin;
  pinned?: boolean;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface PracticeRecord {
  confidence: Confidence;
  reviewedAt: string;
}

export type PracticeLog = Record<string, PracticeRecord>;

export interface Kit {
  source: KitSource;
  company_brief: CompanyBrief;
  role: RoleBreakdown;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
  practice?: PracticeLog;
}

export type KitStatus = "pending" | "researching" | "generating" | "checking_coverage" | "ready" | "failed";

export interface KitError {
  code: string | null;
  message: string | null;
}

export interface KitRecord {
  _id: string;
  userId: string;
  input: { jd: string; company_url: string; days: number };
  status: KitStatus;
  progress: { step: string; message: string; updatedAt: string };
  kit: Kit | null;
  error: KitError | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  userId: string;
  email: string;
}
