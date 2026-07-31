import { Fragment, useState } from 'react';
import { CARDS, cardSections, isDeckable } from '../content/cards';
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
  onRemoveSticker,
}: {
  collection: OwnedCards;
  decks: DeckDef[];
  /** Spendable Influence — forwarded into the detail panel's buy/attach controls. */
  influence: number;
  /** Unlocked card stickers — gates the detail panel's sticker tray (a locked sticker is hidden) and
   *  the per-tile upgrade hint. */
  unlockedStickers: Record<string, true>;
  /** Whole-UI scale (settings) — forwarded to the detail panel for its sticker drag-clone math. */
  uiScale: number;
  onBuyTier: (cardId: string) => void;
  onAttachSticker: (instanceId: string, stickerId: string) => void;
  /** Destroy the sticker at `index` on one owned copy — the detail panel's confirm-gated removal
   *  (`App.tsx`'s `detachSticker`); frees the slot, refunds no Influence. */
  onRemoveSticker: (instanceId: string, index: number) => void;
}) {
  const [detail, setDetail] = useState<string | null>(null);

  // Mission-injected cards (event/threat/objective) are never part of the player's collection.
  const cards = Object.values(CARDS).filter((c) => isDeckable(c) && isOwned(collection, c.id));

  return (
    <div className={styles.collection}>
      <h1 className={styles.title}>Collection</h1>

      {cardSections(cards).map((section) => (
        <Fragment key={section.kind}>
          <h2 className={styles.sectionTitle}>{section.heading}</h2>
          <div className={styles.grid}>
            {section.cards.map((c) => (
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
        </Fragment>
      ))}

      {detail && (
        <CardInstancePanel
          cardId={detail}
          collection={collection}
          decks={decks}
          shop={{ influence, unlockedStickers, onBuyTier, onAttachSticker, onRemoveSticker }}
          uiScale={uiScale}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
