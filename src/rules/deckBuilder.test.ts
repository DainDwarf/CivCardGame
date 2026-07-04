import { describe, it, expect } from 'vitest';
import { addCard, removeCard, groupCounts, resolveDeckCards, cloneDecks } from './deckBuilder';
import type { DeckDef } from '../content/decks';
import type { OwnedCards } from './collection';

// Generous ownership so tests unrelated to the copy cap aren't gated by it.
const UNLIMITED: OwnedCards = { farm: 'unlimited', library: 'unlimited' };

describe('addCard', () => {
  it('appends a valid card', () => {
    expect(addCard(['farm'], 'library', UNLIMITED)).toEqual(['farm', 'library']);
  });

  it('rejects an unknown cardId', () => {
    expect(addCard(['farm'], 'not-a-card', UNLIMITED)).toBe('invalid');
  });

  it('does not mutate the input', () => {
    const deck = ['farm'];
    addCard(deck, 'library', UNLIMITED);
    expect(deck).toEqual(['farm']);
  });

  it('works starting from an empty deck', () => {
    expect(addCard([], 'farm', UNLIMITED)).toEqual(['farm']);
  });

  it('rejects a not-yet-unlocked card', () => {
    expect(addCard([], 'farm', {})).toBe('invalid');
  });

  it('rejects adding past the owned copy count', () => {
    const owns2: OwnedCards = { farm: 2 };
    expect(addCard(['farm'], 'farm', owns2)).toEqual(['farm', 'farm']);
    expect(addCard(['farm', 'farm'], 'farm', owns2)).toBe('invalid');
  });

  it('never caps an unlimited card', () => {
    const owns: OwnedCards = { farm: 'unlimited' };
    expect(addCard(['farm', 'farm', 'farm'], 'farm', owns)).toEqual(['farm', 'farm', 'farm', 'farm']);
  });
});

describe('removeCard', () => {
  it('removes only the first occurrence of a duplicated card', () => {
    expect(removeCard(['farm', 'library', 'farm'], 'farm')).toEqual(['library', 'farm']);
  });

  it('rejects a cardId not present in the deck', () => {
    expect(removeCard(['farm'], 'library')).toBe('invalid');
  });

  it('does not mutate the input', () => {
    const deck = ['farm', 'library'];
    removeCard(deck, 'farm');
    expect(deck).toEqual(['farm', 'library']);
  });
});

describe('groupCounts', () => {
  it('preserves first-seen order', () => {
    expect(groupCounts(['library', 'farm', 'library'])).toEqual([
      { cardId: 'library', count: 2 },
      { cardId: 'farm', count: 1 },
    ]);
  });

  it('counts duplicates correctly', () => {
    expect(groupCounts(['farm', 'farm', 'farm'])).toEqual([{ cardId: 'farm', count: 3 }]);
  });

  it('returns an empty list for empty input', () => {
    expect(groupCounts([])).toEqual([]);
  });
});

describe('resolveDeckCards', () => {
  const decks: DeckDef[] = [
    { id: 'a', name: 'A', cards: ['farm'] },
    { id: 'b', name: 'B', cards: ['library'] },
  ];

  it('resolves a matching deckId', () => {
    expect(resolveDeckCards('b', decks)).toEqual(['library']);
  });

  it('returns undefined for an unresolvable deckId', () => {
    expect(resolveDeckCards('nope', decks)).toBeUndefined();
  });
});

describe('cloneDecks', () => {
  it('deep-copies so mutating a clone does not affect the source', () => {
    const source: DeckDef[] = [{ id: 'a', name: 'A', cards: ['farm'] }];
    const cloned = cloneDecks(source);
    cloned[0].cards.push('library');
    cloned[0].name = 'changed';
    expect(source[0].cards).toEqual(['farm']);
    expect(source[0].name).toBe('A');
  });

  it('preserves content', () => {
    const source: DeckDef[] = [{ id: 'a', name: 'A', cards: ['farm', 'library'] }];
    expect(cloneDecks(source)).toEqual(source);
  });
});
