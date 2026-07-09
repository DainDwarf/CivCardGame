import { CARDS, isDeckable } from '../content/cards';
import { STICKERS } from '../content/stickers';
import { BOARD_STICKERS } from '../content/boardStickers';
import { BOARDS, type BoardId } from '../content/boards';
import { isOwned, stickerableInstancesOf, type OwnedCards } from './collection';
import { canBuyTier } from './shop';
import { stickerAppliesTo } from './stickers';
import { canAttachBoardSticker, type BoardStickers } from './boardStickers';

/**
 * Available-upgrade hints (docs/DESIGN.md → *Economy & progression*; TODO *Meta loop*). The one place
 * that answers "can Influence still be usefully spent here, *right now*?" for the meta UI's at-a-glance
 * hints — Collection card tiles, Board tiles, and the Collection/Board nav-tab badges. A hint is the
 * **strict** reading: on ⟺ at least one real purchase would succeed this instant (affordable · applicable
 * · under the caps), so a hint can never disagree with what a drag-drop drop actually accepts. Each
 * roll-up composes its domain's *authoritative* buy-reject leaf (`shop.ts`'s `canBuyTier`,
 * `boardStickers.ts`'s `canAttachBoardSticker`) rather than re-deriving affordability — the invariant
 * the tests pin against the real `buy*` functions. Cards and boards take different inputs, so this is
 * two per-domain roll-ups, not one contorted predicate.
 */

/** Whether `cardId` has an affordable upgrade available: a buyable copy tier, *or* a copy with room for
 *  a sticker that applies to this card and is affordable. Unlike `CardInstancePanel`'s per-instance
 *  drop check (whose tray pre-filters by applies), this rolls over *all* stickers, so it re-includes
 *  `stickerAppliesTo` to mirror `buySticker` — currently vacuous, but the seam a conditional sticker
 *  would need. The room-vs-applies-vs-afford product factorizes because room is per-instance and
 *  `applies ∧ afford` is per-sticker. */
export function cardUpgradeAvailable(collection: OwnedCards, influence: number, cardId: string): boolean {
  if (canBuyTier(collection, influence, cardId)) return true;
  const card = CARDS[cardId];
  return (
    stickerableInstancesOf(collection, cardId).length > 0 &&
    Object.values(STICKERS).some((s) => stickerAppliesTo(s, card) && influence >= s.cost)
  );
}

/** Whether `boardId` can still take an affordable board sticker (applies · under cap · affordable). */
export function boardUpgradeAvailable(boardStickers: BoardStickers, influence: number, boardId: BoardId): boolean {
  return Object.values(BOARD_STICKERS).some((s) => canAttachBoardSticker(boardStickers, influence, boardId, s));
}

/** Nav roll-up: does *any* owned card have an affordable upgrade? Drives the Collection nav badge. */
export function anyCardUpgradeAvailable(collection: OwnedCards, influence: number): boolean {
  return Object.values(CARDS).some(
    (c) => isDeckable(c) && isOwned(collection, c.id) && cardUpgradeAvailable(collection, influence, c.id),
  );
}

/** Nav roll-up: does *any* board have an affordable board-sticker upgrade? Drives the Board nav badge. */
export function anyBoardUpgradeAvailable(boardStickers: BoardStickers, influence: number): boolean {
  return (Object.keys(BOARDS) as BoardId[]).some((id) => boardUpgradeAvailable(boardStickers, influence, id));
}
