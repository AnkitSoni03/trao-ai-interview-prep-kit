import type { Flashcard, Kit } from "@/lib/types";
import { markEdited, nextId } from "@/lib/kitEdits";
import { IconPlus, IconTrash } from "./icons";

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
    <section className="card p-5 sm:p-6">
      <div className="mb-4">
        <p className="kicker mb-1">Flashcards</p>
        <h2 className="font-semibold tracking-tight">{kit.flashcards.length} cards</h2>
      </div>

      {kit.flashcards.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          No flashcards yet.
        </p>
      ) : (
        <ul className="mb-4 grid gap-3 sm:grid-cols-2">
          {kit.flashcards.map((f) => (
            <li key={f.id} className="card p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="rounded-full bg-background px-2 py-0.5 text-xs capitalize text-muted">{f.origin}</span>
                <button
                  type="button"
                  aria-label="Delete flashcard"
                  onClick={() => onStructuralEdit((k) => ({ ...k, flashcards: k.flashcards.filter((c) => c.id !== f.id) }))}
                  className="btn btn-danger-ghost btn-sm px-2"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="label">Front</span>
                <textarea
                  rows={2}
                  value={f.front}
                  onChange={(e) => updateCard(f.id, { front: e.target.value })}
                  className="field px-2.5 py-2 text-sm"
                />
              </label>
              <label className="mt-3 flex flex-col gap-1.5">
                <span className="label">Back</span>
                <textarea
                  rows={3}
                  value={f.back}
                  onChange={(e) => updateCard(f.id, { back: e.target.value })}
                  className="field px-2.5 py-2 text-sm"
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={addCard} className="btn btn-secondary w-full border-dashed">
        <IconPlus className="h-4 w-4" />
        Add flashcard
      </button>
    </section>
  );
}
