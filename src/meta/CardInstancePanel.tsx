import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { STICKERS } from '../content/stickers';
import { hasSticker, instancesOf, type OwnedCards } from '../rules/collection';
import { decksContaining } from '../rules/deckBuilder';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import styles from './CardInstancePanel.module.css';

/**
 * Step 7.3's anti-surprise mechanism: one owned copy of a card at a time, each row naming
 * the decks it currently sits in ("in Aggro, Midrange") or "unused". Step 7.5 built the
 * sticker on top of exactly this: each row also names any sticker already attached
 * (`content/stickers.ts`'s name), and — in `attach` mode — an unstickered row offers an
 * "Attach ⭐cost" button instead of opening the zoom, so the deck consequences shown here are
 * on screen *before* the pick, not discovered after. Plain browsing (no `attach` prop) keeps
 * the original click-to-zoom behaviour unchanged.
 */
export function CardInstancePanel({
  cardId,
  collection,
  decks,
  attach,
  onClose,
}: {
  cardId: string;
  collection: OwnedCards;
  decks: DeckDef[];
  /** When set, the panel is in sticker-purchase mode (`meta/Shop.tsx`): every row shows an
   *  "Attach" button for this one sticker instead of opening the zoom, disabled (with an
   *  explanatory title) on a row that already carries a sticker (Step 7.5 caps one sticker
   *  per instance) or that the player can't afford. */
  attach?: {
    stickerId: string;
    influence: number;
    onAttach: (instanceId: string) => void;
  };
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  const card = CARDS[cardId];
  const instances = instancesOf(collection, cardId);
  const attachSticker = attach ? STICKERS[attach.stickerId] : undefined;

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
          <div className={styles.list}>
            {instances.map((inst, i) => {
              const usedIn = decksContaining(inst.id, decks).map((d) => d.name);
              const stickerNames = (inst.stickers ?? []).map((id) => STICKERS[id]?.name ?? id);
              const canAttachHere = attachSticker && !hasSticker(inst) && attach!.influence >= attachSticker.cost;
              return (
                <div
                  key={inst.id}
                  className={`${styles.row}${attachSticker ? ` ${styles.rowStatic}` : ''}`}
                  onClick={attachSticker ? undefined : () => setZoom(true)}
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
                      onClick={() => attach!.onAttach(inst.id)}
                      title={
                        hasSticker(inst)
                          ? 'This copy already carries a sticker'
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
        <CardZoomOverlay cardId={zoom ? cardId : null} onClose={() => setZoom(false)} hint="Click anywhere to close" />
      )}
    </>
  );
}
