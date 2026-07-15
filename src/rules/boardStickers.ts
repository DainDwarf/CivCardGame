import { BOARD_STICKERS, type BoardStickerDef } from '../content/boardStickers';
import { BOARDS, type BoardDef, type BoardId } from '../content/boards';

/** The player's attached board stickers, keyed by board — one array of sticker ids per board
 *  (duplicates allowed: a stacked sticker appears twice). A board with none may be absent, so this
 *  is a partial map (read with `?? []`). Lives on `PlayerStore` and is snapshotted into
 *  `RunConfig.boardStickers` at launch (see `contract.ts`). */
export type BoardStickers = Partial<Record<BoardId, string[]>>;

/** Provisional cap on stickers per board — mirrors the card sticker cap. DESIGN.md defers whether
 *  several stack on one board as a balance detail; this is the shippable value. */
export const MAX_BOARD_STICKERS = 2;

export function isBoardStickerFull(stickerIds: string[]): boolean {
  return stickerIds.length >= MAX_BOARD_STICKERS;
}

/** Whether `sticker` may attach to `board` — the one eligibility dispatcher every site routes
 *  through (Shop listing/offer, `buyBoardSticker`'s reject). A sticker owns its own condition via
 *  its `appliesTo` predicate (`content/boardStickers.ts`); absent = attaches to any board. Mirrors
 *  `rules/stickers.ts`'s `stickerAppliesTo`. */
export function boardStickerAppliesTo(sticker: BoardStickerDef, board: BoardDef): boolean {
  return sticker.appliesTo?.(board) ?? true;
}

/** The board stickers a player has *unlocked* (via mission rewards — `PlayerStore.unlockedBoardStickers`).
 *  The board-tray counterpart to `rules/stickers.ts`'s `unlockedStickerDefs`: the single filter seam
 *  every *enumeration* site reads through (the Board tray, the `boardUpgradeAvailable` hint), so a
 *  locked board sticker is hidden entirely. An *already-attached* board sticker never routes through
 *  this (it was necessarily unlocked when bought). */
export function unlockedBoardStickerDefs(unlockedBoardStickers: Record<string, true>): BoardStickerDef[] {
  return Object.values(BOARD_STICKERS).filter((s) => unlockedBoardStickers[s.id]);
}

/**
 * A board's *effective* starting profile after its attached stickers — a **fold** applying each
 * attached sticker's `applyToBoard` in order, so stacking (two of the same) and composing (two
 * different) fall out for free. The display + setup counterpart to `rules/stickers.ts`'s
 * `effectiveCard`: `run/setup.ts` seeds the run off this, and the Shop / launch-popup board pickers
 * show it, so the player sees exactly what they'll start with. Returns `board` unchanged (same
 * object) when the list is empty; an unknown sticker id is skipped (`?? board`).
 */
export function effectiveBoard(board: BoardDef, stickerIds: string[] | undefined): BoardDef {
  if (!stickerIds?.length) return board;
  let out = board;
  for (const id of stickerIds) out = BOARD_STICKERS[id]?.applyToBoard(out) ?? out;
  return out;
}

/** Whether `sticker` can attach to `boardId` *right now* — applies · under the cap · affordable.
 *  The single leaf every site routes through: `BoardMenu.tsx`'s drag `isValidTarget` (highlight +
 *  drop), and the upgrade-hint roll-up (`rules/upgrades.ts`). Mirrors `buyBoardSticker`'s reject. */
export function canAttachBoardSticker(
  boardStickers: BoardStickers,
  influence: number,
  boardId: BoardId,
  sticker: BoardStickerDef,
): boolean {
  return (
    boardStickerAppliesTo(sticker, BOARDS[boardId]) &&
    !isBoardStickerFull(boardStickers[boardId] ?? []) &&
    influence >= sticker.cost
  );
}

/** Result of a board-sticker purchase — the updated Influence + board-sticker map. Mirrors
 *  `rules/shop.ts`'s `buyTier` / `rules/stickers.ts`'s `buySticker`. */
export interface BoardStickerPurchase {
  influence: number;
  boardStickers: BoardStickers;
}

/**
 * Attempt to attach `stickerId` to `boardId`. Returns `null` (mirroring `buyTier`/`buySticker`) when
 * the sticker doesn't exist, the sticker isn't unlocked (`unlockedBoardStickers`, the reward gate the
 * tray only mirrors), the sticker doesn't apply to the board (`boardStickerAppliesTo`, the
 * authoritative guard the Shop UI only mirrors), the board is already full (`MAX_BOARD_STICKERS`), or
 * the player can't afford it. The *same* sticker id can be attached twice by design — the fold in
 * `effectiveBoard` applies it once per attached copy. Appends (never replaces); immutable.
 */
export function buyBoardSticker(
  boardStickers: BoardStickers,
  influence: number,
  boardId: BoardId,
  stickerId: string,
  unlockedBoardStickers: Record<string, true>,
): BoardStickerPurchase | null {
  const sticker = BOARD_STICKERS[stickerId];
  const board = BOARDS[boardId];
  if (!sticker || !unlockedBoardStickers[stickerId] || !board || influence < sticker.cost) return null;
  const current = boardStickers[boardId] ?? [];
  if (isBoardStickerFull(current) || !boardStickerAppliesTo(sticker, board)) return null;
  return {
    influence: influence - sticker.cost,
    boardStickers: { ...boardStickers, [boardId]: [...current, stickerId] },
  };
}

/**
 * Detach the sticker at `index` from `boardId`, destroying it. Returns `null` (the family's reject
 * idiom) when the board has no stickers or `index` is out of range. Immutable; the board's key is
 * *deleted* rather than left as `[]` when its last sticker goes, per this map's absent-means-none
 * contract.
 *
 * Removal is **positional**: a board legitimately holds the same sticker id twice (`buyBoardSticker`
 * appends, and `effectiveBoard` applies it once per copy), so removing by id would destroy both
 * copies of a stack.
 *
 * Returning a bare `BoardStickers` rather than a `BoardStickerPurchase` is the point, not an
 * oversight: **removal refunds nothing**, so there is no Influence for a caller to write back.
 * Attaching a sticker is meant to be a decision with weight; re-applying one costs full price.
 */
export function removeBoardSticker(
  boardStickers: BoardStickers,
  boardId: BoardId,
  index: number,
): BoardStickers | null {
  const current = boardStickers[boardId];
  if (!current || index < 0 || index >= current.length) return null;
  const next = { ...boardStickers };
  const remaining = current.filter((_, i) => i !== index);
  if (remaining.length) next[boardId] = remaining;
  else delete next[boardId];
  return next;
}
