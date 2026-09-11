"use client";

import { useState } from "react";
import type { Kit, Question, QuestionCategory } from "@/lib/types";
import { markEdited, nextId } from "@/lib/kitEdits";
import { AutoTextarea } from "./AutoTextarea";
import { IconChevronDown, IconChevronUp, IconPin, IconPlus, IconRefresh, IconTrash } from "./icons";

const CATEGORIES: { key: QuestionCategory; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "behavioural", label: "Behavioural" },
  { key: "system-design", label: "System design" },
  { key: "company-fit", label: "Company fit" },
];

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

function moveWithinCategory(questions: Question[], id: string, direction: "up" | "down"): Question[] {
  const target = questions.find((q) => q.id === id);
  if (!target) return questions;
  const sameCategoryIndices = questions.reduce<number[]>((acc, q, i) => {
    if (q.category === target.category) acc.push(i);
    return acc;
  }, []);
  const targetFullIndex = questions.findIndex((q) => q.id === id);
  const pos = sameCategoryIndices.indexOf(targetFullIndex);
  const swapPos = direction === "up" ? pos - 1 : pos + 1;
  if (swapPos < 0 || swapPos >= sameCategoryIndices.length) return questions;

  const a = sameCategoryIndices[pos];
  const b = sameCategoryIndices[swapPos];
  const next = [...questions];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function QuestionCard({
  question,
  requirementText,
  onEditField,
  onStructuralEdit,
  canMoveUp,
  canMoveDown,
}: {
  question: Question;
  requirementText: string[];
  onEditField: (updater: (k: Kit) => Kit) => void;
  onStructuralEdit: (updater: (k: Kit) => Kit) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  function updateQuestion(patch: Partial<Question>) {
    onEditField((k) => ({
      ...k,
      questions: k.questions.map((q) => (q.id === question.id ? markEdited({ ...q, ...patch }) : q)),
    }));
  }

  return (
    <li className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1 rounded-full bg-background px-2 py-1 text-xs text-muted">
            <select
              value={question.difficulty}
              onChange={(e) => updateQuestion({ difficulty: Number(e.target.value) as 1 | 2 | 3 })}
              aria-label="Difficulty"
              className="bg-transparent font-medium text-foreground outline-none"
            >
              {([1, 2, 3] as const).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <select
            value={question.category}
            onChange={(e) => updateQuestion({ category: e.target.value as QuestionCategory })}
            aria-label="Move to category"
            className="rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          {question.origin && (
            <span className="rounded-full bg-background px-2 py-1 text-xs capitalize text-muted">{question.origin}</span>
          )}
          {requirementText.length > 0 && (
            <span className="text-xs text-muted">covers: {requirementText.join(", ")}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={question.pinned ? "Unpin" : "Pin (protect from regeneration)"}
            onClick={() => updateQuestion({ pinned: !question.pinned })}
            className={`btn btn-sm ${question.pinned ? "border border-warning bg-warning-soft text-warning" : "btn-ghost border border-border"}`}
          >
            <IconPin className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{question.pinned ? "Pinned" : "Pin"}</span>
          </button>
          <button
            type="button"
            aria-label="Move up"
            disabled={!canMoveUp}
            onClick={() => onStructuralEdit((k) => ({ ...k, questions: moveWithinCategory(k.questions, question.id, "up") }))}
            className="btn btn-ghost btn-sm border border-border px-2"
          >
            <IconChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={!canMoveDown}
            onClick={() => onStructuralEdit((k) => ({ ...k, questions: moveWithinCategory(k.questions, question.id, "down") }))}
            className="btn btn-ghost btn-sm border border-border px-2"
          >
            <IconChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete question"
            onClick={() => onStructuralEdit((k) => ({ ...k, questions: k.questions.filter((q) => q.id !== question.id) }))}
            className="btn btn-danger-ghost btn-sm px-2"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label">Prompt</span>
        <AutoTextarea
          rows={2}
          value={question.prompt}
          onChange={(e) => updateQuestion({ prompt: e.target.value })}
          className="px-3 py-2 text-sm leading-relaxed"
        />
      </label>
      <label className="mt-3 flex flex-col gap-1.5">
        <span className="label">Answer outline</span>
        <AutoTextarea
          rows={3}
          value={question.answer_outline}
          onChange={(e) => updateQuestion({ answer_outline: e.target.value })}
          className="px-3 py-2 text-sm leading-relaxed"
        />
      </label>
    </li>
  );
}

export function QuestionsBoard({
  kit,
  onEditField,
  onStructuralEdit,
  onRegenerate,
  regeneratingSection,
}: {
  kit: Kit;
  onEditField: (updater: (k: Kit) => Kit) => void;
  onStructuralEdit: (updater: (k: Kit) => Kit) => void;
  onRegenerate: (section: QuestionCategory) => void;
  regeneratingSection: string | null;
}) {
  const [active, setActive] = useState<QuestionCategory>("technical");
  const requirementById = new Map(kit.role.requirements.map((r) => [r.id, r.text]));
  const inCategory = kit.questions.filter((q) => q.category === active);

  function addQuestion() {
    const id = nextId(kit.questions.map((q) => q.id), "q");
    const newQuestion: Question = {
      id,
      requirement_ids: [],
      category: active,
      prompt: "",
      answer_outline: "",
      difficulty: 2,
      origin: "user-added",
    };
    onStructuralEdit((k) => ({ ...k, questions: [...k.questions, newQuestion] }));
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="kicker mb-1">Question bank</p>
          <h2 className="font-semibold tracking-tight">{kit.questions.length} total questions</h2>
        </div>
        <button
          type="button"
          onClick={() => onRegenerate(active)}
          disabled={regeneratingSection === active}
          className="btn btn-secondary btn-sm"
        >
          <IconRefresh className={`h-3.5 w-3.5 ${regeneratingSection === active ? "animate-spin" : ""}`} />
          {regeneratingSection === active ? "Regenerating…" : `Regenerate ${active}`}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-background p-1 text-sm" role="tablist" aria-label="Question category">
        {CATEGORIES.map((c) => {
          const count = kit.questions.filter((q) => q.category === c.key).length;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active === c.key}
              onClick={() => setActive(c.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                active === c.key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {c.label} <span className="text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {inCategory.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          No questions in this category yet.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {inCategory.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              requirementText={q.requirement_ids.map((id) => requirementById.get(id) ?? id)}
              onEditField={onEditField}
              onStructuralEdit={onStructuralEdit}
              canMoveUp={i > 0}
              canMoveDown={i < inCategory.length - 1}
            />
          ))}
        </ul>
      )}

      <button type="button" onClick={addQuestion} className="btn btn-secondary w-full border-dashed">
        <IconPlus className="h-4 w-4" />
        Add question
      </button>
    </section>
  );
}
