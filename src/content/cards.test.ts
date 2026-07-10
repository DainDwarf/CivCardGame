import { describe, it, expect } from 'vitest';
import { CARDS, isDeckable } from './cards';
import { STARTING_COLLECTION } from './collection';
import { DEFAULT_DECKS } from './decks';

// Internal coherence of the CARDS catalogue (mirrors `boards.test.ts`'s id-check), plus the
// cross-catalogue invariant that everything a player can *own* or *deck* is actually a deckable
// card (no mission-only event/threat/objective sneaking into the collection or a seed deck).

describe('CARDS', () => {
  it("each entry's id matches its registry key", () => {
    for (const [key, card] of Object.entries(CARDS)) {
      expect(card.id, key).toBe(key);
    }
  });

  it('every card the starting collection owns is deckable', () => {
    for (const cardId of Object.keys(STARTING_COLLECTION)) {
      const card = CARDS[cardId];
      expect(card, `STARTING_COLLECTION → ${cardId}`).toBeDefined();
      expect(isDeckable(card), `${cardId} is not deckable`).toBe(true);
    }
  });

  it('every card in every default deck is deckable', () => {
    for (const deck of DEFAULT_DECKS) {
      for (const cardId of deck.cards) {
        expect(isDeckable(CARDS[cardId]), `${deck.id} → ${cardId} is not deckable`).toBe(true);
      }
    }
  });
});
