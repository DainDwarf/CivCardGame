/**
 * Per-player card ownership (docs/DESIGN.md, "Economy & progression"). An absent entry
 * means the card is not yet unlocked; a mission unlock grants the first copy, the shop
 * later raises it along the bounded ×1/×2/×4/×8 tier ladder (`rules/shop.ts`'s
 * `TIER_LADDER` — Phase 3 Step 7.1 dropped the old terminal `'unlimited'` tier so every
 * owned count is a finite, instantiable number). `Collection`/`DeckEditor` (Phase 3 Step 2)
 * read this to omit not-yet-unlocked cards entirely, rather than showing them locked —
 * unlocking one is meant to be a surprise. `rules/deckBuilder.ts`'s `addCard` also uses
 * it to cap how many copies of an owned card a deck may include (the other half of Step 2).
 */
export type OwnedCards = Record<string, number>;

/** Raw copies owned of `cardId` — `0` if not yet unlocked. */
export function copiesOwned(collection: OwnedCards, cardId: string): number {
  return collection[cardId] ?? 0;
}

/** Whether the player owns at least one copy of `cardId`. */
export function isOwned(collection: OwnedCards, cardId: string): boolean {
  return copiesOwned(collection, cardId) !== 0;
}
