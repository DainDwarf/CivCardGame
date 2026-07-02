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
 * usage) — these become a fresh player's starting, fully-editable decks. Never read
 * directly by the run loop or the meta screens after that point; this array itself is
 * never mutated (see `rules/deckBuilder.ts`'s `cloneDecks`).
 */
export const DEFAULT_DECKS: DeckDef[] = [
  {
    id: 'balanced',
    name: 'Balanced Start',
    cards: [
      'farm', 'workshop', 'corvee', 'library', 'harvest',
      'settlers', 'farm', 'eureka', 'granary', 'settlers',
      'workshop', 'walls', 'library', 'inspiration', 'settlers',
      'barracks', 'university', 'eureka', 'corvee',
      'pyramids', 'great_library', 'colossus',
      'develop', 'develop', 'conquest', 'destroy',
      'market', 'trading_post',
      'theater', 'cultural_festival', 'philosopher',
    ],
  },

  {
    id: 'industrious',
    name: 'Industrious',
    cards: [
      'farm', 'farm', 'workshop', 'workshop', 'workshop',
      'granary', 'corvee', 'corvee', 'settlers', 'settlers',
      'settlers', 'walls', 'barracks', 'market', 'trading_post',
      'harvest', 'develop', 'develop', 'destroy', 'conquest',
      'pyramids', 'colossus', 'library', 'eureka', 'university',
    ],
  },

  {
    id: 'scholarly',
    name: 'Scholarly',
    cards: [
      'library', 'library', 'university', 'farm', 'farm',
      'workshop', 'eureka', 'eureka', 'inspiration', 'inspiration',
      'settlers', 'settlers', 'harvest', 'corvee', 'philosopher',
      'cultural_festival', 'theater', 'great_library', 'colossus',
      'develop', 'destroy', 'market', 'granary',
    ],
  },
];
