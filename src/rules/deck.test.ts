import { describe, it, expect } from 'vitest';
import { drawUpTo, peekTop, drawInstance, returnToDeck } from './deck';
import { blankState, instancesFromCardIds, type CardInstance, type GameState } from './state';
import type { EffectContext } from './effects';

// peekTop/drawInstance/returnToDeck read only `ctx.G`; `self` is a placeholder they never touch.
function ctxFor(G: GameState): EffectContext {
  return { G, self: { id: 0, cardId: 'placeholder' } };
}

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

describe('peekTop', () => {
  it('lifts the top N off the deck and emits no draw event (a peek is not a draw)', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a', 'b', 'c', 'd']);
    const out = peekTop(ctxFor(G), 3);
    expect(out.map((c) => c.cardId)).toEqual(['a', 'b', 'c']);
    expect(G.deck.map((c) => c.cardId)).toEqual(['d']); // revealed cards removed from the deck
    expect(G.events).toEqual([]);
  });

  it('reshuffles the discard in when the deck empties mid-peek', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a'], 10);
    G.discard = instancesFromCardIds(['b', 'c'], 20);
    const out = peekTop(ctxFor(G), 3);
    expect(out.map((c) => c.cardId).sort()).toEqual(['a', 'b', 'c']);
    expect(out[0].cardId).toBe('a'); // 'a' lifted before the reshuffle; b/c come from the reshuffle
    expect(G.deck).toEqual([]);
    expect(G.discard).toEqual([]);
  });

  it('returns fewer than N (or none) once both piles run dry', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a'], 10);
    expect(peekTop(ctxFor(G), 3).map((c) => c.cardId)).toEqual(['a']);
    expect(peekTop(ctxFor(G), 3)).toEqual([]); // both piles now empty
  });

  it('reshuffles deterministically from the run rngState', () => {
    const setup = () => {
      const G = blankState('enlightenment');
      G.deck = [];
      G.discard = instancesFromCardIds(['a', 'b', 'c', 'd']);
      return G;
    };
    const first = setup();
    const second = setup();
    const a = peekTop(ctxFor(first), 3);
    const b = peekTop(ctxFor(second), 3);
    expect(a).toEqual(b);
    expect(first.rngState).toEqual(second.rngState);
  });
});

describe('drawInstance', () => {
  it('pushes a specific card to hand and queues one effect-sourced draw event', () => {
    const G = blankState('enlightenment');
    const card: CardInstance = { id: 42, cardId: 'z' };
    drawInstance(ctxFor(G), card);
    expect(G.hand).toEqual([card]);
    expect(G.events).toEqual([{ type: 'draw', instanceId: 42, cardId: 'z', source: 'effect' }]);
  });
});

describe('returnToDeck', () => {
  it('shuffles cards back into the deck and advances rngState', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['d'], 30);
    const before = G.rngState;
    returnToDeck(ctxFor(G), instancesFromCardIds(['a', 'c'], 10));
    expect(G.deck.map((c) => c.cardId).sort()).toEqual(['a', 'c', 'd']);
    expect(G.rngState).not.toEqual(before);
  });

  it('is a no-op on empty input — no gratuitous reshuffle of the remaining deck', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a', 'b', 'c']);
    const before = G.rngState;
    returnToDeck(ctxFor(G), []);
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'b', 'c']); // order untouched
    expect(G.rngState).toEqual(before); // stream not advanced
  });
});
