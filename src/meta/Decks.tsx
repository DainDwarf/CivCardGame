import { useState } from 'react';
import type { DeckDef } from '../content/decks';
import { MAX_DECKS } from '../rules/deckBuilder';
import type { OwnedCards } from '../rules/collection';
import { DeckTile, DeckListOverlay } from '../components/DeckDisplay';
import styles from './Decks.module.css';

/**
 * The Decks screen — every deck in the player's store, fully editable (Phase 2 build
 * plan step 7). There's no "premade" tier anymore: the starting decks are just seed
 * data (`content/decks.ts`'s `DEFAULT_DECKS`) copied into a new player's store, edited
 * and deleted the same as anything the player builds from scratch.
 *
 * Visually a *shelf of decks*: each deck is a `DeckTile` (a hover-revealed shingled fan of
 * its cards) and clicking one opens a `DeckListOverlay` — both shared with the campaign-map
 * launch popup via `components/DeckDisplay.tsx`, so the two render identically. This screen
 * layers the store-mutation affordances on top through each component's `actions` slot:
 * Edit / Copy / Delete on the tile, Edit / Copy in the overlay. "New Deck" is the grid's
 * own next slot — a hollow tile after the last deck — rather than a button above the grid.
 * The `MAX_DECKS` cap is a core rule (see `rules/deckBuilder.ts`); that slot simply doesn't
 * render once the cap is hit. Copy (tile and list-view, same accent color as Edit)
 * duplicates a deck's cards into a fresh, unsaved `DeckDef` and opens the editor on it —
 * exactly like "New Deck" but pre-filled, so nothing is persisted until Save there — and is
 * gated at `MAX_DECKS` the same way, since it also adds a deck rather than editing one in place.
 */
export function Decks({
  decks,
  collection,
  onNew,
  onEdit,
  onCopy,
  onDelete,
}: {
  decks: DeckDef[];
  /** Resolves each deck's meta instance ids back to cardIds for display (Phase 3 Step 7.2). */
  collection: OwnedCards;
  onNew: () => void;
  onEdit: (deck: DeckDef) => void;
  onCopy: (deck: DeckDef) => void;
  onDelete: (id: string) => void;
}) {
  // The deck whose card list is open in the list-view overlay.
  const [selected, setSelected] = useState<DeckDef | null>(null);
  // Delete is a two-click confirm on the button itself: this tracks which deck's Delete
  // was just clicked once, awaiting a second click to actually delete.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const atCap = decks.length >= MAX_DECKS;
  // Copying adds a new deck, same as "New Deck" — gate it at the cap too, with the
  // same backstop-plus-UI-disable pattern (App.tsx's saveDeck refuses past MAX_DECKS
  // regardless, this just avoids the wasted trip through the editor).
  const copyTitle = atCap ? `Deck limit reached (${MAX_DECKS}) — delete one to make room.` : 'Duplicate this deck';

  return (
    <div className={styles.decks}>
      <h1 className={styles.title}>Decks</h1>

      <div className={styles.grid}>
        {decks.map((deck) => (
          <DeckTile
            key={deck.id}
            deck={deck}
            collection={collection}
            onClick={() => {
              setSelected(deck);
              setConfirmingDeleteId(null);
            }}
            actions={
              <>
                <button
                  type="button"
                  className={styles.editActionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingDeleteId(null);
                    onEdit(deck);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.editActionBtn}
                  disabled={atCap}
                  title={copyTitle}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingDeleteId(null);
                    onCopy(deck);
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className={styles.deleteActionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmingDeleteId === deck.id) {
                      onDelete(deck.id);
                      setConfirmingDeleteId(null);
                    } else {
                      setConfirmingDeleteId(deck.id);
                    }
                  }}
                  onMouseLeave={() => {
                    if (confirmingDeleteId === deck.id) setConfirmingDeleteId(null);
                  }}
                >
                  {confirmingDeleteId === deck.id ? 'Confirm?' : 'Delete'}
                </button>
              </>
            }
          />
        ))}
        <button
          type="button"
          className={styles.newTile}
          disabled={atCap}
          onClick={onNew}
          title={atCap ? `Deck limit reached (${MAX_DECKS}) — delete one to make room.` : 'Create a new deck'}
        >
          {atCap ? `Deck limit reached (${MAX_DECKS})` : 'New Deck'}
        </button>
      </div>

      {selected && (
        <DeckListOverlay
          deck={selected}
          collection={collection}
          onClose={() => setSelected(null)}
          actions={
            <>
              <button type="button" className={styles.panelEditBtn} onClick={() => onEdit(selected)}>
                Edit
              </button>
              <button
                type="button"
                className={styles.panelEditBtn}
                disabled={atCap}
                title={copyTitle}
                onClick={() => onCopy(selected)}
              >
                Copy
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
