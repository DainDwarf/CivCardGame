import { blankState, instancesFromDeckCards, seededRng, seedObjective, type GameState } from '../rules';
import { effectiveBoard } from '../rules/boardStickers';
import { MISSIONS } from '../content/missions';
import { BOARDS } from '../content/boards';
import type { RunConfig } from '../contract';

/**
 * Build the initial run state from an assembled `RunConfig`. The board (with its snapshotted
 * stickers folded in via `effectiveBoard`) sets the baseline (all 8 starting resources); the
 * mission's `setup` then layers its own modifiers on top (see docs/DESIGN.md, "Government boards").
 */
export function createInitialState(config: RunConfig): GameState {
  const board = effectiveBoard(BOARDS[config.board], config.boardStickers);
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
  // Seed the mission's win/lose condition as a card (`GameState.objective`) before its `setup`, so
  // any cards `setup` mints continue past the objective's instance id. The mission owns *which* card;
  // the card owns the win/lose logic (`rules/objective.ts`).
  const objectiveCardId = MISSIONS[config.missionId]?.objectiveCardId;
  if (objectiveCardId) seedObjective(G, objectiveCardId);
  MISSIONS[config.missionId]?.setup?.(G);
  return G;
}
