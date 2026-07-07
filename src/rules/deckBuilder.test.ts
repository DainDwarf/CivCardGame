import { describe, it, expect } from 'vitest';
import {
  addCard,
  removeCard,
  addInstance,
  removeInstance,
  groupCounts,
  resolveDeckCards,
  buildSeedDecks,
  decksContaining,
} from './deckBuilder';
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

/** `GENEROUS` with `instanceId` mutated to carry a sticker — for Step 7.5's fungible-pool
 *  exclusion tests. */
function withSticker(instanceId: string): OwnedCards {
  return {
    ...GENEROUS,
    instances: GENEROUS.instances.map((i) => (i.id === instanceId ? { ...i, stickers: ['reinforced'] } : i)),
  };
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

  it('skips a stickered instance — never picked by the fungible LIFO order', () => {
    const owns2 = collectionFromCounts({ farm: 2 });
    const [a, b] = owns2.instances.map((i) => i.id);
    const stickered = { ...owns2, instances: owns2.instances.map((i) => (i.id === a ? { ...i, stickers: ['reinforced'] } : i)) };
    // The lowest-index instance (a) is stickered, so the add should reach for b instead.
    expect(addCard([], 'farm', stickered)).toEqual([b]);
  });

  it('rejects once every unstickered copy is in the deck, even with a stickered copy still spare', () => {
    const owns2 = collectionFromCounts({ farm: 2 });
    const [a, b] = owns2.instances.map((i) => i.id);
    const stickered = { ...owns2, instances: owns2.instances.map((i) => (i.id === a ? { ...i, stickers: ['reinforced'] } : i)) };
    expect(addCard([b], 'farm', stickered)).toBe('invalid');
  });
});

describe('removeCard', () => {
  it('removes the highest-index in-deck instance, not deck-array order', () => {
    // farmId(1) sits before farmId(0) in the deck array; the highest-*index* owned
    // instance (farmId(1)) should still be the one that leaves.
    const deck = [farmId(1), libraryId(0), farmId(0)];
    const next = removeCard(deck, 'farm', GENEROUS);
    expect(next).toEqual([libraryId(0), farmId(0)]);
  });

  it('rejects a cardId not present in the deck', () => {
    expect(removeCard([farmId(0)], 'library', GENEROUS)).toBe('invalid');
  });

  it('does not mutate the input', () => {
    const deck = [farmId(0), libraryId(0)];
    removeCard(deck, 'farm', GENEROUS);
    expect(deck).toEqual([farmId(0), libraryId(0)]);
  });

  it('round-trips with addCard: remove then re-add returns the same instance', () => {
    const deck = [farmId(0), farmId(1)];
    const removed = removeCard(deck, 'farm', GENEROUS) as string[];
    const readded = addCard(removed, 'farm', GENEROUS) as string[];
    expect(readded.sort()).toEqual(deck.sort());
  });

  it('never removes a stickered instance, even if it is the highest-index in-deck copy', () => {
    const stickered = withSticker(farmId(1));
    const deck = [farmId(0), farmId(1)];
    // farmId(1) is stickered — the fungible remove must fall back to farmId(0) instead.
    expect(removeCard(deck, 'farm', stickered)).toEqual([farmId(1)]);
  });
});

describe('addInstance / removeInstance', () => {
  it('adds a specific instance by identity', () => {
    expect(addInstance([], farmId(0), GENEROUS)).toEqual([farmId(0)]);
  });

  it('rejects an instance already in the deck', () => {
    expect(addInstance([farmId(0)], farmId(0), GENEROUS)).toBe('invalid');
  });

  it('rejects an instance the collection does not own', () => {
    expect(addInstance([], 'not-owned', GENEROUS)).toBe('invalid');
  });

  it('removes a specific instance by identity', () => {
    expect(removeInstance([farmId(0), farmId(1)], farmId(0))).toEqual([farmId(1)]);
  });

  it('rejects removing an instance not in the deck', () => {
    expect(removeInstance([farmId(0)], farmId(1))).toBe('invalid');
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

  it('breaks a stickered instance out of the fungible stack into its own entry', () => {
    const stickered = withSticker(farmId(1));
    expect(groupCounts([farmId(0), farmId(1)], stickered)).toEqual([
      { cardId: 'farm', count: 1 },
      { cardId: 'farm', count: 1, instanceId: farmId(1), stickers: ['reinforced'] },
    ]);
  });

  it('appends stickered entries after every fungible group', () => {
    const stickered = withSticker(farmId(0));
    expect(groupCounts([farmId(0), libraryId(0)], stickered)).toEqual([
      { cardId: 'library', count: 1 },
      { cardId: 'farm', count: 1, instanceId: farmId(0), stickers: ['reinforced'] },
    ]);
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
