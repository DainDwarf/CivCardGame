import { DECKS, type DeckId } from '../content/decks';
import { CARDS } from '../content/cards';
import styles from './Decks.module.css';

const DECK_IDS = Object.keys(DECKS) as DeckId[];

/** Collapse a flat list of card ids into one entry per card with a count, first-seen order. */
function groupCounts(ids: string[]): { cardId: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order.map((cardId) => ({ cardId, count: counts.get(cardId)! }));
}

/**
 * The Decks screen (Phase 2 build plan step 6) — the premade decks a run can launch
 * with, shown read-only. The deck editor (building/saving a custom deck from the
 * collection) is step 7; for now this is navigation, not construction.
 */
export function Decks() {
  return (
    <div className={styles.decks}>
      <h1 className={styles.title}>Decks</h1>
      <p className={styles.subtitle}>
        Premade run decks. Pick one on the Mission screen — the deck editor lands in a later phase.
      </p>

      {DECK_IDS.map((id) => {
        const deck = DECKS[id];
        return (
          <section key={id} className={styles.deckCard}>
            <div className={styles.deckHeader}>
              <h2 className={styles.deckName}>{deck.name}</h2>
              <span className={styles.deckCount}>{deck.cards.length} cards</span>
            </div>
            <p className={styles.deckDesc}>{deck.description}</p>
            <div className={styles.cardList}>
              {groupCounts(deck.cards).map((g) => (
                <span key={g.cardId} className={styles.cardChip}>
                  {CARDS[g.cardId].name}
                  {g.count > 1 ? ` ×${g.count}` : ''}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
