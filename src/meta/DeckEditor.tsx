import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { addCard, removeCard, groupCounts } from '../rules/deckBuilder';
import { CardTile } from './Collection';
import styles from './DeckEditor.module.css';

/**
 * Build/edit a single deck (Phase 2 build plan step 7). Edits `initialDeck` in place —
 * every deck is player-owned, so there's no "duplicate a built-in" indirection. The
 * card picker reuses `Collection.tsx`'s `CardTile` unchanged, just wrapped in a button
 * to make it clickable.
 */
export function DeckEditor({
  initialDeck,
  onSave,
  onCancel,
}: {
  initialDeck: DeckDef;
  onSave: (deck: DeckDef) => void;
  onCancel: () => void;
}) {
  const [deck, setDeck] = useState<DeckDef>(initialDeck);

  // Event cards are mission-injected and can never be added to a deck.
  const cards = Object.values(CARDS).filter((c) => c.kind !== 'event');
  const buildings = cards.filter((c) => c.kind === 'permanent');
  const actions = cards.filter((c) => c.kind === 'recurring');

  function handleAdd(cardId: string) {
    setDeck((d) => {
      const next = addCard(d.cards, cardId);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  function handleRemove(cardId: string) {
    setDeck((d) => {
      const next = removeCard(d.cards, cardId);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  return (
    <div className={styles.editor}>
      <h1 className={styles.title}>Edit Deck</h1>

      <input
        type="text"
        className={styles.nameInput}
        value={deck.name}
        onChange={(e) => setDeck((d) => ({ ...d, name: e.target.value }))}
        placeholder="Deck name"
      />
      <textarea
        className={styles.descInput}
        value={deck.description}
        onChange={(e) => setDeck((d) => ({ ...d, description: e.target.value }))}
        placeholder="Description"
        rows={2}
      />

      <div className={styles.layout}>
        <section className={styles.picker}>
          <h2 className={styles.sectionTitle}>Buildings &amp; Wonders</h2>
          <div className={styles.grid}>
            {buildings.map((c) => (
              <button key={c.id} type="button" className={styles.tileBtn} onClick={() => handleAdd(c.id)}>
                <CardTile card={c} />
              </button>
            ))}
          </div>
          <h2 className={styles.sectionTitle}>Actions</h2>
          <div className={styles.grid}>
            {actions.map((c) => (
              <button key={c.id} type="button" className={styles.tileBtn} onClick={() => handleAdd(c.id)}>
                <CardTile card={c} />
              </button>
            ))}
          </div>
        </section>

        <section className={styles.current}>
          <h2 className={styles.sectionTitle}>Current deck ({deck.cards.length} cards)</h2>
          <div className={styles.cardList}>
            {groupCounts(deck.cards).map((g) => (
              <button
                key={g.cardId}
                type="button"
                className={styles.cardChip}
                onClick={() => handleRemove(g.cardId)}
                title="Remove one copy"
              >
                {CARDS[g.cardId].name}
                {g.count > 1 ? ` ×${g.count}` : ''}
                <span className={styles.remove}>×</span>
              </button>
            ))}
            {deck.cards.length === 0 && <p className={styles.empty}>Click a card on the left to add it.</p>}
          </div>
        </section>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={deck.cards.length === 0}
          onClick={() => onSave(deck)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
