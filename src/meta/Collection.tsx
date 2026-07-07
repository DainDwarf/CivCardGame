import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { CardFace } from '../components/CardFace';
import { copiesOwned, isOwned, type OwnedCards } from '../rules/collection';
import { CardInstancePanel } from './CardInstancePanel';
import styles from './Collection.module.css';

/**
 * The Collection screen: every card the player *owns*, read-only.
 * A card with no entry in `collection` is not yet unlocked and is omitted entirely
 * (not shown locked/greyed) — unlocking it via a mission is meant to be a surprise,
 * so nothing here should hint at what's still out there, including a total count.
 * Cards render as the same `CardFace` tiles as the deck editor's picker grid, grouped
 * by kind; clicking one opens `CardInstancePanel` — the per-copy detail view (Farm 1/2,
 * Farm 2/2) with each instance's deck usage, the anti-surprise mechanism a sticker needs
 * before it can single out one copy. Each tile still carries its own `countBadge` (copies
 * owned — ×2/×4/×8), the same badge the deck banner/pile viewer use for deck-count.
 */
export function Collection({ collection, decks }: { collection: OwnedCards; decks: DeckDef[] }) {
  const [detail, setDetail] = useState<string | null>(null);

  // Event and threat cards are mission-injected and never part of the player's collection.
  const cards = Object.values(CARDS).filter(
    (c) => c.kind !== 'event' && c.kind !== 'threat' && isOwned(collection, c.id),
  );
  const buildings = cards.filter((c) => c.kind === 'building');
  const actions = cards.filter((c) => c.kind === 'action');
  const works = cards.filter((c) => c.kind === 'work');

  return (
    <div className={styles.collection}>
      <h1 className={styles.title}>Collection</h1>
      <p className={styles.subtitle}>Cards you've unlocked so far.</p>

      {buildings.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Buildings &amp; Wonders</h2>
          <div className={styles.grid}>
            {buildings.map((c) => (
              <CardFace
                key={c.id}
                card={c}
                className={styles.tile}
                countBadge={copiesOwned(collection, c.id)}
                onClick={() => setDetail(c.id)}
              />
            ))}
          </div>
        </>
      )}

      {actions.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Actions</h2>
          <div className={styles.grid}>
            {actions.map((c) => (
              <CardFace
                key={c.id}
                card={c}
                className={styles.tile}
                countBadge={copiesOwned(collection, c.id)}
                onClick={() => setDetail(c.id)}
              />
            ))}
          </div>
        </>
      )}

      {works.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Work</h2>
          <div className={styles.grid}>
            {works.map((c) => (
              <CardFace
                key={c.id}
                card={c}
                className={styles.tile}
                countBadge={copiesOwned(collection, c.id)}
                onClick={() => setDetail(c.id)}
              />
            ))}
          </div>
        </>
      )}

      {detail && (
        <CardInstancePanel cardId={detail} collection={collection} decks={decks} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
