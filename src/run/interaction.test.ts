import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { playCard, resolveInteraction } from './moves';
import { endTurn } from './engine';
import { blankState, instancesFromCardIds, type GameState } from '../rules';
import { installCards, uninstallCards } from '../rules/testFixtures';
import { type CardDef } from '../content/cards';
import { suspendChoice } from '../rules/effects';
import { recoverFromDiscard } from '../rules/deck';

// A local fixture for the `chooseCard` interaction path + the `recoverFromDiscard` primitive (no
// shipping card exercises them). It reproduces the canonical shape — suspend a choice over the discard,
// then return the chosen card to hand — so the interaction *engine* (suspend/resume, blocking guards,
// clone-safety) and the recovery mover both stay covered. An interactive-`suspendChoice` card is exactly
// the kind of one-file fixture that stays local (see `rules/testFixtures.ts`), installed via `installCards`.
const FIXTURE: Record<string, CardDef> = {
  test_recover: {
    id: 'test_recover', name: 'Test Recover', kind: 'action', cost: { science: 2 },
    display: { description: 'Return a chosen card from discard to hand.' },
    // Nothing to recover from an empty discard — gate it rather than let it fizzle for its cost.
    gate: { check: (G) => (G.discard.length === 0 ? { kind: 'discardEmpty' } : null) },
    // Keys its two resolver passes on `ctx.answer === undefined` (0 is a valid answer).
    effect: {
      resolve: (ctx) => {
        if (ctx.answer === undefined) {
          // First pass: suspend with the discard as options. `discardEmpty` is gated unplayable, so the
          // guard only covers a direct call; the snapshot excludes the card itself (still held by
          // `playCard`, not yet filed to discard).
          if (ctx.G.discard.length === 0) return;
          suspendChoice(ctx, {
            kind: 'chooseCard',
            prompt: 'Return one card from the discard to your hand',
            options: [...ctx.G.discard],
            pick: 1,
          });
          return;
        }
        // Resume: `answer` indexes the parked options; `recoverFromDiscard` finds it by instance id.
        const pending = ctx.G.pendingInteraction;
        if (!pending) return;
        const chosen = pending.options[ctx.answer];
        if (chosen) recoverFromDiscard(ctx, chosen);
        ctx.G.pendingInteraction = null; // resolver owns clearing the interaction on resume
      },
    },
  },
  // A trivially-playable action — the "other card" the blocked-while-pending test tries to play. Given a
  // cost the test can afford, so the block is provably the pending guard, not affordability.
  test_playable: {
    id: 'test_playable', name: 'Test Playable', kind: 'action', cost: { production: 1 },
    effect: { resources: { science: 1 } },
  },
};

beforeAll(() => installCards(FIXTURE));
afterAll(() => uninstallCards(FIXTURE));

// Discard cards use synthetic ids ('a'/'b'/'c'): the moves under test never look them up in CARDS (the
// recovery is by instance id).
function freshWithRecover(): GameState {
  const G = blankState('test');
  G.hand = instancesFromCardIds(['test_recover']); // id 1
  G.resources.science = 2;
  G.discard = instancesFromCardIds(['a', 'b', 'c'], 10); // ids 10–12
  return G;
}

describe('chooseCard interaction (discard recovery) — suspend/resume', () => {
  it('parks a choice over the discard snapshot and files itself, excluding itself from the options', () => {
    const G = freshWithRecover();
    playCard(G, 0);
    expect(G.pendingInteraction).toEqual({
      cardId: 'test_recover',
      instanceId: 1,
      kind: 'chooseCard',
      prompt: 'Return one card from the discard to your hand',
      options: instancesFromCardIds(['a', 'b', 'c'], 10), // the discard as it was before the play
      pick: 1,
    });
    // The card itself filed to discard *after* the snapshot, so it's never one of its own options.
    expect(G.pendingInteraction?.options.some((c) => c.cardId === 'test_recover')).toBe(false);
    expect(G.discard.map((c) => c.cardId)).toEqual(['a', 'b', 'c', 'test_recover']);
    expect(G.resources.science).toBe(0); // cost paid
    expect(G.hand).toEqual([]); // nothing recovered yet — that waits for the answer
  });

  it('returns the chosen card to hand and clears the interaction on resume', () => {
    const G = freshWithRecover();
    playCard(G, 0);
    resolveInteraction(G, 1); // choose 'b'
    expect(G.hand.map((c) => c.cardId)).toEqual(['b']);
    expect(G.discard.map((c) => c.cardId)).toEqual(['a', 'c', 'test_recover']); // 'b' gone; the card stays
    expect(G.pendingInteraction).toBeNull();
  });

  it('index 0 is a valid answer (the === undefined guard, not a falsy check)', () => {
    const G = freshWithRecover();
    playCard(G, 0);
    resolveInteraction(G, 0); // choose 'a'
    expect(G.hand.map((c) => c.cardId)).toEqual(['a']);
    expect(G.pendingInteraction).toBeNull();
  });

  it('survives a structuredClone round-trip mid-interaction (undo/clone safe)', () => {
    const G = freshWithRecover();
    playCard(G, 0);
    const clone = structuredClone(G);
    resolveInteraction(clone, 2); // choose 'c' on the clone
    expect(clone.hand.map((c) => c.cardId)).toEqual(['c']);
    expect(clone.discard.map((c) => c.cardId)).toEqual(['a', 'b', 'test_recover']);
    expect(clone.pendingInteraction).toBeNull();
  });

  it('is unplayable with an empty discard — nothing to recover, cost not paid', () => {
    const G = freshWithRecover();
    G.discard = [];
    // The discardEmpty gate rejects the play outright instead of letting it fizzle for its cost.
    expect(playCard(G, 0)).toBe('invalid');
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_recover']); // still in hand, untouched
    expect(G.resources.science).toBe(2); // cost not paid
    expect(G.pendingInteraction).toBeNull();
  });

  // The interaction *engine* itself (not recovery-specific), exercised through this real suspend/resume
  // card — reject/blocking guards on `moves`/`endTurn` while a choice is parked.
  it('rejects resolveInteraction when nothing is pending', () => {
    const G = freshWithRecover();
    expect(resolveInteraction(G, 0)).toBe('invalid');
  });

  it('rejects an out-of-range answer and leaves the interaction pending', () => {
    const G = freshWithRecover();
    playCard(G, 0);
    expect(resolveInteraction(G, 5)).toBe('invalid');
    expect(resolveInteraction(G, -1)).toBe('invalid');
    expect(G.pendingInteraction).not.toBeNull();
  });

  it('blocks playing another card while an interaction is pending', () => {
    const G = freshWithRecover();
    G.hand = instancesFromCardIds(['test_recover', 'test_playable']); // ids 1–2
    G.resources.production = 1; // enough to play 'test_playable' — proving it's the pending guard, not affordability
    playCard(G, 0); // opens the interaction; test_recover files to discard
    expect(G.pendingInteraction).not.toBeNull();
    expect(playCard(G, 0)).toBe('invalid'); // 'test_playable' is now at index 0 — blocked while pending
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_playable']); // untouched
  });

  it('endTurn no-ops while an interaction is pending', () => {
    const G = freshWithRecover();
    playCard(G, 0);
    const state = { G, gameover: undefined };
    expect(endTurn(state)).toBe(state); // same reference — the turn cannot end mid-choice
  });
});
