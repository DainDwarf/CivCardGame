import { describe, it, expect } from 'vitest';
import { playCard, resolveInteraction } from './moves';
import { blankState, instancesFromCardIds, type GameState } from '../rules';
import { assertRunInvariants } from '../sim';

// Calendar is a real catalogue card (cost 1🔬): a look-only peek at the top of the draw pile. It
// suspends into a `reveal` interaction the player acknowledges (drawing/keeping nothing). Deck cards use
// synthetic ids ('a'…): the moves never look them up in CARDS (the peek is a pure read by position).
function freshWithCalendar(deck: string[]): GameState {
  const G = blankState('test');
  G.hand = instancesFromCardIds(['calendar']); // id 1
  G.resources.science = 1;
  G.deck = instancesFromCardIds(deck, 10); // ids 10…
  return G;
}

describe('Calendar (deck peek) — look-only reveal', () => {
  it('parks a look-only reveal of the top cards, pays its cost, and files itself — drawing nothing', () => {
    const G = freshWithCalendar(['a', 'b', 'c', 'd']);
    playCard(G, 0);
    expect(G.pendingInteraction).toEqual({
      cardId: 'calendar',
      instanceId: 1,
      kind: 'reveal',
      prompt: 'The next cards you will draw, in order',
      options: instancesFromCardIds(['a', 'b', 'c'], 10), // the top 3, in draw order
      pick: 0,
    });
    expect(G.pendingInteraction?.options).toHaveLength(3);
    // Pure read: the peeked cards stay on the deck (still drawable), and nothing entered the hand.
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'b', 'c', 'd']);
    expect(G.hand).toEqual([]);
    expect(G.resources.science).toBe(0); // cost paid
    expect(G.discard.map((c) => c.cardId)).toEqual(['calendar']);
    expect(G.revealCount).toBe(1); // trips the undo boundary (a pure read the deck-diff can't see)
    // The reveal's options are live references into `G.deck` (peek is pure-read), so those instance ids
    // exist in *both* `options` and `deck`. The fuzzer's unique-id invariant must not read `options` —
    // if it did, playing Calendar would throw "duplicate instance id". Pin that it holds.
    expect(() => assertRunInvariants(G)).not.toThrow();
  });

  it('acknowledging the reveal clears it and keeps nothing — the deck is untouched', () => {
    const G = freshWithCalendar(['a', 'b', 'c', 'd']);
    playCard(G, 0);
    resolveInteraction(G, 0); // Continue
    expect(G.pendingInteraction).toBeNull();
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'b', 'c', 'd']); // unchanged — a peek keeps nothing
    expect(G.hand).toEqual([]);
    expect(G.resources.science).toBe(0);
  });

  it('reveals fewer than the peek limit on a short deck without reshuffling the discard', () => {
    const G = freshWithCalendar(['a', 'b']);
    G.discard = instancesFromCardIds(['x', 'y'], 20);
    playCard(G, 0);
    expect(G.pendingInteraction?.options).toEqual(instancesFromCardIds(['a', 'b'], 10));
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'b']); // still there
    // Peeking never tops up from the discard: 'x'/'y' stay put ('calendar' filed itself on play).
    expect(G.discard.map((c) => c.cardId)).toEqual(['x', 'y', 'calendar']);
    expect(G.reshuffleCount).toBe(0);
  });

  it('is unplayable with an empty draw pile — nothing to reveal, cost not paid', () => {
    const G = freshWithCalendar([]);
    // The emptyDrawPile gate rejects the play outright instead of parking a zero-option reveal.
    expect(playCard(G, 0)).toBe('invalid');
    expect(G.hand.map((c) => c.cardId)).toEqual(['calendar']); // still in hand
    expect(G.resources.science).toBe(1); // cost not paid
    expect(G.pendingInteraction).toBeNull();
    expect(G.revealCount).toBe(0);
  });

  it('survives a structuredClone round-trip mid-reveal (undo/clone safe)', () => {
    const G = freshWithCalendar(['a', 'b', 'c']);
    playCard(G, 0);
    const clone = structuredClone(G);
    resolveInteraction(clone, 0);
    expect(clone.pendingInteraction).toBeNull();
    expect(clone.deck.map((c) => c.cardId)).toEqual(['a', 'b', 'c']);
  });
});
