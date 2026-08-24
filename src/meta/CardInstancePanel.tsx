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
import { effectiveCard, stickerAppliesTo, unlockedStickerDefs } from '../rules/stickers';
import { CardFace } from '../components/CardFace';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import { StickerSeal, StickerSealMark } from '../components/StickerSeal';
import styles from './CardInstancePanel.module.css';

/** Pointer travel (px) before a press on a tray seal becomes a drag rather than a click — the same
 *  threshold the deck editor / board menu / run loop use. A plain click on a seal is inert (a seal
 *  has no default target copy), so only a real drag past this threshold onto a valid face commits. */
const DRAG_THRESHOLD = 6;

/** A tray sticker being dragged onto one owned card face. Mirrors `BoardMenu`'s `DragState` (which
 *  drags a board sticker onto a board) — here the drop target is a card copy. */
interface DragState {
  stickerId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Offset from the seal's top-left to the grab point, so the clone tracks the cursor. */
  grabX: number;
  grabY: number;
  /** The grabbed seal's diameter, so the clone comes out the size it was lifted at. */
  size: number;
  /** Becomes true once the pointer moves past the click/drag threshold. */
  active: boolean;
}

/**
 * The per-card detail view opened from Collection — and that card's *buy/attach* surface (the fused
 * Shop). Each owned copy renders as a real `CardFace` (its sticker-adjusted `effectiveCard` numbers +
 * bottom-left sticker badge); the applicable stickers sit in a right-side tray as `StickerSeal`s, the
 * buy-next-copy-tier button pinned at its top. Dragging a seal out of the tray onto a card face buys
 * and attaches it in one gesture: a hand-rolled pointer-drag (like `DeckEditor.tsx` / `BoardMenu.tsx`,
 * no DnD library) with a single `isValidTarget` predicate gating both the mid-drag highlight and the
 * drop; an invalid/missed drop no-ops.
 *
 * Each face carries a caption naming the deck(s) that copy sits in ("1/2 · in Aggro" / "1/2 · unused"),
 * the anti-surprise core: a sticker always lands on — and is destroyed from — a *known* copy.
 *
 * This is also the only screen where an *attached* card sticker can be destroyed (the card counterpart
 * to `BoardMenu`'s board stickers): clicking a badge on a copy opens a confirm, and accepting frees the
 * slot for nothing back. The gesture is a plain click rather than the inverse of the attach drag because
 * the confirm — where the no-refund cost is made legible — sits badly on a drag release, and an
 * accidental drag would burn the Influence silently.
 *
 * Clicking a face (not its badge, and not dragging onto it) zooms it. Without the `shop` bundle the
 * panel is read-only browse — faces + zoom, no tray, inert badges.
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
   *  a copy-tier buy button, and one draggable seal per sticker that `stickerAppliesTo` this card.
   *  Omitted → read-only browse (faces + click-to-zoom, no tray). */
  shop?: {
    influence: number;
    /** Unlocked card stickers — the tray offers only these (a locked sticker is hidden entirely). */
    unlockedStickers: Record<string, true>;
    onBuyTier: (cardId: string) => void;
    onAttachSticker: (instanceId: string, stickerId: string) => void;
    /** Destroy the sticker at `index` on one owned copy (`App.tsx`'s `detachSticker`). Refunds
     *  nothing — the Influence is burned, which is the whole reason this panel confirms first. Keyed
     *  by position, not sticker id: a copy may carry the same sticker twice. */
    onRemoveSticker: (instanceId: string, index: number) => void;
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
  // The removal a player has clicked but not yet confirmed — the destroy is irreversible and unpaid,
  // so it never fires straight off the click.
  const [pendingRemoval, setPendingRemoval] = useState<{ instanceId: string; index: number } | null>(null);
  // Each face wrapper's DOM node, registered by callback ref — hit-tested (visual px) on drop.
  const faceEls = useRef(new Map<string, HTMLElement>());

  const card = CARDS[cardId];
  // Derived from props every render, never snapshotted into state: a buy-tier appends a copy and an
  // attach mutates one, both arriving as a fresh `collection` prop, so the panel updates live.
  // Ordered by ascending instance id (stringified sequential integers) so the "1/2, 2/2" numbering
  // stays put as copies are bought and stickered.
  const instances = instancesOf(collection, cardId).sort((a, b) => Number(a.id) - Number(b.id));
  const zoomed = instances.find((i) => i.id === zoomInstance);

  const influence = shop?.influence ?? 0;
  const isWonder = card.kind === 'wonder';
  // nextTier keys off the current copy count (== instances.length); null once at the terminal tier. A
  // wonder is unique — copies can never be bought (mirrors `shop.ts`'s reject), so it never offers one.
  const upgrade = shop && !isWonder ? nextTier(cardId, instances.length) : null;
  // Only stickers that apply to *this* card are draggable at all (Irrigation hidden on a non-food
  // building, etc.) — each still re-gated per copy by `isValidTarget`.
  const stickerDefs = shop ? unlockedStickerDefs(shop.unlockedStickers).filter((s) => stickerAppliesTo(s, card)) : [];
  // A card with every copy already full can't take another sticker of any kind.
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

  function onSealPointerDown(e: React.PointerEvent<HTMLElement>, stickerId: string) {
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
      size: r.width,
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

  // While a drag is live, track the pointer on the window so it follows even past the seal.
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

  // The copy a pending removal targets and the sticker it would destroy — resolved for the confirm's
  // copy. An instance/sticker that no longer resolves (the collection changed underneath) leaves the
  // confirm closed.
  const pendingCopy = pendingRemoval ? instances.findIndex((i) => i.id === pendingRemoval.instanceId) : -1;
  const pendingSticker =
    pendingRemoval && pendingCopy >= 0
      ? STICKERS[(instances[pendingCopy].stickers ?? [])[pendingRemoval.index]]
      : undefined;

  // A wonder can't be upgraded at all — it's unique (one copy, never bought) and takes no stickers —
  // so its detail popup drops the whole face-grid + tray and just shows the single card with its deck
  // usage under a one-line note. (The drag machinery above stays inert; no seal can ever be dragged.)
  if (isWonder) {
    const inst = instances[0];
    const usedIn = inst ? decksContaining(inst.id, decks).map((d) => d.name) : [];
    return (
      <>
        <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
          <div className={`${styles.panel} ${styles.wonderPanel}`} onClick={(e) => e.stopPropagation()}>
            <p className={styles.wonderNote}>Wonders are unique — they can't be upgraded with copies or stickers.</p>
            {inst && (
              <div className={styles.faceWrap}>
                <CardFace card={card} onClick={() => setZoomInstance(inst.id)} />
                <span className={styles.faceCaption}>
                  {usedIn.length === 0
                    ? 'unused'
                    : usedIn.length > 2
                      ? `in ${usedIn.length} decks`
                      : `in ${usedIn.join(', ')}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <CardZoomOverlay cardId={zoomInstance ? cardId : null} onClose={() => setZoomInstance(null)} />
      </>
    );
  }

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
                      // Removal is the shop surface's affordance, so a read-only browse shows inert
                      // badges. Suppressed mid-drag (like the tray's own gating): while a seal is in
                      // the air this face's message is "droppable target", and a ✕ under the cursor
                      // would contradict it.
                      onRemoveSticker={
                        shop && !dragSticker ? (index) => setPendingRemoval({ instanceId: inst.id, index }) : undefined
                      }
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
                    <span className={styles.maxTier}>
                      {isWonder ? 'Unique — one per deck' : `Max copies (×${instances.length})`}
                    </span>
                  )}
                </div>

                <h4 className={styles.trayTitle}>Stickers</h4>
                {stickerDefs.length === 0 ? (
                  <p className={styles.trayEmpty}>No stickers for this card.</p>
                ) : (
                  <div className={styles.trayStickers}>
                    {stickerDefs.map((s) => {
                      // Draggable only when it could actually land somewhere: affordable AND some copy
                      // still has room. A seal that can't drop anywhere is dimmed and inert.
                      const canDrag = influence >= s.cost && anyRoom;
                      return (
                        <StickerSeal
                          key={s.id}
                          scale="inline"
                          icon={s.icon}
                          name={s.name}
                          gives={s.gives}
                          charges={s.charges}
                          appliesToLabel={s.appliesToLabel}
                          price={s.cost}
                          disabled={!canDrag}
                          onSealPointerDown={canDrag ? (e) => onSealPointerDown(e, s.id) : undefined}
                          // The bargain and the price are already drawn; the tooltip only carries
                          // what isn't — the gesture, or the reason there isn't one.
                          title={
                            canDrag
                              ? 'Drag the seal onto a copy to buy and attach it.'
                              : !anyRoom
                                ? 'Every copy already carries the maximum stickers.'
                                : 'Not enough Influence.'
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* The destroy confirm. Its three facts — destroyed, not refunded, full price to re-apply —
          are the only place the cost of removal is stated, so none of them is optional. Its layer
          clears the panel's own modal backdrop, like the drag layer below. */}
      {pendingRemoval && pendingSticker && (
        <div className={styles.confirmLayer} onClick={() => setPendingRemoval(null)}>
          <div className={styles.confirmPanel} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>
              Remove {pendingSticker.name} from {card.name} {pendingCopy + 1}/{instances.length}?
            </h3>
            <p className={styles.confirmText}>
              This destroys the sticker and frees its slot on that copy. The {pendingSticker.cost} ⭐ you
              spent is not refunded, and putting another {pendingSticker.name} on a copy later costs the
              full {pendingSticker.cost} ⭐ again.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmDangerBtn}
                onClick={() => {
                  shop?.onRemoveSticker(pendingRemoval.instanceId, pendingRemoval.index);
                  setPendingRemoval(null);
                }}
              >
                Destroy sticker
              </button>
              <button type="button" className={styles.confirmCancelBtn} onClick={() => setPendingRemoval(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The wax seal itself, lifted off its tray widget and following the cursor. Its layer sits
          above the modal backdrop (z-index 75), unlike BoardMenu's non-modal 60, so it renders over
          the panel. */}
      {drag?.active && dragSticker && (
        <div className={styles.dragLayer} aria-hidden="true">
          <StickerSealMark
            className={styles.dragClone}
            icon={dragSticker.icon}
            size={px(drag.size)}
            style={{ left: px(drag.x - drag.grabX), top: px(drag.y - drag.grabY) }}
          />
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
