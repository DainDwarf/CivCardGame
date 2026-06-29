import type { Game } from 'boardgame.io';
import type { GameState } from '../rules';
import { applyUpkeep, drawUpTo } from '../rules';
import { MISSIONS } from '../content/missions';
import { createInitialState } from './setup';
import { playCard, assignWorker, unassignWorker } from './moves';

const DEFAULT_MISSION = 'enlightenment';

/** Phase 1: pick the mission from `?mission=` in the browser, else the default. */
function resolveMissionId(): string {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('mission');
    if (param && MISSIONS[param]) return param;
  }
  return DEFAULT_MISSION;
}

/**
 * Build a run (a boardgame.io match) for a specific mission.
 *
 * Round flow: `onBegin` advances the round and draws; the player builds, plays
 * actions, and allocates population to buildings; `onEnd` resolves upkeep (see
 * `applyUpkeep`) and discards the leftover hand. `endIf` checks the mission's win
 * first, then the universal famine loss (food < 0), then the mission's own failure.
 *
 * Parametrized by missionId so tests and the (future) headless simulator can run any
 * mission without a browser.
 */
export function createCivGame(missionId: string): Game<GameState> {
  return {
    setup: () => createInitialState(missionId),

    moves: { playCard, assignWorker, unassignWorker },

    turn: {
      onBegin: ({ G }) => {
        G.round += 1;
        drawUpTo(G);
      },
      onEnd: ({ G }) => {
        applyUpkeep(G, MISSIONS[G.missionId]?.onUpkeep);
        G.discard.push(...G.hand);
        G.hand = [];
      },
    },

    endIf: ({ G }) => {
      const mission = MISSIONS[G.missionId];
      if (!mission) return;
      if (mission.objective(G)) return { outcome: 'victory', missionId: G.missionId };
      if (G.resources.food < 0) {
        return { outcome: 'defeat', reason: 'famine', missionId: G.missionId };
      }
      if (mission.failure(G)) return { outcome: 'defeat', missionId: G.missionId };
      return;
    },
  };
}

export const CivGame: Game<GameState> = createCivGame(resolveMissionId());
