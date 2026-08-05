import type { GameState } from '../rules';
import { deriveEnablers, enablerPotential, enablerTermsOf, type EnablerTerms } from './enablers';
import { deriveRace, raceScore } from './race';
import type { Heuristic } from './turnSearch';
import { scoreState } from './value';

/**
 * The **scorer seam**: which value function the competent policies rank by. One name selects it across
 * every policy at once (`greedy`/`greedy2`/`planner`/`oracle`/`prover`), so a sweep of the same cells under
 * the same policy names differs in exactly one thing — which is what makes `sim:report --against` a
 * measurement of the value function rather than of two differently-configured tools.
 *
 * A scorer is a *factory* over the run root, not a plain `(G) => number`, because both candidates derive
 * something once per run that no leaf can afford to redo — the classic one its enabler model, the race one
 * its goal plans. Deriving at the root is also what keeps them comparable: neither re-reads the moment.
 */

/** What a policy tells a scorer about the run it is scoring. Both fields are advisory: a scorer that has no
 *  use for one ignores it, which is why they live here rather than in the `Scorer` signature per candidate. */
export interface ScorerContext {
  /** The drive loop's round cutoff (`SimOptions.maxRounds`). A rounds-denominated value clamps every
   *  estimate to what remains of it; a band scorer has no horizon to clamp and ignores it. */
  maxRounds?: number;
  /** Classic only — which enabler mechanisms the shaping folds in (the planner ships a lean subset, the
   *  oracle the full model, the greedies none). Absent means no enabler model at all. */
  enablers?: boolean | EnablerTerms;
}

/** Build the leaf value a policy ranks by, from the run root. */
export type Scorer = (root: GameState, ctx?: ScorerContext) => Heuristic;

/** The incumbent: `value.ts`'s survival-first bands, optionally shaped by the enabler potential. */
export const classicScorer: Scorer = (root, ctx = {}) => {
  const terms = enablerTermsOf(ctx.enablers ?? false);
  if (!terms) return scoreState;
  const model = deriveEnablers(root, terms);
  return (G) => scoreState(G) + enablerPotential(G, model);
};

/** The challenger: `race.ts`'s margin, `T̂loss − T̂win`, denominated in rounds. */
export const raceScorer: Scorer = (root, ctx = {}) => {
  const opts = { maxRounds: ctx.maxRounds, model: deriveRace(root) };
  return (G) => raceScore(G, opts);
};

export const SCORERS: Record<string, Scorer> = {
  classic: classicScorer,
  race: raceScorer,
};

/** The scorer a sweep takes when `--scorer` names none. Like the search beam, a sweep at any other one is a
 *  **diagnostic**: its rows are not comparable to the standing set's, and `sim:record` refuses them. */
export const DEFAULT_SCORER_NAME = 'classic';

export const DEFAULT_SCORER: Scorer = SCORERS[DEFAULT_SCORER_NAME];
