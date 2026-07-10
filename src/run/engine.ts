import { createInitialState } from './setup';
import { applyUpkeep, coreCollapse, drawUpTo, flushEvents, settleEndOfTurn, snapshot, type CollapseReason, type GameState } from '../rules';
import type { RunConfig, RunResult } from '../contract';

export type Gameover = { outcome: 'victory' | 'defeat'; reason?: CollapseReason | string; missionId: string };

export interface RunState {
  G: GameState;
  gameover: Gameover | undefined;
}

function checkEndIf(state: RunState): RunState {
  const { G } = state;
  // Win/lose reads bus-written flags — never re-evaluates card logic here. The objective card's win
  // is re-derived into `G.pendingVictory` at every `flushEvents` boundary (`rules/objective.ts`'s
  // `evaluateObjective`); a threat's own `defeat` predicate is re-derived into `G.pendingDefeat` the
  // same way (`rules/threats.ts`'s `evaluateDefeat`). Core-resource collapse stays a universal defeat
  // between the two. Precedence is load-bearing: victory wins over `pendingDefeat`, so a player who
  // hits the goal on the same upkeep a deadline threat fires still wins.
  if (G.pendingVictory) return { ...state, gameover: { outcome: 'victory', missionId: G.missionId } };
  const collapse = coreCollapse(G.resources);
  if (collapse) return { ...state, gameover: { outcome: 'defeat', reason: collapse, missionId: G.missionId } };
  if (G.pendingDefeat) return { ...state, gameover: { outcome: 'defeat', reason: G.pendingDefeat.reason, missionId: G.missionId } };
  return state;
}

function beginTurn(state: RunState): RunState {
  const G = structuredClone(state.G);
  const before = snapshot(G);
  G.round += 1;
  drawUpTo(G);
  // The draw batch emitted on-draw events; dispatch them (and any resourceChange) before the win/lose
  // poll, so an on-draw handler's output counts this turn.
  flushEvents(G, before);
  return checkEndIf({ ...state, G });
}

export function createRun(config: RunConfig): RunState {
  return beginTurn({ G: createInitialState(config), gameover: undefined });
}

/** Promote a finished run's state into the minimal `RunResult` handed back to the meta loop. */
export function toRunResult(G: GameState, gameover: Gameover): RunResult {
  return {
    outcome: gameover.outcome,
    missionId: gameover.missionId,
    stats: {
      turnsTaken: G.round,
      finalResources: G.resources,
      strategicResources: { population: G.population, territory: G.territory, culture: G.culture },
    },
  };
}

export function endTurn(state: RunState): RunState {
  if (state.gameover) return state;
  // A pending interaction pauses the run — the turn can't end until the player answers it, or the
  // parked (revealed) cards would be stranded and the choice would leak across the turn boundary.
  if (state.G.pendingInteraction) return state;
  const G = structuredClone(state.G);
  applyUpkeep(G);
  // Check for collapse/victory before clearing the hand so that the hand is visible for inspection.
  const afterUpkeep = checkEndIf({ ...state, G });
  if (afterUpkeep.gameover) return afterUpkeep;
  // Events left in hand auto-resolve (applying their effect) and are destroyed to the removed
  // pile; the rest of the hand recycles to discard, and the work zone files — see `settleEndOfTurn`.
  settleEndOfTurn(G);
  // An event may have tripped collapse (a resource going negative) or the objective (e.g. its
  // win threshold crossed), so re-check before the next turn begins.
  const afterEvents = checkEndIf({ ...afterUpkeep, G });
  if (afterEvents.gameover) return afterEvents;
  return beginTurn(afterEvents);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyMove(state: RunState, moveFn: (G: GameState, ...args: any[]) => 'invalid' | void, ...args: unknown[]): RunState {
  if (state.gameover) return state;
  const G = structuredClone(state.G);
  const before = snapshot(G);
  if (moveFn(G, ...args) === 'invalid') return state;
  // The move emitted its events (a sacrifice discard, an `effect.draw`); dispatch them plus the
  // move's net resourceChange at this boundary, so a mid-turn threshold fires the same action.
  flushEvents(G, before);
  return checkEndIf({ ...state, G });
}
