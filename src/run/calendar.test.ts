import { describe, it, expect } from 'vitest';
import { playCard, resolveInteraction } from './moves';
import { blankState, instancesFromCardIds, type GameState } from '../rules';
import { assertRunInvariants } from '../sim';

// Calendar is a real catalogue card (cost 2🔬): peek the top 3 of the draw pile, draw one, and leave
// the rest where they were. The generic suspend/resume machinery is pinned on a synthetic fixture in
// `interaction.test.ts`; what's Calendar's own — and tested here — is the *deck* side: how deep the
// peek reaches, and where the cards it passes over end up. Deck cards use synthetic ids ('a'…): the
// moves never look them up in CARDS (the peek is a pure read by position).
function freshWithCalendar(deck: string[]): GameState {
  const G = blankState('test');
  G.hand = instancesFromCardIds(['calendar']); // id 1
  G.resources.science = 2;
  G.deck = instancesFromCardIds(deck, 10); // ids 10…
  return G;
}

describe('Calendar (deck peek) — look at 3, draw 1', () => {
  it('parks a choice over the top 3 without disturbing the deck, and pays its cost', () => {
    const G = freshWithCalendar(['a', 'b', 'c', 'd']);
    playCard(G, 0);
    expect(G.pendingInteraction).toEqual({
      cardId: 'calendar',
      instanceId: 1,
      kind: 'chooseCard',
      prompt: 'Draw one — the rest stay on top of the pile, in order',
      options: instancesFromCardIds(['a', 'b', 'c'], 10), // the top 3, in draw order
      pick: 1,
    });
    // The peek is a pure read: nothing leaves the deck until the pick is answered.
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'b', 'c', 'd']);
    expect(G.hand).toEqual([]);
    expect(G.resources.science).toBe(0); // cost paid
    expect(G.discard.map((c) => c.cardId)).toEqual(['calendar']);
    expect(G.revealCount).toBe(1); // trips the undo boundary (a pure read the deck-diff can't see)
    // The options are live references into `G.deck` (peek is pure-read), so those instance ids exist in
    // *both* `options` and `deck`. The fuzzer's unique-id invariant must not read `options` — if it did,
    // playing Calendar would throw "duplicate instance id". Pin that it holds.
    expect(() => assertRunInvariants(G)).not.toThrow();
  });

  it('draws the chosen card and leaves the ones passed over on top, in order', () => {
    const G = freshWithCalendar(['a', 'b', 'c', 'd']);
    playCard(G, 0);
    resolveInteraction(G, 1); // take 'b' from the middle
    expect(G.hand.map((c) => c.cardId)).toEqual(['b']);
    // 'a' and 'c' keep their places at the top rather than shuffling back, so the knowledge the play
    // bought outlives the draw it bought.
    expect(G.deck.map((c) => c.cardId)).toEqual(['a', 'c', 'd']);
    expect(G.pendingInteraction).toBeNull();
  });

  it('offers fewer than the peek limit on a short deck without reshuffling the discard', () => {
    const G = freshWithCalendar(['a', 'b']);
    G.discard = instancesFromCardIds(['x', 'y'], 20);
    playCard(G, 0);
    expect(G.pendingInteraction?.options).toEqual(instancesFromCardIds(['a', 'b'], 10));
    // Peeking never tops up from the discard: 'x'/'y' stay put ('calendar' filed itself on play).
    expect(G.discard.map((c) => c.cardId)).toEqual(['x', 'y', 'calendar']);
    expect(G.reshuffleCount).toBe(0);
  });

  it('is unplayable with an empty draw pile — nothing to look at, cost not paid', () => {
    const G = freshWithCalendar([]);
    // The emptyDrawPile gate rejects the play outright instead of parking a zero-option choice.
    expect(playCard(G, 0)).toBe('invalid');
    expect(G.hand.map((c) => c.cardId)).toEqual(['calendar']); // still in hand
    expect(G.resources.science).toBe(2); // cost not paid
    expect(G.pendingInteraction).toBeNull();
    expect(G.revealCount).toBe(0);
  });

  it('survives a structuredClone round-trip mid-choice (undo/clone safe)', () => {
    const G = freshWithCalendar(['a', 'b', 'c']);
    playCard(G, 0);
    const clone = structuredClone(G);
    resolveInteraction(clone, 0);
    expect(clone.hand.map((c) => c.cardId)).toEqual(['a']);
    expect(clone.deck.map((c) => c.cardId)).toEqual(['b', 'c']);
  });
});
