import { describe, it, expect } from 'vitest';
import { blankState, type GameState } from '../rules';
import { CARDS } from '../content/cards';
import { hashOf, keyOf } from './oracleKey';

/**
 * `keyOf` is a pure serialization of a `GameState` — it never looks a card up in the catalogue — so these
 * fixtures use bare made-up cardIds. The two things worth pinning: the *only* normalization is dropping
 * instance ids + derived/UI fields (everything else, kept ordered, must distinguish states), and every
 * field a transition reads must move the key.
 */
function baseState(): GameState {
  const G = blankState('m');
  G.round = 3;
  G.resources = { food: 5, production: 2, science: 0, military: 1, money: 4, population: 2, territory: 3, culture: 7 };
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

  it('drops derived / constant / UI fields (objective, pending flags, reshuffleCount, revealCount)', () => {
    const G = baseState();
    const other = structuredClone(G);
    other.objective = { id: 999, cardId: 'obj' };
    other.pendingVictory = true;
    other.pendingDefeat = { reason: 'deadline' };
    other.reshuffleCount += 5;
    other.revealCount += 3;
    expect(keyOf(other)).toBe(keyOf(G));
  });

  it('distinguishes any resource / scalar difference', () => {
    const G = baseState();
    for (const mutate of [
      (s: GameState) => (s.resources.production += 1),
      (s: GameState) => (s.round += 1),
      (s: GameState) => (s.resources.population += 1),
      (s: GameState) => (s.resources.territory += 1),
      (s: GameState) => (s.resources.culture += 1),
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

  it('treats every non-deck zone as an unordered multiset — reordering it leaves the key unchanged', () => {
    const G = baseState();
    G.hand = [
      { id: 4, cardId: 'c' },
      { id: 5, cardId: 'd' },
    ];
    G.tableau = [
      { id: 7, cardId: 'f', workers: 1 },
      { id: 9, cardId: 'h', workers: 0 },
    ];
    const reordered = structuredClone(G);
    reordered.hand.reverse();
    reordered.tableau.reverse();
    expect(keyOf(reordered)).toBe(keyOf(G));
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

  it('folds a card instance’s stickers into its token, order-independently', () => {
    const G = baseState();
    const stickered = structuredClone(G);
    stickered.deck[0].stickers = ['irrigation', 'terrace'];
    expect(keyOf(stickered)).not.toBe(keyOf(G));

    const reordered = structuredClone(stickered);
    reordered.deck[0].stickers = ['terrace', 'irrigation'];
    expect(keyOf(reordered)).toBe(keyOf(stickered));
  });

  it('treats empty counters / stickers as bare content', () => {
    const G = baseState();
    const empties = structuredClone(G);
    empties.deck[0].counters = {};
    empties.hand[0].stickers = [];
    expect(keyOf(empties)).toBe(keyOf(G));
  });
});

/**
 * `keyOf` tokenizes a bare instance by its raw `cardId` and a decorated one (counters/stickers) by its
 * full `contentKey`. The two token spaces stay disjoint only because a `contentKey` always contains `#`
 * and a cardId never does — so a `#` in a cardId would let a bare and a decorated instance collide,
 * silently merging two distinct states.
 */
describe('cardId / content-key separator coherence', () => {
  it('no cardId contains the contentKey separator', () => {
    for (const cardId of Object.keys(CARDS)) expect(cardId).not.toContain('#');
  });
});

/**
 * `hashOf` is a lossy stand-in for `keyOf`, so the two directions are not equally serious. **Splitting** an
 * equivalence class is a real defect — it silently costs every merge in that class, and no collision check
 * exists to catch it. **Separating** distinct states is only best-effort: a collision is legal by design
 * (it costs completeness, never soundness), so these pin the cases the commutative fold could plausibly
 * lose outright rather than any general injectivity.
 */
describe('state fingerprint', () => {
  it('never splits an equivalence class the canonical key merges', () => {
    const G = baseState();
    const equivalent = structuredClone(G);
    for (const zoneList of [equivalent.deck, equivalent.hand, equivalent.discard, equivalent.tableau]) {
      for (const c of zoneList) c.id += 1000;
    }
    equivalent.hand.reverse();
    equivalent.objective = { id: 999, cardId: 'obj' };
    equivalent.pendingVictory = true;
    equivalent.revealCount += 3;
    expect(keyOf(equivalent)).toBe(keyOf(G)); // the premise: the canonical key calls these one state
    expect(hashOf(equivalent)).toBe(hashOf(G));
  });

  it('does not cancel a duplicated card out of an unordered zone', () => {
    const G = baseState();
    const paired = structuredClone(G);
    paired.hand = [
      { id: 4, cardId: 'c' },
      { id: 5, cardId: 'c' },
    ];
    const empty = structuredClone(G);
    empty.hand = [];
    expect(hashOf(paired)).not.toBe(hashOf(empty));
  });

  it('does not let one zone masquerade as another holding the same cards', () => {
    const G = baseState();
    const moved = structuredClone(G);
    moved.discard = [...moved.hand];
    moved.hand = [];
    expect(hashOf(moved)).not.toBe(hashOf(G));
  });

  it('stays sensitive to deck order, staffing, scalars, and the rng state', () => {
    const G = baseState();
    const reordered = structuredClone(G);
    [reordered.deck[0], reordered.deck[1]] = [reordered.deck[1], reordered.deck[0]];
    expect(hashOf(reordered)).not.toBe(hashOf(G));

    const staffed = structuredClone(G);
    staffed.tableau[0].workers += 1;
    expect(hashOf(staffed)).not.toBe(hashOf(G));

    const richer = structuredClone(G);
    richer.resources.production += 1;
    expect(hashOf(richer)).not.toBe(hashOf(G));

    const rng = structuredClone(G);
    rng.rngState = [1, 2, 4];
    expect(hashOf(rng)).not.toBe(hashOf(G));
  });

  it('is an exact integer, so a number-keyed Map can index it', () => {
    const G = baseState();
    const h = hashOf(G);
    expect(Number.isSafeInteger(h)).toBe(true);
    expect(hashOf(structuredClone(G))).toBe(h); // and stable across calls
  });
});
