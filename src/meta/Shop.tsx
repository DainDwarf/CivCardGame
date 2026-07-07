import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { STICKERS } from '../content/stickers';
import { CardFace } from '../components/CardFace';
import { copiesOwned, stickerableInstancesOf, type OwnedCards } from '../rules/collection';
import { nextTier } from '../rules/shop';
import { stickerAppliesTo } from '../rules/stickers';
import { CardInstancePanel } from './CardInstancePanel';
import type { CardDef } from '../content/cards';
import styles from './Shop.module.css';

/**
 * The Shop screen (Phase 3 Step 5.2, extended by Step 7.5): spend Influence (⭐) to deepen
 * cards you already own — copy-tier upgrades (×1 → ×2 → ×4 → ×8, `rules/shop.ts`) and, since
 * Step 7.5, permanent card stickers (`content/stickers.ts`) attached to one chosen owned
 * instance — up to `MAX_STICKERS` (2, Step 7.7) per instance. The shop sells *depth* only — new
 * cards come from mission unlocks, never here (docs/DESIGN.md, "Economy & progression"). A card
 * is listed if it has *either* a tier left to buy or an owned instance with room for another
 * sticker (`stickerableInstancesOf`) — a card already at ×8 with every copy fully stickered
 * finally drops off the list. Tier-buying stays one click (a
 * purchase only ever adds copies); attaching a sticker needs a target instance, so it opens
 * `CardInstancePanel` in its `attach` mode — the same per-copy picker Step 7.3 built, reused
 * rather than inventing a second one.
 */
export function Shop({
  collection,
  decks,
  influence,
  onBuyTier,
  onAttachSticker,
}: {
  collection: OwnedCards;
  /** Forwarded to the sticker-attach picker so it can show each candidate instance's deck
   *  usage, same as `Collection.tsx`'s browsing view. */
  decks: DeckDef[];
  influence: number;
  onBuyTier: (cardId: string) => void;
  /** Attach a sticker to one chosen owned instance (Phase 3 Step 7.5) — spends Influence and
   *  mutates that instance in the store (`App.tsx`'s `attachSticker`). */
  onAttachSticker: (instanceId: string, stickerId: string) => void;
}) {
  const [picking, setPicking] = useState<{ cardId: string; stickerId: string } | null>(null);

  // Event and threat cards are mission-injected and never part of the player's collection; a
  // card is shown if it's owned *and* has something left to buy — a tier upgrade, or a sticker
  // slot (an owned instance with room) *and* at least one sticker that actually applies to it
  // (`stickerAppliesTo` — e.g. Irrigation only lists on food buildings, Step 7.8).
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
    // Only offer the stickers that actually apply to this card (Step 7.8) — no per-card
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

  return (
    <div className={styles.shop}>
      <h1 className={styles.title}>Shop</h1>
      <p className={styles.subtitle}>
        Spend Influence on extra copies and permanent stickers for cards you own. New cards come from missions.
      </p>
      <div className={styles.balance}>
        <span aria-hidden="true">⭐</span>
        {influence} to spend
      </div>

      {cards.length === 0 ? (
        <p className={styles.empty}>Nothing to buy right now — every card you own is fully upgraded and stickered.</p>
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
