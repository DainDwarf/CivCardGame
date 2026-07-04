import { useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { groupCounts, MAX_DECKS } from '../rules/deckBuilder';
import { CardFace } from '../components/CardFace';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import styles from './Decks.module.css';

/**
 * The Decks screen — every deck in the player's store, fully editable (Phase 2 build
 * plan step 7). There's no "premade" tier anymore: the starting decks are just seed
 * data (`content/decks.ts`'s `DEFAULT_DECKS`) copied into a new player's store, edited
 * and deleted the same as anything the player builds from scratch.
 *
 * Visually a *shelf of decks*: each deck is a tile whose art is a hover-revealed
 * "shingled" fan of its cards (grouped into ×N stacks). Clicking a tile opens a
 * list-view of the deck's cards — the same look as the run loop's discard-pile viewer
 * (`Board.tsx`), reusing `CardFace` + the shared `CardZoomOverlay` for click-to-zoom.
 * "New Deck" is the grid's own next slot — a hollow tile after the last deck — rather
 * than a button above the grid. The `MAX_DECKS` cap is a core rule (see
 * `rules/deckBuilder.ts`); that slot simply doesn't render once the cap is hit. Copy
 * (tile and list-view, same accent color as Edit) duplicates a deck's cards into a
 * fresh, unsaved `DeckDef` and opens the editor on it — exactly like "New Deck" but
 * pre-filled, so nothing is persisted until Save there — and is gated at `MAX_DECKS`
 * the same way, since it also adds a deck rather than editing one in place.
 */
export function Decks({
  decks,
  onNew,
  onEdit,
  onCopy,
  onDelete,
}: {
  decks: DeckDef[];
  onNew: () => void;
  onEdit: (deck: DeckDef) => void;
  onCopy: (deck: DeckDef) => void;
  onDelete: (id: string) => void;
}) {
  // The deck whose card list is open in the list-view overlay, and the card zoomed within it.
  const [selected, setSelected] = useState<DeckDef | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
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
        {decks.map((deck) => {
          const groups = groupCounts(deck.cards);
          const mid = (groups.length - 1) / 2;
          return (
            <div
              key={deck.id}
              className={styles.tile}
              onClick={() => {
                setSelected(deck);
                setConfirmingDeleteId(null);
              }}
              title="Click to view this deck's cards"
            >
              <div className={styles.tileHeader}>
                <div className={styles.tileInfo}>
                  <span className={styles.tileName}>{deck.name}</span>
                  <span className={styles.tileCount}>{deck.cards.length} cards</span>
                </div>
                <div className={styles.tileActions}>
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
                </div>
              </div>
              <div className={styles.stack} style={{ '--mid': mid } as React.CSSProperties}>
                {groups.length === 0 ? (
                  <span className={styles.stackEmpty}>Empty deck</span>
                ) : (
                  groups.map((g, i) => (
                    <span key={g.cardId} className={styles.mini} style={{ '--i': i } as React.CSSProperties}>
                      <CardFace
                        card={CARDS[g.cardId]}
                        className={styles.miniCard}
                        countBadge={g.count}
                        badgeClassName={styles.miniBadge}
                      />
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
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

      {/* List-view of the selected deck's cards — mirrors Board.tsx's pile viewer:
          click a card to zoom, click outside the panel to close. */}
      {selected && (
        <div className={styles.backdrop} onClick={() => setSelected(null)} role="dialog" aria-modal="true">
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>
                {selected.name} <span className={styles.panelCount}>({selected.cards.length} cards)</span>
              </h3>
              <span className={styles.panelHint}>Click a card to zoom · click outside to close</span>
              <div className={styles.panelActions}>
                <button
                  type="button"
                  className={styles.panelEditBtn}
                  onClick={() => onEdit(selected)}
                >
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
              </div>
            </div>
            {selected.cards.length === 0 ? (
              <p className={styles.empty}>This deck is empty.</p>
            ) : (
              <div className={styles.listGrid}>
                {groupCounts(selected.cards).map((g) => (
                  <CardFace
                    key={g.cardId}
                    card={CARDS[g.cardId]}
                    className={styles.listCard}
                    countBadge={g.count}
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoom(g.cardId);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CardZoomOverlay cardId={zoom} onClose={() => setZoom(null)} hint="Click anywhere to close" />
    </div>
  );
}
