"use client";

import { useState } from "react";
import type { Kit, Question, QuestionCategory } from "@/lib/types";
import { markEdited, nextId } from "@/lib/kitEdits";

const CATEGORIES: { key: QuestionCategory; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "behavioural", label: "Behavioural" },
  { key: "system-design", label: "System design" },
  { key: "company-fit", label: "Company fit" },
];

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
    <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
            Difficulty
            <select
              value={question.difficulty}
              onChange={(e) => updateQuestion({ difficulty: Number(e.target.value) as 1 | 2 | 3 })}
              className="ml-1 bg-transparent"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </span>
          <select
            value={question.category}
            onChange={(e) => updateQuestion({ category: e.target.value as QuestionCategory })}
            aria-label="Move to category"
            className="rounded-full bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          {requirementText.length > 0 && <span className="truncate">covers: {requirementText.join(", ")}</span>}
          {question.origin && <span className="italic">{question.origin}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Pin (protect from regeneration)"
            onClick={() => updateQuestion({ pinned: !question.pinned })}
            className={`rounded-md border px-2 py-1 text-xs ${
              question.pinned
                ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {question.pinned ? "Pinned" : "Pin"}
          </button>
          <button
            type="button"
            aria-label="Move up"
            disabled={!canMoveUp}
            onClick={() => onStructuralEdit((k) => ({ ...k, questions: moveWithinCategory(k.questions, question.id, "up") }))}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-30 dark:border-neutral-700"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={!canMoveDown}
            onClick={() => onStructuralEdit((k) => ({ ...k, questions: moveWithinCategory(k.questions, question.id, "down") }))}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-30 dark:border-neutral-700"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Delete question"
            onClick={() => onStructuralEdit((k) => ({ ...k, questions: k.questions.filter((q) => q.id !== question.id) }))}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-red-50 hover:text-red-700 dark:border-neutral-700 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Prompt
        <textarea
          rows={2}
          value={question.prompt}
          onChange={(e) => updateQuestion({ prompt: e.target.value })}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="mt-2 flex flex-col gap-1 text-sm">
        Answer outline
        <textarea
          rows={3}
          value={question.answer_outline}
          onChange={(e) => updateQuestion({ answer_outline: e.target.value })}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Question bank</h2>
        <button
          type="button"
          onClick={() => onRegenerate(active)}
          disabled={regeneratingSection === active}
          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {regeneratingSection === active ? "Regenerating…" : `Regenerate ${active}`}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-sm" role="tablist" aria-label="Question category">
        {CATEGORIES.map((c) => {
          const count = kit.questions.filter((q) => q.category === c.key).length;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active === c.key}
              onClick={() => setActive(c.key)}
              className={`rounded-md px-3 py-1.5 ${
                active === c.key
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {inCategory.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-500">No questions in this category yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
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

      <button
        type="button"
        onClick={addQuestion}
        className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        + Add question
      </button>
    </section>
  );
}
