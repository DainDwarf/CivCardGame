/**
 * A fresh player's starting ownership counts (`meta/store.ts`'s `emptyStore`, via
 * `rules/collection.ts`'s `collectionFromCounts`) — just enough to build `content/decks.ts`'s
 * Founding deck; everything else is unlocked through missions. A plain
 * `{ cardId: count }` map, not an `OwnedCards` itself: instance identity doesn't exist until granted.
 *
 * Every count is a **copy-tier-attainable** number (the shop's ×1→×2→×4→×8 ladder — 1/2/4/8, never 3),
 * so a seeded quantity is one the shop economy could itself reproduce. The two staffed producers a run
 * leans on every turn (Foraging, Toolmaking) get the most copies; everything else the minimum. This
 * exactly covers the Founding deck.
 */
export const STARTING_COLLECTION: Record<string, number> = {
  foraging: 4,
  toolmaking: 4,
  storytelling: 2,
  bow: 2,
  cave_art: 2,
  jewelry: 2,
  bartering: 2,
  dogs: 2,
};
