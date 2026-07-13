import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  addCard,
  removeCard,
  addInstance,
  removeInstance,
  groupCounts,
  resolveDeckCards,
  buildSeedDecks,
  decksContaining,
  deckWonderCount,
} from './deckBuilder';
import type { CardDef } from '../content/cards';
import type { DeckDef, DeckSeed } from '../content/decks';
import { collectionFromCounts, type OwnedCards } from './collection';
import { installFixtures, uninstallFixtures, installCards, uninstallCards } from './testFixtures';

// A second distinct wonder (the shared `test_wonder` fixture is the first) — the one-wonder-per-deck
// cap only bites across *different* wonders, so a real test needs two.
const LOCAL_WONDERS: Record<string, CardDef> = {
  test_wonder2: { id: 'test_wonder2', name: 'Test Wonder 2', kind: 'wonder', cost: { production: 2 }, produces: { culture: 1 }, workers: 1 },
};

beforeAll(() => {
  installFixtures();
  installCards(LOCAL_WONDERS);
});
afterAll(() => {
  uninstallCards(LOCAL_WONDERS);
  uninstallFixtures();
});

// Generous ownership so tests unrelated to the copy cap aren't gated by it.
const GENEROUS: OwnedCards = collectionFromCounts({ test_food: 8, test_sci: 8 });

/** The instance id `collectionFromCounts` assigns to the Nth (0-indexed) granted copy of
 *  `cardId`, given the same counts map / grant order as `GENEROUS` above. */
function foodId(n: number): string {
  return GENEROUS.instances.filter((i) => i.cardId === 'test_food')[n].id;
}
function sciId(n: number): string {
  return GENEROUS.instances.filter((i) => i.cardId === 'test_sci')[n].id;
}

/** `GENEROUS` with `instanceId` mutated to carry a sticker — for Step 7.5's fungible-pool
 *  exclusion tests. */
function withSticker(instanceId: string): OwnedCards {
  return {
    ...GENEROUS,
    instances: GENEROUS.instances.map((i) => (i.id === instanceId ? { ...i, stickers: ['test_addgain'] } : i)),
  };
}

describe('addCard', () => {
  it('appends a valid card', () => {
    expect(addCard([foodId(0)], 'test_sci', GENEROUS)).toEqual([foodId(0), sciId(0)]);
  });

  it('rejects an unknown cardId', () => {
    expect(addCard([foodId(0)], 'not-a-card', GENEROUS)).toBe('invalid');
  });

  it('does not mutate the input', () => {
    const deck = [foodId(0)];
    addCard(deck, 'test_sci', GENEROUS);
    expect(deck).toEqual([foodId(0)]);
  });

  it('works starting from an empty deck', () => {
    expect(addCard([], 'test_food', GENEROUS)).toEqual([foodId(0)]);
  });

  it('rejects a not-yet-unlocked card', () => {
    expect(addCard([], 'test_food', collectionFromCounts({}))).toBe('invalid');
  });

  it('rejects adding past the owned copy count', () => {
    const owns2 = collectionFromCounts({ test_food: 2 });
    const [a, b] = owns2.instances.map((i) => i.id);
    expect(addCard([a], 'test_food', owns2)).toEqual([a, b]);
    expect(addCard([a, b], 'test_food', owns2)).toBe('invalid');
  });

  it('rejects an event card even if somehow "owned"', () => {
    const owns = collectionFromCounts({ test_event: 8 });
    expect(addCard([], 'test_event', owns)).toBe('invalid');
  });

  it('rejects a threat card even if somehow "owned"', () => {
    const owns = collectionFromCounts({ test_threat: 8 });
    expect(addCard([], 'test_threat', owns)).toBe('invalid');
  });

  it('rejects an objective card even if somehow "owned"', () => {
    const owns = collectionFromCounts({ test_objective: 8 });
    expect(addCard([], 'test_objective', owns)).toBe('invalid');
  });

  it('skips a stickered instance — never picked by the fungible LIFO order', () => {
    const owns2 = collectionFromCounts({ test_food: 2 });
    const [a, b] = owns2.instances.map((i) => i.id);
    const stickered = { ...owns2, instances: owns2.instances.map((i) => (i.id === a ? { ...i, stickers: ['test_addgain'] } : i)) };
    // The lowest-index instance (a) is stickered, so the add should reach for b instead.
    expect(addCard([], 'test_food', stickered)).toEqual([b]);
  });

  it('rejects once every unstickered copy is in the deck, even with a stickered copy still spare', () => {
    const owns2 = collectionFromCounts({ test_food: 2 });
    const [a, b] = owns2.instances.map((i) => i.id);
    const stickered = { ...owns2, instances: owns2.instances.map((i) => (i.id === a ? { ...i, stickers: ['test_addgain'] } : i)) };
    expect(addCard([b], 'test_food', stickered)).toBe('invalid');
  });
});

describe('one wonder per deck', () => {
  // Own both distinct wonders plus a filler card.
  const owned = collectionFromCounts({ test_wonder: 1, test_wonder2: 1, test_food: 2 });
  const wid = (cardId: string) => owned.instances.find((i) => i.cardId === cardId)!.id;

  it('deckWonderCount counts only wonder instances', () => {
    expect(deckWonderCount([wid('test_wonder'), wid('test_food')], owned)).toBe(1);
    expect(deckWonderCount([wid('test_food')], owned)).toBe(0);
  });

  it('accepts the first wonder', () => {
    expect(addCard([], 'test_wonder', owned)).toEqual([wid('test_wonder')]);
  });

  it('rejects a second, *different* wonder once one is already in the deck', () => {
    expect(addCard([wid('test_wonder')], 'test_wonder2', owned)).toBe('invalid');
  });

  it('a non-wonder card is unaffected by the wonder already in the deck', () => {
    expect(addCard([wid('test_wonder')], 'test_food', owned)).toEqual([wid('test_wonder'), wid('test_food')]);
  });

  it('addInstance also rejects a second wonder (the by-identity add path)', () => {
    expect(addInstance([wid('test_wonder')], wid('test_wonder2'), owned)).toBe('invalid');
  });
});

describe('removeCard', () => {
  it('removes the highest-index in-deck instance, not deck-array order', () => {
    // foodId(1) sits before foodId(0) in the deck array; the highest-*index* owned
    // instance (foodId(1)) should still be the one that leaves.
    const deck = [foodId(1), sciId(0), foodId(0)];
    const next = removeCard(deck, 'test_food', GENEROUS);
    expect(next).toEqual([sciId(0), foodId(0)]);
  });

  it('rejects a cardId not present in the deck', () => {
    expect(removeCard([foodId(0)], 'test_sci', GENEROUS)).toBe('invalid');
  });

  it('does not mutate the input', () => {
    const deck = [foodId(0), sciId(0)];
    removeCard(deck, 'test_food', GENEROUS);
    expect(deck).toEqual([foodId(0), sciId(0)]);
  });

  it('round-trips with addCard: remove then re-add returns the same instance', () => {
    const deck = [foodId(0), foodId(1)];
    const removed = removeCard(deck, 'test_food', GENEROUS) as string[];
    const readded = addCard(removed, 'test_food', GENEROUS) as string[];
    expect(readded.sort()).toEqual(deck.sort());
  });

  it('never removes a stickered instance, even if it is the highest-index in-deck copy', () => {
    const stickered = withSticker(foodId(1));
    const deck = [foodId(0), foodId(1)];
    // foodId(1) is stickered — the fungible remove must fall back to foodId(0) instead.
    expect(removeCard(deck, 'test_food', stickered)).toEqual([foodId(1)]);
  });
});

describe('addInstance / removeInstance', () => {
  it('adds a specific instance by identity', () => {
    expect(addInstance([], foodId(0), GENEROUS)).toEqual([foodId(0)]);
  });

  it('rejects an instance already in the deck', () => {
    expect(addInstance([foodId(0)], foodId(0), GENEROUS)).toBe('invalid');
  });

  it('rejects an instance the collection does not own', () => {
    expect(addInstance([], 'not-owned', GENEROUS)).toBe('invalid');
  });

  it('removes a specific instance by identity', () => {
    expect(removeInstance([foodId(0), foodId(1)], foodId(0))).toEqual([foodId(1)]);
  });

  it('rejects removing an instance not in the deck', () => {
    expect(removeInstance([foodId(0)], foodId(1))).toBe('invalid');
  });
});

describe('groupCounts', () => {
  it('orders entries by kind then name, independent of deck-array order', () => {
    // Same cards, opposite input order → identical output (Test Food sorts before Test Science by name).
    const expected = [
      { cardId: 'test_food', count: 1 },
      { cardId: 'test_sci', count: 2 },
    ];
    expect(groupCounts([sciId(0), foodId(0), sciId(1)], GENEROUS)).toEqual(expected);
    expect(groupCounts([foodId(0), sciId(1), sciId(0)], GENEROUS)).toEqual(expected);
  });

  it('counts duplicates correctly', () => {
    expect(groupCounts([foodId(0), foodId(1), foodId(2)], GENEROUS)).toEqual([{ cardId: 'test_food', count: 3 }]);
  });

  it('returns an empty list for empty input', () => {
    expect(groupCounts([], GENEROUS)).toEqual([]);
  });

  it('silently skips an instance id the collection no longer recognizes', () => {
    expect(groupCounts(['stale-id', foodId(0)], GENEROUS)).toEqual([{ cardId: 'test_food', count: 1 }]);
  });

  it('breaks a stickered instance out of the fungible stack into its own entry', () => {
    const stickered = withSticker(foodId(1));
    expect(groupCounts([foodId(0), foodId(1)], stickered)).toEqual([
      { cardId: 'test_food', count: 1 },
      { cardId: 'test_food', count: 1, instanceId: foodId(1), stickers: ['test_addgain'] },
    ]);
  });

  it("sorts a stickered break-out into its card's slot, not globally after the fungibles", () => {
    const stickered = withSticker(foodId(0));
    expect(groupCounts([foodId(0), sciId(0)], stickered)).toEqual([
      { cardId: 'test_food', count: 1, instanceId: foodId(0), stickers: ['test_addgain'] },
      { cardId: 'test_sci', count: 1 },
    ]);
  });
});

describe('resolveDeckCards', () => {
  const decks: DeckDef[] = [
    { id: 'a', name: 'A', cards: [foodId(0)] },
    { id: 'b', name: 'B', cards: [sciId(0)] },
  ];

  it('resolves a matching deckId to cardId + sticker entries', () => {
    expect(resolveDeckCards('b', decks, GENEROUS)).toEqual([{ cardId: 'test_sci' }]);
  });

  it('returns undefined for an unresolvable deckId', () => {
    expect(resolveDeckCards('nope', decks, GENEROUS)).toBeUndefined();
  });

  it("carries a stickered instance's stickers along, copied rather than aliased", () => {
    const collection = withSticker(foodId(0));
    const result = resolveDeckCards('a', decks, collection);
    expect(result).toEqual([{ cardId: 'test_food', stickers: ['test_addgain'] }]);
    const stickeredInstance = collection.instances.find((i) => i.id === foodId(0))!;
    expect(result![0].stickers).not.toBe(stickeredInstance.stickers);
  });
});

describe('decksContaining', () => {
  const decks: DeckDef[] = [
    { id: 'a', name: 'A', cards: [foodId(0)] },
    { id: 'b', name: 'B', cards: [foodId(0), sciId(0)] },
    { id: 'c', name: 'C', cards: [sciId(1)] },
  ];

  it('finds every deck holding the instance', () => {
    expect(decksContaining(foodId(0), decks).map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list for an owned instance in no deck', () => {
    expect(decksContaining(foodId(1), decks)).toEqual([]);
  });
});

describe('buildSeedDecks', () => {
  it('resolves each seed cardId to a distinct owned instance', () => {
    const collection = collectionFromCounts({ test_food: 2, test_sci: 1 });
    const seeds: DeckSeed[] = [{ id: 'a', name: 'A', cards: ['test_food', 'test_food', 'test_sci'] }];
    const [deck] = buildSeedDecks(seeds, collection);
    expect(deck.cards.length).toBe(3);
    expect(new Set(deck.cards).size).toBe(3);
    expect(resolveDeckCards('a', [deck], collection)).toEqual([{ cardId: 'test_food' }, { cardId: 'test_food' }, { cardId: 'test_sci' }]);
  });

  it('does not share instances across two seed decks', () => {
    const collection = collectionFromCounts({ test_food: 2 });
    const seeds: DeckSeed[] = [
      { id: 'a', name: 'A', cards: ['test_food'] },
      { id: 'b', name: 'B', cards: ['test_food'] },
    ];
    const [a, b] = buildSeedDecks(seeds, collection);
    expect(a.cards[0]).not.toBe(b.cards[0]);
  });

  it('drops an occurrence that outruns the owned count rather than throwing', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const seeds: DeckSeed[] = [{ id: 'a', name: 'A', cards: ['test_food', 'test_food'] }];
    const [deck] = buildSeedDecks(seeds, collection);
    expect(deck.cards.length).toBe(1);
  });
});
