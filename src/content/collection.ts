/**
 * A fresh player's starting ownership counts (`meta/store.ts`'s `emptyStore`, via
 * `rules/collection.ts`'s `collectionFromCounts`) — just enough to build `content/decks.ts`'s
 * starting deck; everything else is unlocked through missions. A plain `{ cardId: count }` map,
 * not an `OwnedCards` itself: instance identity doesn't exist until it's actually granted.
 *
 * **Reset to empty for the Phase 4 content pass** (Step 2.5), riding with the card catalogue and the
 * `DEFAULT_DECKS` seed it must cover. The real starting collection is authored in Step 3 alongside
 * the base card set and Founding deck.
 */
export const STARTING_COLLECTION: Record<string, number> = {};
