import { describe, it, expect } from 'vitest';
import { buySticker } from './stickers';
import { collectionFromCounts } from './collection';
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
