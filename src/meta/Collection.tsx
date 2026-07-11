import { useState } from 'react';
import { CARDS, compareCards, isDeckable } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { CardFace } from '../components/CardFace';
import { copiesOwned, isOwned, type OwnedCards } from '../rules/collection';
import { cardUpgradeAvailable } from '../rules/upgrades';
import { CardInstancePanel } from './CardInstancePanel';
import styles from './Collection.module.css';

/**
 * The Collection screen: every card the player *owns*. It's also the card *shop* —
 * clicking a card opens `CardInstancePanel`, the per-copy detail view (e.g. copy 1/2, 2/2) that
 * also buys the next copy tier and attaches stickers in place (there's no separate Shop tab).
 * A card with no entry in `collection` is not yet unlocked and is omitted entirely (not shown
 * locked/greyed) — unlocking it via a mission is meant to be a surprise, so nothing here should hint
 * at what's still out there, including a total count. Cards render as the same `CardFace` tiles as the
 * deck editor's picker grid, grouped by kind; each tile carries its own `countBadge` (copies owned —
 * ×2/×4/×8), the same badge the deck banner/pile viewer use for deck-count.
 */
export function Collection({
  collection,
  decks,
  influence,
  unlockedStickers,
  uiScale,
  onBuyTier,
  onAttachSticker,
}: {
  collection: OwnedCards;
  decks: DeckDef[];
  /** Spendable Influence — forwarded into the detail panel's buy/attach controls (Step 9.1). */
  influence: number;
  /** Unlocked card stickers — gates the detail panel's sticker tray (a locked sticker is hidden) and
   *  the per-tile upgrade hint. */
  unlockedStickers: Record<string, true>;
  /** Whole-UI scale (settings) — forwarded to the detail panel for its sticker drag-clone math (Step 9.2). */
  uiScale: number;
  onBuyTier: (cardId: string) => void;
  onAttachSticker: (instanceId: string, stickerId: string) => void;
}) {
  const [detail, setDetail] = useState<string | null>(null);

  // Mission-injected cards (event/threat/objective) are never part of the player's collection.
  const cards = Object.values(CARDS).filter((c) => isDeckable(c) && isOwned(collection, c.id));
  const buildings = cards.filter((c) => c.kind === 'building').sort(compareCards);
  const wonders = cards.filter((c) => c.kind === 'wonder').sort(compareCards);
  const works = cards.filter((c) => c.kind === 'work').sort(compareCards);
  const actions = cards.filter((c) => c.kind === 'action').sort(compareCards);

  return (
    <div className={styles.collection}>
      <h1 className={styles.title}>Collection</h1>

      {buildings.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Buildings</h2>
          <div className={styles.grid}>
            {buildings.map((c) => (
              <CardFace
                key={c.id}
                card={c}
                className={styles.tile}
                countBadge={copiesOwned(collection, c.id)}
                upgradeHint={cardUpgradeAvailable(collection, influence, c.id, unlockedStickers)}
                onClick={() => setDetail(c.id)}
              />
            ))}
          </div>
        </>
      )}

      {wonders.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Wonders</h2>
          <div className={styles.grid}>
            {wonders.map((c) => (
              <CardFace
                key={c.id}
                card={c}
                className={styles.tile}
                countBadge={copiesOwned(collection, c.id)}
                upgradeHint={cardUpgradeAvailable(collection, influence, c.id, unlockedStickers)}
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
                upgradeHint={cardUpgradeAvailable(collection, influence, c.id, unlockedStickers)}
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
                upgradeHint={cardUpgradeAvailable(collection, influence, c.id, unlockedStickers)}
                onClick={() => setDetail(c.id)}
              />
            ))}
          </div>
        </>
      )}

      {detail && (
        <CardInstancePanel
          cardId={detail}
          collection={collection}
          decks={decks}
          shop={{ influence, unlockedStickers, onBuyTier, onAttachSticker }}
          uiScale={uiScale}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
