import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { STICKERS } from '../content/stickers';
import { BOARDS, type BoardId } from '../content/boards';
import { BOARD_STICKERS } from '../content/boardStickers';
import { CardFace } from '../components/CardFace';
import { copiesOwned, stickerableInstancesOf, type OwnedCards } from '../rules/collection';
import { nextTier } from '../rules/shop';
import { stickerAppliesTo } from '../rules/stickers';
import { boardStickerAppliesTo, effectiveBoard, isBoardStickerFull, type BoardStickers } from '../rules/boardStickers';
import { BOARD_IDS, describeBoard } from './boardDisplay';
import { CardInstancePanel } from './CardInstancePanel';
import type { CardDef } from '../content/cards';
import styles from './Shop.module.css';

/**
 * The Shop screen: spend Influence (⭐) to deepen cards you already own — copy-tier upgrades
 * (×1 → ×2 → ×4 → ×8, `rules/shop.ts`) and permanent card stickers (`content/stickers.ts`) attached
 * to one chosen owned instance, up to `MAX_STICKERS` (2) per instance. The shop sells *depth* only —
 * new cards come from mission unlocks, never here (docs/DESIGN.md, "Economy & progression"). A card
 * is listed if it has *either* a tier left to buy or an owned instance with room for another sticker
 * (`stickerableInstancesOf`) — a card already at ×8 with every copy fully stickered finally drops off
 * the list. Tier-buying stays one click (a purchase only ever adds copies); attaching a sticker needs
 * a target instance, so it opens `CardInstancePanel` in its `attach` mode — the same per-copy picker
 * reused rather than inventing a second one.
 */
export function Shop({
  collection,
  decks,
  influence,
  boardStickers,
  onBuyTier,
  onAttachSticker,
  onBuyBoardSticker,
}: {
  collection: OwnedCards;
  /** Forwarded to the sticker-attach picker so it can show each candidate instance's deck
   *  usage, same as `Collection.tsx`'s browsing view. */
  decks: DeckDef[];
  influence: number;
  /** Board stickers attached per board — the Boards section shows each board's effective profile
   *  and hides a sticker already at the per-board cap. */
  boardStickers: BoardStickers;
  onBuyTier: (cardId: string) => void;
  /** Attach a sticker to one chosen owned instance — spends Influence and
   *  mutates that instance in the store (`App.tsx`'s `attachSticker`). */
  onAttachSticker: (instanceId: string, stickerId: string) => void;
  /** Attach a board sticker to a board — spends Influence and mutates the store's
   *  `boardStickers` (`App.tsx`'s `buyBoardStickerAt`). A board is singular, so this attaches
   *  directly (one click), no per-instance picker. */
  onBuyBoardSticker: (boardId: BoardId, stickerId: string) => void;
}) {
  const [picking, setPicking] = useState<{ cardId: string; stickerId: string } | null>(null);

  // Event and threat cards are mission-injected and never part of the player's collection; a
  // card is shown if it's owned *and* has something left to buy — a tier upgrade, or a sticker
  // slot (an owned instance with room) *and* at least one sticker that actually applies to it
  // (`stickerAppliesTo` — e.g. Irrigation only lists on food buildings).
  const cards = Object.values(CARDS).filter((c) => {
    if (c.kind === 'event' || c.kind === 'threat') return false;
    const owned = copiesOwned(collection, c.id);
    if (owned === 0) return false;
    const hasStickerSlot =
      stickerableInstancesOf(collection, c.id).length > 0 &&
      Object.values(STICKERS).some((s) => stickerAppliesTo(s, c));
    return nextTier(owned) !== null || hasStickerSlot;
  });
  const buildings = cards.filter((c) => c.kind === 'building');
  const actions = cards.filter((c) => c.kind === 'action');
  const works = cards.filter((c) => c.kind === 'work');

  function tile(c: CardDef) {
    const owned = copiesOwned(collection, c.id);
    const up = nextTier(owned);
    const hasStickerSlot = stickerableInstancesOf(collection, c.id).length > 0;
    // Only offer the stickers that actually apply to this card — no per-card
    // hard-coding here; each sticker's own `appliesTo` decides via `stickerAppliesTo`.
    const applicableStickers = Object.values(STICKERS).filter((s) => stickerAppliesTo(s, c));
    return (
      <div key={c.id} className={styles.tileWrap}>
        <CardFace card={c} className={styles.tile} countBadge={owned} alwaysShowBadge />
        {up && (
          <button
            type="button"
            className={styles.buyBtn}
            disabled={influence < up.cost}
            onClick={() => onBuyTier(c.id)}
            title={influence >= up.cost ? `Upgrade to ×${up.to} for ${up.cost} Influence` : 'Not enough Influence'}
          >
            <span aria-hidden="true">⭐</span>
            {up.cost} → ×{up.to}
          </button>
        )}
        {hasStickerSlot &&
          applicableStickers.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.buyBtn}
              disabled={influence < s.cost}
              onClick={() => setPicking({ cardId: c.id, stickerId: s.id })}
              title={influence >= s.cost ? `Attach ${s.name} (${s.description}) to a copy for ${s.cost} Influence` : 'Not enough Influence'}
            >
              <span aria-hidden="true">{s.icon}</span>
              {s.cost} → {s.name}
            </button>
          ))}
      </div>
    );
  }

  // Board stickers are permanent modifiers on a *board* (`rules/boardStickers.ts`). A board is
  // singular (no per-copy identity), so — unlike a card sticker — the buy attaches directly, no
  // instance picker. This is a deliberately minimal interim surface: DESIGN.md Step 9.3 replaces it
  // with an in-place board menu (the reason it lives as a separate section, not folded into a tile).
  function boardTile(boardId: BoardId) {
    const board = BOARDS[boardId];
    const attached = boardStickers[boardId] ?? [];
    const eff = effectiveBoard(board, attached);
    const full = isBoardStickerFull(attached);
    const applicable = Object.values(BOARD_STICKERS).filter((s) => boardStickerAppliesTo(s, board));
    return (
      <div key={boardId} className={styles.boardTile}>
        <div className={styles.boardHead}>
          <span className={styles.boardName}>{board.name}</span>
          {attached.length > 0 && (
            <span className={styles.boardStickers}>
              {attached.map((sid, i) => (
                <span key={i} title={BOARD_STICKERS[sid]?.name}>
                  {BOARD_STICKERS[sid]?.icon}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className={styles.boardProfile}>{describeBoard(eff)}</div>
        <div className={styles.boardBuys}>
          {applicable.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.buyBtn}
              disabled={full || influence < s.cost}
              onClick={() => onBuyBoardSticker(boardId, s.id)}
              title={
                full
                  ? `This board is full (${attached.length}/2 stickers)`
                  : influence >= s.cost
                    ? `Attach ${s.name} (${s.description}) for ${s.cost} Influence`
                    : 'Not enough Influence'
              }
            >
              <span aria-hidden="true">{s.icon}</span>
              {s.cost} → {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shop}>
      <h1 className={styles.title}>Shop</h1>
      <p className={styles.subtitle}>
        Spend Influence on extra copies and permanent stickers for cards you own, plus modifiers for your boards. New
        cards come from missions.
      </p>
      <div className={styles.balance}>
        <span aria-hidden="true">⭐</span>
        {influence} to spend
      </div>

      {cards.length === 0 ? (
        <p className={styles.empty}>Every card you own is fully upgraded and stickered.</p>
      ) : (
        <>
          {buildings.length > 0 && (
            <>
              <h2 className={styles.sectionTitle}>Buildings &amp; Wonders</h2>
              <div className={styles.grid}>{buildings.map(tile)}</div>
            </>
          )}
          {actions.length > 0 && (
            <>
              <h2 className={styles.sectionTitle}>Actions</h2>
              <div className={styles.grid}>{actions.map(tile)}</div>
            </>
          )}
          {works.length > 0 && (
            <>
              <h2 className={styles.sectionTitle}>Work</h2>
              <div className={styles.grid}>{works.map(tile)}</div>
            </>
          )}
        </>
      )}

      <h2 className={styles.sectionTitle}>Boards</h2>
      <div className={styles.boardGrid}>{BOARD_IDS.map(boardTile)}</div>

      {picking && (
        <CardInstancePanel
          cardId={picking.cardId}
          collection={collection}
          decks={decks}
          attach={{
            stickerId: picking.stickerId,
            influence,
            onAttach: (instanceId) => {
              onAttachSticker(instanceId, picking.stickerId);
              setPicking(null);
            },
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
