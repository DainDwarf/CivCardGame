import { cultureLevel, isOperating, projectedDelta, usedTerritory, type GameState } from '../rules';
import { objectiveProgress } from './objective';

/**
 * Heuristic **weights** for `scoreState` below. These are a deliberately-first-pass, throwaway set —
 * the simulator is the tool that *tunes* them, and they'll be re-fit once real content (buildings,
 * territory, culture goals) lands in the age arcs (see `docs/TODO.md` Step 4 / Steps 5–8). What matters
 * now is the *shape*: survival dominates capability, because famine (food driven below 0 → core collapse)
 * is the way a run is lost. So a projected-negative food next round is punished far harder than any
 * resource/economy gain is rewarded.
 */
const W = {
  /** Diminishing returns on hoarded food past a safe buffer — extra food beyond this is nearly free. */
  foodBufferCap: 10,
  /** Penalty per unit of *projected-negative* food next round — the imminent-starvation cliff. */
  starvationPenalty: 20,
  production: 1,
  science: 1,
  military: 0.8,
  money: 0.8,
  /** A worker is capability (more staffing capacity) but also eats — its food cost is already priced
   *  into the projected-food term, so this is the net upside. */
  population: 3,
  /** A staffed, operating building / work box earning its keep. */
  operating: 2,
  territory: 1.5,
  cultureLevel: 6,
  /**
   * Pull toward the *mission's* objective — a mission-agnostic steering term. `objectiveProgress`
   * (`rules/objective.ts`) is the objective card's own `[0, 1]` gradient (`1` = won), so this rewards a
   * state that is *closer* to whatever this mission's goal is without the scorer knowing the target —
   * the difference between a survival-first drifter and a policy that voluntarily stockpiles toward the
   * win. Deliberately **capability-tier, not victory-tier**: it must stay well *under* the starvation
   * cliff (`starvationPenalty` × a projected deficit runs into the tens-to-hundreds negative) so the
   * greedy never walks into famine chasing progress — survival still dominates. A *met* objective is a
   * different thing: `pendingVictory` below adds the overwhelming `victory` bonus, because a won run is
   * *over*. Sized so holding a unit of a goal resource out-scores spending it on an off-goal card, but a
   * single non-winning step's progress swing stays smaller than one unit of projected famine.
   */
  objectiveProgress: 50,
  /** Dwarf everything: if a reachable state already meets the objective, it must outrank all others. */
  victory: 1_000_000,
};

/**
 * Score a run state — higher is better — for the greedy policy's one-ply argmax (`sim/greedyPolicy.ts`)
 * and as the ranking backbone the heuristic borrows. A **pure read** over `G` (via `projectedDelta`,
 * which clones; it never mutates `G`), so it's safe to call on a candidate's resulting state and
 * unit-testable in isolation.
 *
 * Survival first: the food term reads *projected* next-round food (`projectedDelta` already nets out
 * population upkeep and any in-hand events), rewarding a positive buffer up to a cap and punishing a
 * projected deficit steeply — so the greedy keeps food boxes staffed and won't over-grow population it
 * can't feed. Then two layers of capability: the generic economy terms (accumulated core resources ·
 * population · operating economy · territory · culture level — what the sandbox measures a run by even
 * though it never *wins*), plus a **mission-directed** pull toward whatever this mission's objective
 * wants (`sim/objective.ts`'s `objectiveProgress`, a `[0, 1]` gradient), so the greedy voluntarily
 * stockpiles toward the goal instead of drifting at a survival equilibrium. That pull is deliberately
 * capability-tier, kept under the starvation cliff so it never lures the greedy into famine. A met
 * objective (`pendingVictory`) then adds an overwhelming bonus so any winning line is taken outright.
 */
export function scoreState(G: GameState): number {
  const r = G.resources;
  const projFood = r.food + projectedDelta(G).resources.food;

  let s = 0;
  s += projFood >= 0 ? Math.min(projFood, W.foodBufferCap) : projFood * W.starvationPenalty;
  s += r.production * W.production + r.science * W.science + r.military * W.military + r.money * W.money;
  s += G.population * W.population;
  s += [...G.tableau, ...G.workZone].filter(isOperating).length * W.operating;
  s += usedTerritory(G.tableau) * W.territory;
  s += cultureLevel(G.culture) * W.cultureLevel;
  s += objectiveProgress(G) * W.objectiveProgress;
  if (G.pendingVictory) s += W.victory;
  return s;
}
