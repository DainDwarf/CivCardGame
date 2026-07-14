import { describe, it, expect } from 'vitest';
import { playCard, resolveInteraction } from './moves';
import { endTurn } from './engine';
import { blankState, instancesFromCardIds, type GameState } from '../rules';

// Storytelling is a real catalogue card (not a test fixture): cost 2🔬, recoversFromDiscard — suspend
// a choice over the discard pile, then return the chosen card to hand. Discard cards use synthetic ids
// ('a'/'b'/'c'): the moves under test never look them up in CARDS (the recovery is by instance id).
function freshWithStory(): GameState {
  const G = blankState('test');
  G.hand = instancesFromCardIds(['storytelling']); // id 1
  G.resources.science = 2;
  G.discard = instancesFromCardIds(['a', 'b', 'c'], 10); // ids 10–12
  return G;
}

describe('Storytelling (discard recovery) — suspend/resume', () => {
  it('parks a choice over the discard snapshot and files itself, excluding itself from the options', () => {
    const G = freshWithStory();
    playCard(G, 0);
    expect(G.pendingInteraction).toEqual({
      cardId: 'storytelling',
      instanceId: 1,
      kind: 'chooseCard',
      prompt: 'Return one card from the discard to your hand',
      options: instancesFromCardIds(['a', 'b', 'c'], 10), // the discard as it was before the play
      pick: 1,
    });
    // Storytelling itself filed to discard *after* the snapshot, so it's never one of its own options.
    expect(G.pendingInteraction?.options.some((c) => c.cardId === 'storytelling')).toBe(false);
    expect(G.discard.map((c) => c.cardId)).toEqual(['a', 'b', 'c', 'storytelling']);
    expect(G.resources.science).toBe(0); // cost paid
    expect(G.hand).toEqual([]); // nothing recovered yet — that waits for the answer
  });

  it('returns the chosen card to hand and clears the interaction on resume', () => {
    const G = freshWithStory();
    playCard(G, 0);
    resolveInteraction(G, 1); // choose 'b'
    expect(G.hand.map((c) => c.cardId)).toEqual(['b']);
    expect(G.discard.map((c) => c.cardId)).toEqual(['a', 'c', 'storytelling']); // 'b' gone; Storytelling stays
    expect(G.pendingInteraction).toBeNull();
  });

  it('index 0 is a valid answer (the === undefined guard, not a falsy check)', () => {
    const G = freshWithStory();
    playCard(G, 0);
    resolveInteraction(G, 0); // choose 'a'
    expect(G.hand.map((c) => c.cardId)).toEqual(['a']);
    expect(G.pendingInteraction).toBeNull();
  });

  it('survives a structuredClone round-trip mid-interaction (undo/clone safe)', () => {
    const G = freshWithStory();
    playCard(G, 0);
    const clone = structuredClone(G);
    resolveInteraction(clone, 2); // choose 'c' on the clone
    expect(clone.hand.map((c) => c.cardId)).toEqual(['c']);
    expect(clone.discard.map((c) => c.cardId)).toEqual(['a', 'b', 'storytelling']);
    expect(clone.pendingInteraction).toBeNull();
  });

  it('is unplayable with an empty discard — nothing to recover, cost not paid', () => {
    const G = freshWithStory();
    G.discard = [];
    // The discardEmpty gate rejects the play outright instead of letting it fizzle for its cost.
    expect(playCard(G, 0)).toBe('invalid');
    expect(G.hand.map((c) => c.cardId)).toEqual(['storytelling']); // still in hand, untouched
    expect(G.resources.science).toBe(2); // cost not paid
    expect(G.pendingInteraction).toBeNull();
  });

  // The interaction *engine* itself (not Storytelling-specific), exercised through this real
  // suspend/resume card — reject/blocking guards on `moves`/`endTurn` while a choice is parked.
  it('rejects resolveInteraction when nothing is pending', () => {
    const G = freshWithStory();
    expect(resolveInteraction(G, 0)).toBe('invalid');
  });

  it('rejects an out-of-range answer and leaves the interaction pending', () => {
    const G = freshWithStory();
    playCard(G, 0);
    expect(resolveInteraction(G, 5)).toBe('invalid');
    expect(resolveInteraction(G, -1)).toBe('invalid');
    expect(G.pendingInteraction).not.toBeNull();
  });

  it('blocks playing another card while an interaction is pending', () => {
    const G = freshWithStory();
    G.hand = instancesFromCardIds(['storytelling', 'fire']); // ids 1–2
    G.resources.production = 1; // enough to play 'fire' — proving it's the pending guard, not affordability
    playCard(G, 0); // opens the interaction; storytelling files to discard
    expect(G.pendingInteraction).not.toBeNull();
    expect(playCard(G, 0)).toBe('invalid'); // 'fire' is now at index 0 — blocked while pending
    expect(G.hand.map((c) => c.cardId)).toEqual(['fire']); // untouched
  });

  it('endTurn no-ops while an interaction is pending', () => {
    const G = freshWithStory();
    playCard(G, 0);
    const state = { G, gameover: undefined };
    expect(endTurn(state)).toBe(state); // same reference — the turn cannot end mid-choice
  });
});
