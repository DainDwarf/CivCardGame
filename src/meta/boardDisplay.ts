import { BOARDS, ORIGIN_BOARD_ID, type BoardId } from '../content/boards';

/** The boards the player may launch on / sticker, in catalogue order: exactly the members of
 *  `PlayerStore.unlockedBoards` — the single source of truth for availability, seeded with the origin
 *  board and grown/replaced by mission rewards (`unlockBoardIds` adds; a `boardUpgrade` swaps one for
 *  another). The single filter seam the board pickers (launch popup, the Board menu) read through — the
 *  board counterpart to `rules/boardStickers.ts`'s `unlockedBoardStickerDefs`. A locked board is hidden
 *  entirely (anti-surprise unlock). If the set is ever empty (a hand-edited/corrupt-but-valid save),
 *  this falls back to the origin board — the structural never-locked-out guarantee, unbypassable
 *  because every picker routes through here. */
export function availableBoardIds(unlockedBoards: Record<string, true>): BoardId[] {
  const available = (Object.keys(BOARDS) as BoardId[]).filter((id) => unlockedBoards[id]);
  return available.length ? available : [ORIGIN_BOARD_ID];
}
