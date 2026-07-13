import { randInt, seededRng, type GameState } from '../rules';
import { CARDS } from '../content/cards';
import { discardCostToPay, enumerateActions } from './actions';
import type { Policy, SimAction } from './simulate';

/** A live seeded generator — typed off `seededRng` so `pure-rand` stays confined to `rules/rng.ts`. */
type Rng = ReturnType<typeof seededRng>;

/**
 * A random-legal-move policy: at each step it takes the shared legal-action enumeration
 * (`sim/actions.ts`'s `enumerateActions` — reusing the prod gate `unplayableReason`, so the fuzzer and
 * the real UI agree on what is playable) and picks one uniformly from its own seeded stream (distinct
 * from the run's shuffle seed, so play-order and draw-order vary independently). For a `playCard` it then
 * *re-randomizes* the extras the canonical enumeration fixed (which cards to sacrifice) so the fuzzer still
 * exercises those choices. A parked interaction resolves to a random option —
 * `enumerateActions` already returns only those when one is pending, so no special-case is needed here.
 *
 * Doubles as a crash / illegal-state fuzzer — walking arbitrary legal sequences drives the run into
 * corners a scripted test wouldn't, which `simulateRun`'s post-step invariant checks then police.
 */
export function createRandomPolicy(policySeed: string): Policy {
  const rng = seededRng(policySeed);
  const policy: Policy = (state) => {
    const candidates = enumerateActions(state.G);
    const pick = candidates[randInt(rng, 0, candidates.length - 1)];
    // Only `playCard` carries randomizable extras; every other action is already fully determined.
    return pick.kind === 'playCard' ? randomizePlay(state.G, pick.playHandIdx, rng) : pick;
  };
  policy.seed = policySeed;
  return policy;
}

/** Rebuild a legal `playCard` for `playHandIdx` with *randomized* extras — a random discard-cost
 *  sacrifice (of the count `discardCostToPay` fixes, waive included). */
function randomizePlay(G: GameState, playHandIdx: number, rng: Rng): SimAction {
  const card = CARDS[G.hand[playHandIdx].cardId];
  const required = discardCostToPay(G, card);

  let discardHandIdxs: number[] | undefined;
  if (required > 0) {
    const others: number[] = [];
    for (let i = 0; i < G.hand.length; i++) if (i !== playHandIdx) others.push(i);
    discardHandIdxs = pickDistinct(others, required, rng);
  }

  return { kind: 'playCard', playHandIdx, discardHandIdxs };
}

/** Pick `k` distinct entries from `pool` via a partial Fisher–Yates shuffle over a copy. */
function pickDistinct(pool: number[], k: number, rng: Rng): number[] {
  const a = [...pool];
  for (let i = 0; i < k; i++) {
    const j = randInt(rng, i, a.length - 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}
