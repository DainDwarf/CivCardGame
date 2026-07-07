import { blankState, instancesFromDeckCards, seededRng, type GameState } from '../rules';
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
  // The shuffled `RunConfig.deck` carries each card's cardId and any permanent sticker; mint each
  // into an identity-bearing instance (ids 1..N), stickers riding along, so per-copy state (and a
  // sticker's bonus) can ride with it. Any later mint (a mission's injected cards, a card played)
  // continues past these ids via `nextInstanceId`.
  G.deck = instancesFromDeckCards(config.deck);
  G.rngState = seededRng(config.seed).getState();
  MISSIONS[config.missionId]?.setup?.(G);
  return G;
}
