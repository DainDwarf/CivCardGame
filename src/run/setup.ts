import { blankState, type GameState } from '../rules';
import { MISSIONS } from '../content/missions';
import { DEFAULT_DECK } from '../content/decks';

/** Build the initial run state for a mission. Wired into the Game as `setup`. */
export function createInitialState(missionId: string): GameState {
  const G = blankState(missionId);
  G.resources = { food: 5, production: 5, science: 0 };
  G.population = 2;
  G.deck = [...DEFAULT_DECK];
  MISSIONS[missionId]?.setup?.(G);
  return G;
}
