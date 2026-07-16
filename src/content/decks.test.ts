import { describe, it, expect } from 'vitest';
import { DEFAULT_DECKS } from './decks';
import { CARDS } from './cards';
import { MIN_DECK_SIZE } from '../rules/deckBuilder';

describe('DEFAULT_DECKS', () => {
  it('every card in every deck exists in the CARDS catalogue', () => {
    for (const deck of DEFAULT_DECKS) {
      for (const cardId of deck.cards) {
        expect(CARDS[cardId], `${deck.id} references unknown card "${cardId}"`).toBeDefined();
      }
    }
  });

  // The seed deck must satisfy the committed minimum-deck-size floor, so a fresh player's
  // Founding deck is savable/launchable out of the box.
  it('every deck meets the minimum deck size', () => {
    for (const deck of DEFAULT_DECKS) {
      expect(deck.cards.length, `${deck.id} has ${deck.cards.length} cards`).toBeGreaterThanOrEqual(MIN_DECK_SIZE);
    }
  });

  it('deck ids are unique', () => {
    const ids = DEFAULT_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
