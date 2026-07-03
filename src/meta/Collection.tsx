import { useState } from 'react';
import { CARDS } from '../content/cards';
import { CardFace } from '../components/CardFace';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import styles from './Collection.module.css';

/**
 * The Collection screen (Phase 2 build plan step 6) — every card in the game, shown
 * read-only. There's no unlock/ownership tracking yet, so this simply lists the full
 * `CARDS` catalogue; deck construction (writing to a persisted collection) is step 7.
 * Cards render as the same `CardFace` tiles as the deck editor's picker grid, grouped
 * by kind; clicking one opens the run loop's card-zoom overlay.
 */
export function Collection() {
  const [zoom, setZoom] = useState<string | null>(null);

  // Event cards are mission-injected and never part of the player's collection.
  const cards = Object.values(CARDS).filter((c) => c.kind !== 'event');
  const buildings = cards.filter((c) => c.kind === 'permanent');
  const actions = cards.filter((c) => c.kind === 'recurring');

  return (
    <div className={styles.collection}>
      <h1 className={styles.title}>Collection</h1>
      <p className={styles.subtitle}>Every card in the game — {cards.length} total.</p>

      <h2 className={styles.sectionTitle}>Buildings &amp; Wonders</h2>
      <div className={styles.grid}>
        {buildings.map((c) => (
          <CardFace key={c.id} card={c} className={styles.tile} onClick={() => setZoom(c.id)} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Actions</h2>
      <div className={styles.grid}>
        {actions.map((c) => (
          <CardFace key={c.id} card={c} className={styles.tile} onClick={() => setZoom(c.id)} />
        ))}
      </div>

      <CardZoomOverlay cardId={zoom} onClose={() => setZoom(null)} hint="Click anywhere to close" />
    </div>
  );
}
