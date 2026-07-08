import { createInitialState } from './setup';
import { applyUpkeep, coreCollapse, discardWorkZone, drawUpTo, emitEvent, flushEvents, objectiveFailed, objectiveMet, resolveHandEvents, snapshot, type CollapseReason, type GameState } from '../rules';
import { MISSIONS } from '../content/missions';
import type { RunConfig, RunResult } from '../contract';

export type Gameover = { outcome: 'victory' | 'defeat'; reason?: CollapseReason | string; missionId: string };

export interface RunState {
  G: GameState;
  gameover: Gameover | undefined;
}

function checkEndIf(state: RunState): RunState {
  const { G } = state;
  // Win/lose is owned by the mission's objective *card* (`G.objective`), polled here through
  // `rules/objective.ts`. Core-resource collapse stays a universal defeat between the two.
  if (objectiveMet(G)) return { ...state, gameover: { outcome: 'victory', missionId: G.missionId } };
  const collapse = coreCollapse(G.resources);
  if (collapse) return { ...state, gameover: { outcome: 'defeat', reason: collapse, missionId: G.missionId } };
  // A card's `on` handler may declare defeat itself (with its own reason) via `G.pendingDefeat` — the
  // bus capability that lets a threat *own* its loss rather than draining a resource into collapse.
  if (G.pendingDefeat) return { ...state, gameover: { outcome: 'defeat', reason: G.pendingDefeat.reason, missionId: G.missionId } };
  if (objectiveFailed(G)) return { ...state, gameover: { outcome: 'defeat', missionId: G.missionId } };
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
  applyUpkeep(G, MISSIONS[G.missionId]?.onUpkeep);
  // Check for collapse/victory before clearing the hand so that the hand is visible for inspection.
  const afterUpkeep = checkEndIf({ ...state, G });
  if (afterUpkeep.gameover) return afterUpkeep;
  // Events left in hand auto-resolve (applying their effect) and are destroyed to the removed
  // pile; the rest of the hand recycles to discard.
  const beforeEvents = snapshot(G);
  resolveHandEvents(G);
  // The recycled hand files as end-of-turn discards — a distinct reason from a sacrifice, so an
  // `on.discard` handler can ignore the routine recycle.
  for (const c of G.hand) emitEvent(G, { type: 'discard', instanceId: c.id, cardId: c.cardId, reason: 'endOfTurn' });
  G.discard.push(...G.hand);
  G.hand = [];
  // Work cards played this turn have now had their staffed production collected by upkeep; file
  // them to the discard and clear the board's work zone for the next turn.
  discardWorkZone(G);
  // Dispatch everything the hand-events / recycle / work-filing emitted before the next turn begins.
  flushEvents(G, beforeEvents);
  // An event may have tripped collapse (a resource going negative) or the objective (e.g. the
  // last barbarian beaten), so re-check before the next turn begins.
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
