import { describe, it, expect } from 'vitest';
import { nextTier, buyTier } from './shop';

describe('nextTier', () => {
  it('walks the ×1 → ×2 → ×4 → unlimited ladder with its costs', () => {
    expect(nextTier(1)).toEqual({ to: 2, cost: 1 });
    expect(nextTier(2)).toEqual({ to: 4, cost: 2 });
    expect(nextTier(4)).toEqual({ to: 'unlimited', cost: 5 });
  });

  it('returns null at the terminal tier (unlimited)', () => {
    expect(nextTier('unlimited')).toBeNull();
  });

  it('returns null for a not-owned card (0 copies) and off-ladder counts', () => {
    expect(nextTier(0)).toBeNull();
    expect(nextTier(3)).toBeNull();
  });
});

describe('buyTier', () => {
  it('deducts the cost and bumps the card to its next tier', () => {
    const result = buyTier({ farm: 1 }, 5, 'farm');
    expect(result).toEqual({ influence: 4, collection: { farm: 2 } });
  });

  it('upgrades ×4 to unlimited', () => {
    const result = buyTier({ farm: 4 }, 5, 'farm');
    expect(result).toEqual({ influence: 0, collection: { farm: 'unlimited' } });
  });

  it('does not mutate the input collection', () => {
    const collection = { farm: 1 };
    buyTier(collection, 5, 'farm');
    expect(collection).toEqual({ farm: 1 });
  });

  it('returns null when the card is not owned', () => {
    expect(buyTier({}, 99, 'farm')).toBeNull();
  });

  it('returns null when the card is already at its cap', () => {
    expect(buyTier({ farm: 'unlimited' }, 99, 'farm')).toBeNull();
  });

  it('returns null when the player cannot afford the upgrade', () => {
    // ×2 → ×4 costs 2; with only 1 Influence it must fail and spend nothing.
    expect(buyTier({ farm: 2 }, 1, 'farm')).toBeNull();
  });
});
