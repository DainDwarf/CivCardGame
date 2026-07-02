import { describe, it, expect } from 'vitest';
import { DEFAULT_DECKS } from './decks';
import { CARDS } from './cards';

describe('DEFAULT_DECKS', () => {
  it('every card in every deck exists in the CARDS catalogue', () => {
    for (const deck of DEFAULT_DECKS) {
      for (const cardId of deck.cards) {
        expect(CARDS[cardId], `${deck.id} references unknown card "${cardId}"`).toBeDefined();
      }
    }
  });

  it('no deck is empty', () => {
    for (const deck of DEFAULT_DECKS) {
      expect(deck.cards.length).toBeGreaterThan(0);
    }
  });

  it('deck ids are unique', () => {
    const ids = DEFAULT_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
