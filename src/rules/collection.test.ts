import { describe, it, expect } from 'vitest';
import { copiesOwned, isOwned } from './collection';
import { STARTING_COLLECTION } from '../content/collection';
import { DEFAULT_DECKS } from '../content/decks';
import { groupCounts } from './deckBuilder';

describe('copiesOwned', () => {
  it('returns the raw count for an owned card', () => {
    expect(copiesOwned({ farm: 2 }, 'farm')).toBe(2);
  });

  it('returns "unlimited" for an unlimited card', () => {
    expect(copiesOwned({ farm: 'unlimited' }, 'farm')).toBe('unlimited');
  });

  it('returns 0 for a card with no entry', () => {
    expect(copiesOwned({}, 'farm')).toBe(0);
  });
});

describe('isOwned', () => {
  it('is true for any positive copy count or "unlimited"', () => {
    expect(isOwned({ farm: 1 }, 'farm')).toBe(true);
    expect(isOwned({ farm: 'unlimited' }, 'farm')).toBe(true);
  });

  it('is false with no entry', () => {
    expect(isOwned({}, 'farm')).toBe(false);
  });
});

describe('STARTING_COLLECTION', () => {
  it('owns enough copies of every card in the starting deck', () => {
    const startingDeck = DEFAULT_DECKS.find((d) => d.id === 'starter')!.cards;
    for (const { cardId, count } of groupCounts(startingDeck)) {
      const owned = copiesOwned(STARTING_COLLECTION, cardId);
      expect(owned === 'unlimited' || owned >= count, `${cardId}: owns ${owned}, deck needs ${count}`).toBe(true);
    }
  });
});
