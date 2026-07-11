import { describe, it, expect } from 'vitest';
import { blankState, type GameState } from '../rules';
import { keyOf } from './oracleKey';

/**
 * `keyOf` is a pure serialization of a `GameState` — it never looks a card up in the catalogue — so these
 * fixtures use bare made-up cardIds. The two things worth pinning: the *only* normalization is dropping
 * instance ids + derived/UI fields (everything else, kept ordered, must distinguish states), and every
 * field a transition reads must move the key.
 */
function baseState(): GameState {
  const G = blankState('m');
  G.round = 3;
  G.resources = { food: 5, production: 2, science: 0, military: 1, money: 4 };
  G.population = 2;
  G.territory = 3;
  G.culture = 7;
  G.handSize = 4;
  G.deck = [
    { id: 1, cardId: 'a' },
    { id: 2, cardId: 'b' },
    { id: 3, cardId: 'a' },
  ];
  G.hand = [
    { id: 4, cardId: 'c' },
    { id: 5, cardId: 'd' },
  ];
  G.discard = [{ id: 6, cardId: 'e' }];
  G.tableau = [{ id: 7, cardId: 'f', workers: 1 }];
  G.workZone = [{ id: 8, cardId: 'g', workers: 0 }];
  G.rngState = [1, 2, 3];
  return G;
}

describe('oracle transposition key', () => {
  it('is invariant under a wholesale instance-id relabeling (the one normalization)', () => {
    const G = baseState();
    const relabeled = structuredClone(G);
    for (const zoneList of [
      relabeled.deck,
      relabeled.hand,
      relabeled.discard,
      relabeled.removed,
      relabeled.tableau,
      relabeled.workZone,
      relabeled.threats,
    ]) {
      for (const c of zoneList) c.id += 1000;
    }
    expect(keyOf(relabeled)).toBe(keyOf(G));
  });

  it('drops derived / constant / UI fields (objective, pending flags, reshuffleCount)', () => {
    const G = baseState();
    const other = structuredClone(G);
    other.objective = { id: 999, cardId: 'obj' };
    other.pendingVictory = true;
    other.pendingDefeat = { reason: 'deadline' };
    other.reshuffleCount += 5;
    expect(keyOf(other)).toBe(keyOf(G));
  });

  it('distinguishes any resource / scalar difference', () => {
    const G = baseState();
    for (const mutate of [
      (s: GameState) => (s.resources.production += 1),
      (s: GameState) => (s.round += 1),
      (s: GameState) => (s.population += 1),
      (s: GameState) => (s.territory += 1),
      (s: GameState) => (s.culture += 1),
      (s: GameState) => (s.handSize += 1),
    ]) {
      const m = structuredClone(G);
      mutate(m);
      expect(keyOf(m)).not.toBe(keyOf(G));
    }
  });

  it('keeps deck order (the future draw sequence) — a swap of distinct cards changes the key', () => {
    const G = baseState();
    const swapped = structuredClone(G);
    [swapped.deck[0], swapped.deck[1]] = [swapped.deck[1], swapped.deck[0]]; // 'a','b' → 'b','a'
    expect(keyOf(swapped)).not.toBe(keyOf(G));
  });

  it('distinguishes a placed card by its worker count and rngState', () => {
    const G = baseState();
    const staffed = structuredClone(G);
    staffed.tableau[0].workers += 1;
    expect(keyOf(staffed)).not.toBe(keyOf(G));

    const rng = structuredClone(G);
    rng.rngState = [...rng.rngState, 9];
    expect(keyOf(rng)).not.toBe(keyOf(G));
  });

  it('folds a card instance’s counters into its token', () => {
    const G = baseState();
    const withCounter = structuredClone(G);
    withCounter.deck[0].counters = { plays: 3 };
    expect(keyOf(withCounter)).not.toBe(keyOf(G));
  });
});
