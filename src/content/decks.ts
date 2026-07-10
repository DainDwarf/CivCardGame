export interface DeckDef {
  /** Plain id — a fixed literal for the seed decks below, `crypto.randomUUID()` for
   *  anything a player creates in the deck editor. Not a closed union: every deck
   *  (seed or player-made) is equally editable, so there's no separate "built-in" type. */
  id: string;
  name: string;
  /** Meta card-*instance* ids (`rules/collection.ts`'s `OwnedCards`), in draw order before
   *  shuffling. Not cardIds: resolve each to a cardId via the player's collection
   *  (`rules/deckBuilder.ts`'s `resolveDeckCards`/`groupCounts`). Referencing a specific owned copy,
   *  rather than just a cardId, is what lets a card sticker live on one instance and be seen by every
   *  deck that includes it. */
  cards: string[];
}

/** Content-authoring shape for a seed deck's composition — written directly in cardIds,
 *  since instance identity (`rules/collection.ts`) doesn't exist until a player's collection
 *  is actually seeded. `rules/deckBuilder.ts`'s `buildSeedDecks` resolves each into a real
 *  `DeckDef` by matching owned instances off the fresh collection built from
 *  `content/collection.ts`'s `STARTING_COLLECTION`. */
export interface DeckSeed {
  id: string;
  name: string;
  /** Card IDs (from `CARDS`), in draw order before shuffling. */
  cards: string[];
}

/**
 * Seed data for a new player's store (see `meta/store.ts`'s `emptyStore`) — a fresh player's
 * starting, fully-editable deck(s). Never read directly by the run loop or the meta screens;
 * `buildSeedDecks` turns this into the real `DeckDef`(s) a fresh store's `decks` holds.
 *
 * **Reset to empty for the Phase 4 content pass** (Step 2.5), riding with the card catalogue it
 * references (a deck seed's cardIds only make sense against `content/collection.ts`'s
 * `STARTING_COLLECTION`). The real Founding deck is authored in Step 3, once the base card set
 * exists to build it from. Emptied, not deleted: the `DeckSeed`/`DeckDef` types stay.
 */
export const DEFAULT_DECKS: DeckSeed[] = [];
