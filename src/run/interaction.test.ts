import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { playCard, resolveInteraction } from './moves';
import { endTurn } from './engine';
import { blankState, instancesFromCardIds, type GameState } from '../rules';
import { installFixtures, uninstallFixtures } from '../rules/testFixtures';

// `test_peek` is the interactive peek fixture: reveal the top 3, draw 1, shuffle the rest
// back (cost 1🔬, revealsFromDeck 3, prompt 'Draw one — the rest shuffle back').
beforeAll(installFixtures);
afterAll(uninstallFixtures);

function freshWithPeek(): GameState {
  const G = blankState('test');
  G.hand = instancesFromCardIds(['test_peek']);
  G.resources.science = 1;
  G.deck = instancesFromCardIds(['a', 'b', 'c', 'd'], 10);
  return G;
}

describe('Test Peek (interactive peek) — suspend/resume', () => {
  it('reveals the top 3 and parks a pending interaction on play', () => {
    const G = freshWithPeek();
    playCard(G, 0);
    expect(G.pendingInteraction).toEqual({
      cardId: 'test_peek',
      instanceId: 1, // the played peek copy's own id
      kind: 'chooseCard',
      prompt: 'Draw one — the rest shuffle back',
      options: instancesFromCardIds(['a', 'b', 'c'], 10), // the 3 revealed instances (deck ids 10–12)
      pick: 1,
    });
    expect(G.deck.map((c) => c.cardId)).toEqual(['d']); // the 3 peeked cards lifted off the deck
    expect(G.discard.map((c) => c.cardId)).toEqual(['test_peek']); // the action itself filed
    expect(G.resources.science).toBe(0); // cost paid
    expect(G.hand).toEqual([]); // nothing drawn yet — that waits for the answer
  });

  it('draws the chosen card and shuffles the rest back on resume', () => {
    const G = freshWithPeek();
    playCard(G, 0);
    resolveInteraction(G, 1); // choose 'b'
    expect(G.hand.map((c) => c.cardId)).toEqual(['b']);
    expect(G.pendingInteraction).toBeNull();
    // 'a' and 'c' returned to the deck alongside the untouched 'd' — same multiset, reshuffled order.
    expect(G.deck.map((c) => c.cardId).sort()).toEqual(['a', 'c', 'd']);
  });

  it('rejects resolveInteraction when nothing is pending', () => {
    const G = freshWithPeek();
    expect(resolveInteraction(G, 0)).toBe('invalid');
  });

  it('rejects an out-of-range answer and leaves the interaction pending', () => {
    const G = freshWithPeek();
    playCard(G, 0);
    expect(resolveInteraction(G, 5)).toBe('invalid');
    expect(resolveInteraction(G, -1)).toBe('invalid');
    expect(G.pendingInteraction).not.toBeNull();
  });

  it('blocks playing another card while an interaction is pending', () => {
    const G = freshWithPeek();
    G.hand = instancesFromCardIds(['test_peek', 'test_food']);
    G.resources.production = 5;
    G.resources.population = 2;
    playCard(G, 0); // opens the interaction
    expect(G.pendingInteraction).not.toBeNull();
    expect(playCard(G, 0)).toBe('invalid'); // 'test_food' is now at index 0
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food']); // untouched
  });

  it('endTurn no-ops while an interaction is pending', () => {
    const G = freshWithPeek();
    playCard(G, 0);
    const state = { G, gameover: undefined };
    expect(endTurn(state)).toBe(state); // same reference — the turn cannot end mid-choice
  });

  it('survives a structuredClone round-trip mid-interaction (undo/clone safe)', () => {
    const G = freshWithPeek();
    playCard(G, 0);
    const clone = structuredClone(G);
    resolveInteraction(clone, 0); // choose 'a' on the clone
    expect(clone.hand.map((c) => c.cardId)).toEqual(['a']);
    expect(clone.pendingInteraction).toBeNull();
  });

  it('is unplayable when both draw and discard piles are empty — no cards to reveal', () => {
    const G = freshWithPeek();
    G.deck = [];
    G.discard = [];
    // The emptyDrawPile gate rejects the play outright instead of letting it fizzle for its cost.
    expect(playCard(G, 0)).toBe('invalid');
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_peek']); // still in hand, untouched
    expect(G.resources.science).toBe(1); // cost not paid
    expect(G.pendingInteraction).toBeNull();
  });

  it('reshuffles the discard in to still reveal up to 3 when the deck is short', () => {
    const G = freshWithPeek();
    G.deck = instancesFromCardIds(['a'], 10);
    G.discard = instancesFromCardIds(['b', 'c'], 20); // filed before the peek card itself files
    playCard(G, 0);
    // peekTop lifted 'a', then reshuffled ['b','c'] in to fill the tray to 3.
    expect(G.pendingInteraction?.options).toHaveLength(3);
    expect(G.pendingInteraction?.options.map((c) => c.cardId).sort()).toEqual(['a', 'b', 'c']);
  });
});
