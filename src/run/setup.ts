import { blankState, seededRng, type GameState } from '../rules';
import { MISSIONS } from '../content/missions';
import { BOARDS } from '../content/boards';
import type { RunConfig } from '../contract';

/**
 * Build the initial run state from an assembled `RunConfig`. The board sets the
 * baseline (all 8 starting resources); the mission's `setup` then layers its own
 * modifiers on top (see docs/DESIGN.md, "Government boards").
 */
export function createInitialState(config: RunConfig): GameState {
  const board = BOARDS[config.board];
  const G = blankState(config.missionId);
  G.resources = { ...board.resources };
  G.population = board.population;
  G.territory = board.territory;
  G.culture = board.culture;
  G.deck = [...config.deck];
  G.rngState = seededRng(config.seed).getState();
  MISSIONS[config.missionId]?.setup?.(G);
  return G;
}
