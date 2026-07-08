import { useEffect, useRef, useState } from 'react';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import { STICKERS, type StickerDef } from '../content/stickers';
import {
  instancesOf,
  isStickerFull,
  stickerableInstancesOf,
  type MetaCardInstance,
  type OwnedCards,
} from '../rules/collection';
import { decksContaining } from '../rules/deckBuilder';
import { nextTier } from '../rules/shop';
import { effectiveCard, stickerAppliesTo } from '../rules/stickers';
import { CardFace } from '../components/CardFace';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import styles from './CardInstancePanel.module.css';

/** Pointer travel (px) before a press on a tray badge becomes a drag rather than a click — the same
 *  threshold the deck editor / board menu / run loop use. A plain click on a badge is inert (a badge
 *  has no default target copy), so only a real drag past this threshold onto a valid face commits. */
const DRAG_THRESHOLD = 6;

/** A sticker badge being dragged from the tray onto one owned card face. Mirrors `BoardMenu`'s
 *  `DragState` (which drags a board sticker onto a board) — here the drop target is a card copy. */
interface DragState {
  stickerId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Offset from the badge's top-left to the grab point, so the clone tracks the cursor. */
  grabX: number;
  grabY: number;
  w: number;
  h: number;
  /** Becomes true once the pointer moves past the click/drag threshold. */
  active: boolean;
}

/**
 * The per-card detail view opened from Collection — and, since Step 9.1, that card's *buy/attach*
 * surface (the fused Shop). As of Step 9.2 it renders each owned copy as a real `CardFace` (its
 * sticker-adjusted `effectiveCard` numbers + bottom-left sticker badge) rather than a text row, and
 * stickers are bought+applied by **drag-and-drop**: the applicable stickers sit in a right-side tray
 * (the buy-next-copy-tier button pinned at its top), and dragging a sticker badge out of the tray
 * onto a card face buys and attaches it in one gesture — replacing Step 7.5's separate attach sub-mode.
 *
 * The anti-surprise core (Step 7.3) survives the visual change: each face carries a caption naming the
 * deck(s) that copy sits in ("1/2 · in Aggro" / "1/2 · unused"), so a sticker still lands on a *known*
 * copy. A hand-rolled pointer-drag (like `DeckEditor.tsx` / `BoardMenu.tsx`, no DnD library) with a
 * single `isValidTarget` predicate gating both the mid-drag highlight and the drop; an invalid/missed
 * drop no-ops. Clicking a face (not dragging onto it) zooms it. Without the `shop` bundle the panel is
 * read-only browse — faces + zoom, no tray.
 */
export function CardInstancePanel({
  cardId,
  collection,
  decks,
  shop,
  uiScale = 1,
  onClose,
}: {
  cardId: string;
  collection: OwnedCards;
  decks: DeckDef[];
  /** When set, the panel becomes the card's buy/attach surface: the tray with the Influence balance,
   *  a copy-tier buy button, and one draggable badge per sticker that `stickerAppliesTo` this card.
   *  Omitted → read-only browse (faces + click-to-zoom, no tray). */
  shop?: {
    influence: number;
    onBuyTier: (cardId: string) => void;
    onAttachSticker: (instanceId: string, stickerId: string) => void;
  };
  /** Whole-UI scale from settings — the panel renders inside App.tsx's transform:scale() wrapper, so
   *  the drag clone's inline coordinates must be divided by it (visual → local), same as `BoardMenu`.
   *  Hit-testing stays in visual px (unconverted). */
  uiScale?: number;
  onClose: () => void;
}) {
  // See DeckEditor's/BoardMenu's `px` — convert visual (post-scale) pointer/rect px to local px.
  const px = (v: number) => v / uiScale;
  const [zoomInstance, setZoomInstance] = useState<string | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // Each face wrapper's DOM node, registered by callback ref — hit-tested (visual px) on drop.
  const faceEls = useRef(new Map<string, HTMLElement>());

  const card = CARDS[cardId];
  // Derived from props every render, never snapshotted into state: a buy-tier appends a copy and an
  // attach mutates one, both arriving as a fresh `collection` prop, so the panel updates live.
  // Ordered by ascending instance id so the "1/2, 2/2" numbering is stable and matches the
  // deck banner's stickered break-out order (ids are stringified sequential integers).
  const instances = instancesOf(collection, cardId).sort((a, b) => Number(a.id) - Number(b.id));
  const zoomed = instances.find((i) => i.id === zoomInstance);

  const influence = shop?.influence ?? 0;
  // nextTier keys off the current copy count (== instances.length); null once at ×8.
  const upgrade = shop ? nextTier(instances.length) : null;
  // Only stickers that apply to *this* card are draggable at all (Irrigation hidden on a non-food
  // building, etc.) — each still re-gated per copy by `isValidTarget`.
  const stickerDefs = shop ? Object.values(STICKERS).filter((s) => stickerAppliesTo(s, card)) : [];
  // A card with every copy already full can't take another sticker of any kind — used to dim badges.
  const anyRoom = stickerableInstancesOf(collection, cardId).length > 0;

  // Keep a ref in lockstep with drag state so the window pointer listeners read fresh values.
  function setDrag(d: DragState | null) {
    dragRef.current = d;
    setDragState(d);
  }

  /** Whether `sticker` may be dropped on `inst` right now — the single predicate driving BOTH the
   *  during-drag highlight AND the drop commit, so they can never disagree. The sticker already
   *  applies to the card (tray filter), so this only re-checks per-copy room + affordability.
   *  `buySticker` re-checks server-side, so this is the gate, not the only backstop. */
  function isValidTarget(inst: MetaCardInstance, sticker: StickerDef): boolean {
    return !isStickerFull(inst) && influence >= sticker.cost;
  }

  function onBadgePointerDown(e: React.PointerEvent<HTMLElement>, stickerId: string) {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({
      stickerId,
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

  /** Resolve a finished drag: a plain click (never crossed the threshold) is inert. A real drag
   *  commits only when released over a *valid* face (hit-test raw clientX/Y against each face's
   *  rect, then re-check `isValidTarget`). Anything else no-ops (the clone just disappears). */
  function finishDrag(d: DragState, releaseX: number, releaseY: number) {
    if (d.active) {
      const sticker = STICKERS[d.stickerId];
      for (const inst of instances) {
        const el = faceEls.current.get(inst.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const over = releaseX >= r.left && releaseX <= r.right && releaseY >= r.top && releaseY <= r.bottom;
        if (over && sticker && isValidTarget(inst, sticker)) {
          shop?.onAttachSticker(inst.id, d.stickerId);
          break;
        }
      }
    }
    setDrag(null);
  }

  // While a drag is live, track the pointer on the window so it follows even past the badge.
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
      finishDrag(d, e.clientX, e.clientY);
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

  // The sticker currently being dragged (for the highlight predicate + the clone), null when idle.
  const dragSticker = drag?.active ? STICKERS[drag.stickerId] : undefined;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
        <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div className={styles.body}>
            <div className={styles.cardGrid}>
              {instances.map((inst, i) => {
                const usedIn = decksContaining(inst.id, decks).map((d) => d.name);
                const highlight = dragSticker ? isValidTarget(inst, dragSticker) : false;
                return (
                  <div
                    key={inst.id}
                    ref={(el) => {
                      if (el) faceEls.current.set(inst.id, el);
                      else faceEls.current.delete(inst.id);
                    }}
                    className={`${styles.faceWrap}${highlight ? ` ${styles.faceWrapValid}` : ''}`}
                  >
                    <CardFace
                      card={effectiveCard(card, inst)}
                      stickerBadge={inst.stickers}
                      onClick={() => setZoomInstance(inst.id)}
                    />
                    <span className={styles.faceCaption}>
                      {i + 1}/{instances.length} ·{' '}
                      {/* List names up to 2 decks; beyond that just count them, so a copy in many
                          decks doesn't blow the caption out to several lines. */}
                      {usedIn.length === 0
                        ? 'unused'
                        : usedIn.length > 2
                          ? `in ${usedIn.length} decks`
                          : `in ${usedIn.join(', ')}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {shop && (
              <aside className={styles.tray}>
                <div className={styles.trayHead}>
                  <span className={styles.balance}>
                    <span aria-hidden="true">⭐</span>
                    {influence} to spend
                  </span>
                  {upgrade ? (
                    <button
                      type="button"
                      className={styles.buyBtn}
                      disabled={influence < upgrade.cost}
                      onClick={() => shop.onBuyTier(cardId)}
                      title={
                        influence < upgrade.cost
                          ? 'Not enough Influence'
                          : `Buy a copy tier — ×${upgrade.to} for ${upgrade.cost} Influence`
                      }
                    >
                      <span aria-hidden="true">⭐</span>
                      {upgrade.cost} → ×{upgrade.to} copies
                    </button>
                  ) : (
                    <span className={styles.maxTier}>Max copies (×{instances.length})</span>
                  )}
                </div>

                <h4 className={styles.trayTitle}>Stickers</h4>
                {stickerDefs.length === 0 ? (
                  <p className={styles.trayEmpty}>No stickers for this card.</p>
                ) : (
                  <div className={styles.trayChips}>
                    {stickerDefs.map((s) => {
                      // Draggable only when it could actually land somewhere: affordable AND some copy
                      // still has room. A badge that can't drop anywhere is dimmed and inert.
                      const canDrag = influence >= s.cost && anyRoom;
                      return (
                        <div
                          key={s.id}
                          className={`${styles.chip}${canDrag ? '' : ` ${styles.chipDisabled}`}`}
                          title={
                            canDrag
                              ? `${s.name} — ${s.description}. Drag onto a copy (${s.cost} Influence).`
                              : !anyRoom
                                ? `${s.name} — every copy already carries the maximum stickers.`
                                : `${s.name} — ${s.description}. Not enough Influence (${s.cost}).`
                          }
                        >
                          <div className={styles.chipTop}>
                            {/* The sticker itself — the draggable, styled like the on-card badge (same
                                tokens) but larger, so the player recognizes it as the very thing that
                                lands on the card. Only this element starts a drag. */}
                            <span
                              className={styles.stickerDraggable}
                              aria-hidden="true"
                              onPointerDown={canDrag ? (e) => onBadgePointerDown(e, s.id) : undefined}
                            >
                              {s.icon}
                            </span>
                            <span className={styles.chipName}>{s.name}</span>
                          </div>
                          <div className={styles.chipBottom}>
                            <span className={styles.chipEffect}>{s.description}</span>
                            <span className={styles.chipCost}>
                              <span aria-hidden="true">⭐</span>
                              {s.cost}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* The sticker clone following the cursor while it's dragged onto a face — the same round badge
          (bigger than the on-card one) picked up from the tray. Its layer sits above the modal
          backdrop (z-index 75), unlike BoardMenu's non-modal 60, so it renders over the panel. */}
      {drag?.active && dragSticker && (
        <div className={styles.dragLayer} aria-hidden="true">
          <div
            className={styles.dragClone}
            style={{ left: px(drag.x - drag.grabX), top: px(drag.y - drag.grabY), width: px(drag.w), height: px(drag.h) }}
          >
            {dragSticker.icon}
          </div>
        </div>
      )}

      <CardZoomOverlay
        cardId={zoomInstance ? cardId : null}
        overrideCard={zoomed ? effectiveCard(card, zoomed) : undefined}
        stickerBadge={zoomed?.stickers}
        onClose={() => setZoomInstance(null)}
      />
    </>
  );
}
