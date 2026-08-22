import { describe, it, expect } from 'vitest';
import { nextTier, buyTier, canBuyTier, copyPrice, COPY_PRICE_BY_AGE, TIER_LADDER } from './shop';
import { copiesOwned, collectionFromCounts } from './collection';
import { cardAge } from '../content/cardAge';

const TERMINAL = TIER_LADDER[TIER_LADDER.length - 1].to;
const stonePrice = COPY_PRICE_BY_AGE.stone;

describe('copyPrice', () => {
  it('charges the card\'s age band, flat', () => {
    expect(copyPrice('farm')).toBe(COPY_PRICE_BY_AGE[cardAge('farm')!]);
    expect(copyPrice('house')).toBe(COPY_PRICE_BY_AGE[cardAge('house')!]);
  });

  it('leaves a card the campaign never hands out unpriced, and so unsellable', () => {
    // A board's `prebuilt` structure: nobody can own it, so it has no age and no price.
    expect(copyPrice('war_camp')).toBeUndefined();
    expect(nextTier('war_camp', 1)).toBeNull();
  });
});

describe('nextTier', () => {
  it('walks one copy per rung to the terminal tier', () => {
    expect(TIER_LADDER.map((r) => [r.from, r.to])).toEqual(
      TIER_LADDER.map((_, i) => [i + 1, i + 2]),
    );
    for (const rung of TIER_LADDER) {
      expect(nextTier('farm', rung.from)).toEqual({ to: rung.to, cost: stonePrice });
    }
  });

  it('prices every rung the same, and a later age dearer', () => {
    const costs = TIER_LADDER.map((rung) => nextTier('house', rung.from)!.cost);
    expect(new Set(costs).size).toBe(1);
    expect(costs[0]).toBeGreaterThan(stonePrice);
  });

  it('returns null at the terminal tier', () => {
    expect(nextTier('farm', TERMINAL)).toBeNull();
  });

  it('returns null for a not-owned card (0 copies) and off-ladder counts', () => {
    expect(nextTier('farm', 0)).toBeNull();
    expect(nextTier('farm', TERMINAL + 1)).toBeNull();
  });
});

describe('buyTier', () => {
  it('deducts the cost and bumps the card by one copy', () => {
    const result = buyTier(collectionFromCounts({ farm: 1 }), 99, 'farm');
    expect(result!.influence).toBe(99 - stonePrice);
    expect(copiesOwned(result!.collection, 'farm')).toBe(2);
  });

  it('buys the last rung up to the terminal tier', () => {
    const result = buyTier(collectionFromCounts({ farm: TERMINAL - 1 }), stonePrice, 'farm');
    expect(result!.influence).toBe(0);
    expect(copiesOwned(result!.collection, 'farm')).toBe(TERMINAL);
  });

  it('grants fresh instances distinct from the ones already owned', () => {
    const before = collectionFromCounts({ farm: 1 });
    const result = buyTier(before, 99, 'farm')!;
    const ids = result.collection.instances.filter((i) => i.cardId === 'farm').map((i) => i.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(before.instances[0].id);
  });

  it('does not mutate the input collection', () => {
    const collection = collectionFromCounts({ farm: 1 });
    buyTier(collection, 99, 'farm');
    expect(copiesOwned(collection, 'farm')).toBe(1);
  });

  it('returns null when the card is not owned', () => {
    expect(buyTier(collectionFromCounts({}), 99, 'farm')).toBeNull();
  });

  it('returns null when the card is already at its cap', () => {
    expect(buyTier(collectionFromCounts({ farm: TERMINAL }), 99, 'farm')).toBeNull();
  });

  it('returns null when the player cannot afford the upgrade', () => {
    expect(buyTier(collectionFromCounts({ farm: 2 }), stonePrice - 1, 'farm')).toBeNull();
  });

  it('rejects a wonder outright — wonders are unique, copies can never be bought', () => {
    // Göbekli Tepe is a `kind: 'wonder'` card; even owned and affordable, no tier is buyable.
    const owned = collectionFromCounts({ gobekli_tepe: 1 });
    expect(buyTier(owned, 99, 'gobekli_tepe')).toBeNull();
    expect(canBuyTier(owned, 99, 'gobekli_tepe')).toBe(false);
  });
});
