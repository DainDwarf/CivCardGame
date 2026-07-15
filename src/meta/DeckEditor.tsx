import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CARDS, compareCards, isDeckable, type CardDef } from '../content/cards';
import type { DeckDef } from '../content/decks';
import {
  addCard,
  removeCard,
  groupCounts,
  ownedVariantsOf,
  variantKey,
  deckWonderCount,
  MAX_WONDERS_PER_DECK,
  MIN_DECK_SIZE,
  type DeckCard,
} from '../rules/deckBuilder';
import { isOwned, variantInstancesOf, type OwnedCards } from '../rules/collection';
import { effectiveCard } from '../rules/stickers';
import { CardFace } from '../components/CardFace';
import styles from './DeckEditor.module.css';

/** Pointer travel (px) before a press becomes a drag rather than a click — same threshold
 *  the run loop uses (`Board.tsx`'s `DRAG_THRESHOLD`) for its click-vs-drag split. */
const DRAG_THRESHOLD = 6;

/** A card being dragged between the picker and the deck banner. */
interface DragState {
  /** The variant the grabbed tile stands for — one copy of it is what a completed drag adds or
   *  removes, and its stickers are what the drag clone's face and badge show. */
  card: DeckCard;
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
 * Build/edit a single deck. Edits `initialDeck` in place —
 * every deck is player-owned, so there's no "duplicate a built-in" indirection. Cards are
 * the same run-loop `CardFace` used on the board: a main picker area (grouped by kind) and a
 * bottom banner representing the deck itself, both grouped into ×N stacks like the run loop's
 * pile viewer. Click adds/removes a single copy — the fast path for building a large deck —
 * and dragging a card between the two areas does the same thing more visually, mirroring the
 * hand-rolled pointer-drag convention `Board.tsx` uses for cards, building boxes, and workers
 * (no drag-and-drop library exists in this project).
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
  /** The player's ownership — the picker only ever offers owned cards:
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

  // Mission-injected cards (event/threat/objective) can never be added to a deck; the picker
  // only offers deckable cards the player has actually unlocked.
  const cards = Object.values(CARDS).filter((c) => isDeckable(c) && isOwned(collection, c.id));
  const buildings = cards.filter((c) => c.kind === 'building').sort(compareCards);
  const wonders = cards.filter((c) => c.kind === 'wonder').sort(compareCards);
  const works = cards.filter((c) => c.kind === 'work').sort(compareCards);
  const actions = cards.filter((c) => c.kind === 'action').sort(compareCards);

  // Copies of `card`'s variant still available to add — the owned ones not already in the deck,
  // exactly the pool `addCard` picks from. Shared by `atCap` and the picker's badge so both read
  // the same number.
  function remainingCopies(card: DeckCard): number {
    return variantInstancesOf(collection, card.cardId, card.stickers).filter((inst) => !deck.cards.includes(inst.id)).length;
  }

  // Whether every owned copy of `card`'s variant is already in the deck — mirrors `addCard`'s cap
  // (rules/deckBuilder.ts) so the picker tile can visually reflect the same limit rather than just
  // silently no-opping on click/drag. A wonder is *also* capped once the deck already holds
  // `MAX_WONDERS_PER_DECK` wonders (of any card), so a second distinct wonder's tile disables
  // instead of silently rejecting — mirrors `addCard`'s wonder guard.
  function atCap(card: DeckCard): boolean {
    if (remainingCopies(card) <= 0) return true;
    if (CARDS[card.cardId].kind === 'wonder' && deckWonderCount(deck.cards, collection) >= MAX_WONDERS_PER_DECK) return true;
    return false;
  }

  // A picker tile's badge shows the variant's *remaining* copies, not total owned — how many more
  // of it can still be added. A variant with only one copy never shows a badge at all (the ×N badge
  // is only meaningful when there's a stack to distinguish from).
  function pickerBadge(card: DeckCard): number | undefined {
    if (variantInstancesOf(collection, card.cardId, card.stickers).length <= 1) return undefined;
    return remainingCopies(card);
  }

  function handleAdd(card: DeckCard) {
    setDeck((d) => {
      const next = addCard(d.cards, card, collection);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  function handleRemove(card: DeckCard) {
    setDeck((d) => {
      const next = removeCard(d.cards, card, collection);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  // Keep a ref in lockstep with drag state so the window pointer listeners read fresh values —
  // same pattern as Board.tsx's setDrag.
  function setDrag(d: DragState | null) {
    dragRef.current = d;
    setDragState(d);
  }

  function onTilePointerDown(e: React.PointerEvent<HTMLElement>, card: DeckCard, source: 'picker' | 'banner') {
    if (e.button !== 0) return;
    // A capped picker tile is inert — same as a disabled button, no drag/click starts.
    if (source === 'picker' && atCap(card)) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({
      card,
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
      if (d.source === 'picker') handleAdd(d.card);
      else handleRemove(d.card);
    } else if (d.source === 'picker' && overBanner) {
      handleAdd(d.card);
    } else if (d.source === 'banner' && !overBanner) {
      handleRemove(d.card);
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

  // A card's picker tiles: one ×N tile per owned *variant* — its plain copies, then a tile per
  // distinct sticker combination owned. Copies of a variant are interchangeable, so a stack of them
  // is one tile with a count, exactly like the plain copies.
  function pickerTiles(c: CardDef): ReactNode[] {
    return ownedVariantsOf(collection, c.id).map((v) => (
      <CardFace
        key={variantKey(v)}
        as="button"
        card={effectiveCard(c, v)}
        className={`${styles.pickerTile}${atCap(v) ? ` ${styles.pickerTileAtCap}` : ''}`}
        countBadge={pickerBadge(v)}
        alwaysShowBadge
        stickerBadge={v.stickers}
        title={atCap(v) ? 'All owned copies are already in this deck' : 'Click or drag into the deck to add a copy'}
        onPointerDown={(e) => onTilePointerDown(e, v, 'picker')}
      />
    ));
  }

  return (
    <>
    <div className={styles.editor}>
      <h1 className={styles.title}>Edit Deck</h1>

      <div className={styles.picker}>
        {buildings.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Buildings</h2>
            <div className={styles.grid}>{buildings.flatMap(pickerTiles)}</div>
          </>
        )}
        {wonders.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Wonders</h2>
            <div className={styles.grid}>{wonders.flatMap(pickerTiles)}</div>
          </>
        )}
        {works.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Work</h2>
            <div className={styles.grid}>{works.flatMap(pickerTiles)}</div>
          </>
        )}
        {actions.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Actions</h2>
            <div className={styles.grid}>{actions.flatMap(pickerTiles)}</div>
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
        <span className={styles.count}>{deck.cards.length} cards (min {MIN_DECK_SIZE})</span>
        <div className={styles.bannerActions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            disabled={deck.cards.length < MIN_DECK_SIZE}
            title={deck.cards.length < MIN_DECK_SIZE ? `A deck needs at least ${MIN_DECK_SIZE} cards to save.` : 'Save this deck'}
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
        {groupCounts(deck.cards, collection).map((g) => (
          <CardFace
            key={variantKey(g)}
            as="button"
            card={effectiveCard(CARDS[g.cardId], g)}
            className={styles.bannerTile}
            countBadge={g.count}
            stickerBadge={g.stickers}
            title="Click or drag out of the deck to remove a copy"
            onPointerDown={(e) => onTilePointerDown(e, g, 'banner')}
          />
        ))}
      </div>
    </div>

    {/* The card clone following the cursor while it's dragged between the picker and the banner. */}
    {drag?.active && (
      <div className={styles.dragLayer} aria-hidden="true">
        <CardFace
          card={effectiveCard(CARDS[drag.card.cardId], drag.card)}
          className={styles.dragClone}
          stickerBadge={drag.card.stickers}
          style={{ left: px(drag.x - drag.grabX), top: px(drag.y - drag.grabY), width: px(drag.w), height: px(drag.h) }}
        />
      </div>
    )}
    </>
  );
}
