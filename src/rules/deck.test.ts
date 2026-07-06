import { describe, it, expect } from 'vitest';
import { drawUpTo } from './deck';
import { blankState, instancesFromCardIds } from './state';

describe('drawUpTo', () => {
  it('draws from the deck up to hand size', () => {
    const G = blankState('enlightenment');
    G.handSize = 3;
    G.deck = instancesFromCardIds(['a', 'b', 'c', 'd']);
    drawUpTo(G);
    expect(G.hand.map((c) => c.cardId)).toEqual(['a', 'b', 'c']);
    expect(G.deck.map((c) => c.cardId)).toEqual(['d']);
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    const G = blankState('enlightenment');
    G.handSize = 2;
    G.deck = [];
    G.discard = instancesFromCardIds(['x', 'y']);
    drawUpTo(G);
    expect(G.hand.map((c) => c.cardId).sort()).toEqual(['x', 'y']);
    expect(G.deck).toEqual([]);
    expect(G.discard).toEqual([]);
  });

  it('stops when no cards are available anywhere', () => {
    const G = blankState('enlightenment');
    drawUpTo(G);
    expect(G.hand).toEqual([]);
  });

  it('reshuffles deterministically from the same rngState', () => {
    const setup = () => {
      const G = blankState('enlightenment');
      G.handSize = 4;
      G.deck = [];
      G.discard = instancesFromCardIds(['a', 'b', 'c', 'd']);
      return G;
    };
    const first = setup();
    const second = setup();
    drawUpTo(first);
    drawUpTo(second);
    expect(first.hand).toEqual(second.hand);
    expect(first.rngState).toEqual(second.rngState);
    expect(first.hand.map((c) => c.cardId)).not.toEqual(['a', 'b', 'c', 'd']); // actually reshuffled, not a no-op
  });

  it('advances rngState so consecutive reshuffles differ', () => {
    const G = blankState('enlightenment');
    G.handSize = 4;
    G.deck = [];
    G.discard = instancesFromCardIds(['a', 'b', 'c', 'd']);
    drawUpTo(G);
    const stateAfterFirst = G.rngState;
    G.discard = [...G.hand];
    G.hand = [];
    drawUpTo(G);
    expect(G.rngState).not.toEqual(stateAfterFirst);
  });
});
