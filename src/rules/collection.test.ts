import { describe, it, expect } from 'vitest';
import { copiesOwned, isOwned, collectionFromCounts, grantCopies, emptyCollection, findInstance } from './collection';
import { STARTING_COLLECTION } from '../content/collection';
import { DEFAULT_DECKS } from '../content/decks';
import { groupCounts, buildSeedDecks } from './deckBuilder';

describe('copiesOwned', () => {
  it('returns the raw count for an owned card', () => {
    expect(copiesOwned(collectionFromCounts({ farm: 2 }), 'farm')).toBe(2);
  });

  it('returns 0 for a card with no entry', () => {
    expect(copiesOwned(emptyCollection(), 'farm')).toBe(0);
  });
});

describe('isOwned', () => {
  it('is true for any positive copy count', () => {
    expect(isOwned(collectionFromCounts({ farm: 1 }), 'farm')).toBe(true);
  });

  it('is false with no entry', () => {
    expect(isOwned(emptyCollection(), 'farm')).toBe(false);
  });
});

describe('grantCopies', () => {
  it('appends new instances with fresh, never-reused ids', () => {
    let collection = grantCopies(emptyCollection(), 'farm', 2);
    expect(copiesOwned(collection, 'farm')).toBe(2);
    collection = grantCopies(collection, 'farm', 1);
    expect(copiesOwned(collection, 'farm')).toBe(3);
    const ids = collection.instances.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not mutate the input collection', () => {
    const collection = emptyCollection();
    grantCopies(collection, 'farm', 2);
    expect(collection.instances).toEqual([]);
  });
});

describe('findInstance', () => {
  it('resolves an owned instance by id', () => {
    const collection = grantCopies(emptyCollection(), 'farm', 1);
    const id = collection.instances[0].id;
    expect(findInstance(collection, id)).toEqual({ id, cardId: 'farm' });
  });

  it('returns undefined for an unknown id', () => {
    expect(findInstance(emptyCollection(), 'nope')).toBeUndefined();
  });
});

describe('STARTING_COLLECTION', () => {
  it('owns enough copies of every card in the starting deck', () => {
    const collection = collectionFromCounts(STARTING_COLLECTION);
    const startingDeck = buildSeedDecks(DEFAULT_DECKS, collection).find((d) => d.id === 'starter')!.cards;
    for (const { cardId, count } of groupCounts(startingDeck, collection)) {
      const owned = copiesOwned(collection, cardId);
      expect(owned >= count, `${cardId}: owns ${owned}, deck needs ${count}`).toBe(true);
    }
  });
});
