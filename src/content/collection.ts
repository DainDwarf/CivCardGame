/**
 * A fresh player's starting ownership counts (`meta/store.ts`'s `emptyStore`, via
 * `rules/collection.ts`'s `collectionFromCounts`) — just enough to build `content/decks.ts`'s
 * Founding deck (with a little room to rebuild), plus two cards (Bow, Clothing) owned but not
 * pre-decked, for early deckbuilding variety; everything else is unlocked through missions. A plain
 * `{ cardId: count }` map, not an `OwnedCards` itself: instance identity doesn't exist until granted.
 *
 * **Phase 4 Step 3 — the Paleolithic starting collection.** Every count is a **copy-tier-attainable**
 * number (the shop's ×1→×2→×4→×8 ladder — 1/2/4/8, never 3), so a seeded quantity is one the shop
 * economy could itself reproduce. The two staffed producers a run leans on every turn (Foraging,
 * Toolmaking) start at 4; everything else at 2. This exactly covers the Founding deck (which uses
 * Foraging/Toolmaking ×3 and every other card ×2).
 */
export const STARTING_COLLECTION: Record<string, number> = {
  foraging: 4,
  toolmaking: 4,
  fire: 2,
  spear: 2,
  bow: 2,
  cave_art: 2,
  clothing: 2,
  jewelry: 2,
  bartering: 2,
  dogs: 2,
  kinship: 2,
  storytelling: 2,
};
