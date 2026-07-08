import { useEffect, useRef, useState } from 'react';
import { BOARDS, type BoardId } from '../content/boards';
import { BOARD_STICKERS, type BoardStickerDef } from '../content/boardStickers';
import { boardStickerAppliesTo, isBoardStickerFull, type BoardStickers } from '../rules/boardStickers';
import { BoardMini } from '../components/BoardMini';
import { BOARD_IDS } from './boardDisplay';
import styles from './BoardMenu.module.css';

/** Pointer travel (px) before a press becomes a drag rather than a click — same threshold the
 *  deck editor / run loop use for their click-vs-drag split. Here a plain click is inert (a chip
 *  has no target board), so only a drag past this threshold onto a valid board ever commits. */
const DRAG_THRESHOLD = 6;

/** A board sticker chip being dragged from the tray onto a mini-board. */
interface DragState {
  stickerId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Offset from the chip's top-left to the grab point, so the clone tracks the cursor. */
  grabX: number;
  grabY: number;
  w: number;
  h: number;
  /** Becomes true once the pointer moves past the click/drag threshold. */
  active: boolean;
}

/**
 * The Board screen: spend Influence (⭐) on permanent board stickers — modifiers that tweak a
 * board's *starting* profile (`rules/boardStickers.ts`), attached per board on the store's
 * `boardStickers`. A board is singular (no per-copy identity), so — unlike a card sticker — the buy
 * attaches directly, no instance picker. Each board renders as a `BoardMini` (Step 9.3.2's
 * mini-board); the available stickers sit in a right-side **tray** pinned beside the boards, each a
 * box (a sticker badge + name on top, effect + price below). The badge is styled like the on-board
 * sticker but larger, and *it* is the draggable: dragging it onto a board buys+attaches it in one
 * gesture (mirroring the card sticker tray) — a hand-rolled pointer-drag like `DeckEditor.tsx` (no
 * DnD library). During a drag only the *valid* target boards for that sticker highlight; an
 * invalid/missed drop no-ops (the clone just disappears).
 */
export function BoardMenu({
  boardStickers,
  influence,
  uiScale,
  onBuyBoardSticker,
}: {
  /** Board stickers attached per board — shows each board's effective profile and gates which
   *  boards a dragged chip may drop onto (a board already at the per-board cap is not a valid
   *  target). */
  boardStickers: BoardStickers;
  influence: number;
  /** Whole-UI scale from settings — the tray/board menu renders inside App.tsx's transform:scale()
   *  wrapper, so the drag clone's inline coordinates must be divided by it (visual → local), same
   *  as `DeckEditor.tsx`. Hit-testing stays in visual px (unconverted). */
  uiScale: number;
  /** Attach a board sticker to a board — spends Influence and mutates the store's
   *  `boardStickers` (`App.tsx`'s `buyBoardStickerAt`). A board is singular, so this attaches
   *  directly, no per-instance picker. Returns void, so the drop can't learn success/failure after
   *  the fact — `isValidTarget` is the pre-drop gate (and `buyBoardSticker` is the rule backstop). */
  onBuyBoardSticker: (boardId: BoardId, stickerId: string) => void;
}) {
  // See DeckEditor's `px` — convert visual (post-scale) pointer/rect px to local px for the clone.
  const px = (v: number) => v / uiScale;
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // Each mini-board wrapper's DOM node, registered by callback ref — hit-tested (visual px) on drop.
  const boardEls = useRef(new Map<BoardId, HTMLElement>());

  // Keep a ref in lockstep with drag state so the window pointer listeners read fresh values —
  // same pattern as DeckEditor's setDrag.
  function setDrag(d: DragState | null) {
    dragRef.current = d;
    setDragState(d);
  }

  /** Whether `sticker` may be dropped on `boardId` right now — the single predicate driving BOTH
   *  the during-drag highlight AND the drop commit, so the two can never disagree. Computed fresh
   *  from props each render. `buyBoardSticker` re-checks this (returns null otherwise), so it's a
   *  backstop, not the gate. */
  function isValidTarget(boardId: BoardId, sticker: BoardStickerDef): boolean {
    const attached = boardStickers[boardId] ?? [];
    return (
      boardStickerAppliesTo(sticker, BOARDS[boardId]) &&
      !isBoardStickerFull(attached) &&
      influence >= sticker.cost
    );
  }

  function onChipPointerDown(e: React.PointerEvent<HTMLElement>, stickerId: string) {
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

  /** Resolve a finished drag: a plain click (never crossed the threshold) is inert — a chip has no
   *  target board, so there's nothing to do. A real drag commits only when released over a *valid*
   *  board (hit-test raw clientX/Y against each wrapper's rect, then re-check `isValidTarget`).
   *  Anything else no-ops (the clone just disappears). */
  function finishDrag(d: DragState, releaseX: number, releaseY: number) {
    if (d.active) {
      const sticker = BOARD_STICKERS[d.stickerId];
      for (const [boardId, el] of boardEls.current) {
        const r = el.getBoundingClientRect();
        const over = releaseX >= r.left && releaseX <= r.right && releaseY >= r.top && releaseY <= r.bottom;
        if (over && sticker && isValidTarget(boardId, sticker)) {
          onBuyBoardSticker(boardId, d.stickerId);
          break;
        }
      }
    }
    setDrag(null);
  }

  // While a drag is live, track the pointer on the window so it follows even past the chip.
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

  // The dragged chip's sticker (for the highlight predicate + the clone), null when idle.
  const dragSticker = drag?.active ? BOARD_STICKERS[drag.stickerId] : undefined;

  function boardTile(boardId: BoardId) {
    const attached = boardStickers[boardId] ?? [];
    // Highlight only valid targets for the chip currently being dragged.
    const highlight = dragSticker ? isValidTarget(boardId, dragSticker) : false;
    return (
      <div
        key={boardId}
        ref={(el) => {
          if (el) boardEls.current.set(boardId, el);
          else boardEls.current.delete(boardId);
        }}
        className={`${styles.boardTile}${highlight ? ` ${styles.boardTileValid}` : ''}`}
      >
        <BoardMini boardId={boardId} stickerIds={attached} />
      </div>
    );
  }

  return (
    <>
      <div className={styles.boardMenu}>
        <h1 className={styles.title}>Board</h1>

        <div className={styles.layout}>
          <div className={styles.boardGrid}>{BOARD_IDS.map(boardTile)}</div>

          <aside className={styles.tray}>
            <h2 className={styles.trayTitle}>Stickers</h2>
            <div className={styles.trayChips}>
              {Object.values(BOARD_STICKERS).map((s) => {
                // Affordable for at least one board? A chip too expensive everywhere is dimmed.
                const affordable = influence >= s.cost;
                return (
                  <div
                    key={s.id}
                    className={`${styles.chip}${affordable ? '' : ` ${styles.chipDisabled}`}`}
                    title={
                      affordable
                        ? `${s.name} — ${s.description}. Drag the sticker onto a board (${s.cost} Influence).`
                        : `${s.name} — ${s.description}. Not enough Influence (${s.cost}).`
                    }
                  >
                    <div className={styles.chipTop}>
                      {/* The sticker itself — the draggable, styled like the on-board badge (same
                          tokens) but larger, so the player recognizes it as the very thing that
                          lands on the board. Only this element starts a drag. */}
                      <span
                        className={styles.stickerDraggable}
                        aria-hidden="true"
                        onPointerDown={affordable ? (e) => onChipPointerDown(e, s.id) : undefined}
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
          </aside>
        </div>
      </div>

      {/* The sticker clone following the cursor while it's dragged onto a board — the same round
          badge (bigger than the on-board one) picked up from the tray. */}
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
    </>
  );
}
