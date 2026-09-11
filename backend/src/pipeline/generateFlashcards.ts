import type { Flashcard, Question, Requirement } from "../types/kit.js";

/**
 * Derives flashcards from already-generated questions rather than a separate LLM call:
 * one flashcard per requirement, built from the first question that covers it. This keeps
 * the flashcard deck a tight "one core fact per requirement" study aid instead of a 1:1
 * duplicate of the full question bank, and avoids spending another round of LLM/rate-limit
 * budget on content we can derive deterministically (documented as a design choice in the README).
 */
export function generateFlashcards(requirements: Requirement[], questions: Question[]): Flashcard[] {
  const flashcards: Flashcard[] = [];
  let counter = 1;

  for (const req of requirements) {
    const coveringQuestion = questions.find((q) => q.requirement_ids.includes(req.id));
    if (!coveringQuestion) continue;

    flashcards.push({
      id: `f${counter++}`,
      front: `${req.text}?`,
      back: coveringQuestion.answer_outline || coveringQuestion.prompt,
      requirement_ids: [req.id],
      origin: "generated",
    });
  }

  return flashcards;
}
