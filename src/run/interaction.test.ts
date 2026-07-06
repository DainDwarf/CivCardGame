import { describe, it, expect } from 'vitest';
import { playCard, resolveInteraction } from './moves';
import { endTurn } from './engine';
import { blankState, instancesFromCardIds, type GameState } from '../rules';

function freshWithForesight(): GameState {
  const G = blankState('enlightenment');
  G.hand = instancesFromCardIds(['foresight']);
  G.resources.science = 1;
  G.deck = instancesFromCardIds(['a', 'b', 'c', 'd'], 10);
  return G;
}

describe('Foresight (interactive peek) — suspend/resume', () => {
  it('reveals the top 3 and parks a pending interaction on play', () => {
    const G = freshWithForesight();
    playCard(G, 0);
    expect(G.pendingInteraction).toEqual({
      cardId: 'foresight',
      instanceId: 1, // the played Foresight copy's own id
      kind: 'chooseCard',
      prompt: 'Draw one — the rest shuffle back',
      options: instancesFromCardIds(['a', 'b', 'c'], 10), // the 3 revealed instances (deck ids 10–12)
      pick: 1,
    });
    expect(G.deck.map((c) => c.cardId)).toEqual(['d']); // the 3 peeked cards lifted off the deck
    expect(G.discard.map((c) => c.cardId)).toEqual(['foresight']); // the action itself filed
    expect(G.resources.science).toBe(0); // cost paid
    expect(G.hand).toEqual([]); // nothing drawn yet — that waits for the answer
  });

  it('draws the chosen card and shuffles the rest back on resume', () => {
    const G = freshWithForesight();
    playCard(G, 0);
    resolveInteraction(G, 1); // choose 'b'
    expect(G.hand.map((c) => c.cardId)).toEqual(['b']);
    expect(G.pendingInteraction).toBeNull();
    // 'a' and 'c' returned to the deck alongside the untouched 'd' — same multiset, reshuffled order.
    expect(G.deck.map((c) => c.cardId).sort()).toEqual(['a', 'c', 'd']);
  });

  it('rejects resolveInteraction when nothing is pending', () => {
    const G = freshWithForesight();
    expect(resolveInteraction(G, 0)).toBe('invalid');
  });

  it('rejects an out-of-range answer and leaves the interaction pending', () => {
    const G = freshWithForesight();
    playCard(G, 0);
    expect(resolveInteraction(G, 5)).toBe('invalid');
    expect(resolveInteraction(G, -1)).toBe('invalid');
    expect(G.pendingInteraction).not.toBeNull();
  });

  it('blocks playing another card while an interaction is pending', () => {
    const G = freshWithForesight();
    G.hand = instancesFromCardIds(['foresight', 'farm']);
    G.resources.production = 5;
    G.population = 2;
    playCard(G, 0); // opens the interaction
    expect(G.pendingInteraction).not.toBeNull();
    expect(playCard(G, 0)).toBe('invalid'); // 'farm' is now at index 0
    expect(G.hand.map((c) => c.cardId)).toEqual(['farm']); // untouched
  });

  it('endTurn no-ops while an interaction is pending', () => {
    const G = freshWithForesight();
    playCard(G, 0);
    const state = { G, gameover: undefined };
    expect(endTurn(state)).toBe(state); // same reference — the turn cannot end mid-choice
  });

  it('survives a structuredClone round-trip mid-interaction (undo/clone safe)', () => {
    const G = freshWithForesight();
    playCard(G, 0);
    const clone = structuredClone(G);
    resolveInteraction(clone, 0); // choose 'a' on the clone
    expect(clone.hand.map((c) => c.cardId)).toEqual(['a']);
    expect(clone.pendingInteraction).toBeNull();
  });

  it('fizzles (no interaction) on an empty draw pile, still paying and discarding', () => {
    const G = freshWithForesight();
    G.deck = [];
    playCard(G, 0);
    expect(G.pendingInteraction).toBeNull();
    expect(G.discard.map((c) => c.cardId)).toEqual(['foresight']);
    expect(G.resources.science).toBe(0);
  });
});
