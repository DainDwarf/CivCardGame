import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { blankState, getCounter, bumpCounter, setCounter, instancesFromDeckCards, stripSticker, type CardInstance } from './state';
import { scaleResources } from './resources';
import { resolveCard } from './effects';
import { installFixtures, uninstallFixtures } from './testFixtures';

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('scaleResources', () => {
  it('multiplies each present key by the factor, leaving absent keys out', () => {
    expect(scaleResources({ food: 1, production: 2 }, 3)).toEqual({ food: 3, production: 6 });
  });

  it('a factor of 0 zeroes the present keys', () => {
    expect(scaleResources({ food: 2 }, 0)).toEqual({ food: 0 });
  });

  it('does not mutate its input', () => {
    const base = { food: 1 };
    scaleResources(base, 5);
    expect(base).toEqual({ food: 1 });
  });
});

describe('instancesFromDeckCards', () => {
  it('mints sequential ids, carrying stickers onto the instance', () => {
    const insts = instancesFromDeckCards([{ cardId: 'farm', stickers: ['reinforced'] }, { cardId: 'library' }]);
    expect(insts).toEqual([
      { id: 1, cardId: 'farm', stickers: ['reinforced'] },
      { id: 2, cardId: 'library' },
    ]);
  });

  it('omits the stickers field entirely for an unstickered entry (stays bare, like a plain mint)', () => {
    const [inst] = instancesFromDeckCards([{ cardId: 'farm' }]);
    expect('stickers' in inst).toBe(false);
  });

  it('continues ids from a later startId', () => {
    const insts = instancesFromDeckCards([{ cardId: 'farm' }, { cardId: 'library' }], 10);
    expect(insts.map((i) => i.id)).toEqual([10, 11]);
  });
});

describe('per-instance counter accessors', () => {
  it('reads a never-touched key as 0', () => {
    const inst: CardInstance = { id: 1, cardId: 'anything' };
    expect(getCounter(inst, 'plays')).toBe(0);
  });

  it('bump adds (default 1), lazily creates the map, and returns the new value', () => {
    const inst: CardInstance = { id: 1, cardId: 'k' };
    expect(bumpCounter(inst, 'plays')).toBe(1);
    expect(bumpCounter(inst, 'plays', 4)).toBe(5);
    expect(inst.counters?.plays).toBe(5);
  });

  it('set writes outright, so a counter can go back down without a negated bump', () => {
    const inst: CardInstance = { id: 1, cardId: 'k' };
    bumpCounter(inst, 'idle', 3);
    expect(setCounter(inst, 'idle', 0)).toBe(0);
    expect(getCounter(inst, 'idle')).toBe(0);
    expect(bumpCounter(inst, 'idle')).toBe(1);
  });

  it('set lazily creates the map on an untouched instance', () => {
    const inst: CardInstance = { id: 1, cardId: 'k' };
    setCounter(inst, 'seen', 2);
    expect(inst.counters?.seen).toBe(2);
  });
});

describe('stripSticker', () => {
  it('reports nothing to strip on a bare copy, and on one carrying other stickers', () => {
    expect(stripSticker({ id: 1, cardId: 'k' }, 'test_addgain')).toBe(false);
    const other: CardInstance = { id: 1, cardId: 'k', stickers: ['test_costcut'] };
    expect(stripSticker(other, 'test_addgain')).toBe(false);
    expect(other.stickers).toEqual(['test_costcut']);
  });

  it('takes one layer off a double stack, leaving the copy still carrying one', () => {
    const inst: CardInstance = { id: 1, cardId: 'k', stickers: ['test_addgain', 'test_addgain'] };
    expect(stripSticker(inst, 'test_addgain')).toBe(true);
    expect(inst.stickers).toEqual(['test_addgain']);
  });

  it('drops the stickers key entirely when the last one goes, returning a plain copy', () => {
    const inst: CardInstance = { id: 1, cardId: 'k', stickers: ['test_addgain'] };
    expect(stripSticker(inst, 'test_addgain')).toBe(true);
    expect('stickers' in inst).toBe(false);
  });

  it('leaves the other stickers in place and in order', () => {
    const inst: CardInstance = { id: 1, cardId: 'k', stickers: ['test_costcut', 'test_addgain', 'test_costcut'] };
    stripSticker(inst, 'test_addgain');
    expect(inst.stickers).toEqual(['test_costcut', 'test_costcut']);
  });

  // The strip is run-local by contract — it destroys this run's defenses, never the player's purchase —
  // so it rebuilds the array rather than writing through the one it was handed.
  it('never writes through an array another holder shares', () => {
    const shared = ['test_addgain', 'test_costcut'];
    const stripped: CardInstance = { id: 1, cardId: 'k', stickers: shared };
    stripSticker(stripped, 'test_addgain');
    expect(shared).toEqual(['test_addgain', 'test_costcut']);
  });
});

describe('test_growing (growing per-instance gain)', () => {
  it('gains +1🌾 the first play of a copy and +1 more each subsequent play of that same copy', () => {
    const G = blankState('test');
    const copy: CardInstance = { id: 1, cardId: 'test_growing' };
    resolveCard({ G, self: copy });
    expect(G.resources.food).toBe(1); // +1
    expect(copy.counters?.plays).toBe(1);
    resolveCard({ G, self: copy });
    expect(G.resources.food).toBe(3); // +2
    resolveCard({ G, self: copy });
    expect(G.resources.food).toBe(6); // +3
    expect(copy.counters?.plays).toBe(3);
  });

  it('grows each copy independently — playing one never buffs another', () => {
    const G = blankState('test');
    const a: CardInstance = { id: 1, cardId: 'test_growing' };
    const b: CardInstance = { id: 2, cardId: 'test_growing' };
    resolveCard({ G, self: a }); // a: +1 (food 1)
    resolveCard({ G, self: a }); // a: +2 (food 3)
    resolveCard({ G, self: b }); // b's first play — still +1, not buffed by a's plays (food 4)
    expect(G.resources.food).toBe(4);
    expect(a.counters?.plays).toBe(2);
    expect(b.counters?.plays).toBe(1);
  });
});
