export type DeckId = 'balanced' | 'industrious' | 'scholarly';

export interface DeckDef {
  id: DeckId;
  name: string;
  description: string;
  /** Card IDs (from `CARDS`), in draw order before shuffling. */
  cards: string[];
}

/**
 * Premade decks — the meta loop's deck construction (Phase 2 step 7) will let players
 * build their own; until then a run picks one of these. Each is a CardId[] list, same
 * shape `RunConfig.deck` will carry.
 */
export const DECKS: Record<DeckId, DeckDef> = {
  balanced: {
    id: 'balanced',
    name: 'Balanced Start',
    description: 'A well-rounded build with a little of everything — the original curated deck.',
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

  industrious: {
    id: 'industrious',
    name: 'Industrious',
    description: 'Leans on Production and Workshops to out-build everyone else.',
    cards: [
      'farm', 'farm', 'workshop', 'workshop', 'workshop',
      'granary', 'corvee', 'corvee', 'settlers', 'settlers',
      'settlers', 'walls', 'barracks', 'market', 'trading_post',
      'harvest', 'develop', 'develop', 'destroy', 'conquest',
      'pyramids', 'colossus', 'library', 'eureka', 'university',
    ],
  },

  scholarly: {
    id: 'scholarly',
    name: 'Scholarly',
    description: 'Card draw and Science engines over raw building count.',
    cards: [
      'library', 'library', 'university', 'farm', 'farm',
      'workshop', 'eureka', 'eureka', 'inspiration', 'inspiration',
      'settlers', 'settlers', 'harvest', 'corvee', 'philosopher',
      'cultural_festival', 'theater', 'great_library', 'colossus',
      'develop', 'destroy', 'market', 'granary',
    ],
  },
};
