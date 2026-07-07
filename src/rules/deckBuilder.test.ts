import { describe, it, expect } from 'vitest';
import { addCard, removeCard, groupCounts, resolveDeckCards, buildSeedDecks, decksContaining } from './deckBuilder';
import type { DeckDef, DeckSeed } from '../content/decks';
import { collectionFromCounts, type OwnedCards } from './collection';

// Generous ownership so tests unrelated to the copy cap aren't gated by it.
const GENEROUS: OwnedCards = collectionFromCounts({ farm: 8, library: 8 });

/** The instance id `collectionFromCounts` assigns to the Nth (0-indexed) granted copy of
 *  `cardId`, given the same counts map / grant order as `GENEROUS` above. */
function farmId(n: number): string {
  return GENEROUS.instances.filter((i) => i.cardId === 'farm')[n].id;
}
function libraryId(n: number): string {
  return GENEROUS.instances.filter((i) => i.cardId === 'library')[n].id;
}

describe('addCard', () => {
  it('appends a valid card', () => {
    expect(addCard([farmId(0)], 'library', GENEROUS)).toEqual([farmId(0), libraryId(0)]);
  });

  it('rejects an unknown cardId', () => {
    expect(addCard([farmId(0)], 'not-a-card', GENEROUS)).toBe('invalid');
  });

  it('does not mutate the input', () => {
    const deck = [farmId(0)];
    addCard(deck, 'library', GENEROUS);
    expect(deck).toEqual([farmId(0)]);
  });

  it('works starting from an empty deck', () => {
    expect(addCard([], 'farm', GENEROUS)).toEqual([farmId(0)]);
  });

  it('rejects a not-yet-unlocked card', () => {
    expect(addCard([], 'farm', collectionFromCounts({}))).toBe('invalid');
  });

  it('rejects adding past the owned copy count', () => {
    const owns2 = collectionFromCounts({ farm: 2 });
    const [a, b] = owns2.instances.map((i) => i.id);
    expect(addCard([a], 'farm', owns2)).toEqual([a, b]);
    expect(addCard([a, b], 'farm', owns2)).toBe('invalid');
  });

  it('rejects an event card even if somehow "owned"', () => {
    const owns = collectionFromCounts({ barbarian: 8 });
    expect(addCard([], 'barbarian', owns)).toBe('invalid');
  });

  it('rejects a threat card even if somehow "owned"', () => {
    const owns = collectionFromCounts({ harsh_winter: 8 });
    expect(addCard([], 'harsh_winter', owns)).toBe('invalid');
  });
});

describe('removeCard', () => {
  it('removes an instance of the given cardId', () => {
    const deck = [farmId(0), libraryId(0), farmId(1)];
    const next = removeCard(deck, 'farm', GENEROUS);
    expect(next).not.toBe('invalid');
    expect((next as string[]).sort()).toEqual([farmId(1), libraryId(0)].sort());
  });

  it('rejects a cardId not present in the deck', () => {
    expect(removeCard([farmId(0)], 'library', GENEROUS)).toBe('invalid');
  });

  it('does not mutate the input', () => {
    const deck = [farmId(0), libraryId(0)];
    removeCard(deck, 'farm', GENEROUS);
    expect(deck).toEqual([farmId(0), libraryId(0)]);
  });
});

describe('groupCounts', () => {
  it('preserves first-seen order', () => {
    expect(groupCounts([libraryId(0), farmId(0), libraryId(1)], GENEROUS)).toEqual([
      { cardId: 'library', count: 2 },
      { cardId: 'farm', count: 1 },
    ]);
  });

  it('counts duplicates correctly', () => {
    expect(groupCounts([farmId(0), farmId(1), farmId(2)], GENEROUS)).toEqual([{ cardId: 'farm', count: 3 }]);
  });

  it('returns an empty list for empty input', () => {
    expect(groupCounts([], GENEROUS)).toEqual([]);
  });

  it('silently skips an instance id the collection no longer recognizes', () => {
    expect(groupCounts(['stale-id', farmId(0)], GENEROUS)).toEqual([{ cardId: 'farm', count: 1 }]);
  });
});

describe('resolveDeckCards', () => {
  const decks: DeckDef[] = [
    { id: 'a', name: 'A', cards: [farmId(0)] },
    { id: 'b', name: 'B', cards: [libraryId(0)] },
  ];

  it('resolves a matching deckId to cardIds', () => {
    expect(resolveDeckCards('b', decks, GENEROUS)).toEqual(['library']);
  });

  it('returns undefined for an unresolvable deckId', () => {
    expect(resolveDeckCards('nope', decks, GENEROUS)).toBeUndefined();
  });
});

describe('decksContaining', () => {
  const decks: DeckDef[] = [
    { id: 'a', name: 'A', cards: [farmId(0)] },
    { id: 'b', name: 'B', cards: [farmId(0), libraryId(0)] },
    { id: 'c', name: 'C', cards: [libraryId(1)] },
  ];

  it('finds every deck holding the instance', () => {
    expect(decksContaining(farmId(0), decks).map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list for an owned instance in no deck', () => {
    expect(decksContaining(farmId(1), decks)).toEqual([]);
  });
});

describe('buildSeedDecks', () => {
  it('resolves each seed cardId to a distinct owned instance', () => {
    const collection = collectionFromCounts({ farm: 2, library: 1 });
    const seeds: DeckSeed[] = [{ id: 'a', name: 'A', cards: ['farm', 'farm', 'library'] }];
    const [deck] = buildSeedDecks(seeds, collection);
    expect(deck.cards.length).toBe(3);
    expect(new Set(deck.cards).size).toBe(3);
    expect(resolveDeckCards('a', [deck], collection)).toEqual(['farm', 'farm', 'library']);
  });

  it('does not share instances across two seed decks', () => {
    const collection = collectionFromCounts({ farm: 2 });
    const seeds: DeckSeed[] = [
      { id: 'a', name: 'A', cards: ['farm'] },
      { id: 'b', name: 'B', cards: ['farm'] },
    ];
    const [a, b] = buildSeedDecks(seeds, collection);
    expect(a.cards[0]).not.toBe(b.cards[0]);
  });

  it('drops an occurrence that outruns the owned count rather than throwing', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const seeds: DeckSeed[] = [{ id: 'a', name: 'A', cards: ['farm', 'farm'] }];
    const [deck] = buildSeedDecks(seeds, collection);
    expect(deck.cards.length).toBe(1);
  });
});
