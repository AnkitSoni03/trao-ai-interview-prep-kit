import type { Flashcard, Kit } from "@/lib/types";
import { markEdited, nextId } from "@/lib/kitEdits";

export function FlashcardsBoard({
  kit,
  onEditField,
  onStructuralEdit,
}: {
  kit: Kit;
  onEditField: (updater: (k: Kit) => Kit) => void;
  onStructuralEdit: (updater: (k: Kit) => Kit) => void;
}) {
  function updateCard(id: string, patch: Partial<Flashcard>) {
    onEditField((k) => ({
      ...k,
      flashcards: k.flashcards.map((f) => (f.id === id ? markEdited({ ...f, ...patch }) : f)),
    }));
  }

  function addCard() {
    const id = nextId(kit.flashcards.map((f) => f.id), "f");
    const card: Flashcard = { id, front: "", back: "", requirement_ids: [], origin: "user-added" };
    onStructuralEdit((k) => ({ ...k, flashcards: [...k.flashcards, card] }));
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-3 font-semibold">Flashcards ({kit.flashcards.length})</h2>

      {kit.flashcards.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-500">No flashcards yet.</p>
      ) : (
        <ul className="mb-3 grid gap-2 sm:grid-cols-2">
          {kit.flashcards.map((f) => (
            <li key={f.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-neutral-500">{f.origin}</span>
                <button
                  type="button"
                  aria-label="Delete flashcard"
                  onClick={() => onStructuralEdit((k) => ({ ...k, flashcards: k.flashcards.filter((c) => c.id !== f.id) }))}
                  className="rounded-md border border-neutral-300 px-2 py-0.5 text-xs hover:bg-red-50 hover:text-red-700 dark:border-neutral-700 dark:hover:bg-red-950"
                >
                  Delete
                </button>
              </div>
              <label className="flex flex-col gap-1 text-xs">
                Front
                <textarea
                  rows={2}
                  value={f.front}
                  onChange={(e) => updateCard(f.id, { front: e.target.value })}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="mt-2 flex flex-col gap-1 text-xs">
                Back
                <textarea
                  rows={3}
                  value={f.back}
                  onChange={(e) => updateCard(f.id, { back: e.target.value })}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addCard}
        className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        + Add flashcard
      </button>
    </section>
  );
}
