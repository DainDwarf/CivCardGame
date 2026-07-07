import { describe, it, expect } from 'vitest';
import { blankState, getCounter, bumpCounter, instancesFromDeckCards, type CardInstance } from './state';
import { scaleResources } from './resources';
import { resolveCard } from './effects';

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
});

describe('Cornucopia (growing per-instance gain)', () => {
  it('gains +1🌾 the first play of a copy and +1 more each subsequent play of that same copy', () => {
    const G = blankState('enlightenment');
    const copy: CardInstance = { id: 1, cardId: 'cornucopia' };
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
    const G = blankState('enlightenment');
    const a: CardInstance = { id: 1, cardId: 'cornucopia' };
    const b: CardInstance = { id: 2, cardId: 'cornucopia' };
    resolveCard({ G, self: a }); // a: +1 (food 1)
    resolveCard({ G, self: a }); // a: +2 (food 3)
    resolveCard({ G, self: b }); // b's first play — still +1, not buffed by a's plays (food 4)
    expect(G.resources.food).toBe(4);
    expect(a.counters?.plays).toBe(2);
    expect(b.counters?.plays).toBe(1);
  });
});
