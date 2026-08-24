import { useEffect, useRef, useState } from 'react';
import { BOARDS, type BoardId } from '../content/boards';
import { BOARD_STICKERS, BOARD_STICKER_SCOPE, type BoardStickerDef } from '../content/boardStickers';
import { canAttachBoardSticker, unlockedBoardStickerDefs, MAX_BOARD_STICKERS, type BoardStickers } from '../rules/boardStickers';
import { boardUpgradeAvailable } from '../rules/upgrades';
import { BoardMini } from '../components/BoardMini';
import { BoardZoomOverlay } from '../components/BoardZoomOverlay';
import { StickerSeal, StickerSealMark } from '../components/StickerSeal';
import { availableBoardIds } from './boardDisplay';
import styles from './BoardMenu.module.css';

/** Pointer travel (px) before a press becomes a drag rather than a click — same threshold the
 *  deck editor / run loop use for their click-vs-drag split. Here a plain click is inert (a seal
 *  has no target board), so only a drag past this threshold onto a valid board ever commits. */
const DRAG_THRESHOLD = 6;

/** A board sticker being dragged from the tray onto a mini-board. */
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
 * The Board screen: spend Influence (⭐) on permanent board stickers — modifiers that tweak a
 * board's *starting* profile (`rules/boardStickers.ts`), attached per board on the store's
 * `boardStickers`. A board is singular (no per-copy identity), so — unlike a card sticker — the buy
 * attaches directly, no instance picker. Each board renders as a `BoardMini`; the available
 * stickers sit in a right-side **tray** pinned beside the boards, one `StickerSeal` apiece. The wax
 * seal *is* the draggable: dragging it onto a board buys+attaches it in one gesture (mirroring the
 * card sticker tray) — a hand-rolled pointer-drag like `DeckEditor.tsx` (no DnD library). During a
 * drag only the *valid* target boards for that sticker highlight; an invalid/missed drop no-ops (the
 * clone just disappears).
 *
 * Clicking a board enlarges it (`BoardZoomOverlay`) — a tile shows a pre-built structure as an emoji
 * in a slot, so the enlargement is the only place that card can actually be read.
 *
 * This is also the only screen where an *attached* sticker can be destroyed: clicking a badge on a
 * board opens a confirm, and accepting frees the slot for nothing back. The gesture is a plain click
 * rather than the inverse of the attach drag because the confirm — where the no-refund cost is made
 * legible — sits badly on a drag release, and an accidental drag would burn the Influence silently.
 */
export function BoardMenu({
  boardStickers,
  influence,
  unlockedBoardStickers,
  unlockedBoards,
  uiScale,
  onBuyBoardSticker,
  onRemoveBoardSticker,
}: {
  /** Board stickers attached per board — shows each board's effective profile and gates which
   *  boards a dragged seal may drop onto (a board already at the per-board cap is not a valid
   *  target). */
  boardStickers: BoardStickers;
  influence: number;
  /** Unlocked board stickers (`rules/rewards.ts`) — the tray offers only these; a locked board
   *  sticker is hidden entirely (hidden-until-unlocked). */
  unlockedBoardStickers: Record<string, true>;
  /** Unlocked boards (`rules/rewards.ts`) — the grid shows only the available boards (starting +
   *  unlocked, via `availableBoardIds`); a locked board is hidden entirely. */
  unlockedBoards: Record<string, true>;
  /** Whole-UI scale from settings — the tray/board menu renders inside App.tsx's transform:scale()
   *  wrapper, so the drag clone's inline coordinates must be divided by it (visual → local), same
   *  as `DeckEditor.tsx`. Hit-testing stays in visual px (unconverted). */
  uiScale: number;
  /** Attach a board sticker to a board — spends Influence and mutates the store's
   *  `boardStickers` (`App.tsx`'s `buyBoardStickerAt`). A board is singular, so this attaches
   *  directly, no per-instance picker. Returns void, so the drop can't learn success/failure after
   *  the fact — `isValidTarget` is the pre-drop gate (and `buyBoardSticker` is the rule backstop). */
  onBuyBoardSticker: (boardId: BoardId, stickerId: string) => void;
  /** Destroy the board sticker at `index` on `boardId` (`App.tsx`'s `removeBoardStickerAt`). Refunds
   *  nothing — the Influence is burned, which is the whole reason this screen confirms first. Keyed
   *  by position, not sticker id: a board may hold the same sticker twice. */
  onRemoveBoardSticker: (boardId: BoardId, index: number) => void;
}) {
  // See DeckEditor's `px` — convert visual (post-scale) pointer/rect px to local px for the clone.
  const px = (v: number) => v / uiScale;
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // The removal a player has clicked but not yet confirmed — the destroy is irreversible and unpaid,
  // so it never fires straight off the click.
  const [pendingRemoval, setPendingRemoval] = useState<{ boardId: BoardId; index: number } | null>(null);
  // The board whose enlargement is open — the only way to read what a board stands pre-built.
  const [zoomBoard, setZoomBoard] = useState<BoardId | null>(null);
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
    return canAttachBoardSticker(boardStickers, influence, boardId, sticker);
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

  /** Resolve a finished drag: a plain click (never crossed the threshold) is inert — a seal has no
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

  // The dragged seal's sticker (for the highlight predicate + the clone), null when idle.
  const dragSticker = drag?.active ? BOARD_STICKERS[drag.stickerId] : undefined;

  // The sticker a pending removal would destroy — resolved for the confirm's copy. An id that no
  // longer resolves (or a board whose stickers changed underneath) leaves the confirm closed.
  const pendingSticker = pendingRemoval
    ? BOARD_STICKERS[(boardStickers[pendingRemoval.boardId] ?? [])[pendingRemoval.index]]
    : undefined;

  function boardTile(boardId: BoardId) {
    const attached = boardStickers[boardId] ?? [];
    // Highlight only valid targets for the seal currently being dragged.
    const highlight = dragSticker ? isValidTarget(boardId, dragSticker) : false;
    // At-a-glance hint: this board can still take an affordable, under-cap sticker (idle only —
    // during a drag the highlight carries the same information, per-sticker). Rendered as gold open
    // slots in the board's sticker row (its remaining capacity) rather than a corner dot.
    const hint = !dragSticker && boardUpgradeAvailable(boardStickers, influence, boardId, unlockedBoardStickers);
    return (
      <div
        key={boardId}
        ref={(el) => {
          if (el) boardEls.current.set(boardId, el);
          else boardEls.current.delete(boardId);
        }}
        className={`${styles.boardTile}${highlight ? ` ${styles.boardTileValid}` : ''}`}
        // A drop that ends a seal drag never reaches here: the click lands on the nearest common
        // ancestor of the press and the release, and the press was on the tray's seal.
        onClick={() => setZoomBoard(boardId)}
        title="Click to inspect this board"
      >
        <BoardMini
          boardId={boardId}
          stickerIds={attached}
          openSlots={hint ? MAX_BOARD_STICKERS - attached.length : 0}
          // Suppressed mid-drag (like `hint`): while a seal is in the air the tile's message is
          // "droppable target", and a ✕ under the cursor would contradict it.
          onRemoveSticker={dragSticker ? undefined : (index) => setPendingRemoval({ boardId, index })}
        />
      </div>
    );
  }

  return (
    <>
      <div className={styles.boardMenu}>
        <h1 className={styles.title}>Board</h1>

        <div className={styles.layout}>
          <div className={styles.boardGrid}>{availableBoardIds(unlockedBoards).map(boardTile)}</div>

          <aside className={styles.tray}>
            <h2 className={styles.trayTitle}>Stickers</h2>
            <div className={styles.trayStickers}>
              {unlockedBoardStickerDefs(unlockedBoardStickers).map((s) => {
                // Affordable for at least one board? A seal too expensive everywhere is dimmed.
                const affordable = influence >= s.cost;
                return (
                  <StickerSeal
                    key={s.id}
                    scale="inline"
                    icon={s.icon}
                    name={s.name}
                    gives={s.gives}
                    appliesToLabel={BOARD_STICKER_SCOPE}
                    price={s.cost}
                    disabled={!affordable}
                    onSealPointerDown={affordable ? (e) => onSealPointerDown(e, s.id) : undefined}
                    // The bargain and the price are already drawn; the tooltip only carries what
                    // isn't — the gesture, or the reason there isn't one.
                    title={
                      affordable ? 'Drag the seal onto a board to buy and attach it.' : 'Not enough Influence.'
                    }
                  />
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* The destroy confirm. Its three facts — destroyed, not refunded, full price to re-apply —
          are the only place the cost of removal is stated, so none of them is optional. */}
      {pendingRemoval && pendingSticker && (
        <div className={styles.confirmLayer} onClick={() => setPendingRemoval(null)}>
          <div className={styles.confirmPanel} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>
              Remove {pendingSticker.name} from {BOARDS[pendingRemoval.boardId]?.name}?
            </h3>
            <p className={styles.confirmText}>
              This destroys the sticker and frees its slot. The {pendingSticker.cost} ⭐ you spent is not
              refunded, and putting another {pendingSticker.name} on a board later costs the full{' '}
              {pendingSticker.cost} ⭐ again.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmDangerBtn}
                onClick={() => {
                  onRemoveBoardSticker(pendingRemoval.boardId, pendingRemoval.index);
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

      <BoardZoomOverlay
        boardId={zoomBoard}
        stickerIds={zoomBoard ? boardStickers[zoomBoard] : undefined}
        onClose={() => setZoomBoard(null)}
      />

      {/* The wax seal itself, lifted off its tray widget and following the cursor. */}
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
    </>
  );
}
