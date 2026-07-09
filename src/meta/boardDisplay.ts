import { BOARDS, type BoardId } from '../content/boards';
import type { Resources } from '../rules/resources';

/** All starting boards, in catalogue order — the board pickers (launch popup, the Board menu)
 *  iterate this. Boards are all-available today; unlocking is future work. */
export const BOARD_IDS = Object.keys(BOARDS) as BoardId[];

/** Icons for the 5 core resources — shared by every board-profile display (`BoardMini`, the run
 *  board banner). */
export const RESOURCE_ICON: Record<keyof Resources, string> = {
  food: '🌾',
  production: '🔨',
  science: '🔬',
  military: '⚔️',
  money: '🪙',
};
