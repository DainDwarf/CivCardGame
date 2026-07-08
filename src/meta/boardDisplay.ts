import { BOARDS, type BoardDef, type BoardId } from '../content/boards';
import type { Resources } from '../rules/resources';

/** All starting boards, in catalogue order — the board pickers (launch popup, Shop's Boards
 *  section) iterate this. Boards are all-available today; unlocking is future work. */
export const BOARD_IDS = Object.keys(BOARDS) as BoardId[];

export const RESOURCE_ICON: Record<keyof Resources, string> = {
  food: '🌾',
  production: '🔨',
  science: '🔬',
  military: '⚔️',
  money: '🪙',
};

/** Presentation-only summary of a board's starting profile — all 8 starting values. Shared by the
 *  launch popup's board picker (`CampaignMap.tsx`) and the Shop's Boards section; pass an
 *  `effectiveBoard(...)` to show the sticker-adjusted profile. */
export function describeBoard(board: BoardDef): string {
  const parts = (Object.entries(board.resources) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}${RESOURCE_ICON[k]}`);
  parts.push(`${board.population}🧍`, `${board.territory} territory`);
  if (board.culture) parts.push(`${board.culture}🎭`);
  return parts.join(' · ');
}
