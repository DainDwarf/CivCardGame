import { describe, it, expect } from 'vitest';
import {
  copiesOwned,
  isOwned,
  collectionFromCounts,
  grantCopies,
  emptyCollection,
  findInstance,
  isStickerFull,
  stickerableInstancesOf,
  distinctCardIdsOwned,
} from './collection';
import { buildSeedDecks, MIN_DECK_SIZE } from './deckBuilder';
import { DEFAULT_DECKS } from '../content/decks';
import { STARTING_COLLECTION } from '../content/collection';

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

describe('distinctCardIdsOwned', () => {
  it('collapses multiple copies of a card to a single id (counts card types, not copies)', () => {
    const collection = collectionFromCounts({ farm: 3, house: 1 });
    expect(distinctCardIdsOwned(collection).sort()).toEqual(['farm', 'house']);
  });

  it('is empty for a fresh collection', () => {
    expect(distinctCardIdsOwned(emptyCollection())).toEqual([]);
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

describe('isStickerFull', () => {
  it('is false with no stickers or just one', () => {
    expect(isStickerFull({ id: '0', cardId: 'farm' })).toBe(false);
    expect(isStickerFull({ id: '0', cardId: 'farm', stickers: ['reinforced'] })).toBe(false);
  });

  it('is true once at MAX_STICKERS, even as duplicates of the same sticker', () => {
    expect(isStickerFull({ id: '0', cardId: 'farm', stickers: ['reinforced', 'reinforced'] })).toBe(true);
    expect(isStickerFull({ id: '0', cardId: 'farm', stickers: ['reinforced', 'efficient'] })).toBe(true);
  });
});

describe('stickerableInstancesOf', () => {
  it('includes a once-stickered instance (room for a second)', () => {
    let collection = grantCopies(emptyCollection(), 'farm', 1);
    const [a] = collection.instances.map((i) => i.id);
    collection = { ...collection, instances: collection.instances.map((i) => (i.id === a ? { ...i, stickers: ['reinforced'] } : i)) };
    expect(stickerableInstancesOf(collection, 'farm').map((i) => i.id)).toEqual([a]);
  });

  it('excludes a full instance', () => {
    let collection = grantCopies(emptyCollection(), 'farm', 1);
    const [a] = collection.instances.map((i) => i.id);
    collection = {
      ...collection,
      instances: collection.instances.map((i) => (i.id === a ? { ...i, stickers: ['reinforced', 'efficient'] } : i)),
    };
    expect(stickerableInstancesOf(collection, 'farm')).toEqual([]);
  });
});
// Content↔content coherence (re-armed in Step 3): the starting collection must own enough copies of
// every card in every `DEFAULT_DECKS` seed. `buildSeedDecks` *silently drops* any occurrence the
// collection can't cover, so an under-provisioned collection yields a resolved deck shorter than its
// seed — which would then fall below the committed `MIN_DECK_SIZE` floor a fresh player launches with.
// Asserting the *resolved* deck size catches that in one check (a data-coherence check, never deferred).
describe('STARTING_COLLECTION covers DEFAULT_DECKS', () => {
  const resolved = buildSeedDecks(DEFAULT_DECKS, collectionFromCounts(STARTING_COLLECTION));

  it('resolves every seed deck (none dropped by an unresolvable id)', () => {
    expect(resolved.length).toBe(DEFAULT_DECKS.length);
  });

  it('every resolved deck still meets the minimum deck size (collection fully covers the seed)', () => {
    resolved.forEach((deck, i) => {
      expect(deck.cards.length, `${deck.id}: ${deck.cards.length} resolved vs ${DEFAULT_DECKS[i].cards.length} seeded`)
        .toBeGreaterThanOrEqual(MIN_DECK_SIZE);
      expect(deck.cards.length).toBe(DEFAULT_DECKS[i].cards.length);
    });
  });
});
