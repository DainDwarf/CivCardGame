import type { Resources } from '../rules/resources';

/** A board's catalogue id. A plain `string` (not a union) because the catalogue is emptied for the
 *  Phase 4 content pass — a fixed union couldn't key an empty `BOARDS` and would break every
 *  `boardId: BoardId` consumer; Step 3 authors the real boards under whatever ids it picks. */
export type BoardId = string;

/**
 * A government board is a run's starting configuration — the baseline the mission's
 * `setup` then layers modifiers on top of (see docs/DESIGN.md, "Government boards").
 * It sets all 8 starting resources: the 5 core (spendable) plus the 3 strategic gauges
 * (population / territory / culture).
 */
export interface BoardDef {
  id: BoardId;
  name: string;
  description: string;
  resources: Resources;
  population: number;
  territory: number;
  culture: number;
}

// Reset to empty for the Phase 4 content pass (docs/TODO.md Step 2.6) — the catalogue and its types
// are kept so the app keeps typechecking; the game is knowingly non-launchable (a `RunConfig` needs a
// board) until Step 3 authors at least one real board here.
export const BOARDS: Record<BoardId, BoardDef> = {};
