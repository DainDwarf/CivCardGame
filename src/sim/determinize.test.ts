import { describe, it, expect } from 'vitest';
import { determinize } from './determinize';
import { blankState, seededRng, type CardInstance } from '../rules';

function deck(): CardInstance[] {
  return Array.from({ length: 10 }, (_, i) => ({ id: i + 1, cardId: `c${i}` }));
}
const ids = (cs: CardInstance[]) => cs.map((c) => c.id);
const sortedIds = (cs: CardInstance[]) => ids(cs).slice().sort((a, b) => a - b);

describe('determinize (fair draw sampling)', () => {
  it('reorders the deck but preserves it as a multiset', () => {
    const G = blankState('sandbox');
    G.deck = deck();
    const d = determinize(G, seededRng('samp').getState());
    // Same cards, different order — the planner plans over the multiset, not the real sequence.
    expect(sortedIds(d.G.deck)).toEqual(sortedIds(G.deck));
    expect(ids(d.G.deck)).not.toEqual(ids(G.deck));
  });

  it('leaves the real state untouched (works on a clone)', () => {
    const G = blankState('sandbox');
    G.deck = deck();
    G.hand = [{ id: 100, cardId: 'h' }];
    const before = ids(G.deck);
    const d = determinize(G, seededRng('samp').getState());
    expect(ids(G.deck)).toEqual(before); // original deck order preserved
    expect(d.G.hand).not.toBe(G.hand); // cloned
    expect(ids(d.G.hand)).toEqual(ids(G.hand)); // hand (known to the player) unchanged
  });

  it('is deterministic for a given sampling state, and varies across states', () => {
    const G = blankState('sandbox');
    G.deck = deck();
    const a1 = determinize(G, seededRng('one').getState());
    const a2 = determinize(G, seededRng('one').getState());
    const b = determinize(G, seededRng('two').getState());
    expect(ids(a1.G.deck)).toEqual(ids(a2.G.deck)); // reproducible
    expect(ids(a1.G.deck)).not.toEqual(ids(b.G.deck)); // a different world, not tied to one order
  });

  it('advances and returns the sampling state, and reseeds the clone off the sample stream', () => {
    const G = blankState('sandbox');
    G.deck = deck();
    const seed = seededRng('samp').getState();
    const d = determinize(G, seed);
    expect(d.rngState).not.toEqual(seed); // advanced, so successive worlds differ
    expect(d.G.rngState).toEqual(d.rngState); // in-search reshuffles continue the sample, not the real run
  });
});
