export interface DeckDef {
  /** Plain id — a fixed literal for the seed decks below, `crypto.randomUUID()` for
   *  anything a player creates in the deck editor. Not a closed union: every deck
   *  (seed or player-made) is equally editable, so there's no separate "built-in" type. */
  id: string;
  name: string;
  /** Card IDs (from `CARDS`), in draw order before shuffling. */
  cards: string[];
}

/**
 * Seed data for a new player's store (see `meta/store.ts`'s `loadStore`/`cloneDecks`
 * usage) — a fresh player's one starting, fully-editable deck. Never read directly by
 * the run loop or the meta screens after that point; this array itself is never
 * mutated (see `rules/deckBuilder.ts`'s `cloneDecks`).
 *
 * Deliberately a single narrow deck (docs/TODO.md, Phase 3 Step 1), built entirely from
 * cards `content/collection.ts`'s `STARTING_COLLECTION` actually owns — every other
 * deck a player has is unlocked/built from scratch as their collection grows.
 */
export const DEFAULT_DECKS: DeckDef[] = [
  {
    id: 'starter',
    name: 'Founding Deck',
    cards: [
      'settlers', 'settlers', 'corvee', 'corvee', 'harvest', 'harvest',
      'farm', 'workshop', 'farm', 'workshop', 'library', 'theater',
      // Two Cornucopias so the run-scoped growing gain is visible in a single playthrough, a
      // Foresight to exercise the interactive peek/choose, and a Destroy to exercise the
      // targeted demolish (there are buildings above for it to target).
      'cornucopia', 'cornucopia', 'foresight', 'destroy',
    ],
  },
];
