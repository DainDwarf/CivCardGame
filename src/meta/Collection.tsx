import { Fragment, useState } from 'react';
import { CARDS, cardSections, isDeckable } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { STICKERS } from '../content/stickers';
import { CardFace } from '../components/CardFace';
import { StickerSeal } from '../components/StickerSeal';
import { copiesOwned, isOwned, type OwnedCards } from '../rules/collection';
import { canBuyTier } from '../rules/shop';
import { stickerAppliesTo, unlockedStickerDefs } from '../rules/stickers';
import { stickerUpgradeAvailable, stickerUpgradeAvailableFor } from '../rules/upgrades';
import { CardInstancePanel } from './CardInstancePanel';
import styles from './Collection.module.css';

/**
 * The Collection screen: every card the player *owns*. It's also the card *shop* —
 * clicking a card opens `CardInstancePanel`, the per-copy detail view (e.g. copy 1/2, 2/2) that
 * also buys the next copy tier and attaches stickers in place (there's no separate Shop tab).
 * A card with no entry in `collection` is not yet unlocked and is omitted entirely (not shown
 * locked/greyed) — unlocking it via a mission is meant to be a surprise, so nothing here should hint
 * at what's still out there, including a total count. Cards render as the same `CardFace` tiles as the
 * deck editor's picker grid, grouped by kind, each carrying its two independent buy hints: its ×N badge
 * turning gold and taking a ▲ when another copy is affordable, and a gold open sticker slot bottom-left
 * when a sticker could go on one. A wonder gets neither, nor a count — it is unique and unstickerable.
 *
 * The unlocked stickers sit in a right-side tray mirroring `BoardMenu`'s, but the seal here is a
 * **filter** rather than a drag handle: selecting one narrows the grid to the cards it fits, which is
 * the only way to ask "what can this sticker go on?" without drilling into copies one at a time. Under
 * a filter each tile's sticker hint answers for the *selected* sticker instead of for any.
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
  /** Spendable Influence — gates the per-tile hints and the tray's gold rims, and is forwarded into
   *  the detail panel's buy/attach controls. */
  influence: number;
  /** Unlocked card stickers — the tray lists exactly these (a locked sticker is hidden), and they are
   *  what the per-tile sticker hint folds over. */
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
  // The tray sticker the grid is filtered to, null when unfiltered.
  const [filter, setFilter] = useState<string | null>(null);

  // Mission-injected cards (event/threat/objective) are never part of the player's collection.
  const cards = Object.values(CARDS).filter((c) => isDeckable(c) && isOwned(collection, c.id));
  const filterSticker = filter ? STICKERS[filter] : undefined;
  const shown = filterSticker ? cards.filter((c) => stickerAppliesTo(filterSticker, c)) : cards;

  return (
    <div className={styles.collection}>
      <h1 className={styles.title}>
        {filterSticker ? `Collection — Cards for ${filterSticker.name}` : 'Collection'}
      </h1>

      <div className={styles.layout}>
        <div className={styles.cards}>
          {cardSections(shown).map((section) => (
            <Fragment key={section.kind}>
              <h2 className={styles.sectionTitle}>{section.heading}</h2>
              <div className={styles.grid}>
                {section.cards.map((c) => {
                  const isWonder = c.kind === 'wonder';
                  // Under a filter the ring answers for the selected sticker — "this one, on this
                  // card, now" — since that is the question the filter was asked.
                  const stickerHint = filterSticker
                    ? stickerUpgradeAvailableFor(collection, influence, c.id, filterSticker)
                    : stickerUpgradeAvailable(collection, influence, c.id, unlockedStickers);
                  return (
                    <CardFace
                      key={c.id}
                      card={c}
                      className={styles.tile}
                      countBadge={isWonder ? undefined : copiesOwned(collection, c.id)}
                      alwaysShowBadge
                      copyHint={canBuyTier(collection, influence, c.id)}
                      openSlots={stickerHint ? 1 : 0}
                      onClick={() => setDetail(c.id)}
                    />
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>

        <aside className={styles.tray}>
          <h2 className={styles.trayTitle}>Stickers</h2>
          <div className={styles.trayStickers}>
            {unlockedStickerDefs(unlockedStickers).map((s) => {
              // Gold only where the sticker could really be bought onto something right now. Never
              // dimmed: an unaffordable sticker is still a perfectly good thing to ask about.
              const buyable = cards.some((c) => stickerUpgradeAvailableFor(collection, influence, c.id, s));
              return (
                <StickerSeal
                  key={s.id}
                  className={styles.traySeal}
                  scale="inline"
                  icon={s.icon}
                  name={s.name}
                  gives={s.gives}
                  charges={s.charges}
                  appliesToLabel={s.appliesToLabel}
                  price={s.cost}
                  hint={buyable}
                  selected={filter === s.id}
                  onClick={() => setFilter((f) => (f === s.id ? null : s.id))}
                  // The bargain and the price are already drawn; the tooltip only carries what
                  // isn't — the gesture, and whether it can be acted on.
                  title={
                    buyable
                      ? 'Click to show the cards this sticker fits — affordable now.'
                      : 'Click to show the cards this sticker fits.'
                  }
                />
              );
            })}
          </div>
        </aside>
      </div>

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
