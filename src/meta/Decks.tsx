import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { groupCounts } from '../rules/deckBuilder';
import styles from './Decks.module.css';

/**
 * The Decks screen — every deck in the player's store, fully editable (Phase 2 build
 * plan step 7). There's no "premade" tier anymore: the starting decks are just seed
 * data (`content/decks.ts`'s `DEFAULT_DECKS`) copied into a new player's store, edited
 * and deleted the same as anything the player builds from scratch.
 */
export function Decks({
  decks,
  onNew,
  onEdit,
  onDelete,
}: {
  decks: DeckDef[];
  onNew: () => void;
  onEdit: (deck: DeckDef) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.decks}>
      <h1 className={styles.title}>Decks</h1>
      <p className={styles.subtitle}>Your run decks. Pick one on the Mission screen, or edit them here.</p>

      <button type="button" className={styles.newBtn} onClick={onNew}>
        + New Deck
      </button>

      {decks.length === 0 && <p className={styles.empty}>No decks yet — create one to get started.</p>}

      {decks.map((deck) => (
        <section key={deck.id} className={styles.deckCard}>
          <div className={styles.deckHeader}>
            <h2 className={styles.deckName}>{deck.name}</h2>
            <span className={styles.deckCount}>{deck.cards.length} cards</span>
          </div>
          <div className={styles.cardList}>
            {groupCounts(deck.cards).map((g) => (
              <span key={g.cardId} className={styles.cardChip}>
                {CARDS[g.cardId].name}
                {g.count > 1 ? ` ×${g.count}` : ''}
              </span>
            ))}
          </div>
          <div className={styles.deckActions}>
            <button type="button" className={styles.actionBtn} onClick={() => onEdit(deck)}>
              Edit
            </button>
            <button type="button" className={styles.actionBtn} onClick={() => onDelete(deck.id)}>
              Delete
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
