import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CARDS, isDeckable, type CardDef } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { addCard, removeCard, addInstance, removeInstance, groupCounts } from '../rules/deckBuilder';
import {
  findInstance,
  hasSticker,
  instancesOf,
  isOwned,
  unstickeredInstancesOf,
  type OwnedCards,
} from '../rules/collection';
import { effectiveCard } from '../rules/stickers';
import { CardFace } from '../components/CardFace';
import styles from './DeckEditor.module.css';

/** Pointer travel (px) before a press becomes a drag rather than a click — same threshold
 *  the run loop uses (`Board.tsx`'s `DRAG_THRESHOLD`) for its click-vs-drag split. */
const DRAG_THRESHOLD = 6;

/** A card being dragged between the picker and the deck banner. */
interface DragState {
  cardId: string;
  /** Set only for a *stickered* instance — dragged/clicked by identity rather than
   *  through `cardId`'s fungible LIFO pool. Absent for a plain copy. */
  instanceId?: string;
  /** The dragged instance's attached sticker ids, carried along so the drag clone can show
   *  the same per-sticker icon badge as the tile it was picked up from. */
  stickers?: string[];
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
  const buildings = cards.filter((c) => c.kind === 'building');
  const actions = cards.filter((c) => c.kind === 'action');
  const works = cards.filter((c) => c.kind === 'work');

  // Unstickered copies of `cardId` still available to add — owned (unstickered pool only:
  // a stickered instance is never part of this fungible tile) minus what's already in the deck.
  // Shared by `atCap` and the picker's badge so both read the same number. `deck.cards` holds
  // meta instance ids, so counting "in this deck" means resolving each instance id back to its
  // cardId via `collection`, not comparing ids directly.
  function remainingCopies(cardId: string): number {
    const owned = unstickeredInstancesOf(collection, cardId).length;
    const inDeck = deck.cards.filter((instanceId) => {
      const inst = findInstance(collection, instanceId);
      return inst?.cardId === cardId && !hasSticker(inst);
    }).length;
    return Math.max(0, owned - inDeck);
  }

  // Whether every owned unstickered copy of `cardId` is already in the deck — mirrors
  // `addCard`'s cap (rules/deckBuilder.ts) so the fungible picker tile can visually reflect
  // the same limit rather than just silently no-opping on click/drag.
  function atCap(cardId: string): boolean {
    return remainingCopies(cardId) <= 0;
  }

  // The fungible picker tile's count badge shows *remaining* unstickered copies, not total
  // owned — how many more of this card can still be added that way. A card with only one
  // unstickered copy never shows a badge at all (the ×N badge is only meaningful when
  // there's a stack to distinguish from).
  function pickerBadge(cardId: string): number | undefined {
    const owned = unstickeredInstancesOf(collection, cardId).length;
    if (owned <= 1) return undefined;
    return remainingCopies(cardId);
  }

  // Owned, stickered instances of `cardId` not currently in the deck — by-identity picker tiles,
  // one per instance (never grouped, since a sticker makes each worth distinguishing from its
  // siblings).
  function stickeredNotInDeck(cardId: string) {
    return instancesOf(collection, cardId).filter((inst) => hasSticker(inst) && !deck.cards.includes(inst.id));
  }

  function handleAdd(cardId: string) {
    setDeck((d) => {
      const next = addCard(d.cards, cardId, collection);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  function handleRemove(cardId: string) {
    setDeck((d) => {
      const next = removeCard(d.cards, cardId, collection);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  // By-identity add/remove for a stickered instance — bypasses the fungible LIFO pool entirely.
  function handleAddInstance(instanceId: string) {
    setDeck((d) => {
      const next = addInstance(d.cards, instanceId, collection);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  function handleRemoveInstance(instanceId: string) {
    setDeck((d) => {
      const next = removeInstance(d.cards, instanceId);
      return next === 'invalid' ? d : { ...d, cards: next };
    });
  }

  // Keep a ref in lockstep with drag state so the window pointer listeners read fresh values —
  // same pattern as Board.tsx's setDrag.
  function setDrag(d: DragState | null) {
    dragRef.current = d;
    setDragState(d);
  }

  function onTilePointerDown(
    e: React.PointerEvent<HTMLElement>,
    cardId: string,
    source: 'picker' | 'banner',
    instanceId?: string,
    stickers?: string[],
  ) {
    if (e.button !== 0) return;
    // A capped *fungible* picker tile is inert — same as a disabled button, no drag/click
    // starts. A stickered picker tile (instanceId set) has no such cap: it's only ever
    // rendered when it's not already in the deck, so it's always addable.
    if (source === 'picker' && !instanceId && atCap(cardId)) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({
      cardId,
      instanceId,
      stickers,
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
   *  ×N banner stack (matches `removeCard`'s one-at-a-time semantics). A stickered tile
   *  (`d.instanceId` set) always resolves by identity instead of through the fungible pool. */
  function finishDrag(d: DragState, releaseY: number) {
    const bannerTop = bannerRef.current?.getBoundingClientRect().top ?? Infinity;
    const overBanner = releaseY >= bannerTop;
    const add = () => (d.instanceId ? handleAddInstance(d.instanceId) : handleAdd(d.cardId));
    const remove = () => (d.instanceId ? handleRemoveInstance(d.instanceId) : handleRemove(d.cardId));
    if (!d.active) {
      if (d.source === 'picker') add();
      else remove();
    } else if (d.source === 'picker' && overBanner) {
      add();
    } else if (d.source === 'banner' && !overBanner) {
      remove();
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

  // A card's picker tiles: the fungible ×N tile (only if at least one unstickered copy is
  // owned) followed by one tile per owned, not-yet-in-deck *stickered* instance —
  // each addressable and draggable by its own identity, never folded into the fungible stack.
  function pickerTiles(c: CardDef): ReactNode[] {
    const tiles: ReactNode[] = [];
    if (unstickeredInstancesOf(collection, c.id).length > 0) {
      tiles.push(
        <CardFace
          key={c.id}
          as="button"
          card={c}
          className={`${styles.pickerTile}${atCap(c.id) ? ` ${styles.pickerTileAtCap}` : ''}`}
          countBadge={pickerBadge(c.id)}
          alwaysShowBadge
          title={atCap(c.id) ? 'All owned copies are already in this deck' : 'Click or drag into the deck to add a copy'}
          onPointerDown={(e) => onTilePointerDown(e, c.id, 'picker')}
        />,
      );
    }
    for (const inst of stickeredNotInDeck(c.id)) {
      tiles.push(
        <CardFace
          key={inst.id}
          as="button"
          card={effectiveCard(c, inst)}
          className={styles.pickerTile}
          stickerBadge={inst.stickers}
          title="Click or drag into the deck to add this stickered copy"
          onPointerDown={(e) => onTilePointerDown(e, c.id, 'picker', inst.id, inst.stickers)}
        />,
      );
    }
    return tiles;
  }

  return (
    <>
    <div className={styles.editor}>
      <h1 className={styles.title}>Edit Deck</h1>

      <div className={styles.picker}>
        {buildings.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Buildings &amp; Wonders</h2>
            <div className={styles.grid}>{buildings.flatMap(pickerTiles)}</div>
          </>
        )}
        {actions.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Actions</h2>
            <div className={styles.grid}>{actions.flatMap(pickerTiles)}</div>
          </>
        )}
        {works.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Work</h2>
            <div className={styles.grid}>{works.flatMap(pickerTiles)}</div>
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
        {groupCounts(deck.cards, collection).map((g) => (
          <CardFace
            key={g.instanceId ?? g.cardId}
            as="button"
            card={effectiveCard(CARDS[g.cardId], g)}
            className={styles.bannerTile}
            countBadge={g.count}
            stickerBadge={g.stickers}
            title={g.instanceId ? 'Click or drag out of the deck to remove this stickered copy' : 'Click or drag out of the deck to remove a copy'}
            onPointerDown={(e) => onTilePointerDown(e, g.cardId, 'banner', g.instanceId, g.stickers)}
          />
        ))}
      </div>
    </div>

    {/* The card clone following the cursor while it's dragged between the picker and the banner. */}
    {drag?.active && (
      <div className={styles.dragLayer} aria-hidden="true">
        <CardFace
          card={effectiveCard(CARDS[drag.cardId], { stickers: drag.stickers })}
          className={styles.dragClone}
          stickerBadge={drag.stickers}
          style={{ left: px(drag.x - drag.grabX), top: px(drag.y - drag.grabY), width: px(drag.w), height: px(drag.h) }}
        />
      </div>
    )}
    </>
  );
}
