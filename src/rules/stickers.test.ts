import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buySticker, effectiveCard, effectiveCost, effectiveGain, stickerAppliesTo } from './stickers';
import { collectionFromCounts } from './collection';
import type { CardInstance } from './state';
import { FIXTURE_CARDS, FIXTURE_STICKERS, installFixtures, uninstallFixtures } from './testFixtures';

// Synthetic fixtures stand in for shipped cards/stickers: `test_food` is a food-producing building
// (eligible for the restricted sticker), `test_prod` a non-food building (ineligible); `test_addgain`/
// `test_costcut` are two different unrestricted stickers, `test_restricted` the food-only one.
const ADDGAIN = FIXTURE_STICKERS.test_addgain.cost;
const COSTCUT = FIXTURE_STICKERS.test_costcut.cost;
// Every fixture sticker is unlocked by default, so these tests exercise the buy path without the
// unlock gate getting in the way; one dedicated test below covers a *locked* sticker rejection.
const UNLOCKED: Record<string, true> = Object.fromEntries(Object.keys(FIXTURE_STICKERS).map((id) => [id, true]));

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('buySticker', () => {
  it('attaches the sticker and deducts its cost', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const result = buySticker(collection, ADDGAIN + 2, a, 'test_addgain', UNLOCKED);
    expect(result).not.toBeNull();
    expect(result!.influence).toBe(2);
    expect(result!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_addgain']);
  });

  it('does not mutate the input collection', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    buySticker(collection, ADDGAIN, a, 'test_addgain', UNLOCKED);
    expect(collection.instances.find((i) => i.id === a)?.stickers).toBeUndefined();
  });

  it('rejects an unknown sticker id', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 5, a, 'not-a-sticker', UNLOCKED)).toBeNull();
  });

  it('rejects a sticker that is not unlocked, even when everything else is valid', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    // Affordable, applicable, room — but locked (absent from the unlocked set) → rejected.
    expect(buySticker(collection, ADDGAIN + 5, a, 'test_addgain', {})).toBeNull();
  });

  it('rejects an instance the collection does not own', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    expect(buySticker(collection, 5, 'not-owned', 'test_addgain', UNLOCKED)).toBeNull();
  });

  it('appends a second, different sticker to a once-stickered instance', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const first = buySticker(collection, ADDGAIN + COSTCUT, a, 'test_addgain', UNLOCKED)!;
    const second = buySticker(first.collection, first.influence, a, 'test_costcut', UNLOCKED);
    expect(second).not.toBeNull();
    expect(second!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_addgain', 'test_costcut']);
  });

  it('rejects a third sticker once the instance is full', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    // Budget affords all three, so the third's rejection is by fullness, not affordability.
    const budget = ADDGAIN * 2 + COSTCUT;
    const first = buySticker(collection, budget, a, 'test_addgain', UNLOCKED)!;
    const second = buySticker(first.collection, first.influence, a, 'test_costcut', UNLOCKED)!;
    expect(buySticker(second.collection, second.influence, a, 'test_addgain', UNLOCKED)).toBeNull();
  });

  it('allows attaching the same sticker twice — it stacks', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const first = buySticker(collection, ADDGAIN * 2, a, 'test_addgain', UNLOCKED)!;
    const second = buySticker(first.collection, first.influence, a, 'test_addgain', UNLOCKED);
    expect(second).not.toBeNull();
    expect(second!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_addgain', 'test_addgain']);
  });

  it('rejects an unaffordable purchase', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 1, a, 'test_addgain', UNLOCKED)).toBeNull();
  });

  it('attaches an eligible restricted sticker (a food-only sticker on a food building)', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const result = buySticker(collection, 5, a, 'test_restricted', UNLOCKED);
    expect(result).not.toBeNull();
    expect(result!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_restricted']);
  });

  it('rejects a restricted sticker on an ineligible card (a food-only sticker on a non-food building)', () => {
    const collection = collectionFromCounts({ test_prod: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 5, a, 'test_restricted', UNLOCKED)).toBeNull();
  });
});

// The 2.1 deletions carried the only coverage of the sticker effect-fold functions. Re-asserted here
// on synthetic fixtures: `test_addgain` (+1 every key, unrestricted), `test_costcut` (−1 every key,
// floored), `test_restricted` (food-only +1🌾). `test_food`/`test_work` are a food building and a
// production Work card; `test_prod` a non-food building; `test_action` a non-building card.

describe('stickerAppliesTo', () => {
  it('a restricted (food-only) sticker applies to a food-producing building', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_restricted, FIXTURE_CARDS.test_food)).toBe(true);
  });

  it('does not apply to a non-food building', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_restricted, FIXTURE_CARDS.test_prod)).toBe(false);
  });

  it('does not apply to a non-building card', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_restricted, FIXTURE_CARDS.test_action)).toBe(false);
  });

  it('an unrestricted sticker applies to everything', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_addgain, FIXTURE_CARDS.test_food)).toBe(true);
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_addgain, FIXTURE_CARDS.test_prod)).toBe(true);
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_addgain, FIXTURE_CARDS.test_action)).toBe(true);
  });
});

describe('effectiveGain (restricted, food-only)', () => {
  it('bumps only food by 1, leaving other outputs untouched', () => {
    const self: CardInstance = { id: 1, cardId: 'test_multi', stickers: ['test_restricted'] };
    expect(effectiveGain({ food: 1, science: 1, military: 1 }, self)).toEqual({ food: 1 + 1, science: 1, military: 1 });
  });

  it('composes with an additive-gain sticker on the same copy', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_restricted', 'test_addgain'] };
    // restricted +1 food, then additive-gain +1 to every key → food 2+1+1 = 4.
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 4 });
  });
});

describe('effectiveGain (additive-gain)', () => {
  it('bumps every resource key present by 1 on a stickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain'] };
    expect(effectiveGain({ food: 2, production: 1 }, self)).toEqual({ food: 3, production: 2 });
  });

  it('leaves gain untouched on an unstickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food' };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 2 });
  });

  it('passes undefined through unchanged', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain'] };
    expect(effectiveGain(undefined, self)).toBeUndefined();
  });

  it('stacks two additive-gain stickers on the same instance to +2', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain', 'test_addgain'] };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 4 });
  });
});

describe('effectiveCost (cost-cut)', () => {
  it('knocks 1 off every cost resource on a stickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_costcut'] };
    expect(effectiveCost({ production: 2 }, self)).toEqual({ production: 1 });
  });

  it('floors a discounted resource at 0 rather than going negative', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_costcut'] };
    expect(effectiveCost({ production: 1, food: 0 }, self)).toEqual({ production: 0, food: 0 });
  });

  it('leaves cost untouched on an unstickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food' };
    expect(effectiveCost({ production: 2 }, self)).toEqual({ production: 2 });
  });

  it('stacks two cost-cut stickers on the same instance to -2, still floored at 0', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_costcut', 'test_costcut'] };
    expect(effectiveCost({ production: 3, food: 1 }, self)).toEqual({ production: 1, food: 0 });
  });
});

describe('a doubly-stickered instance', () => {
  it('composes two different stickers (additive-gain + cost-cut) on the same copy', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain', 'test_costcut'] };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 3 });
    expect(effectiveCost({ production: 2 }, self)).toEqual({ production: 1 });
  });
});

describe('effectiveCard', () => {
  it('returns the same object (no sticker) unchanged', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food' };
    expect(effectiveCard(FIXTURE_CARDS.test_food, self)).toBe(FIXTURE_CARDS.test_food);
  });

  it("reflects the additive-gain sticker's +1 in produces and the cost-cut sticker's -1 in cost", () => {
    const boosted = effectiveCard(FIXTURE_CARDS.test_food, { stickers: ['test_addgain'] });
    expect(boosted.produces).toEqual({ food: 3 });
    expect(boosted.cost).toEqual(FIXTURE_CARDS.test_food.cost); // unaffected by additive-gain

    const cheaper = effectiveCard(FIXTURE_CARDS.test_food, { stickers: ['test_costcut'] });
    expect(cheaper.cost).toEqual({ production: 1 });
    expect(cheaper.produces).toEqual(FIXTURE_CARDS.test_food.produces); // unaffected by cost-cut
  });

  it("reflects the additive-gain sticker's +1 in a work card's effect.gain", () => {
    const boosted = effectiveCard(FIXTURE_CARDS.test_work, { stickers: ['test_addgain'] });
    expect(boosted.effect?.gain).toEqual({ production: 4 });
  });
});
