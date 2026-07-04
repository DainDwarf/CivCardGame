import { useEffect, useRef, useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { addCard, removeCard, groupCounts } from '../rules/deckBuilder';
import { copiesOwned, isOwned, type OwnedCards } from '../rules/collection';
import { CardFace } from '../components/CardFace';
import styles from './DeckEditor.module.css';

/** Pointer travel (px) before a press becomes a drag rather than a click — same threshold
 *  the run loop uses (`Board.tsx`'s `DRAG_THRESHOLD`) for its click-vs-drag split. */
const DRAG_THRESHOLD = 6;

/** A card being dragged between the picker and the deck banner. */
interface DragState {
  cardId: string;
  source: 'picker' | 'banner';
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Offset from the tile's top-left to the grab point, so the clone tracks the cursor. */
  grabX: number;
  grabY: number;
  w: number;
  h: number;
  /** Becomes true once the pointer moves past the click/drag threshold. */
  active: boolean;
}

/**
 * Build/edit a single deck (Phase 2 build plan step 7). Edits `initialDeck` in place —
 * every deck is player-owned, so there's no "duplicate a built-in" indirection. Cards are
 * the same run-loop `CardFace` used on the board: a main picker area (grouped by kind, same
 * as before) and a bottom banner representing the deck itself, grouped into ×N stacks like
 * the run loop's pile viewer. Click still adds/removes a single copy — the fast path for
 * building a large deck — and dragging a card between the two areas does the same thing
 * more visually, mirroring the hand-rolled pointer-drag convention `Board.tsx` uses for
 * cards, building boxes, and workers (no drag-and-drop library exists in this project).
 */
export function DeckEditor({
  initialDeck,
  uiScale,
  collection,
  onSave,
  onCancel,
}: {
  initialDeck: DeckDef;
  /** Whole-UI scale from settings — the editor renders inside App.tsx's transform:scale()
   *  wrapper, so the drag clone's inline coordinates must be divided by it (visual → local),
   *  same as `Board.tsx`. */
  uiScale: number;
  /** The player's ownership — the picker only ever offers owned cards (Phase 3 Step 2):
   *  a not-yet-unlocked card is omitted entirely, not shown locked. */
  collection: OwnedCards;
  onSave: (deck: DeckDef) => void;
  onCancel: () => void;
}) {
  const [deck, setDeck] = useState<DeckDef>(initialDeck);
  // See Board.tsx's `px` — convert visual (post-scale) pointer/rect px to local px for the clone.
  const px = (v: number) => v / uiScale;
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Event cards are mission-injected and can never be added to a deck; the picker
  // only offers cards the player has actually unlocked.
  const cards = Object.values(CARDS).filter((c) => c.kind !== 'event' && isOwned(collection, c.id));
  const buildings = cards.filter((c) => c.kind === 'building');
  const actions = cards.filter((c) => c.kind === 'action');
  const works = cards.filter((c) => c.kind === 'work');

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

  // Keep a ref in lockstep with drag state so the window pointer listeners read fresh values —
  // same pattern as Board.tsx's setDrag.
  function setDrag(d: DragState | null) {
    dragRef.current = d;
    setDragState(d);
  }

  function onTilePointerDown(e: React.PointerEvent<HTMLElement>, cardId: string, source: 'picker' | 'banner') {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({
      cardId,
      source,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      w: r.width,
      h: r.height,
      active: false,
    });
  }

  /** Resolve a finished drag: a non-drag press is a click (add/remove one copy, the fast
   *  path); a real drag adds/removes only when released over the *other* area — dropping
   *  back where it started is a no-op. Removal always takes exactly one copy, even from a
   *  ×N banner stack (matches `removeCard`'s one-at-a-time semantics). */
  function finishDrag(d: DragState, releaseY: number) {
    const bannerTop = bannerRef.current?.getBoundingClientRect().top ?? Infinity;
    const overBanner = releaseY >= bannerTop;
    if (!d.active) {
      if (d.source === 'picker') handleAdd(d.cardId);
      else handleRemove(d.cardId);
    } else if (d.source === 'picker' && overBanner) {
      handleAdd(d.cardId);
    } else if (d.source === 'banner' && !overBanner) {
      handleRemove(d.cardId);
    }
    setDrag(null);
  }

  // While a drag is live, track the pointer on the window so it follows even past the tile.
  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      setDrag({ ...d, x: e.clientX, y: e.clientY, active: d.active || moved > DRAG_THRESHOLD });
    }
    function onUp(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      finishDrag(d, e.clientY);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // Re-bind only when a drag begins/ends; mid-drag updates flow through dragRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.pointerId]);

  return (
    <>
    <div className={styles.editor}>
      <h1 className={styles.title}>Edit Deck</h1>

      <div className={styles.picker}>
        {buildings.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Buildings &amp; Wonders</h2>
            <div className={styles.grid}>
              {buildings.map((c) => (
                <CardFace
                  key={c.id}
                  as="button"
                  card={c}
                  className={styles.pickerTile}
                  countBadge={copiesOwned(collection, c.id)}
                  title="Click or drag into the deck to add a copy"
                  onPointerDown={(e) => onTilePointerDown(e, c.id, 'picker')}
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
                  as="button"
                  card={c}
                  className={styles.pickerTile}
                  countBadge={copiesOwned(collection, c.id)}
                  title="Click or drag into the deck to add a copy"
                  onPointerDown={(e) => onTilePointerDown(e, c.id, 'picker')}
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
                  as="button"
                  card={c}
                  className={styles.pickerTile}
                  countBadge={copiesOwned(collection, c.id)}
                  title="Click or drag into the deck to add a copy"
                  onPointerDown={(e) => onTilePointerDown(e, c.id, 'picker')}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>

    {/* Outside `.editor`'s max-width column so it can span the full screen width — see
        DeckEditor.module.css's `.banner`. */}
    <div className={styles.banner} ref={bannerRef}>
      <div className={styles.bannerHeader}>
        <input
          type="text"
          className={styles.nameInput}
          value={deck.name}
          onChange={(e) => setDeck((d) => ({ ...d, name: e.target.value }))}
          placeholder="Deck name"
        />
        <span className={styles.count}>{deck.cards.length} cards</span>
        <div className={styles.bannerActions}>
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
      <div className={styles.bannerStrip}>
        {deck.cards.length === 0 && (
          <p className={styles.empty}>Click or drag a card above to add it.</p>
        )}
        {groupCounts(deck.cards).map((g) => (
          <CardFace
            key={g.cardId}
            as="button"
            card={CARDS[g.cardId]}
            className={styles.bannerTile}
            countBadge={g.count}
            title="Click or drag out of the deck to remove a copy"
            onPointerDown={(e) => onTilePointerDown(e, g.cardId, 'banner')}
          />
        ))}
      </div>
    </div>

    {/* The card clone following the cursor while it's dragged between the picker and the banner. */}
    {drag?.active && (
      <div className={styles.dragLayer} aria-hidden="true">
        <CardFace
          card={CARDS[drag.cardId]}
          className={styles.dragClone}
          style={{ left: px(drag.x - drag.grabX), top: px(drag.y - drag.grabY), width: px(drag.w), height: px(drag.h) }}
        />
      </div>
    )}
    </>
  );
}
