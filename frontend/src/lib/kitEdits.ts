import type { ItemOrigin } from "./types";

/** A generated item the user just changed becomes "edited"; user-added/already-edited stay as-is. */
export function markEdited<T extends { origin?: ItemOrigin }>(item: T): T {
  return item.origin === "user-added" ? item : { ...item, origin: "edited" };
}

export function nextId(existingIds: string[], prefix: string): string {
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}
