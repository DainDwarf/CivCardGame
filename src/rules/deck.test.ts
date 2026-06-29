import { describe, it, expect } from 'vitest';
import { drawUpTo } from './deck';
import { blankState } from './state';

describe('drawUpTo', () => {
  it('draws from the deck up to hand size', () => {
    const G = blankState('enlightenment');
    G.handSize = 3;
    G.deck = ['a', 'b', 'c', 'd'];
    drawUpTo(G);
    expect(G.hand).toEqual(['a', 'b', 'c']);
    expect(G.deck).toEqual(['d']);
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    const G = blankState('enlightenment');
    G.handSize = 2;
    G.deck = [];
    G.discard = ['x', 'y'];
    drawUpTo(G);
    expect([...G.hand].sort()).toEqual(['x', 'y']);
    expect(G.deck).toEqual([]);
    expect(G.discard).toEqual([]);
  });

  it('stops when no cards are available anywhere', () => {
    const G = blankState('enlightenment');
    drawUpTo(G);
    expect(G.hand).toEqual([]);
  });
});
