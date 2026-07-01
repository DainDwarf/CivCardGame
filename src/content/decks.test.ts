import { describe, it, expect } from 'vitest';
import { DECKS } from './decks';
import { CARDS } from './cards';

describe('DECKS', () => {
  it('each entry\'s id matches its registry key', () => {
    for (const [key, deck] of Object.entries(DECKS)) {
      expect(deck.id).toBe(key);
    }
  });

  it('every card in every deck exists in the CARDS catalogue', () => {
    for (const deck of Object.values(DECKS)) {
      for (const cardId of deck.cards) {
        expect(CARDS[cardId], `${deck.id} references unknown card "${cardId}"`).toBeDefined();
      }
    }
  });

  it('no deck is empty', () => {
    for (const deck of Object.values(DECKS)) {
      expect(deck.cards.length).toBeGreaterThan(0);
    }
  });
});
