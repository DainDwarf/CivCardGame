import { BOARDS, type BoardId } from '../content/boards';
import { BOARD_STICKERS } from '../content/boardStickers';
import { boardStickerAppliesTo, MAX_BOARD_STICKERS, type BoardStickers } from './boardStickers';

/** A board *upgrade* reward: the run board `from` is retired in favour of `to` (carried on
 *  `MissionDef.reward.boardUpgrade`). Unlike an `unlockBoardIds` grant — which only makes a board
 *  *available* — an upgrade replaces one board with another, so to the player their government reads
 *  as improved rather than a second option appearing. Applied once, on first clear, by
 *  `meta/store.ts`'s `applyRunResult`. */
export interface BoardUpgrade {
  from: BoardId;
  to: BoardId;
}

/** The board state a `boardUpgrade` rewrites — the two `PlayerStore` fields it touches. */
export interface BoardUpgradeResult {
  unlockedBoards: Record<string, true>;
  boardStickers: BoardStickers;
}

/**
 * Fold a board upgrade into the player's board state: unlock `to`, drop `from` from the unlocked set
 * (so the pickers show one board upgraded, not the old one lingering beside it — `availableBoardIds`),
 * and carry `from`'s attached stickers across to `to`. Only stickers that still apply to the new board
 * ride along (`boardStickerAppliesTo`), and the carried run is capped at `MAX_BOARD_STICKERS` (a
 * future smaller-cap target just truncates). Immutable; an unknown `to` id drops the carried stickers
 * rather than misapplying them.
 */
export function applyBoardUpgrade(
  unlockedBoards: Record<string, true>,
  boardStickers: BoardStickers,
  { from, to }: BoardUpgrade,
): BoardUpgradeResult {
  const nextUnlocked = { ...unlockedBoards, [to]: true as const };
  delete nextUnlocked[from];

  const target = BOARDS[to];
  const carried = (boardStickers[from] ?? []).filter((id) => {
    const sticker = BOARD_STICKERS[id];
    return sticker && target && boardStickerAppliesTo(sticker, target);
  });
  const nextStickers = { ...boardStickers };
  delete nextStickers[from];
  const merged = [...(nextStickers[to] ?? []), ...carried].slice(0, MAX_BOARD_STICKERS);
  if (merged.length) nextStickers[to] = merged;

  return { unlockedBoards: nextUnlocked, boardStickers: nextStickers };
}
