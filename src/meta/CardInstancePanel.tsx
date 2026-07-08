import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { STICKERS } from '../content/stickers';
import { instancesOf, isStickerFull, stickerableInstancesOf, type OwnedCards } from '../rules/collection';
import { decksContaining } from '../rules/deckBuilder';
import { nextTier } from '../rules/shop';
import { effectiveCard, stickerAppliesTo } from '../rules/stickers';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import styles from './CardInstancePanel.module.css';

/**
 * The per-card detail view opened from Collection — and, since Step 9.1, that card's *buy/attach*
 * surface (the fused Shop). Its anti-surprise core is unchanged: one owned copy of the card per row,
 * each row naming the decks it sits in ("in Aggro, Midrange" or "unused") and any sticker already on
 * it, so the deck consequences are on screen *before* any pick.
 *
 * Given the optional `shop` bundle it also shows the Influence balance, a buy-next-tier button, and a
 * sticker-offer button per applicable sticker. Picking a sticker drops the panel into an *attach
 * sub-mode* where each copy's row offers an "Attach" button for that one sticker (stacking the same
 * sticker is allowed — `rules/stickers.ts`'s `effectiveGain`/`effectiveCost` count occurrences);
 * "← Back" returns to browse. Without `shop`, the panel is plain read-only browse (click a copy to
 * zoom to its sticker-adjusted stats).
 */
export function CardInstancePanel({
  cardId,
  collection,
  decks,
  shop,
  onClose,
}: {
  cardId: string;
  collection: OwnedCards;
  decks: DeckDef[];
  /** When set, the panel becomes the card's buy/attach surface: the Influence balance, a copy-tier
   *  buy button, and one sticker-offer button per sticker that `stickerAppliesTo` this card (only
   *  while some copy still has room). Omitted → read-only browse (click a copy to zoom). */
  shop?: {
    influence: number;
    onBuyTier: (cardId: string) => void;
    onAttachSticker: (instanceId: string, stickerId: string) => void;
  };
  onClose: () => void;
}) {
  const [zoomInstance, setZoomInstance] = useState<string | null>(null);
  const [pickingStickerId, setPickingStickerId] = useState<string | null>(null);
  const card = CARDS[cardId];
  const instances = instancesOf(collection, cardId);
  const attachSticker = pickingStickerId ? STICKERS[pickingStickerId] : undefined;
  const zoomed = instances.find((i) => i.id === zoomInstance);

  const influence = shop?.influence ?? 0;
  // nextTier keys off the current copy count (== instances.length); null once at ×8.
  const upgrade = shop ? nextTier(instances.length) : null;
  // Offer a sticker only while some copy still has room for it (a card with every copy full drops the
  // offer, mirroring the old Shop's `stickerableInstancesOf` gate). The per-row button re-checks fullness.
  const stickerOffers =
    shop && stickerableInstancesOf(collection, cardId).length > 0
      ? Object.values(STICKERS).filter((s) => stickerAppliesTo(s, card))
      : [];

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
        <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              {card.name} <span className={styles.panelCount}>({instances.length} owned)</span>
            </h3>
            <span className={styles.panelHint}>
              {attachSticker
                ? `Choose a copy to attach ${attachSticker.name} to · click outside to close`
                : 'Click a copy to zoom · click outside to close'}
            </span>
          </div>

          {shop && !attachSticker && (
            <div className={styles.shopBar}>
              <span className={styles.balance}>
                <span aria-hidden="true">⭐</span>
                {influence} to spend
              </span>
              {(upgrade || stickerOffers.length > 0) && (
                <div className={styles.offers}>
                  {upgrade && (
                    <button
                      type="button"
                      className={styles.buyBtn}
                      disabled={influence < upgrade.cost}
                      onClick={() => shop.onBuyTier(cardId)}
                      title={
                        influence < upgrade.cost
                          ? 'Not enough Influence'
                          : `Buy a copy tier — ×${upgrade.to} for ${upgrade.cost} Influence`
                      }
                    >
                      <span aria-hidden="true">⭐</span>
                      {upgrade.cost} → ×{upgrade.to}
                    </button>
                  )}
                  {stickerOffers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.buyBtn}
                      disabled={influence < s.cost}
                      onClick={() => setPickingStickerId(s.id)}
                      title={
                        influence < s.cost ? 'Not enough Influence' : `Attach ${s.name} — ${s.cost} Influence`
                      }
                    >
                      <span aria-hidden="true">{s.icon}</span>
                      {s.cost} → {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {attachSticker && (
            <div className={styles.shopBar}>
              <button type="button" className={styles.backBtn} onClick={() => setPickingStickerId(null)}>
                ← Back
              </button>
              <span className={styles.balance}>
                <span aria-hidden="true">⭐</span>
                {influence} to spend
              </span>
            </div>
          )}

          <div className={styles.list}>
            {instances.map((inst, i) => {
              const usedIn = decksContaining(inst.id, decks).map((d) => d.name);
              const stickerNames = (inst.stickers ?? []).map((id) => STICKERS[id]?.name ?? id);
              const canAttachHere = !!attachSticker && !isStickerFull(inst) && influence >= attachSticker.cost;
              return (
                <div
                  key={inst.id}
                  className={`${styles.row}${attachSticker ? ` ${styles.rowStatic}` : ''}`}
                  onClick={attachSticker ? undefined : () => setZoomInstance(inst.id)}
                >
                  <span className={styles.rowLabel}>
                    {card.name} {i + 1}/{instances.length}
                    {stickerNames.length > 0 && ` · 🏷️ ${stickerNames.join(', ')}`}
                  </span>
                  <span className={styles.rowUsage}>{usedIn.length > 0 ? `in ${usedIn.join(', ')}` : 'unused'}</span>
                  {attachSticker && (
                    <button
                      type="button"
                      className={styles.attachBtn}
                      disabled={!canAttachHere}
                      onClick={() => {
                        shop?.onAttachSticker(inst.id, attachSticker.id);
                        setPickingStickerId(null);
                      }}
                      title={
                        isStickerFull(inst)
                          ? 'This copy already carries the maximum number of stickers'
                          : canAttachHere
                            ? `Attach ${attachSticker.name} for ${attachSticker.cost} Influence`
                            : 'Not enough Influence'
                      }
                    >
                      <span aria-hidden="true">⭐</span>
                      {attachSticker.cost} → Attach
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {!attachSticker && (
        <CardZoomOverlay
          cardId={zoomInstance ? cardId : null}
          overrideCard={zoomed ? effectiveCard(card, zoomed) : undefined}
          stickerBadge={zoomed?.stickers}
          onClose={() => setZoomInstance(null)}
        />
      )}
    </>
  );
}
