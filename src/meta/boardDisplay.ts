import { BOARDS, type BoardId } from '../content/boards';

/** The boards the player may launch on / sticker, in catalogue order: every *starting* board (always
 *  available) plus any unlocked via a mission reward (`PlayerStore.unlockedBoards`, fed by
 *  `unlockBoardIds`). The single filter seam the board pickers (launch popup, the Board menu) read
 *  through — the board counterpart to `rules/boardStickers.ts`'s `unlockedBoardStickerDefs`. A locked
 *  board is hidden entirely (anti-surprise unlock). Baseline is the `starting` flag, never the mutable
 *  set, so an empty/edited unlock set can't lock a player out of playing. */
export function availableBoardIds(unlockedBoards: Record<string, true>): BoardId[] {
  return (Object.keys(BOARDS) as BoardId[]).filter((id) => BOARDS[id].starting || unlockedBoards[id]);
}
