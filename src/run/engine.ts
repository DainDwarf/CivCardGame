import { createInitialState } from './setup';
import { applyUpkeep, coreCollapse, drawUpTo, type CollapseReason, type GameState } from '../rules';
import { MISSIONS } from '../content/missions';

export type Gameover = { outcome: 'victory' | 'defeat'; reason?: CollapseReason; missionId: string };

export interface RunState {
  G: GameState;
  gameover: Gameover | undefined;
}

function checkEndIf(state: RunState): RunState {
  const { G } = state;
  const mission = MISSIONS[G.missionId];
  if (!mission) return state;
  if (mission.objective(G)) return { ...state, gameover: { outcome: 'victory', missionId: G.missionId } };
  const collapse = coreCollapse(G.resources);
  if (collapse) return { ...state, gameover: { outcome: 'defeat', reason: collapse, missionId: G.missionId } };
  if (mission.failure(G)) return { ...state, gameover: { outcome: 'defeat', missionId: G.missionId } };
  return state;
}

function beginTurn(state: RunState): RunState {
  const G = structuredClone(state.G);
  G.round += 1;
  drawUpTo(G);
  return checkEndIf({ ...state, G });
}

export function createRun(missionId: string): RunState {
  return beginTurn({ G: createInitialState(missionId), gameover: undefined });
}

export function endTurn(state: RunState): RunState {
  if (state.gameover) return state;
  const G = structuredClone(state.G);
  applyUpkeep(G, MISSIONS[G.missionId]?.onUpkeep);
  G.discard.push(...G.hand);
  G.hand = [];
  const afterUpkeep = checkEndIf({ ...state, G });
  if (afterUpkeep.gameover) return afterUpkeep;
  return beginTurn(afterUpkeep);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyMove(state: RunState, moveFn: (G: GameState, ...args: any[]) => 'invalid' | void, ...args: unknown[]): RunState {
  if (state.gameover) return state;
  const G = structuredClone(state.G);
  if (moveFn(G, ...args) === 'invalid') return state;
  return checkEndIf({ ...state, G });
}
