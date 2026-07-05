import { CARDS } from '../content/cards';
import { CardFace } from '../components/CardFace';
import { copiesOwned, type OwnedCards } from '../rules/collection';
import { nextTier } from '../rules/shop';
import type { CardDef } from '../content/cards';
import styles from './Shop.module.css';

/**
 * The Shop screen (Phase 3 Step 5.2): spend Influence (⭐) to deepen cards you already own,
 * raising each along the copy-tier ladder ×1 → ×2 → ×4 → unlimited (`rules/shop.ts`). The shop
 * sells *depth* only — new cards come from mission unlocks, never here (docs/DESIGN.md,
 * "Economy & progression"). Only *upgradeable* owned cards are listed: `nextTier` returns null
 * for a maxed (unlimited) or not-yet-owned card, so that one predicate both hides the ∞ basics
 * and excludes anything not unlocked. Buying is one click — a purchase only ever adds copies,
 * so there's no confirm step. Tiles mirror `Collection.tsx`'s grouped grid.
 */
export function Shop({
  collection,
  influence,
  onBuyTier,
}: {
  collection: OwnedCards;
  influence: number;
  onBuyTier: (cardId: string) => void;
}) {
  // Event cards are mission-injected and never part of the player's collection; a card is shown
  // only if it's owned *and* has a tier left to buy (nextTier !== null covers both).
  const cards = Object.values(CARDS).filter(
    (c) => c.kind !== 'event' && nextTier(copiesOwned(collection, c.id)) !== null,
  );
  const buildings = cards.filter((c) => c.kind === 'building');
  const actions = cards.filter((c) => c.kind === 'action');
  const works = cards.filter((c) => c.kind === 'work');

  function tile(c: CardDef) {
    const up = nextTier(copiesOwned(collection, c.id))!; // filtered to upgradeable above
    const affordable = influence >= up.cost;
    const target = up.to === 'unlimited' ? '∞' : `×${up.to}`;
    return (
      <div key={c.id} className={styles.tileWrap}>
        <CardFace card={c} className={styles.tile} countBadge={copiesOwned(collection, c.id)} alwaysShowBadge />
        <button
          type="button"
          className={styles.buyBtn}
          disabled={!affordable}
          onClick={() => onBuyTier(c.id)}
          title={affordable ? `Upgrade to ${target} for ${up.cost} Influence` : 'Not enough Influence'}
        >
          <span aria-hidden="true">⭐</span>
          {up.cost} → {target}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.shop}>
      <h1 className={styles.title}>Shop</h1>
      <p className={styles.subtitle}>
        Spend Influence on extra copies of cards you own. New cards come from missions.
      </p>
      <div className={styles.balance}>
        <span aria-hidden="true">⭐</span>
        {influence} to spend
      </div>

      {cards.length === 0 ? (
        <p className={styles.empty}>Nothing to upgrade right now — every card you own is at its cap.</p>
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
    </div>
  );
}
