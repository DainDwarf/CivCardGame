import { describe, it, expect } from 'vitest';
import { buySticker, effectiveCard, effectiveCost, effectiveGain, stickerAppliesTo } from './stickers';
import { collectionFromCounts } from './collection';
import type { CardInstance } from './state';
import { CARDS } from '../content/cards';
import { STICKERS } from '../content/stickers';

describe('buySticker', () => {
  it('attaches the sticker and deducts its cost', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const result = buySticker(collection, STICKERS.reinforced.cost + 2, a, 'reinforced');
    expect(result).not.toBeNull();
    expect(result!.influence).toBe(2);
    expect(result!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['reinforced']);
  });

  it('does not mutate the input collection', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    buySticker(collection, STICKERS.reinforced.cost, a, 'reinforced');
    expect(collection.instances.find((i) => i.id === a)?.stickers).toBeUndefined();
  });

  it('rejects an unknown sticker id', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 5, a, 'not-a-sticker')).toBeNull();
  });

  it('rejects an instance the collection does not own', () => {
    const collection = collectionFromCounts({ farm: 1 });
    expect(buySticker(collection, 5, 'not-owned', 'reinforced')).toBeNull();
  });

  it('appends a second, different sticker to a once-stickered instance', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const first = buySticker(collection, STICKERS.reinforced.cost + STICKERS.efficient.cost, a, 'reinforced')!;
    const second = buySticker(first.collection, first.influence, a, 'efficient');
    expect(second).not.toBeNull();
    expect(second!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['reinforced', 'efficient']);
  });

  it('rejects a third sticker once the instance is full', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    // Budget affords all three, so the third's rejection is by fullness, not affordability.
    const budget = STICKERS.reinforced.cost * 2 + STICKERS.efficient.cost;
    const first = buySticker(collection, budget, a, 'reinforced')!;
    const second = buySticker(first.collection, first.influence, a, 'efficient')!;
    expect(buySticker(second.collection, second.influence, a, 'reinforced')).toBeNull();
  });

  it('allows attaching the same sticker twice — it stacks', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const first = buySticker(collection, STICKERS.reinforced.cost * 2, a, 'reinforced')!;
    const second = buySticker(first.collection, first.influence, a, 'reinforced');
    expect(second).not.toBeNull();
    expect(second!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['reinforced', 'reinforced']);
  });

  it('rejects an unaffordable purchase', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 1, a, 'reinforced')).toBeNull();
  });

  it('attaches an eligible restricted sticker (Irrigation on a food building)', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const result = buySticker(collection, 5, a, 'irrigation');
    expect(result).not.toBeNull();
    expect(result!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['irrigation']);
  });

  it('rejects a restricted sticker on an ineligible card (Irrigation on a non-food building)', () => {
    const collection = collectionFromCounts({ workshop: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 5, a, 'irrigation')).toBeNull();
  });
});

describe('stickerAppliesTo (Irrigation eligibility, Step 7.8)', () => {
  it('applies to a food-producing building', () => {
    expect(stickerAppliesTo(STICKERS.irrigation, CARDS.farm)).toBe(true);
  });

  it('does not apply to a non-food building', () => {
    expect(stickerAppliesTo(STICKERS.irrigation, CARDS.workshop)).toBe(false);
  });

  it('does not apply to a non-building card', () => {
    expect(stickerAppliesTo(STICKERS.irrigation, CARDS.settlers)).toBe(false);
  });

  it('an unrestricted sticker (Reinforced) applies to everything', () => {
    expect(stickerAppliesTo(STICKERS.reinforced, CARDS.farm)).toBe(true);
    expect(stickerAppliesTo(STICKERS.reinforced, CARDS.workshop)).toBe(true);
    expect(stickerAppliesTo(STICKERS.reinforced, CARDS.settlers)).toBe(true);
  });
});

describe('effectiveGain (Irrigation, Step 7.8)', () => {
  it('bumps only food by 1, leaving other outputs untouched', () => {
    const self: CardInstance = { id: 1, cardId: 'colossus', stickers: ['irrigation'] };
    expect(effectiveGain({ food: 1, science: 1, military: 1 }, self)).toEqual({ food: 1 + 1, science: 1, military: 1 });
  });

  it('composes with Reinforced on the same copy', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['irrigation', 'reinforced'] };
    // Reinforced +1 to every key, then Irrigation +1 to food → food 2+1+1 = 4.
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 4 });
  });
});

describe('effectiveGain (Reinforced)', () => {
  it('bumps every resource key present by 1 on a stickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['reinforced'] };
    expect(effectiveGain({ food: 2, production: 1 }, self)).toEqual({ food: 3, production: 2 });
  });

  it('leaves gain untouched on an unstickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'farm' };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 2 });
  });

  it('passes undefined through unchanged', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['reinforced'] };
    expect(effectiveGain(undefined, self)).toBeUndefined();
  });

  it('stacks two Reinforced stickers on the same instance to +2', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['reinforced', 'reinforced'] };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 4 });
  });
});

describe('effectiveCost (Efficient)', () => {
  it('knocks 1 off every cost resource on a stickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['efficient'] };
    expect(effectiveCost({ production: 2 }, self)).toEqual({ production: 1 });
  });

  it('floors a discounted resource at 0 rather than going negative', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['efficient'] };
    expect(effectiveCost({ production: 1, food: 0 }, self)).toEqual({ production: 0, food: 0 });
  });

  it('leaves cost untouched on an unstickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'farm' };
    expect(effectiveCost({ production: 2 }, self)).toEqual({ production: 2 });
  });

  it('stacks two Efficient stickers on the same instance to -2, still floored at 0', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['efficient', 'efficient'] };
    expect(effectiveCost({ production: 3, food: 1 }, self)).toEqual({ production: 1, food: 0 });
  });
});

describe('a doubly-stickered instance (Step 7.7)', () => {
  it('composes two different stickers (Reinforced + Efficient) on the same copy', () => {
    const self: CardInstance = { id: 1, cardId: 'farm', stickers: ['reinforced', 'efficient'] };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 3 });
    expect(effectiveCost({ production: 2 }, self)).toEqual({ production: 1 });
  });
});

describe('effectiveCard', () => {
  it('returns the same object (no sticker) unchanged', () => {
    const self: CardInstance = { id: 1, cardId: 'farm' };
    expect(effectiveCard(CARDS.farm, self)).toBe(CARDS.farm);
  });

  it("reflects Reinforced's +1 in produces and Efficient's -1 in cost", () => {
    const reinforced = effectiveCard(CARDS.farm, { stickers: ['reinforced'] });
    expect(reinforced.produces).toEqual({ food: 3 });
    expect(reinforced.cost).toEqual(CARDS.farm.cost); // unaffected by Reinforced

    const efficient = effectiveCard(CARDS.farm, { stickers: ['efficient'] });
    expect(efficient.cost).toEqual({ production: 0 });
    expect(efficient.produces).toEqual(CARDS.farm.produces); // unaffected by Efficient
  });

  it("reflects Reinforced's +1 in a work card's effect.gain", () => {
    const reinforced = effectiveCard(CARDS.corvee, { stickers: ['reinforced'] });
    expect(reinforced.effect?.gain).toEqual({ production: 4 });
  });
});
