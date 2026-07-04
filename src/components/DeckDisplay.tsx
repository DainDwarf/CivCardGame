import { useState } from 'react';
import type { ReactNode } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { groupCounts } from '../rules/deckBuilder';
import { CardFace } from './CardFace';
import { CardZoomOverlay } from './CardZoomOverlay';
import styles from './DeckDisplay.module.css';

/**
 * Shared, presentational deck display — a deck rendered as a card-like tile whose "art"
 * is a hover-revealed shingled fan of its cards (grouped into ×N stacks), plus the
 * list-view overlay it opens. Both are used by the Decks screen (`meta/Decks.tsx`) and
 * the campaign-map launch popup (`meta/CampaignMap.tsx`) so the two look identical.
 *
 * The caller owns interaction: click behaviour comes via `onClick`, and any action
 * buttons (Edit/Copy/Delete) are passed through the optional `actions` slot — Decks
 * supplies them, the launch popup passes none.
 */
export function DeckTile({
  deck,
  onClick,
  selected = false,
  actions,
  title = "Click to view this deck's cards",
}: {
  deck: DeckDef;
  onClick?: () => void;
  selected?: boolean;
  actions?: ReactNode;
  title?: string;
}) {
  const groups = groupCounts(deck.cards);
  const mid = (groups.length - 1) / 2;
  return (
    <div
      className={`${styles.tile}${selected ? ` ${styles.selected}` : ''}`}
      onClick={onClick}
      title={title}
    >
      <div className={styles.tileHeader}>
        <div className={styles.tileInfo}>
          <span className={styles.tileName}>{deck.name}</span>
          <span className={styles.tileCount}>{deck.cards.length} cards</span>
        </div>
        {actions && <div className={styles.tileActions}>{actions}</div>}
      </div>
      <div className={styles.stack} style={{ '--mid': mid } as React.CSSProperties}>
        {groups.length === 0 ? (
          <span className={styles.stackEmpty}>Empty deck</span>
        ) : (
          groups.map((g, i) => (
            <span key={g.cardId} className={styles.mini} style={{ '--i': i } as React.CSSProperties}>
              <CardFace
                card={CARDS[g.cardId]}
                className={styles.miniCard}
                countBadge={g.count}
                badgeClassName={styles.miniBadge}
              />
            </span>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * The list-view overlay for a deck — mirrors the run loop's pile viewer: a grid of the
 * deck's cards (grouped ×N), click a card to zoom (shared `CardZoomOverlay`), click
 * outside to close. Owns its own zoom state. The `CardZoomOverlay` is a *sibling* of the
 * backdrop (not nested) so its dismiss click doesn't bubble up and close this overlay too.
 * The optional `actions` slot holds caller-specific buttons (Decks passes Edit/Copy; the
 * launch popup passes none — the header's centre column keeps the hint centred regardless).
 */
export function DeckListOverlay({
  deck,
  onClose,
  actions,
}: {
  deck: DeckDef;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
        <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              {deck.name} <span className={styles.panelCount}>({deck.cards.length} cards)</span>
            </h3>
            <span className={styles.panelHint}>Click a card to zoom · click outside to close</span>
            {actions && <div className={styles.panelActions}>{actions}</div>}
          </div>
          {deck.cards.length === 0 ? (
            <p className={styles.empty}>This deck is empty.</p>
          ) : (
            <div className={styles.listGrid}>
              {groupCounts(deck.cards).map((g) => (
                <CardFace
                  key={g.cardId}
                  card={CARDS[g.cardId]}
                  className={styles.listCard}
                  countBadge={g.count}
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoom(g.cardId);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <CardZoomOverlay cardId={zoom} onClose={() => setZoom(null)} hint="Click anywhere to close" />
    </>
  );
}
