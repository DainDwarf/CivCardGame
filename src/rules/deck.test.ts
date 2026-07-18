import { describe, it, expect } from 'vitest';
import { drawUpTo, peekTop, drawInstance, returnToDeck, recoverFromDiscard, spawnIntoDeck } from './deck';
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

  it('emits a reshuffle event each time the discard folds back into the deck', () => {
    const G = blankState('enlightenment');
    G.handSize = 1; // draw one card, forcing exactly one reshuffle of the empty deck
    G.deck = [];
    G.discard = instancesFromCardIds(['x', 'y']);
    drawUpTo(G);
    // A `draw` (the card taken) plus one `reshuffle` (the fold) — the broadcast a reshuffle-reactive
    // card (e.g. the Unrest threat) drains on at the next flush.
    expect(G.events.filter((e) => e.type === 'reshuffle')).toHaveLength(1);
    expect(G.reshuffleCount).toBe(1);
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
  it('reads the top N without removing them, emits no draw, and bumps revealCount', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a', 'b', 'c', 'd']);
    const out = peekTop(ctxFor(G), 3);
    expect(out.map((c) => c.cardId)).toEqual(['a', 'b', 'c']);
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'b', 'c', 'd']); // a pure look — deck untouched
    expect(G.events).toEqual([]); // no draw event
    expect(G.revealCount).toBe(1); // the undo-boundary signal
  });

  it('reveals fewer than N when the deck is short, without touching the discard', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a'], 10);
    G.discard = instancesFromCardIds(['b', 'c'], 20);
    const out = peekTop(ctxFor(G), 3);
    expect(out.map((c) => c.cardId)).toEqual(['a']); // only what's on the deck — no reshuffle to top up
    expect(G.deck.map((c) => c.cardId)).toEqual(['a']);
    expect(G.discard.map((c) => c.cardId)).toEqual(['b', 'c']);
    expect(G.reshuffleCount).toBe(0);
  });

  it('returns nothing and does not bump revealCount when the deck is empty', () => {
    const G = blankState('enlightenment');
    G.deck = [];
    G.discard = instancesFromCardIds(['b', 'c'], 20);
    expect(peekTop(ctxFor(G), 3)).toEqual([]); // a peek only sees the deck, never the discard
    expect(G.revealCount).toBe(0); // nothing revealed — no boundary
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

describe('recoverFromDiscard', () => {
  it('removes the instance from the discard by id and draws it to hand (effect-sourced draw)', () => {
    const G = blankState('enlightenment');
    G.discard = instancesFromCardIds(['a', 'b', 'c'], 10);
    recoverFromDiscard(ctxFor(G), G.discard[1]); // 'b', id 11
    expect(G.hand.map((c) => c.cardId)).toEqual(['b']);
    expect(G.discard.map((c) => c.cardId)).toEqual(['a', 'c']); // 'b' gone from discard
    expect(G.events).toEqual([{ type: 'draw', instanceId: 11, cardId: 'b', source: 'effect' }]);
  });

  it('is a no-op when the id is not in the discard', () => {
    const G = blankState('enlightenment');
    G.discard = instancesFromCardIds(['a', 'b'], 10);
    recoverFromDiscard(ctxFor(G), { id: 99, cardId: 'z' });
    expect(G.hand).toEqual([]);
    expect(G.discard.map((c) => c.cardId)).toEqual(['a', 'b']); // untouched
    expect(G.events).toEqual([]);
  });
});

describe('spawnIntoDeck', () => {
  it('mints fresh instances into the deck with ids unique across every zone', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a'], 5);
    G.discard = instancesFromCardIds(['b'], 12); // highest live id is 12
    const before = G.rngState;
    spawnIntoDeck(ctxFor(G), 'thief', 3);
    const thieves = G.deck.filter((c) => c.cardId === 'thief');
    expect(thieves).toHaveLength(3);
    const ids = G.deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // no collisions with the existing id 5 or the discard's 12
    expect(Math.min(...thieves.map((t) => t.id))).toBeGreaterThan(12);
    expect(G.rngState).not.toEqual(before); // shuffled in via the RNG stream
  });

  it('is a no-op for a non-positive count — no gratuitous reshuffle', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a', 'b', 'c']);
    const before = G.rngState;
    spawnIntoDeck(ctxFor(G), 'thief', 0);
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'b', 'c']); // untouched
    expect(G.rngState).toEqual(before); // stream not advanced
  });
});
