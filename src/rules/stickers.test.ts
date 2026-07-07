import { describe, it, expect } from 'vitest';
import { buySticker } from './stickers';
import { collectionFromCounts } from './collection';

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
