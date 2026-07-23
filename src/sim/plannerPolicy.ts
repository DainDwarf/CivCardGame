import { hashOf } from './oracleKey';
import { endTurn, type RunState } from '../run/engine';
import { enumerateActions } from './actions';
import { applyAction, type Policy, type SimAction } from './simulate';
import { expandTurn, reconstruct, type Budget, type Heuristic, type SearchNode } from './turnSearch';
import { scoreState } from './value';
import {
  DEFAULT_ENABLER_TERMS,
  deriveEnablers,
  enablerPotential,
  enablerTermsOf,
  type EnablerModel,
  type EnablerTerms,
} from './enablers';
import { determinize } from './determinize';
import { seededRng, type GameState } from '../rules';

/**
 * A **fair, competent planner** — the honest middle between the one-ply greedies (too shallow to plan the
 * multi-turn conversion chains the game is built on) and the oracle (perfect-information: it reads the real
 * shuffle off `cloneState(G)`, and pays a per-seed winnability-proof cost). Where the greedies stall
 * on a mission like Masonry — sitting at a survival equilibrium because banking military/production toward
 * a future Conquest/Hut never raises the one-ply heuristic — this policy searches a few turns ahead and
 * commits the best line.
 *
 * **Bounded determinized expectimax + beam.** The only hidden information is the *draw order*; randomness
 * resolves only at the turn boundary. So each re-plan samples `determinizations` fair worlds
 * (`determinize` — sampled deck, real hand), evaluates every candidate line in each, and **averages** the
 * value across worlds (Perfect-Information Monte Carlo). Within a world the game is deterministic, so each
 * world is a plain shallow beam over the shared turn-search skeleton (`sim/turnSearch.ts`), with leaves
 * scored by `scoreState` **plus the enabler potential** (`sim/enablers.ts`) — the shaping that lets the
 * horizon stay shallow (and thus cheap). Reuses the engine seams verbatim; lives strictly in `sim/`.
 *
 * **Online, per information-reveal.** Unlike the oracle it doesn't plan once — sampled worlds differ from
 * the real future, so it re-plans whenever new information lands. It commits a turn's line into a buffer
 * and dispenses one action per call, but only **up to the next reveal**: the turn's `endTurn` (a real draw
 * follows) or any action that parks a `pendingInteraction` (a real peek). After either, the buffer empties
 * and the next call re-plans on the now-real state. For a deck with no in-turn draw/peek cards this is
 * simply "plan a turn, play it out, re-plan next turn."
 *
 * A **candidate turn line** is enumerated on the *real* state (within-turn plays don't touch the deck for
 * the current card set, so both the set of lines *and* each line's end state are world-independent) and
 * evaluated in each sampled world by **grafting** the world onto its already-computed end state — splicing
 * in that world's deck + rngState instead of replaying the line — then looking ahead. Common random
 * numbers across lines, so the argmax is low-variance. A mid-turn *peek* (Calendar) is compatible — it's
 * look-only, so the deck the graft splices in stays the sole difference. A card that *drew* mid-turn would
 * break the premise (the line pulled real cards off the real deck, so a full sampled deck double-counts),
 * as would a peek whose resolution consumes what it saw — the reveal-boundary design (TODO.md) is the plan
 * for that day.
 */

export interface PlannerOptions {
  /** Turns of look-ahead past the current one. Deeper sees longer chains, at more cost. */
  depth?: number;
  /** States kept per look-ahead round in a world's beam. */
  beamWidth?: number;
  /** Distinct pre-`endTurn` lines explored within a turn (bounds the within-turn sub-search). */
  turnConfigLimit?: number;
  /** Fair worlds sampled per re-plan and averaged over (the PIMC sample count). */
  determinizations?: number;
  /** Engine-step backstop per re-plan — aborts the search reporting its best-so-far if exceeded. */
  nodeBudget?: number;
  /** Fold the enabler potential into the leaf value (the shaping that steers the conversion chains).
   *  Defaults to `DEFAULT_ENABLER_TERMS` (the measured lean set); `true` is the full all-on model, off
   *  isolates the bare `scoreState` planner, and an `EnablerTerms` object ablates individual mechanisms
   *  (per-term attribution). */
  enablers?: boolean | EnablerTerms;
}

const DEFAULTS: Required<PlannerOptions> = {
  depth: 1,
  beamWidth: 4,
  turnConfigLimit: 8,
  determinizations: 2,
  nodeBudget: 100_000,
  enablers: DEFAULT_ENABLER_TERMS,
};

/** A reachable victory in a sampled world — dominates any heuristic leaf so a winning line is preferred. */
const VICTORY = 1e9;

function makeNode(state: RunState, h: Heuristic): SearchNode {
  const key = hashOf(state.G);
  return { state, parent: null, action: null, key, h: h(state.G, key) };
}

/**
 * Best heuristic value reachable within `depth` further turns from `root` in one (already-sampled) world —
 * a bounded, deterministic beam. A reachable `victory` short-circuits to `VICTORY`; a defeat branch is
 * pruned. Each turn's own pre-`endTurn` configs are candidate leaves (so "wait a round" is considered).
 */
function beamValue(root: RunState, depth: number, opts: Required<PlannerOptions>, budget: Budget, h: Heuristic): number {
  const rootNode = makeNode(root, h);
  let best = rootNode.h;
  let beam: SearchNode[] = [rootNode];

  for (let d = 0; d < depth; d++) {
    const successors: SearchNode[] = [];
    for (const node of beam) {
      const { win, configs } = expandTurn(node, opts.turnConfigLimit, budget, h);
      if (win) return VICTORY;
      for (const cfg of configs) {
        if (cfg.h > best) best = cfg.h;
        const advanced = endTurn(cfg.state);
        if (advanced === cfg.state) continue; // parked interaction: its resolutions are other configs
        if (advanced.gameover) {
          if (advanced.gameover.outcome === 'victory') return VICTORY;
          continue; // defeat — dead branch
        }
        successors.push(makeNode(advanced, h));
      }
      if (budget.steps >= budget.cap) return best;
    }
    if (successors.length === 0) break;
    successors.sort((a, b) => b.h - a.h);
    beam = successors.length > opts.beamWidth ? successors.slice(0, opts.beamWidth) : successors;
    if (beam[0].h > best) best = beam[0].h;
  }
  return best;
}

/** Value of committing this turn's line `cfg` in one sampled world: end the turn (drawing that world's
 *  sampled cards) and look `depth` turns further. A parked interaction (unresolvable `endTurn`) is valued
 *  through its answers — the re-plan that follows the real reveal picks one, so the line is worth the best
 *  answer's continuation (resolve, then end the turn into the world), not its bare leaf. A bare leaf would
 *  undervalue commit-at-the-reveal lines against fully-played ones; note it still can't make an
 *  information-only peek *attractive* — inside a sampled world the lookahead already knows the deck, so a
 *  reveal has no modeled upside there (the PIMC strategy-fusion ceiling). */
function evalLine(cfg: RunState, opts: Required<PlannerOptions>, budget: Budget, h: Heuristic): number {
  const advanced = endTurn(cfg);
  if (advanced === cfg) {
    let best = -Infinity;
    for (const action of enumerateActions(cfg.G)) {
      budget.steps += 1;
      const resolved = applyAction(cfg, action);
      if (resolved === cfg) continue;
      if (resolved.gameover) {
        if (resolved.gameover.outcome === 'victory') return VICTORY;
        continue; // a defeat answer — dead branch
      }
      const value = evalLine(resolved, opts, budget, h);
      if (value > best) best = value;
      if (budget.steps >= budget.cap) break; // same node-budget backstop as beamValue/expandTurn
    }
    return best === -Infinity ? h(cfg.G) : best;
  }
  if (advanced.gameover) return advanced.gameover.outcome === 'victory' ? VICTORY : h(advanced.G);
  return beamValue(advanced, opts.depth, opts, budget, h);
}

/** The action prefix to commit from a chosen turn line: every action up to and including the first that
 *  parks a `pendingInteraction` (a real reveal to re-plan on), else the whole line plus `endTurn`. */
function commitPrefix(cfg: SearchNode): SimAction[] {
  const chain: SearchNode[] = [];
  for (let n: SearchNode | null = cfg; n; n = n.parent) chain.push(n);
  chain.reverse();
  const out: SimAction[] = [];
  for (const node of chain) {
    if (!node.action) continue; // the root
    out.push(node.action);
    if (node.state.G.pendingInteraction) return out; // stop at the reveal — the rest is re-planned
  }
  out.push({ kind: 'endTurn' });
  return out;
}

export function createPlannerPolicy(policySeed: string, options: PlannerOptions = {}): Policy {
  const opts = { ...DEFAULTS, ...options };
  let model: EnablerModel | null = null;
  let rngState = seededRng(policySeed).getState();
  const buffer: SimAction[] = [];

  /** Leaf values already computed this run, keyed by the transposition fingerprint — split across two maps
   *  by the one field the value reads that the fingerprint drops (`pendingVictory` — derived, so it *would*
   *  follow from the key, but splitting on it removes the argument). `objective`/`missionId`, also dropped,
   *  are constant within a run and this cache never outlives one. Worth it because the beam and the sampled
   *  worlds re-score ~25% of states, each score costing two upkeep projections — far more than a lookup. */
  const leafCache = new Map<number, number>();
  const leafCacheVictory = new Map<number, number>();

  const replan = (state: RunState): void => {
    if (!model) {
      const terms = enablerTermsOf(opts.enablers);
      model = terms ? deriveEnablers(state.G, terms) : { weight: {}, cap: {}, producerCredit: {} };
    }
    const enablers = model;
    const h: Heuristic = (G: GameState, key?: number) => {
      if (key === undefined) return scoreState(G) + enablerPotential(G, enablers);
      const cache = G.pendingVictory ? leafCacheVictory : leafCache;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const value = scoreState(G) + enablerPotential(G, enablers);
      cache.set(key, value);
      return value;
    };
    const budget: Budget = { steps: 0, cap: opts.nodeBudget };

    // This turn's candidate lines, on the real state (world-independent for the current card set).
    const root = makeNode(state, h);
    const { win, configs } = expandTurn(root, opts.turnConfigLimit, budget, h);
    if (win) {
      buffer.push(...reconstruct(win)); // a guaranteed within-turn win, deck-independent
      return;
    }
    // A parked-interaction root yields no do-nothing config (`expandTurn` excludes it); if resolving it
    // also collected no continuation (a chooseCard whose every option ends the run), fall back to a bare
    // dismiss so the interaction still clears rather than deadlocking on `commitPrefix(undefined)`.
    if (configs.length === 0) {
      buffer.push({ kind: 'resolveInteraction', answer: 0 });
      return;
    }

    // Fixed sampled worlds (common random numbers across lines → low-variance argmax).
    const worlds: RunState[] = [];
    for (let i = 0; i < opts.determinizations; i++) {
      const d = determinize(state.G, rngState);
      rngState = d.rngState;
      worlds.push({ G: d.G, gameover: undefined });
    }

    let best = configs[0];
    let bestValue = -Infinity;
    for (const cfg of configs) {
      let sum = 0;
      for (const world of worlds) {
        // Graft the world onto the line's already-computed end state: the line only ever *peeked* the deck
        // (look-only), so its state in this world differs from `cfg.state` only in deck + rngState. Shallow
        // copy is enough — `endTurn` clones `G` before mutating, so the shared arrays stay pristine. A
        // parked interaction keeps its `options` snapshot from the pre-graft deck; harmless because a peek's
        // resolution ignores them and `commitPrefix` stops to re-plan at the real reveal.
        const line: RunState = {
          G: { ...cfg.state.G, deck: world.G.deck, rngState: world.G.rngState },
          gameover: undefined,
        };
        sum += evalLine(line, opts, budget, h);
      }
      const value = sum / worlds.length;
      if (value > bestValue) {
        bestValue = value;
        best = cfg;
      }
    }
    buffer.push(...commitPrefix(best));
  };

  const policy: Policy = (state: RunState): SimAction => {
    if (buffer.length === 0) replan(state);
    return buffer.shift() ?? { kind: 'endTurn' };
  };
  policy.seed = policySeed;
  return policy;
}
