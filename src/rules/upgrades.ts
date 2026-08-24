import { CARDS, isDeckable } from '../content/cards';
import { BOARDS, type BoardId } from '../content/boards';
import type { StickerDef } from '../content/stickers';
import { isOwned, stickerableInstancesOf, type OwnedCards } from './collection';
import { canBuyTier } from './shop';
import { stickerAppliesTo, unlockedStickerDefs } from './stickers';
import { canAttachBoardSticker, unlockedBoardStickerDefs, type BoardStickers } from './boardStickers';

/**
 * Available-upgrade hints (docs/DESIGN.md → *Economy & progression*). The one place that answers "can
 * Influence still be usefully spent here, *right now*?" for the meta UI's at-a-glance hints — the
 * Collection tile's two markers (a buyable copy tier · a stickerable copy), Board tiles, and the
 * Collection/Board nav-tab badges. A hint is the **strict** reading: on ⟺ at least one real purchase
 * would succeed this instant (affordable · applicable · under the caps), so a hint can never disagree
 * with what a drag-drop drop actually accepts. Each roll-up composes its domain's *authoritative*
 * buy-reject leaf (`shop.ts`'s `canBuyTier`, `boardStickers.ts`'s `canAttachBoardSticker`) rather than
 * re-deriving affordability — the invariant the tests pin against the real `buy*` functions. Cards and
 * boards take different inputs, so this is two per-domain roll-ups, not one contorted predicate.
 *
 * The card side is split per *cause*, because the Collection draws the two independently and its
 * sticker tray asks the question one sticker at a time (a filtered grid answers for the selected
 * sticker, not for any). `canBuyTier` is the copy half whole, so it has no wrapper here.
 */

/** Whether `sticker` could be bought onto some copy of `cardId` right now — the conjunction
 *  `buySticker` rejects on, minus the unlock gate its callers apply by enumerating through
 *  `unlockedStickerDefs`. Unlike `CardInstancePanel`'s per-instance drop check (whose tray pre-filters
 *  by applies), a caller here may hand over any sticker, so this re-includes `stickerAppliesTo`. The
 *  room-vs-applies-vs-afford product factorizes because room is per-instance and `applies ∧ afford` is
 *  per-sticker. */
export function stickerUpgradeAvailableFor(
  collection: OwnedCards,
  influence: number,
  cardId: string,
  sticker: StickerDef,
): boolean {
  return (
    stickerableInstancesOf(collection, cardId).length > 0 &&
    stickerAppliesTo(sticker, CARDS[cardId]) &&
    influence >= sticker.cost
  );
}

/** Whether *some* unlocked sticker could be bought onto a copy of `cardId` right now. Enumerates only
 *  unlocked stickers, so a locked one never lights the hint. */
export function stickerUpgradeAvailable(
  collection: OwnedCards,
  influence: number,
  cardId: string,
  unlockedStickers: Record<string, true>,
): boolean {
  return unlockedStickerDefs(unlockedStickers).some((s) =>
    stickerUpgradeAvailableFor(collection, influence, cardId, s),
  );
}

/** Whether `cardId` has an affordable upgrade available at all — either half. Drives the nav badge,
 *  which has one dot for both causes. */
export function cardUpgradeAvailable(
  collection: OwnedCards,
  influence: number,
  cardId: string,
  unlockedStickers: Record<string, true>,
): boolean {
  return (
    canBuyTier(collection, influence, cardId) ||
    stickerUpgradeAvailable(collection, influence, cardId, unlockedStickers)
  );
}

/** Whether `boardId` can still take an affordable board sticker (unlocked · applies · under cap ·
 *  affordable). Enumerates only *unlocked* stickers, so a locked one never lights the hint. */
export function boardUpgradeAvailable(
  boardStickers: BoardStickers,
  influence: number,
  boardId: BoardId,
  unlockedBoardStickers: Record<string, true>,
): boolean {
  return unlockedBoardStickerDefs(unlockedBoardStickers).some((s) =>
    canAttachBoardSticker(boardStickers, influence, boardId, s),
  );
}

/** Nav roll-up: does *any* owned card have an affordable upgrade? Drives the Collection nav badge. */
export function anyCardUpgradeAvailable(
  collection: OwnedCards,
  influence: number,
  unlockedStickers: Record<string, true>,
): boolean {
  return Object.values(CARDS).some(
    (c) => isDeckable(c) && isOwned(collection, c.id) && cardUpgradeAvailable(collection, influence, c.id, unlockedStickers),
  );
}

/** Nav roll-up: does *any* board have an affordable board-sticker upgrade? Drives the Board nav badge. */
export function anyBoardUpgradeAvailable(
  boardStickers: BoardStickers,
  influence: number,
  unlockedBoardStickers: Record<string, true>,
): boolean {
  return (Object.keys(BOARDS) as BoardId[]).some((id) =>
    boardUpgradeAvailable(boardStickers, influence, id, unlockedBoardStickers),
  );
}
