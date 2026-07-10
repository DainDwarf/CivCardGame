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
 * **Phase 4 Step 3 — the Founding deck.** One 20-card buildingless Paleolithic deck: the two staffed
 * producers ×4, every other action ×2. Every cardId
 * must be owned with enough copies in `content/collection.ts`'s `STARTING_COLLECTION` (`buildSeedDecks`
 * silently drops any occurrence the collection can't cover) — a coherence test in
 * `rules/collection.test.ts` pins that the resolved deck still meets `MIN_DECK_SIZE`.
 */
export const DEFAULT_DECKS: DeckSeed[] = [
  {
    id: 'founding',
    name: 'Founding Deck',
    cards: [
      'foraging', 'foraging', 'foraging', 'foraging',
      'toolmaking', 'toolmaking', 'toolmaking', 'toolmaking',
      'bartering', 'bartering',
      'bow', 'bow',
      'dogs', 'dogs',
      'fire', 'fire',
      'jewelry', 'jewelry',
      'storytelling', 'storytelling',
    ],
  },
];
