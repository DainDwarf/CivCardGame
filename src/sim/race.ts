import { CARDS, type ObjectiveGoal } from '../content/cards';
import {
  CORE_KEYS,
  addResources,
  applyUpkeep,
  cloneState,
  goalMet,
  isOperating,
  producingUnits,
  realizedGain,
  scaleResources,
  type CardInstance,
  type CoreResources,
  type GameState,
  type Resources,
} from '../rules';
import { effectiveGain } from '../rules/stickers';
import { DEFAULT_MAX_ROUNDS } from './simulate';

/**
 * The **race model**: a run is a race between the win and death, so a state's value is its margin —
 * `T̂loss − T̂win`, both estimated in **rounds**.
 *
 * The currency is what makes this different from a band scorer. A target enters only as
 * `need / throughput`, with both sides in raw resource units, so nothing here can be denominated per
 * *fraction of a goal* — which is what makes a mission's steering signal independent of how large a
 * number its goal happens to name. Three behaviours then fall out of the arithmetic rather than out of
 * tuned terms: a producer is worth the rounds it shaves off `T̂win` (and worth nothing once it cannot
 * repay before `T̂loss`); survival and tempo trade against each other continuously, so a survivable dip
 * that buys a faster win is takeable; and staffing registers as value because it raises τ in `T̂win`'s
 * denominator.
 *
 * A **pure read** over `G` (it clones to project), so it is safe on a candidate's resulting state.
 */

/**
 * The tuned constants, with their units. Everything else in this module is derived from `G` and the
 * catalogue — a number that is not here is arithmetic, not a knob.
 */
const RACE = {
  /** Score points — a met objective ends the run, so it dwarfs any margin the horizon can express. */
  victory: 1_000_000,
  /** Rounds: the log-sum-exp temperature of the goal fold. Tuned rather than derived because it prices
   *  a preference, not a quantity — how much a *non*-bottleneck goal still pulls. A pure `max` has zero
   *  gradient on every goal but the slowest, which lets a beam abandon a side goal for free. */
  goalSoftening: 1,
  /** Dimensionless multiplier on a losing margin, decaying with `T̂loss`. Tuned because it prices the
   *  *noise* in the two estimates rather than anything the state contains: both are projections, and a
   *  beam must not surf one round from famine on the strength of one. */
  nearDeathSteepness: 4,
  /** Rounds — the tie-break's ceiling, reached at `wealthCap` banked core resources (the two together
   *  are one constant: a weight with no cap is unbounded, and cannot then be held under a margin step).
   *  Sized so a full bank never outweighs a real difference in the race. */
  wealthRounds: 0.05,
  wealthCap: 50,
};

/** What bound `T̂loss`: the core pool that runs out first, the drive loop's round cutoff, or a defeat
 *  already pending. Naming it is the difference between "this state is 3 rounds from death" and an
 *  answer a balance question can act on. */
export type LossCause = keyof CoreResources | 'horizon' | 'defeat';

/** One goal's clock. `need` and `tau` are in the goal's own measure units; `t` is in rounds. */
export interface GoalClock {
  icon: string;
  /** Units of `measure` still to gain, counting output already in flight (`0` once satisfied). */
  need: number;
  /** Per-round movement of `measure` from the permanent economy alone. */
  tau: number;
  /** Rounds to satisfy this goal, clamped to the horizon. */
  t: number;
}

/** One state's value, split into the terms that composed it. `total` is accumulated in the same
 *  sequence as the fields, never re-summed from them, so it is bit-identical to what a policy ranks by. */
export interface RaceBreakdown {
  /** One clock per goal, in the objective card's own order. */
  goals: GoalClock[];
  /** Index into `goals` of the binding one, or `-1` with no goals. */
  bottleneck: number;
  tWin: number;
  tLoss: number;
  lossCause: LossCause;
  /** `T̂loss − T̂win` — the race margin, the value proper. */
  margin: number;
  /** The near-death steepening, ≤ 0. */
  nearDeath: number;
  /** The banked-wealth tie-break, ≥ 0. */
  wealth: number;
  /** `RACE.victory` or 0. */
  victory: number;
  total: number;
}

/** How this scorer learns the clock it is racing against. */
export interface RaceOptions {
  /** The drive loop's round cutoff (`SimOptions.maxRounds`), which is also the deepest a search may
   *  look. Every estimate here clamps to what remains of it: an unbounded horizon would make
   *  `T̂loss − T̂win` an `∞ − ∞` NaN on any state with no drain and no throughput, and a NaN comparator
   *  leaves a beam's sort order undefined. */
  maxRounds?: number;
}

/**
 * The run's **permanent** economy one round on: tableau production, trade rent, threat drains, building
 * maintenance and population food, with both transient zones dropped — the work zone (a work box
 * produces once, then recycles) and the hand (an unplayed event's drain is contingent on it staying
 * there). This is the one clone per evaluation; τ and the pool drains are both read off it.
 */
function permanentProjection(G: GameState): GameState {
  const clone = cloneState(G);
  clone.workZone = [];
  clone.hand = [];
  applyUpkeep(clone);
  return clone;
}

/**
 * What this turn's boundary will settle that the permanent projection deliberately drops: a staffed work
 * box's one-shot production, and the `upkeep` disaster of every `event` still sitting unplayed in hand.
 * One bag, because both are the same thing — a level this turn reaches once, not a rate.
 *
 * Read straight off the cards rather than through a second projection, so an evaluation stays one clone.
 * The folds mirror the resolvers exactly (a box scales per staffed worker, then the copy's stickers, then
 * the board's standing modifiers; an event's flat drain skips only the scaling), because an amount
 * arrived at differently would price the very play it is meant to judge at a number the board won't pay.
 * A card whose output is all closure reads as nothing in flight — the price of not projecting.
 */
function inFlight(G: GameState): Partial<Resources> {
  const out: Partial<Resources> = {};
  const settle = (base: Partial<Resources> | undefined, self: CardInstance) => {
    const bag = realizedGain(G, effectiveGain(base, self));
    for (const [k, v] of Object.entries(bag ?? {}) as [keyof Resources, number][]) out[k] = (out[k] ?? 0) + v;
  };
  for (const w of G.workZone) {
    const produces = CARDS[w.cardId]?.produces?.resources;
    if (produces && isOperating(w)) settle(scaleResources(produces, producingUnits(w)), w);
  }
  for (const c of G.hand) {
    const card = CARDS[c.cardId];
    if (card?.kind === 'event') settle(card.upkeep?.resources, c);
  }
  return out;
}

/** `G` with this turn's boundary settled — what every *level* read (a goal's `need`, a pool's depth)
 *  measures against, so staffing a box registers the turn it happens and a hand event's disaster is
 *  charged before it lands. A shallow copy: the zones are only read from here. Returns `G` itself when
 *  nothing is in flight. */
function bankedState(G: GameState): GameState {
  const pending = inFlight(G);
  if (Object.keys(pending).length === 0) return G;
  return { ...G, resources: addResources({ ...G.resources }, pending) };
}

/** A smooth maximum — `max` plus a term that decays exponentially as a value falls behind it, shifted so
 *  the exponentials cannot overflow at horizon-scale inputs. Exact `max` for a single value, and bounded
 *  by `max + temperature·ln n`, so folding several goals cannot inflate a rounds figure without limit. */
function softMax(values: number[], temperature: number): number {
  const max = Math.max(...values);
  let sum = 0;
  for (const v of values) sum += Math.exp((v - max) / temperature);
  return max + temperature * Math.log(sum);
}

/**
 * One goal's rounds-to-completion. `need` reads the **banked** state and τ the **permanent** one, which
 * is what counts each contribution exactly once: a tableau producer's output is throughput (τ) and a
 * staffed work box's is a level already reached (`need`).
 *
 * Read off raw `measure`/`target` rather than `goalProgress`, which caps at the target and returns 1
 * once met — either would erase the very quantity `need` is. A goal carrying a bespoke `met` is flat by
 * construction: its satisfaction isn't a threshold, so there is no `need` to divide.
 */
function goalClock(goal: ObjectiveGoal, G: GameState, banked: GameState, perm: GameState, horizon: number): GoalClock {
  const need = Math.max(0, goal.target - goal.measure(banked));
  const tau = goal.measure(perm) - goal.measure(G);
  let t: number;
  if (goalMet(goal, banked)) t = 0;
  else if (goal.met) t = horizon;
  else t = tau > 0 ? Math.min(need / tau, horizon) : horizon;
  return { icon: goal.icon, need, tau, t };
}

/** Value one state as the race margin, split into the terms that composed it. */
export function raceBreakdown(G: GameState, opts: RaceOptions = {}): RaceBreakdown {
  // The drive loop cuts a run at `round > maxRounds`, so this many end-of-round boundaries remain,
  // counting the one this state can still reach. `Infinity` is a legal cutoff there (it disables the
  // stall check) and is caught here rather than at the call sites, since it is this module's
  // `∞ − ∞` that would go NaN.
  const cutoff = opts.maxRounds;
  const bound = cutoff !== undefined && Number.isFinite(cutoff) ? cutoff : DEFAULT_MAX_ROUNDS;
  const horizon = Math.max(0, bound - G.round + 1);
  const banked = bankedState(G);
  const perm = permanentProjection(G);

  // T̂win — the bottleneck goal, softened so the others still pull. With no objective seeded there is
  // no clock to run down, which reads as the horizon: unwinnable, and flat.
  const objectiveGoals = (G.objective ? CARDS[G.objective.cardId]?.goals : undefined) ?? [];
  const goals = objectiveGoals.map((g) => goalClock(g, G, banked, perm, horizon));
  let bottleneck = -1;
  for (let i = 0; i < goals.length; i++) if (bottleneck < 0 || goals[i].t > goals[bottleneck].t) bottleneck = i;
  const tWin = goals.length > 0 ? softMax(goals.map((c) => c.t), RACE.goalSoftening) : horizon;

  // T̂loss — the soonest clock that ends the run: a core pool emptying under the permanent drain, or the
  // drive cutoff.
  let tLoss = horizon;
  let lossCause: LossCause = 'horizon';
  if (G.pendingDefeat) {
    tLoss = 0;
    lossCause = 'defeat';
  } else {
    for (const k of CORE_KEYS) {
      const level = banked.resources[k];
      const drain = G.resources[k] - perm.resources[k];
      // A pool this turn's boundary already carries below zero has collapsed whatever its rate — which
      // is the only thing that makes a *one-shot* drain (an unplayed event's disaster) visible here.
      const t = level < 0 ? 0 : drain > 0 ? level / drain : Infinity;
      if (t < tLoss) {
        tLoss = t;
        lossCause = k;
      }
    }
  }

  const margin = tLoss - tWin;
  let total = margin;

  // Both estimates are projections, and the closer death is the less a losing margin can be trusted to
  // be recoverable — so steepen the same deficit as `T̂loss` shrinks. The `1 +` is the unit round, not a
  // second knob: it is what keeps a zero-round `T̂loss` finite.
  const nearDeath = -RACE.nearDeathSteepness * Math.max(0, tWin - tLoss) / (1 + tLoss);
  total += nearDeath;

  // Among states the race cannot tell apart, prefer the deeper bank — the wealth that buys the next
  // play. Linear to its cap so it keeps discriminating over the range a bank actually spans.
  const core = CORE_KEYS.reduce((n, k) => n + Math.max(0, banked.resources[k]), 0);
  const wealth = (Math.min(core, RACE.wealthCap) / RACE.wealthCap) * RACE.wealthRounds;
  total += wealth;

  const victory = G.pendingVictory ? RACE.victory : 0;
  total += victory;

  return { goals, bottleneck, tWin, tLoss, lossCause, margin, nearDeath, wealth, victory, total };
}

/** The scalar a policy ranks by. */
export function raceScore(G: GameState, opts?: RaceOptions): number {
  return raceBreakdown(G, opts).total;
}
