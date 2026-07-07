import { describe, it, expect } from 'vitest';
import { buySticker, effectiveCard, effectiveCost, effectiveGain } from './stickers';
import { collectionFromCounts } from './collection';
import type { CardInstance } from './state';
import { CARDS } from '../content/cards';

describe('buySticker', () => {
  it('attaches the sticker and deducts its cost', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const result = buySticker(collection, 5, a, 'reinforced');
    expect(result).not.toBeNull();
    expect(result!.influence).toBe(2);
    expect(result!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['reinforced']);
  });

  it('does not mutate the input collection', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    buySticker(collection, 5, a, 'reinforced');
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

  it('rejects an instance that already carries a sticker', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const first = buySticker(collection, 5, a, 'reinforced')!;
    expect(buySticker(first.collection, first.influence, a, 'efficient')).toBeNull();
  });

  it('rejects an unaffordable purchase', () => {
    const collection = collectionFromCounts({ farm: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 1, a, 'reinforced')).toBeNull();
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
});

describe('effectiveCard', () => {
  it('returns the same object (no sticker) unchanged', () => {
    const self: CardInstance = { id: 1, cardId: 'farm' };
    expect(effectiveCard(CARDS.farm, self)).toBe(CARDS.farm);
  });

  it("reflects Reinforced's +1 in produces and Efficient's -1 in cost", () => {
    const reinforced = effectiveCard(CARDS.farm, { id: 1, cardId: 'farm', stickers: ['reinforced'] });
    expect(reinforced.produces).toEqual({ food: 3 });
    expect(reinforced.cost).toEqual(CARDS.farm.cost); // unaffected by Reinforced

    const efficient = effectiveCard(CARDS.farm, { id: 2, cardId: 'farm', stickers: ['efficient'] });
    expect(efficient.cost).toEqual({ production: 0 });
    expect(efficient.produces).toEqual(CARDS.farm.produces); // unaffected by Efficient
  });

  it("reflects Reinforced's +1 in a work card's effect.gain", () => {
    const reinforced = effectiveCard(CARDS.corvee, { id: 1, cardId: 'corvee', stickers: ['reinforced'] });
    expect(reinforced.effect?.gain).toEqual({ production: 4 });
  });
});
