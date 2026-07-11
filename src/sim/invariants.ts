import type { GameState } from '../rules';
import { freePopulation, workerCapOf } from '../rules';

/** Enough of the run's identity to reproduce a violation: the config (deck/board/mission) seed and
 *  the move-policy seed together replay a headless run exactly, and `round`/`actionsApplied` locate
 *  the step it broke on. All optional so a bare invariant check (e.g. a unit test) can pass `{}`. */
export interface InvariantContext {
  configSeed?: string;
  policySeed?: string;
  round?: number;
  actionsApplied?: number;
}

/**
 * Assert the structural invariants a committed `GameState` must always satisfy — the teeth that make
 * the headless simulator a *fuzzer* rather than a mere runner (`sim/simulate.ts` calls this after
 * every applied action). Throws with the full reproduction key on any violation.
 *
 * Deliberately does **not** assert resource non-negativity: a core-resource collapse (famine/ruin)
 * leaves `G` holding a negative pool in the committed *gameover* state — `run/engine.ts`'s
 * `checkEndIf` sets `gameover` without healing `G` — so a `resources >= 0` check would false-positive
 * on every legitimate collapse ending. Collapse is a normal outcome, not a broken invariant.
 */
export function assertRunInvariants(G: GameState, ctx: InvariantContext = {}): void {
  const fail = (msg: string): never => {
    throw new Error(
      `Run invariant violated: ${msg} ` +
        `[configSeed=${ctx.configSeed ?? '?'} policySeed=${ctx.policySeed ?? '?'} ` +
        `round=${ctx.round ?? G.round} action=${ctx.actionsApplied ?? '?'}]`,
    );
  };

  // The event bus is always drained to [] in any committed/undo-visible state (see `rules/state.ts`).
  if (G.events.length !== 0) fail(`event bus not drained (${G.events.length} pending)`);

  // Instance ids are unique across *every* zone (see `rules/state.ts`).
  const seen = new Set<number>();
  const zones = [G.hand, G.deck, G.discard, G.removed, G.tableau, G.workZone, G.threats];
  for (const zone of zones) {
    for (const inst of zone) {
      if (seen.has(inst.id)) fail(`duplicate instance id ${inst.id}`);
      seen.add(inst.id);
    }
  }
  if (G.objective) {
    if (seen.has(G.objective.id)) fail(`duplicate instance id ${G.objective.id} (objective)`);
    seen.add(G.objective.id);
  }

  // Staffing stays within bounds: no negative workers, none over its requirement, no over-subscribed
  // population pool.
  for (const s of [...G.tableau, ...G.workZone]) {
    const cap = workerCapOf(s);
    if (s.workers < 0 || s.workers > cap) fail(`instance ${s.id} has ${s.workers} workers (cap ${cap})`);
  }
  if (freePopulation(G) < 0) fail(`negative free population (${freePopulation(G)})`);
}
