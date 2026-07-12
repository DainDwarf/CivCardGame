import { blankState, instancesFromDeckCards, seededRng, seedObjective, type GameState } from '../rules';
import { effectiveBoard } from '../rules/boardStickers';
import { MISSIONS, seedMissionCards } from '../content/missions';
import { BOARDS } from '../content/boards';
import type { RunConfig } from '../contract';

/**
 * Build the initial run state from an assembled `RunConfig`. The board (with its snapshotted
 * stickers folded in via `effectiveBoard`) sets the baseline (all 8 starting resources); the
 * mission's declarative `threats`/`events` are then seeded on top (see docs/DESIGN.md,
 * "Government boards").
 */
export function createInitialState(config: RunConfig): GameState {
  const board = effectiveBoard(BOARDS[config.board], config.boardStickers);
  const G = blankState(config.missionId);
  G.resources = { ...board.resources };
  // The shuffled `RunConfig.deck` carries each card's cardId and any permanent sticker; mint each
  // into an identity-bearing instance (ids 1..N), stickers riding along, so per-copy state (and a
  // sticker's bonus) can ride with it. Any later mint (a mission's injected cards, a card played)
  // continues past these ids via `nextInstanceId`.
  G.deck = instancesFromDeckCards(config.deck);
  G.rngState = seededRng(config.seed).getState();
  const mission = MISSIONS[config.missionId];
  // Seed the mission's win/lose condition as a card (`GameState.objective`) before its threats/
  // events, so any cards those mint continue past the objective's instance id. The mission owns
  // *which* card; the card owns the win/lose logic (`rules/objective.ts`).
  if (mission) {
    seedObjective(G, mission.objectiveCardId);
    seedMissionCards(mission, G);
  }
  return G;
}
