import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  addBuilding,
  addThreat,
  addWork,
  blankState,
  instancesFromCardIds,
  shuffle,
  subtractResources,
  type GameState,
} from '../rules';
import type { CardDef } from '../content/cards';
import { installCards, installFixtures, uninstallCards, uninstallFixtures } from '../rules/testFixtures';
import { endTurn, type RunState } from '../run/engine';
import { hashOf, keyOf } from './oracleKey';

// Local fixtures for the territory-drain case (the Overextension shape): a work card that lands +1
// territory at end of turn and a threat that drains 🔨 by the current territory. The threat reads a
// resource its workZone batch siblings mutate in the *same* end-of-turn dispatch — the exact "reads
// across its batch siblings" case this suite must pin. Kept local (only this file needs them) and
// synthetic (decoupled from the shipped Road/Conquest/Overextension numbers).
const LOCAL_CARDS: Record<string, CardDef> = {
  test_terr_work: {
    id: 'test_terr_work', name: 'Test Territory Work', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { territory: 1 } },
  },
  test_terr_threat: {
    id: 'test_terr_threat', name: 'Test Territory Threat', kind: 'threat', cost: {},
    upkeep: { resolve: ({ G }) => { subtractResources(G.resources, { production: G.resources.territory }); } },
  },
};

/**
 * Enforces the **zone order-independence invariant** (see DESIGN.md / the CLAUDE.md convention): no card
 * may make the *committed* end-of-round outcome depend on the resolution order of its siblings in the same
 * batch (production, threat drains, hand-event auto-resolve) or on the order cards file into the discard.
 * The engine's *dispatch* order stays fixed for replay determinism — this pins that the **outcome** is
 * commutative under it, which is exactly what lets `sim/oracleKey.ts` key those zones as multisets and the
 * discard reshuffle canonicalize by content (`deck.ts`).
 *
 * **Coverage caveat:** this is *one fixed fixture*, so it only catches order-dependence among the cards it
 * includes — it can't automatically flag a *future* order-dependent card. When you add a card whose effect
 * reads across its batch siblings, add it here. (A miss only costs the oracle *completeness* — a looser key
 * that misses wins — never soundness, since a returned line always replays through the real engine.)
 *
 * Method: build a producing state, permute every unordered zone (tableau/workZone/hand/discard), run the
 * *real* `endTurn` on each permutation, and assert the committed states are identical — compared both by
 * resources (a non-commutative production would move a scalar) and by `keyOf` (the multiset abstraction the
 * oracle actually relies on).
 */
function producingState(): GameState {
  const G = blankState('test'); // mission label only — no objective seeded here
  G.resources.population = 8;
  G.resources.food = 50; // amply fed, so nothing collapses over the tested rounds
  G.resources.production = 10; // buffered so the territory drain can't run production negative
  // Several producing siblings emitting to different pools — two duplicate food buildings, a multi-output
  // building (production + military), two work boxes (production, food), and two territory work boxes —
  // each auto-staffed from the idle pool (8 pop → 7 staffed, 1 idle), so a non-commutative production
  // would move a scalar. The two territory boxes let the drain threat below read a mutated sibling pool.
  addBuilding(G, 'test_food');
  addBuilding(G, 'test_food');
  addBuilding(G, 'test_multi');
  addWork(G, 'test_work');
  addWork(G, 'test_work_food');
  addWork(G, 'test_terr_work');
  addWork(G, 'test_terr_work');
  // The territory-scaled drain: it ticks after the workZone production pass, so it reads the +2 territory
  // the two work boxes just landed — pinning that the committed drain is order-independent regardless.
  addThreat(G, 'test_terr_threat');
  // A few non-event hand cards + a stocked deck/discard, so the end-of-turn recycle and a possible
  // reshuffle both run and their ordering can't leak into the result.
  G.hand = instancesFromCardIds(['test_work', 'test_action', 'test_settlers'], 200);
  G.deck = instancesFromCardIds(['test_food', 'test_work', 'test_work_food'], 300);
  G.discard = instancesFromCardIds(['test_action', 'test_settlers', 'test_work'], 400);
  return G;
}

/** Deterministic permutations of `G`'s unordered zones — reverse plus a few seeded shuffles. */
function permutations(G: GameState): GameState[] {
  const seeds = ['p1', 'p2', 'p3'];
  const out: GameState[] = [];
  // reversed
  const rev = structuredClone(G);
  rev.tableau.reverse();
  rev.workZone.reverse();
  rev.hand.reverse();
  rev.discard.reverse();
  out.push(rev);
  // seeded shuffles
  for (const s of seeds) {
    const p = structuredClone(G);
    p.tableau = shuffle(p.tableau, `t-${s}`);
    p.workZone = shuffle(p.workZone, `w-${s}`);
    p.hand = shuffle(p.hand, `h-${s}`);
    p.discard = shuffle(p.discard, `d-${s}`);
    out.push(p);
  }
  return out;
}

describe('zone order-independence invariant', () => {
  beforeAll(() => {
    installFixtures();
    installCards(LOCAL_CARDS);
  });
  afterAll(() => {
    uninstallCards(LOCAL_CARDS);
    uninstallFixtures();
  });

  it('endTurn is commutative under any permutation of the unordered zones', () => {
    const base = producingState();
    const baseState: RunState = { G: structuredClone(base), gameover: undefined };
    const baseAfter = endTurn(baseState);
    const baseKey = keyOf(baseAfter.G);
    const baseHash = hashOf(baseAfter.G);

    for (const perm of permutations(base)) {
      const after = endTurn({ G: perm, gameover: undefined });
      // Resources: a non-commutative production/drain would move a scalar here.
      expect(after.G.resources).toEqual(baseAfter.G.resources);
      // The multiset abstraction the oracle keys on must agree regardless of input order — on the
      // canonical key and on the fingerprint the searches actually index by, which erases zone order by a
      // different mechanism (a commutative fold rather than a sort) and so can fail independently.
      expect(keyOf(after.G)).toBe(baseKey);
      expect(hashOf(after.G)).toBe(baseHash);
    }
  });
});
