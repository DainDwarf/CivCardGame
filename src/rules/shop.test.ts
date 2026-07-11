import { describe, it, expect } from 'vitest';
import { nextTier, buyTier, canBuyTier } from './shop';
import { copiesOwned, collectionFromCounts } from './collection';

describe('nextTier', () => {
  it('walks the ×1 → ×2 → ×4 → ×8 ladder with its costs', () => {
    expect(nextTier(1)).toEqual({ to: 2, cost: 1 });
    expect(nextTier(2)).toEqual({ to: 4, cost: 2 });
    expect(nextTier(4)).toEqual({ to: 8, cost: 5 });
  });

  it('returns null at the terminal tier (×8)', () => {
    expect(nextTier(8)).toBeNull();
  });

  it('returns null for a not-owned card (0 copies) and off-ladder counts', () => {
    expect(nextTier(0)).toBeNull();
    expect(nextTier(3)).toBeNull();
  });
});

describe('buyTier', () => {
  it('deducts the cost and bumps the card to its next tier', () => {
    const result = buyTier(collectionFromCounts({ farm: 1 }), 5, 'farm');
    expect(result!.influence).toBe(4);
    expect(copiesOwned(result!.collection, 'farm')).toBe(2);
  });

  it('upgrades ×4 to ×8', () => {
    const result = buyTier(collectionFromCounts({ farm: 4 }), 5, 'farm');
    expect(result!.influence).toBe(0);
    expect(copiesOwned(result!.collection, 'farm')).toBe(8);
  });

  it('grants fresh instances distinct from the ones already owned', () => {
    const before = collectionFromCounts({ farm: 1 });
    const result = buyTier(before, 5, 'farm')!;
    const ids = result.collection.instances.filter((i) => i.cardId === 'farm').map((i) => i.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(before.instances[0].id);
  });

  it('does not mutate the input collection', () => {
    const collection = collectionFromCounts({ farm: 1 });
    buyTier(collection, 5, 'farm');
    expect(copiesOwned(collection, 'farm')).toBe(1);
  });

  it('returns null when the card is not owned', () => {
    expect(buyTier(collectionFromCounts({}), 99, 'farm')).toBeNull();
  });

  it('returns null when the card is already at its cap', () => {
    expect(buyTier(collectionFromCounts({ farm: 8 }), 99, 'farm')).toBeNull();
  });

  it('returns null when the player cannot afford the upgrade', () => {
    // ×2 → ×4 costs 2; with only 1 Influence it must fail and spend nothing.
    expect(buyTier(collectionFromCounts({ farm: 2 }), 1, 'farm')).toBeNull();
  });

  it('rejects a wonder outright — wonders are unique, copies can never be bought', () => {
    // Göbekli Tepe is a `kind: 'wonder'` card; even owned and affordable, no tier is buyable.
    const owned = collectionFromCounts({ gobekli_tepe: 1 });
    expect(buyTier(owned, 99, 'gobekli_tepe')).toBeNull();
    expect(canBuyTier(owned, 99, 'gobekli_tepe')).toBe(false);
  });
});
