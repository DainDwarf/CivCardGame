import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { instancesOf, type OwnedCards } from '../rules/collection';
import { decksContaining } from '../rules/deckBuilder';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import styles from './CardInstancePanel.module.css';

/**
 * Step 7.3's anti-surprise mechanism: one owned copy of a card at a time, each row naming
 * the decks it currently sits in ("in Aggro, Midrange") or "unused". A future sticker
 * (Step 7.5) attaches to one instance chosen here, so its deck consequences are on screen
 * *before* the pick, not discovered after. Every instance looks identical today (no sticker
 * field yet), so clicking any row opens the same shared `CardZoomOverlay`.
 */
export function CardInstancePanel({
  cardId,
  collection,
  decks,
  onClose,
}: {
  cardId: string;
  collection: OwnedCards;
  decks: DeckDef[];
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  const card = CARDS[cardId];
  const instances = instancesOf(collection, cardId);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
        <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              {card.name} <span className={styles.panelCount}>({instances.length} owned)</span>
            </h3>
            <span className={styles.panelHint}>Click a copy to zoom · click outside to close</span>
          </div>
          <div className={styles.list}>
            {instances.map((inst, i) => {
              const usedIn = decksContaining(inst.id, decks).map((d) => d.name);
              return (
                <div key={inst.id} className={styles.row} onClick={() => setZoom(true)}>
                  <span className={styles.rowLabel}>
                    {card.name} {i + 1}/{instances.length}
                  </span>
                  <span className={styles.rowUsage}>{usedIn.length > 0 ? `in ${usedIn.join(', ')}` : 'unused'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <CardZoomOverlay cardId={zoom ? cardId : null} onClose={() => setZoom(false)} hint="Click anywhere to close" />
    </>
  );
}
