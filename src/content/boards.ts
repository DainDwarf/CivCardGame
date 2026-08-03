import type { Resources } from '../rules/resources';

/** A board's catalogue id. A plain `string` (not a union) because the catalogue grows through the
 *  content pass — a fixed union would break every `boardId: BoardId` consumer as boards are added
 *  or renamed. */
export type BoardId = string;

/**
 * A government board is a run's starting configuration — the baseline a run is seeded from, chosen
 * at launch alongside the deck (see docs/DESIGN.md, "Government boards").
 */
export interface BoardDef {
  id: BoardId;
  name: string;
  /** All eight starting pools in one bundle: the five core (spendable) plus the three strategic
   *  gauges (population / territory / culture). Mirrors `GameState.resources`, so `run/setup.ts`
   *  seeds a run by copying it directly. */
  resources: Resources;
  /** Structures already standing when the run opens, by card id — how a board carries a *standing*
   *  rule instead of only an opening number, as a visible card on the table rather than an invisible
   *  board clause. Each spends a territory slot like any other structure, so a board must start with
   *  at least as much `resources.territory` as it lists (pinned by `boards.test.ts`). */
  prebuilt?: string[];
}

/** Every card id some board stands pre-built. Not a card the player can ever own, so the collection
 *  denominator excludes it (`meta/Stats.tsx`) — a card nothing unlocks would otherwise put the
 *  collectathon's `X/N` permanently out of reach. */
export function prebuiltCardIds(): Set<string> {
  return new Set(Object.values(BOARDS).flatMap((b) => b.prebuilt ?? []));
}

/** The board every fresh profile starts with, and the guaranteed fallback if the unlocked set is ever
 *  empty (`meta/boardDisplay.ts`'s `availableBoardIds`) — the one board availability can never drop
 *  below, so a player is never locked out. There is no `starting` flag: launchability is purely
 *  membership in `PlayerStore.unlockedBoards`, seeded with this id and grown/replaced by mission
 *  rewards (`unlockBoardIds`, `boardUpgrade`). */
export const ORIGIN_BOARD_ID: BoardId = 'tribe';

/**
 * The government boards a run can be launched on. `tribe` (the `ORIGIN_BOARD_ID`) is the Paleolithic
 * starting configuration matching the buildingless starting deck: a modest food store and the few
 * slots a nomadic camp works out of — and the whole Tribe/Settlement pair is the opening arc's board
 * lesson: the first *two* missions are played on Tribe, and clearing "Growing Numbers" (raising the roof)
 * *upgrades* it into `settlement` (a `boardUpgrade` reward that
 * retires Tribe for the settled version — see `rules/boardUpgrade.ts`). Other boards land through
 * `unlockBoardIds` rewards — `chiefdom`, the first military-leaning government, is unlocked by the
 * "Raiders at the Border" mission, where the arc teaches board choice (Chiefdom vs. the settled
 * government at launch). `settlement` in turn upgrades into `city` — the Bronze Age government — on
 * clearing the "Masonry" mission. All four boards' numbers are provisional and unmeasured against the
 * split cap; the territory figures in particular are the content pass's to settle. Territory now buys
 * *buildings* alone — work and trade cost none — so it is a building budget rather than a whole-board
 * one, and the numbers are back to what they were before the caps were merged. `tribe` starts with
 * none at all: the origin deck has no buildings to place, so land is something the opening arc goes
 * out and takes (Conquest or Road) rather than something it is handed.
 */
export const BOARDS: Record<BoardId, BoardDef> = {
  tribe: {
    id: 'tribe',
    name: 'Tribe',
    resources: { food: 10, production: 0, science: 0, military: 0, money: 0, population: 2, territory: 0, culture: 0 },
  },
  settlement: {
    id: 'settlement',
    name: 'Settlement',
    resources: { food: 10, production: 5, science: 0, military: 0, money: 0, population: 2, territory: 2, culture: 0 },
  },
  chiefdom: {
    id: 'chiefdom',
    name: 'Chiefdom',
    // Landless in practice like Tribe — its one slot is spoken for by the War Camp standing in it —
    // but its 6⚔️ is exactly two plays of one Conquest copy (2⚔️ doubling per play), and the War Camp
    // makes each of those pay double. The board hands you the means to take room, and a reason to
    // keep taking it, rather than the room itself.
    resources: { food: 8, production: 2, science: 0, military: 6, money: 0, population: 3, territory: 1, culture: 0 },
    prebuilt: ['war_camp'],
  },
  city: {
    id: 'city',
    name: 'City',
    resources: { food: 12, production: 10, science: 0, military: 0, money: 2, population: 2, territory: 2, culture: 0 },
  },
};
