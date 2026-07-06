import { useEffect, useRef, useState } from 'react';
import type { BuildingInstance, CardInstance, Resources, WorkInstance } from '../rules';
import { useGame } from '../run/GameContext';
import {
  cultureProgress,
  freePopulation,
  isOperating,
  projectedDelta,
  requiredWorkersOf,
  unplayableReason,
} from '../rules';
import { CARDS, type CardDef } from '../content/cards';
import { MISSIONS, type MissionDef } from '../content/missions';
import type { GameState } from '../rules';
import { isCompleted } from '../rules/campaign';
import { computeRewards } from '../rules/rewards';
import { isOwned, type OwnedCards } from '../rules/collection';
import { CardFace, COST_ICON, artFor, describeBuilding } from './CardFace';
import { CardZoomOverlay } from './CardZoomOverlay';
import styles from './Board.module.css';

/** A hoverable stat chip: icon + value (+ optional projected delta), with a tooltip. */
function Stat({
  icon,
  label,
  description,
  value,
  delta,
  warn,
  className,
}: {
  icon: string;
  label: string;
  description: string;
  value: string | number;
  delta?: number;
  warn?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`${styles.stat}${warn ? ` ${styles.statWarn}` : ''}${className ? ` ${className}` : ''}`}
      tabIndex={0}
    >
      <span aria-hidden="true">{icon}</span> {value}
      {delta !== undefined && delta !== 0 && (
        <span className={delta > 0 ? styles.deltaPos : delta < 0 ? styles.deltaNeg : styles.deltaZero}>
          {' '}
          ({delta >= 0 ? '+' : ''}
          {delta})
        </span>
      )}
      <span className={styles.tooltip} role="tooltip">
        <strong>{label}</strong> — {description}
      </span>
    </span>
  );
}

/** The population tray: one 🧍 token per population, styled exactly like a building's staffing
 *  toggle (green-tinted when idle and available, dim/grayscale when at work) so the player reads
 *  at a glance that these are the same workers occupying the building boxes below. An idle token
 *  can be picked up and dragged onto a building to staff it (see `onTokenPointerDown`). */
function PopulationTokens({
  population,
  idle,
  onTokenPointerDown,
}: {
  population: number;
  idle: number;
  onTokenPointerDown?: (e: React.PointerEvent) => void;
}) {
  const working = population - idle;
  return (
    <span className={styles.stat} tabIndex={0} aria-label={`Population ${population}, ${idle} idle`}>
      <span className={styles.popTokens}>
        {Array.from({ length: population }, (_, i) => {
          const tokenIdle = i < idle;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`${styles.popToken} ${tokenIdle ? styles.staffFull : styles.staffEmpty}${
                tokenIdle ? ` ${styles.popTokenIdle}` : ''
              }`}
              onPointerDown={tokenIdle ? onTokenPointerDown : undefined}
            >
              🧍
            </span>
          );
        })}
      </span>
      <span className={styles.tooltip} role="tooltip">
        <strong>Population</strong> — Your people — a pool of workers. Each eats 1 food/round
        whether working or idle. Assign them to buildings to operate them.
        <span className={styles.ttRule}>{working} working · {idle} idle</span>
      </span>
    </span>
  );
}

/**
 * Full-width culture gauge beneath the resource bar. A level bubble on the left; a translucent
 * track that fills pink→purple with progress toward the next level (a fainter ghost segment
 * previews the culture this round's upkeep will add).
 */
function CultureBar({ culture, projected }: { culture: number; projected: number }) {
  const { level, current, needed, ratio } = cultureProgress(culture);
  const ghost = needed > 0 ? Math.min(1, (current + Math.max(0, projected)) / needed) : 0;
  return (
    <div className={styles.cultureBar}>
      <span className={styles.cultureLevel} tabIndex={0}>
        <span aria-hidden="true">🎭</span> {level}
        <span className={styles.tooltip} role="tooltip">
          <strong>Culture level {level}</strong> — each level raises your hand size and unlocks cards.
        </span>
      </span>
      <div className={styles.cultureTrack} tabIndex={0}>
        <div className={styles.cultureGhost} style={{ width: `${ghost * 100}%` }} />
        <div className={styles.cultureFill} style={{ width: `${ratio * 100}%` }} />
        <span className={styles.tooltip} role="tooltip">
          {current}/{needed} toward level {level + 1}
        </span>
      </div>
    </div>
  );
}

/** Fixed widget in the top-left corner: shows mission name, live progress, and a tooltip. */
function MissionWidget({ mission, G }: { mission: MissionDef; G: GameState }) {
  return (
    <div className={styles.missionWidget} tabIndex={0}>
      <div className={styles.missionName}>{mission.name}</div>
      <div className={styles.missionProgress}>🎯 {mission.progress(G)}</div>
      <div className={`${styles.tooltip} ${styles.tooltipLeft} ${styles.tooltipWide}`} role="tooltip">
        <strong>{mission.name}</strong>
        <span className={styles.ttBody}>{mission.description}</span>
        <span className={styles.ttRule}>🏆 {mission.victoryHint}</span>
        {mission.failureHint && <span className={styles.ttRule}>💀 {mission.failureHint}</span>}
      </div>
    </div>
  );
}

/** Collapse a list of card instances into one tile per type with a count, keeping first-seen
 *  order — *except* a card with `dynamicText`, which never groups: each copy can carry its own
 *  live value (e.g. two Cornucopia with different play counts), so a shared count would either
 *  hide that or force picking one copy's value to speak for the stack. Each stays its own
 *  single-count entry, keyed by its stable instance id, carrying the instance so the caller can
 *  compute its current `dynamicText`. */
function groupCards(insts: CardInstance[]): { key: number | string; cardId: string; inst: CardInstance; count: number }[] {
  const order: string[] = [];
  const groups = new Map<string, { inst: CardInstance; count: number }>();
  const singles: { key: number; cardId: string; inst: CardInstance; count: number }[] = [];
  for (const inst of insts) {
    if (CARDS[inst.cardId].dynamicText) {
      singles.push({ key: inst.id, cardId: inst.cardId, inst, count: 1 });
      continue;
    }
    const g = groups.get(inst.cardId);
    if (g) g.count += 1;
    else {
      groups.set(inst.cardId, { inst, count: 1 });
      order.push(inst.cardId);
    }
  }
  const grouped = order.map((cardId) => {
    const g = groups.get(cardId)!;
    return { key: cardId, cardId, inst: g.inst, count: g.count };
  });
  return [...grouped, ...singles];
}

/** A pile token flanking the hand (deck / discard / removed). Clickable when `onView` is given. */
function Pile({
  count,
  label,
  variant,
  onView,
}: {
  count: number;
  label: string;
  variant: string;
  onView?: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.pile} ${variant}`}
      onClick={onView}
      disabled={!onView || count === 0}
      title={onView ? `View ${label} (${count})` : `${label}: ${count}`}
    >
      <span className={styles.pileCount}>{count}</span>
      <span className={styles.pileLabel}>{label}</span>
    </button>
  );
}

/** A physical hand card with a UI-stable identity (so playing one doesn't re-animate the rest). */
interface HandCard {
  /** Stable React key across renders, assigned by `useAnimatedHand`. */
  key: number;
  cardId: string;
  /** The underlying run instance — carried so a card's run-aware text (`dynamicText`) can read its
   *  own per-copy state (e.g. Cornucopia's play count). */
  inst: CardInstance;
  /** Index into `G.hand` this render (what the moves API expects). */
  handIdx: number;
  /** True only on the render where the card first appears — drives the deal-in animation. */
  isNew: boolean;
  /** Sequence among newly-dealt cards this render, for staggering the deal. */
  newOrder: number;
}

/**
 * Give each physical hand card a stable React key so drawing one doesn't re-animate the rest.
 * `G.hand` instances *do* carry stable ids now, but we deliberately match the deal animation by
 * cardId (not id): greedily pair the new hand against the previously-seen one by cardId; anything
 * left over is freshly drawn (`isNew`), so a card of a type already in hand doesn't re-deal. Keys
 * are derived purely from the committed mapping (no mutation during render), so it's safe under
 * StrictMode's double-render. The full instance is threaded through for `dynamicText`.
 */
function useAnimatedHand(hand: CardInstance[]): HandCard[] {
  const committedRef = useRef<{ key: number; cardId: string }[]>([]);
  const committed = committedRef.current;
  let nextKey = committed.reduce((m, c) => Math.max(m, c.key), 0) + 1;
  let newOrder = 0;
  const used = new Array(committed.length).fill(false);

  const display: HandCard[] = hand.map((inst, handIdx) => {
    for (let j = 0; j < committed.length; j++) {
      if (!used[j] && committed[j].cardId === inst.cardId) {
        used[j] = true;
        return { key: committed[j].key, cardId: inst.cardId, inst, handIdx, isNew: false, newOrder: 0 };
      }
    }
    return { key: nextKey++, cardId: inst.cardId, inst, handIdx, isNew: true, newOrder: newOrder++ };
  });

  // Commit after render so the next render sees these keys and stops flagging them as new.
  useEffect(() => {
    committedRef.current = display.map((d) => ({ key: d.key, cardId: d.cardId }));
  });

  return display;
}

/** The visual face of one building box — shared by the slot grid and the drag clone. Each box is
 *  a single `BuildingInstance`; same-type buildings are never coalesced, so its stable `id` keys
 *  its slot and drives per-instance staffing/demolish. */
function BuildingBox({
  inst,
  gameover,
  idle,
  dragging,
  workerDragSource,
  pendingDestroy,
  onPointerDown,
  onStaffPointerDown,
  onDestroy,
  onZoomClick,
}: {
  inst: BuildingInstance;
  gameover: boolean;
  idle: number;
  dragging?: boolean;
  /** True while this building's own worker is being dragged out of it (fades the toggle). */
  workerDragSource?: boolean;
  pendingDestroy?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onStaffPointerDown?: (e: React.PointerEvent, inst: BuildingInstance) => void;
  onDestroy?: () => void;
  /** Gameover inspect mode only — normal-mode zoom is handled by the slot-drag click/drag split
   *  instead, since `onPointerDown` never fires there (view-only board). */
  onZoomClick?: () => void;
}) {
  const bld = CARDS[inst.cardId];
  const req = requiredWorkersOf(inst);
  const selfSufficient = req === 0;
  const staffed = isOperating(inst);
  const className = [
    styles.buildingBox,
    staffed ? styles.operating : styles.idleBuilding,
    dragging ? styles.boxDragging : '',
    pendingDestroy ? styles.demolishTarget : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={className}
      onPointerDown={onPointerDown}
      onClick={pendingDestroy ? onDestroy : onZoomClick}
      role={pendingDestroy ? 'button' : undefined}
      aria-label={pendingDestroy ? `demolish ${bld.name}` : undefined}
    >
      {!pendingDestroy && !selfSufficient && (
        <button
          type="button"
          className={`${styles.staffToggle} ${staffed ? styles.staffFull : styles.staffEmpty}${
            workerDragSource ? ` ${styles.staffDragSource}` : ''
          }`}
          onPointerDown={(e) => { e.stopPropagation(); onStaffPointerDown?.(e, inst); }}
          // Only disable when there's nothing to do: no worker to reclaim AND not enough idle to
          // staff. Gating on `inst.workers === 0` (not `!staffed`) keeps a partially-staffed
          // building interactive so its worker can always be pulled back off.
          disabled={gameover || (inst.workers === 0 && idle < req)}
          aria-pressed={staffed}
          aria-label={staffed ? `unstaff ${bld.name}` : `staff ${bld.name}`}
        >
          <span aria-hidden="true">🧍</span>
        </button>
      )}
      <div className={styles.bldBody}>
        <span className={styles.bName}>{bld.name}</span>
        <div className={styles.bldFace} aria-label={describeBuilding(bld)}>
          <span className={styles.bldIcon} aria-hidden="true">{artFor(bld.id)}</span>
          <span className={styles.bldOutput} aria-hidden="true">
            {[
              ...Object.entries(bld.produces ?? {})
                .filter(([, v]) => v)
                .map(([k, v]) => `+${v}${COST_ICON[k as keyof Resources]}`),
              ...(bld.cultureOutput ? [`+${bld.cultureOutput}🎭`] : []),
            ].join(' ')}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The visual face of one Work box in the work strip — a Work card played this turn. Staffable
 *  exactly like a building (it shares the worker moves and the same staffing controls), but it's
 *  transient (files to the discard at end of turn) and lives outside the territory slot grid, so
 *  its own `boxRef` feeds a separate hit-test map for worker drops. */
function WorkBox({
  inst,
  gameover,
  idle,
  workerDragSource,
  dropTarget,
  boxRef,
  onStaffPointerDown,
}: {
  inst: WorkInstance;
  gameover: boolean;
  idle: number;
  /** True while this box's own worker is being dragged out of it (fades the toggle). */
  workerDragSource?: boolean;
  /** True while a dragged worker hovers this box and it can accept one (highlights the box). */
  dropTarget?: boolean;
  boxRef?: (el: HTMLDivElement | null) => void;
  onStaffPointerDown?: (e: React.PointerEvent, inst: WorkInstance) => void;
}) {
  const card = CARDS[inst.cardId];
  const req = requiredWorkersOf(inst);
  const selfSufficient = req === 0;
  const staffed = isOperating(inst);
  const className = [
    styles.buildingBox,
    styles.workBox,
    staffed ? styles.operating : styles.idleBuilding,
    dropTarget ? styles.workerDropTarget : '',
  ]
    .filter(Boolean)
    .join(' ');
  const gain = Object.entries(card.effect?.gain ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `+${v}${COST_ICON[k as keyof Resources]}`)
    .join(' ');
  return (
    <div className={className} ref={boxRef}>
      {!selfSufficient && (
        <button
          type="button"
          className={`${styles.staffToggle} ${staffed ? styles.staffFull : styles.staffEmpty}${
            workerDragSource ? ` ${styles.staffDragSource}` : ''
          }`}
          onPointerDown={(e) => { e.stopPropagation(); onStaffPointerDown?.(e, inst); }}
          disabled={gameover || (inst.workers === 0 && idle < req)}
          aria-pressed={staffed}
          aria-label={staffed ? `unstaff ${card.name}` : `staff ${card.name}`}
        >
          <span aria-hidden="true">🧍</span>
        </button>
      )}
      <div className={styles.bldBody}>
        <span className={styles.bName}>{card.name}</span>
        <div className={styles.bldFace}>
          <span className={styles.bldIcon} aria-hidden="true">{artFor(inst.cardId)}</span>
          <span className={styles.bldOutput} aria-hidden="true">{gain}</span>
        </div>
      </div>
    </div>
  );
}

/** A card play awaiting its discard cost: which card, and the sacrifices picked so far. */
interface PendingPlay {
  cardId: string;
  handIdx: number;
  /** Stable key of the card being played, so we can find its element for the play animation. */
  playedKey: number;
  need: number;
  discards: number[]; // hand indices marked to discard
}

/** A destroy card play awaiting a building target selection. */
interface PendingDestroy {
  cardId: string;
  handIdx: number;
  playedKey: number;
}

type Rect = { left: number; top: number; width: number; height: number };

/** A transient clone that animates a card leaving the hand: 'play' flies up, 'drop' absorbs. */
interface Ghost {
  id: number;
  cardId: string;
  rect: Rect;
  anim: 'play' | 'drop';
  /** A dynamic card's live current-value text, captured at spawn time (before its resolver runs
   *  and bumps its counter) so the flying clone shows the same value the hand card just did. */
  overrideText?: string;
}

/** A card being dragged from the hand toward the board. */
interface DragState {
  key: number;
  cardId: string;
  handIdx: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Offset from the card's top-left to the grab point, so the clone tracks the cursor. */
  grabX: number;
  grabY: number;
  w: number;
  h: number;
  /** Becomes true once the pointer moves past the click/drag threshold. */
  active: boolean;
}

/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 6;

/** A building box being dragged from its slot toward another slot. */
interface SlotDrag {
  /** Stable id of the building instance being dragged. */
  id: number;
  /** Slot index the drag started from. */
  fromSlot: number;
  pointerId: number;
  /** Offset from the box's top-left to the grab point, so the clone tracks the cursor. */
  grabX: number;
  grabY: number;
  /** Box size, so the floating clone matches the slot box. */
  w: number;
  h: number;
  startX: number;
  startY: number;
  /** Live pointer position. */
  x: number;
  y: number;
  /** Becomes true once the pointer moves past the drag threshold (else it's a plain click). */
  active: boolean;
}

/** A worker token being dragged: either an idle token from the population tray toward a
 *  building (`fromBuildingId` null), or a staffed worker being pulled out of a building
 *  (`fromBuildingId` set) — which can land back on the tray (unstaff) or on another
 *  building's box (transfer directly via `moves.transferWorker`, one atomic move). */
interface WorkerDrag {
  pointerId: number;
  fromBuildingId: number | null;
  /** Whether there was actually a worker to pull out (only meaningful when dragging from a building). */
  hadWorker: boolean;
  grabX: number;
  grabY: number;
  w: number;
  h: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
}

/**
 * Formats the reason a card cannot be played right now, or null if it's playable.
 * `unplayableReason` (src/rules/playability.ts) is the single source of truth for the
 * gates themselves — shared with `playCard` — this just renders it for the dimming
 * logic, drag gate, and rejection message.
 */
function whyUnplayable(card: CardDef, G: GameState): string | null {
  const reason = unplayableReason(G, card);
  if (!reason) return null;
  switch (reason.kind) {
    case 'cost': {
      const missing = (Object.entries(reason.missing) as [keyof Resources, number][])
        .map(([k, v]) => `${v}${COST_ICON[k]}`);
      return `need ${missing.join(' ')}`;
    }
    case 'cultureLevel':
      return `need 🎭 level ${reason.required}`;
    case 'territory':
      return 'territory full';
    case 'noBuildingsToDestroy':
      return 'no buildings to demolish';
    case 'event':
      return 'resolves at end of round';
  }
}

export function Board({
  confirmEndTurn,
  uiScale,
  onTransition,
  mapProgress,
  collection,
}: {
  confirmEndTurn: boolean;
  uiScale: number;
  /** Wraps a restart/end-run action in the shell's fade-to-black transition (`App.tsx`) —
   *  used by the gameover overlay's own Restart/End Run buttons below. */
  onTransition: (action: () => void) => void;
  /** The player's progress/collection as they stood *entering* this run — read-only here,
   *  used only to preview the gameover overlay's reward line (rules/rewards.ts). The actual
   *  grant happens once, in `App.tsx`'s `recordResult`, off the same pure `computeRewards` —
   *  this is a preview, not a second source of truth. */
  mapProgress: Record<string, true>;
  collection: OwnedCards;
}) {
  const { G, gameover, board, moves, endTurn, undo, canUndo, restart, endRun } = useGame();
  // The whole board renders inside a `transform: scale(uiScale)` wrapper (App.tsx). Pointer
  // coordinates and getBoundingClientRect() are in *visual* (post-scale) px; when written into
  // an inline left/top/width/height on a drag/ghost clone — which lives inside that scaled
  // wrapper — the value would be scaled a second time. Divide by the scale to convert
  // visual → local so the clone lands under the cursor at its true size. (offsetHeight-derived
  // insets stay in layout space and need no conversion; hit-testing compares visual-to-visual.)
  const px = (v: number) => v / uiScale;
  const mission = MISSIONS[G.missionId];
  const [pending, setPending] = useState<PendingPlay | null>(null);
  const [pendingDestroy, setPendingDestroy] = useState<PendingDestroy | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [zoom, setZoom] = useState<{ cardId: string; overrideText?: string } | null>(null);
  const [pileView, setPileView] = useState<{ title: string; cards: CardInstance[] } | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const [shake, setShake] = useState<{ key: number; n: number } | null>(null);
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const [warnEndRound, setWarnEndRound] = useState(false);
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  // Slot layout: which building (by instance id) sits in each territory slot; `null` is empty.
  // Length tracks G.territory. Pure UI state — the core never knows where boxes sit.
  const [layout, setLayout] = useState<(number | null)[]>([]);
  const [slotDrag, setSlotDragState] = useState<SlotDrag | null>(null);
  // Slot the pointer is hovering during a slot-drag (the drop-target highlight).
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [workerDrag, setWorkerDragState] = useState<WorkerDrag | null>(null);
  // Slot the pointer is hovering while dragging an idle worker onto a building.
  const [workerHoverSlot, setWorkerHoverSlot] = useState<number | null>(null);
  // Same, for the work strip (which lives outside the territory slot grid).
  const [workerHoverWorkId, setWorkerHoverWorkId] = useState<number | null>(null);
  // Whether the pointer is over the population tray while dragging a worker out of a building.
  const [workerOverTray, setWorkerOverTray] = useState(false);
  // The canvas is a fixed backdrop; these insets keep its content between the banner and hand bar.
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  const slotDragRef = useRef<SlotDrag | null>(null);
  const workerDragRef = useRef<WorkerDrag | null>(null);
  const layoutRef = useRef<(number | null)[]>([]);
  // Slot index → the slot's DOM element, for pointer hit-testing during drag / build placement.
  const slotEls = useRef<Map<number, HTMLDivElement>>(new Map());
  // Work-box instance id → its DOM element. Work boxes aren't in the slot grid, so worker drops
  // hit-test them separately (see workBoxAt / staffableUnder).
  const workBoxEls = useRef<Map<number, HTMLDivElement>>(new Map());
  // Slot a just-played build card should drop into; consumed by the layout-reconcile effect.
  const pendingBuildSlotRef = useRef<number | null>(null);
  const gameareaRef = useRef<HTMLDivElement>(null);
  const popTrayRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const cardEls = useRef<Map<number, HTMLButtonElement>>(new Map());
  const handBarRef = useRef<HTMLDivElement>(null);
  const ghostSeq = useRef(0);
  const shakeSeq = useRef(0);
  const rejectMsgSeq = useRef(0);
  const hand = useAnimatedHand(G.hand);
  // Each building's stable id keys both its slot in `layout` and this lookup.
  const buildingById = new Map(G.tableau.map((b) => [b.id, b]));
  // Work boxes share the instance-id space with buildings, keyed here for worker-drop resolution.
  const workById = new Map(G.workZone.map((w) => [w.id, w]));

  /** Shake a card that can't be played and briefly show why. */
  function rejectShake(key: number, reason?: string) {
    const n = ++shakeSeq.current;
    setShake({ key, n });
    window.setTimeout(() => setShake((s) => (s && s.n === n ? null : s)), 420);
    if (reason !== undefined) {
      const msgN = ++rejectMsgSeq.current;
      setRejectMsg(reason);
      window.setTimeout(() => {
        if (rejectMsgSeq.current === msgN) setRejectMsg(null);
      }, 2500);
    }
  }

  // Keep a ref in lockstep with drag state so the window pointer listeners read fresh values.
  function setDrag(d: DragState | null) {
    dragRef.current = d;
    setDragState(d);
  }

  // Same lockstep pattern for the slot drag.
  function setSlotDrag(d: SlotDrag | null) {
    slotDragRef.current = d;
    setSlotDragState(d);
  }

  // Same lockstep pattern for a worker being dragged to/from a building.
  function setWorkerDrag(d: WorkerDrag | null) {
    workerDragRef.current = d;
    setWorkerDragState(d);
  }

  /** The slot whose box contains the given viewport point, or null if none. */
  function slotAt(x: number, y: number): number | null {
    for (const [idx, el] of slotEls.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return idx;
    }
    return null;
  }

  /** Whether the given viewport point lands on the population tray. */
  function isOverTray(x: number, y: number): boolean {
    const r = popTrayRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  /** The Work box instance id whose box contains the given viewport point, or null. */
  function workBoxAt(x: number, y: number): number | null {
    for (const [id, el] of workBoxEls.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }

  /** The staffable (building or Work box) whose box contains the given point, or undefined —
   *  unifies the slot-grid and work-strip hit-tests so a worker drop can target either zone. */
  function staffableUnder(x: number, y: number) {
    const slot = slotAt(x, y);
    const key = slot != null ? layout[slot] : null;
    if (key != null) return buildingById.get(key);
    const workId = workBoxAt(x, y);
    return workId != null ? workById.get(workId) : undefined;
  }

  /**
   * Where a build card dropped at (x, y) should place its building: the empty slot under the
   * drop point, else the empty slot nearest to it. (A build is only allowed with free territory,
   * so there is always at least one empty slot.)
   */
  function chooseBuildSlot(x: number, y: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const [idx, el] of slotEls.current) {
      if (layoutRef.current[idx] != null) continue; // occupied
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return idx;
      const dx = x - (r.left + r.right) / 2;
      const dy = y - (r.top + r.bottom) / 2;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    }
    return best;
  }

  /** Begin dragging a building box between slots — unless the press landed on a control. */
  function onBoxPointerDown(e: React.PointerEvent, inst: BuildingInstance, fromSlot: number) {
    if (e.button !== 0) return;
    if (gameover && overlayMinimized) return; // inspect mode — board is view-only
    if (pendingDestroy) return; // in targeting mode a click demolishes, not drags
    if ((e.target as HTMLElement).closest('button')) return; // let staffing/demolish clicks through
    const r = e.currentTarget.getBoundingClientRect();
    setSlotDrag({
      id: inst.id,
      fromSlot,
      pointerId: e.pointerId,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      w: r.width,
      h: r.height,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    });
  }

  /** Begin dragging an idle population token out of the tray toward a building. Idle workers
   *  are interchangeable, so no token identity is tracked — only that one is available. */
  function onPopTokenPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (gameover || pending || pendingDestroy) return;
    const r = e.currentTarget.getBoundingClientRect();
    setWorkerDrag({
      pointerId: e.pointerId,
      fromBuildingId: null,
      hadWorker: false,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      w: r.width,
      h: r.height,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    });
  }

  /** Begin dragging a staffable's worker (a building or a Work box): a plain click still toggles
   *  staffing (handled on release); a real drag released onto the population tray returns one
   *  worker to it. Only `id` and `workers` are read, so it accepts either instance kind. */
  function onStaffPointerDown(e: React.PointerEvent, inst: BuildingInstance | WorkInstance) {
    if (e.button !== 0) return;
    if (gameover) return;
    const btnRect = e.currentTarget.getBoundingClientRect();
    setWorkerDrag({
      pointerId: e.pointerId,
      fromBuildingId: inst.id,
      hadWorker: inst.workers > 0,
      grabX: e.clientX - btnRect.left,
      grabY: e.clientY - btnRect.top,
      w: btnRect.width,
      h: btnRect.height,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    });
  }

  /** Spawn a transient clone that animates a card out, then clean it up. */
  function spawnGhost(cardId: string, rect: Rect, anim: 'play' | 'drop', overrideText?: string) {
    const id = ghostSeq.current++;
    setGhosts((gs) => [...gs, { id, cardId, rect, anim, overrideText }]);
    window.setTimeout(() => setGhosts((gs) => gs.filter((x) => x.id !== id)), anim === 'drop' ? 360 : 440);
  }

  /** Fly-up animation from a card's slot in the hand (used by the discard-cost flow). */
  function ghostFromSlot(key: number, cardId: string, overrideText?: string) {
    const el = cardEls.current.get(key);
    if (!el) return;
    const r = el.getBoundingClientRect();
    spawnGhost(cardId, { left: r.left, top: r.top, width: r.width, height: r.height }, 'play', overrideText);
  }

  /** Try to play a dragged card released over the board. */
  function attemptPlay(d: DragState, x: number, y: number) {
    if (gameover) return; // run is over — drags may still zoom on click, but never play
    const card = CARDS[d.cardId];
    const reason = whyUnplayable(card, G);
    if (reason) {
      rejectShake(d.key, reason);
      return;
    }
    // Destroy card: player must choose a building target before the move fires.
    if (card.effect?.destroy) {
      setPendingDestroy({ cardId: d.cardId, handIdx: d.handIdx, playedKey: d.key });
      return;
    }
    // A card that erects a building drops it into the slot under the release point (or the
    // nearest free slot if that one's taken); the reconcile effect places the new instance there.
    // Reserved actions occupy no slot, so a pop-reserve card needs no placement. This must be
    // captured now, at the drop point — not after the discard-cost branch below, which can defer
    // the actual moves.playCard call until a later click, by which point the release position
    // is long gone.
    if (card.kind === 'building') {
      // Use the card's own center, not the raw cursor — the cursor can sit anywhere within the
      // card depending on where it was grabbed, which otherwise skews "closest slot" toward
      // wherever the grab point happened to land instead of where the card visually rests.
      const cx = x - d.grabX + d.w / 2;
      const cy = y - d.grabY + d.h / 2;
      pendingBuildSlotRef.current = chooseBuildSlot(cx, cy);
    }
    const need = card.discardCost ?? 0;
    // A discard cost only applies if you have spare cards; then pick the sacrifice by clicking.
    if (need > 0 && G.hand.length - 1 >= need) {
      setPending({ cardId: d.cardId, handIdx: d.handIdx, playedKey: d.key, need, discards: [] });
      return;
    }
    spawnGhost(
      d.cardId,
      { left: x - d.grabX, top: y - d.grabY, width: d.w, height: d.h },
      'drop',
      card.dynamicText?.(G, G.hand[d.handIdx]),
    );
    moves.playCard(d.handIdx);
  }

  /** Resolve a finished drag: a non-drag press zooms; a drag over the board plays. */
  function finishDrag(d: DragState, x: number, y: number) {
    if (!d.active) {
      // it was a click, not a drag
      setZoom({ cardId: d.cardId, overrideText: CARDS[d.cardId].dynamicText?.(G, G.hand[d.handIdx]) });
    } else {
      const barTop = handBarRef.current?.getBoundingClientRect().top ?? Infinity;
      if (y < barTop) attemptPlay(d, x, y); // released above the hand bar = over the board
    }
    setDrag(null);
  }

  function onCardPointerDown(e: React.PointerEvent, card: HandCard) {
    if (e.button !== 0 || pending || pendingDestroy) return; // in selection mode, clicks select instead
    if (gameover && overlayMinimized) return; // inspect mode — zoom handled by onClick instead
    const r = cardEls.current.get(card.key)?.getBoundingClientRect();
    if (!r) return;
    setDrag({
      key: card.key,
      cardId: card.cardId,
      handIdx: card.handIdx,
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

  // While a drag is live, track the pointer on the window so it follows even past the card.
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
  }, [drag?.key]);

  // While a building box is being dragged between slots, track the pointer on the window and
  // highlight the slot it's over. The drop (in onUp) swaps the two slots' contents.
  useEffect(() => {
    if (!slotDrag) return;
    function onMove(e: PointerEvent) {
      const d = slotDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      const active = d.active || moved > DRAG_THRESHOLD;
      setSlotDrag({ ...d, x: e.clientX, y: e.clientY, active });
      setHoverSlot(active ? slotAt(e.clientX, e.clientY) : null);
    }
    function onUp(e: PointerEvent) {
      const d = slotDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.active) {
        const target = slotAt(e.clientX, e.clientY);
        if (target != null && target !== d.fromSlot) {
          // Swap the two slots' contents — moves into an empty slot, swaps with an occupied one.
          setLayout((prev) => {
            const next = prev.slice();
            [next[d.fromSlot], next[target]] = [next[target], next[d.fromSlot]];
            return next;
          });
        }
      } else {
        // It was a click, not a drag — zoom the building's card (mirrors finishDrag for hand cards).
        const inst = buildingById.get(d.id);
        if (inst) setZoom({ cardId: inst.cardId });
      }
      setSlotDrag(null);
      setHoverSlot(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // Re-bind only when a drag begins/ends; mid-drag updates flow through slotDragRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotDrag?.id]);

  // While a worker token is being dragged (either from the tray toward a building, or out of a
  // building back toward the tray), track the pointer on the window. The drop resolves in onUp:
  // a release with no real movement is treated as a plain click (staffing toggle), matching the
  // click-vs-drag split used for cards and building boxes above.
  useEffect(() => {
    if (!workerDrag) return;
    function onMove(e: PointerEvent) {
      const d = workerDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      const active = d.active || moved > DRAG_THRESHOLD;
      setWorkerDrag({ ...d, x: e.clientX, y: e.clientY, active });
      setWorkerHoverSlot(active ? slotAt(e.clientX, e.clientY) : null);
      setWorkerHoverWorkId(active ? workBoxAt(e.clientX, e.clientY) : null);
      setWorkerOverTray(active && d.fromBuildingId != null && isOverTray(e.clientX, e.clientY));
    }
    function onUp(e: PointerEvent) {
      const d = workerDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        // No real movement — a plain click on the staffing toggle (tray tokens have no click behavior).
        if (d.fromBuildingId != null) moves.toggleStaffing(d.fromBuildingId);
      } else if (d.fromBuildingId == null) {
        // Dropped an idle token — staff whichever building or Work box is under the cursor, if it
        // can still accept a worker.
        const inst = staffableUnder(e.clientX, e.clientY);
        if (inst && inst.workers < requiredWorkersOf(inst)) moves.assignWorker(inst.id);
      } else if (isOverTray(e.clientX, e.clientY)) {
        // Dragged a worker out of its box and dropped it on the population tray.
        if (d.hadWorker) moves.unassignWorker(d.fromBuildingId);
      } else if (d.hadWorker) {
        // Dragged a worker out of one box and released it over another (building or Work box) —
        // transfer it directly (one atomic move) rather than unassign-then-assign, which would
        // split undo into two steps.
        const inst = staffableUnder(e.clientX, e.clientY);
        if (inst && inst.id !== d.fromBuildingId && inst.workers < requiredWorkersOf(inst)) {
          moves.transferWorker(d.fromBuildingId, inst.id);
        }
      }
      setWorkerDrag(null);
      setWorkerHoverSlot(null);
      setWorkerHoverWorkId(null);
      setWorkerOverTray(false);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // Re-bind only when a drag begins/ends; mid-drag updates flow through workerDragRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerDrag?.pointerId]);

  // Keep layoutRef in lockstep so pointer handlers (chooseBuildSlot) read the current layout.
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Reconcile the slot layout with the tableau and territory cap. Runs whenever a building
  // is built/destroyed (the key signature changes) or territory grows. Existing placements —
  // including ones the player dragged — are preserved; vanished buildings free their slot; a
  // newly built one takes its drop slot (else the first free slot). Territory only ever grows,
  // so slots are appended and pre-existing ones never shift.
  const tableauSig = G.tableau.map((b) => b.id).join(',');
  useEffect(() => {
    // Capture and clear the pending drop slot here, outside the updater below — setLayout's
    // updater must stay pure (StrictMode invokes it twice in dev and keeps only the second
    // result), so it cannot itself read-and-clear a ref as a side effect. Reading `wantSlot` as
    // a plain closure variable makes both invocations see the same value.
    const wantSlot = pendingBuildSlotRef.current;
    pendingBuildSlotRef.current = null;
    setLayout((prev) => {
      const next = prev.slice();
      while (next.length < G.territory) next.push(null);
      if (next.length > G.territory) next.length = G.territory; // defensive; territory is monotonic
      const present = new Set(G.tableau.map((b) => b.id));
      for (let i = 0; i < next.length; i++) {
        if (next[i] != null && !present.has(next[i]!)) next[i] = null; // building gone → free slot
      }
      const placed = new Set(next.filter((k): k is number => k != null));
      let want = wantSlot;
      for (const b of G.tableau) {
        if (placed.has(b.id)) continue;
        let slot = want != null && want < next.length && next[want] == null ? want : next.indexOf(null);
        want = null; // only the first newly-placed building in this pass takes the drop slot
        if (slot === -1) slot = next.length; // no free slot (shouldn't happen) → append defensively
        next[slot] = b.id;
        placed.add(b.id);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableauSig, G.territory]);

  // The canvas fills the gap between the banner and the hand bar; track their heights so it
  // stays flush as they reflow (e.g. the hand bar grows when a discard/destroy prompt shows).
  useEffect(() => {
    const measure = () =>
      setInsets({ top: bannerRef.current?.offsetHeight ?? 0, bottom: handBarRef.current?.offsetHeight ?? 0 });
    measure();
    const ro = new ResizeObserver(measure);
    if (bannerRef.current) ro.observe(bannerRef.current);
    if (handBarRef.current) ro.observe(handBarRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const idle = freePopulation(G);
  const hasUnstaffedCapacity = G.tableau.some((b) => !isOperating(b));
  const shouldWarn = idle > 0 && hasUnstaffedCapacity;

  // Restore the overlay when a new run starts.
  useEffect(() => {
    if (!gameover) setOverlayMinimized(false);
  }, [gameover]);

  // Clear pending sacrifice-pick, pending destroy, and the end-round warning at the start of each new round.
  useEffect(() => {
    setPending(null);
    setPendingDestroy(null);
    setWarnEndRound(false);
  }, [G.round]);

  // warnEndRound is only meaningful while shouldWarn or confirmEndTurn is true; reset it
  // if the player staffs all buildings after triggering the dialog (so it can't
  // ghost-trigger later) — confirmEndTurn doesn't depend on staffing, so it can't go stale.
  useEffect(() => {
    if (!shouldWarn && !confirmEndTurn) setWarnEndRound(false);
  }, [shouldWarn, confirmEndTurn]);

  /** In sacrifice-pick mode, a click toggles a card as the discard (or cancels the play). */
  function handlePendingClick(card: HandCard) {
    if (!pending) return;
    const i = card.handIdx;
    if (i === pending.handIdx) {
      pendingBuildSlotRef.current = null; // discard the aborted build's chosen slot too
      return setPending(null); // click the pending card again to cancel
    }
    const discards = pending.discards.includes(i)
      ? pending.discards.filter((d) => d !== i)
      : [...pending.discards, i];
    if (discards.length === pending.need) {
      ghostFromSlot(pending.playedKey, pending.cardId, CARDS[pending.cardId].dynamicText?.(G, G.hand[pending.handIdx]));
      moves.playCard(pending.handIdx, discards);
      setPending(null);
    } else {
      setPending({ ...pending, discards });
    }
  }

  /** Fire the destroy move against a chosen building instance, then exit targeting mode. */
  function handleDestroyTarget(instanceId: number) {
    if (!pendingDestroy) return;
    ghostFromSlot(
      pendingDestroy.playedKey,
      pendingDestroy.cardId,
      CARDS[pendingDestroy.cardId].dynamicText?.(G, G.hand[pendingDestroy.handIdx]),
    );
    moves.playCard(pendingDestroy.handIdx, [], instanceId);
    setPendingDestroy(null);
  }


  const COLLAPSE_MESSAGES: Record<string, string> = {
    famine:     'famine struck — your people starved.',
    ruin:       'ruin befell — your economy collapsed.',
    bankruptcy: 'bankruptcy struck — your treasury ran dry.',
    dark_age:   'a dark age descended — knowledge was lost.',
    revolt:     'revolt erupted — your people rose against you.',
  };

  const proj = projectedDelta(G, mission.onUpkeep);
  const collapseRisk = (key: keyof typeof G.resources) => G.resources[key] + proj.resources[key] < 0;
  const canEndRound = !pending && !pendingDestroy && !drag;

  return (
    <>
    <div className={styles.app}>
      <div className={styles.groundBackdrop} data-board={board} />
      <MissionWidget mission={mission} G={G} />
      <header className={styles.topBanner} ref={bannerRef}>
        <div
          ref={popTrayRef}
          className={`${styles.populationTray}${workerOverTray ? ` ${styles.trayReturnTarget}` : ''}`}
        >
          <PopulationTokens population={G.population} idle={idle} onTokenPointerDown={onPopTokenPointerDown} />
        </div>

        <div className={styles.coreGroup}>
          <Stat
            icon="🌾"
            label="Food"
            description="Sustenance from food-producing buildings. Your population eats it each round."
            value={G.resources.food}
            delta={proj.resources.food}
            warn={collapseRisk('food')}
          />
          <Stat
            icon="🔨"
            label="Production"
            description="Your build budget, spent to construct buildings."
            value={G.resources.production}
            delta={proj.resources.production}
            warn={collapseRisk('production')}
          />
          <Stat
            icon="🪙"
            label="Money"
            description="Coin from commercial buildings. Spent on action cards."
            value={G.resources.money}
            delta={proj.resources.money}
            warn={collapseRisk('money')}
          />
          <Stat
            icon="⚔️"
            label="Military"
            description="Military power of your civilization."
            value={G.resources.military}
            delta={proj.resources.military}
            warn={collapseRisk('military')}
          />
          <Stat
            icon="🔬"
            label="Science"
            description="Knowledge from research buildings."
            value={G.resources.science}
            delta={proj.resources.science}
            warn={collapseRisk('science')}
          />
        </div>

        <CultureBar culture={G.culture} projected={proj.culture} />
      </header>

      <div
        className={styles.gamearea}
        ref={gameareaRef}
        style={{ top: 0, bottom: insets.bottom, paddingTop: insets.top }}
      >
        <div className={styles.slotGrid}>
          {layout.map((key, slotIdx) => {
            const inst = key != null ? buildingById.get(key) : undefined;
            const isDropTarget = slotDrag?.active === true && hoverSlot === slotIdx;
            const isDragSource = slotDrag?.active === true && slotDrag.fromSlot === slotIdx;
            const canAcceptWorker = !!inst && inst.workers < requiredWorkersOf(inst);
            const isWorkerDropTarget =
              workerDrag?.active === true &&
              workerHoverSlot === slotIdx &&
              canAcceptWorker &&
              inst?.id !== workerDrag.fromBuildingId;
            const isWorkerDragSource =
              workerDrag?.active === true && !!inst && workerDrag.fromBuildingId === inst.id;
            const slotClass = [
              styles.slot,
              inst ? '' : styles.slotEmpty,
              isDropTarget ? styles.slotDrop : '',
              isDragSource ? styles.slotSource : '',
              isWorkerDropTarget ? styles.workerDropTarget : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={slotIdx}
                ref={(el) => {
                  if (el) slotEls.current.set(slotIdx, el);
                  else slotEls.current.delete(slotIdx);
                }}
                className={slotClass}
              >
                {inst && (
                  <BuildingBox
                    inst={inst}
                    gameover={!!gameover}
                    idle={idle}
                    workerDragSource={isWorkerDragSource}
                    pendingDestroy={!!pendingDestroy}
                    onPointerDown={(e) => onBoxPointerDown(e, inst, slotIdx)}
                    onStaffPointerDown={onStaffPointerDown}
                    onDestroy={() => handleDestroyTarget(inst.id)}
                    onZoomClick={
                      gameover && overlayMinimized ? () => setZoom({ cardId: inst.cardId }) : undefined
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
        {G.workZone.length > 0 && (
          <div className={styles.workStrip}>
            {G.workZone.map((inst) => {
              const canAcceptWorker = inst.workers < requiredWorkersOf(inst);
              const isWorkerDropTarget =
                workerDrag?.active === true &&
                workerHoverWorkId === inst.id &&
                canAcceptWorker &&
                inst.id !== workerDrag.fromBuildingId;
              const isWorkerDragSource =
                workerDrag?.active === true && workerDrag.fromBuildingId === inst.id;
              return (
                <WorkBox
                  key={inst.id}
                  inst={inst}
                  gameover={!!gameover}
                  idle={idle}
                  workerDragSource={isWorkerDragSource}
                  dropTarget={isWorkerDropTarget}
                  boxRef={(el) => {
                    if (el) workBoxEls.current.set(inst.id, el);
                    else workBoxEls.current.delete(inst.id);
                  }}
                  onStaffPointerDown={onStaffPointerDown}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.handBar} ref={handBarRef}>
        <div className={styles.handBarInner}>
          <div className={styles.deckColumn}>
            <Pile variant={styles.pileDeck} label="deck" count={G.deck.length} />
            <button
              className={styles.undoBtn}
              disabled={!canUndo || !!pending || !!pendingDestroy || drag?.active === true}
              onClick={undo}
              title="Undo your last action (cleared when you draw or end the round)"
            >
              ↶ Undo
            </button>
          </div>

          <div className={styles.handArea}>
            {pending && (
              <p className={styles.discardPrompt}>
                Playing <strong>{CARDS[pending.cardId].name}</strong> — pick{' '}
                {pending.need - pending.discards.length} card to discard, or click{' '}
                {CARDS[pending.cardId].name} again to cancel.
              </p>
            )}
            {pendingDestroy && (
              <p className={styles.discardPrompt}>
                Playing <strong>{CARDS[pendingDestroy.cardId].name}</strong> — click a building
                above to demolish it, or click{' '}
                {CARDS[pendingDestroy.cardId].name} again to cancel.
              </p>
            )}
            {rejectMsg && (
              <p className={styles.rejectToast} role="alert">{rejectMsg}</p>
            )}
            <div className={styles.hand}>
              {hand.length === 0 && <p className={styles.empty}>No cards in hand.</p>}
              {hand.map((card) => {
                const c = CARDS[card.cardId];
                // Discard cost never blocks play — it's waived when you can't cover it.
                const affordable = whyUnplayable(c, G) === null;
                const isPending = pending?.handIdx === card.handIdx;
                const isPendingDestroy = pendingDestroy?.handIdx === card.handIdx;
                const isSacrifice = pending?.discards.includes(card.handIdx) ?? false;
                const isDragging = drag?.active === true && drag.key === card.key;
                const className = [
                  styles.handCard,
                  card.isNew ? styles.dealIn : '',
                  isPending || isPendingDestroy ? styles.pending : '',
                  isSacrifice ? styles.sacrifice : '',
                  isDragging ? styles.dragging : '',
                  // Events are unplayable but must NOT be dimmed — they're a threat the
                  // player should focus on, not tune out. Their red styling stands in.
                  !affordable && c.kind !== 'event' && !pending && !pendingDestroy ? styles.unaffordable : '',
                  shake?.key === card.key ? styles.shake : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <CardFace
                    key={card.key}
                    as="button"
                    card={c}
                    // A card owning run-aware text (e.g. Cornucopia's growing gain) renders its
                    // current value here; the shell just asks, with no per-card branch.
                    overrideText={c.dynamicText?.(G, card.inst)}
                    ref={(el) => {
                      if (el) cardEls.current.set(card.key, el as HTMLButtonElement);
                      else cardEls.current.delete(card.key);
                    }}
                    className={className}
                    style={card.isNew ? { animationDelay: `${Math.min(card.newOrder, 6) * 70}ms` } : undefined}
                    onPointerDown={(e) => onCardPointerDown(e, card)}
                    onClick={() => {
                      if (gameover && overlayMinimized) {
                        setZoom({ cardId: card.cardId, overrideText: c.dynamicText?.(G, card.inst) });
                        return;
                      }
                      if (pending) handlePendingClick(card);
                      else if (pendingDestroy && card.handIdx === pendingDestroy.handIdx) setPendingDestroy(null);
                    }}
                  />
                );
              })}
            </div>
          </div>

          <Pile
            variant={styles.pileDiscard}
            label="discard"
            count={G.discard.length}
            onView={() => setPileView({ title: 'Discard pile', cards: G.discard })}
          />
          <Pile
            variant={styles.pileRemoved}
            label="removed"
            count={G.removed.length}
            onView={() => setPileView({ title: 'Removed from deck', cards: G.removed })}
          />

          {warnEndRound && (shouldWarn || confirmEndTurn) ? (
            <div className={styles.endRoundWarn}>
              <span className={styles.endRoundWarnMsg}>
                {shouldWarn ? (
                  <>{idle} idle 👷<br />unstaffed buildings</>
                ) : (
                  'End this round?'
                )}
              </span>
              <div className={styles.endRoundWarnBtns}>
                <button
                  className={styles.endRoundConfirm}
                  disabled={!canEndRound}
                  onClick={() => { setWarnEndRound(false); endTurn(); }}
                >
                  {shouldWarn ? 'End anyway' : 'End round'}
                </button>
                <button
                  className={styles.endRoundCancel}
                  onClick={() => setWarnEndRound(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.endRound}
              disabled={!!gameover || !canEndRound}
              onClick={() => { if (shouldWarn || confirmEndTurn) setWarnEndRound(true); else endTurn(); }}
            >
              <span className={styles.endRoundLabel}>End Round</span>
              <span className={styles.endRoundRound}>Rd {G.round}</span>
            </button>
          )}
        </div>
      </div>

      {ghosts.length > 0 && (
        <div className={styles.ghostLayer} aria-hidden="true">
          {ghosts.map((g) => (
            <CardFace
              key={g.id}
              card={CARDS[g.cardId]}
              overrideText={g.overrideText}
              className={`${styles.ghostCard} ${g.anim === 'drop' ? styles.ghostDrop : styles.ghostPlay}`}
              style={{ left: px(g.rect.left), top: px(g.rect.top), width: px(g.rect.width), height: px(g.rect.height) }}
            />
          ))}
        </div>
      )}

      {/* Drop target highlight + the card following the cursor, shown only during an active drag. */}
      {drag?.active && (
        <>
          <div
            className={`${styles.dropZone} ${
              drag.y < (handBarRef.current?.getBoundingClientRect().top ?? Infinity)
                ? styles.dropZoneActive
                : ''
            }`}
            style={{ bottom: handBarRef.current?.offsetHeight ?? 150 }}
            aria-hidden="true"
          >
            <span>
              Release to play <strong>{CARDS[drag.cardId].name}</strong>
            </span>
          </div>
          <div className={styles.dragLayer} aria-hidden="true">
            <CardFace
              card={CARDS[drag.cardId]}
              overrideText={CARDS[drag.cardId].dynamicText?.(G, G.hand[drag.handIdx])}
              className={styles.dragCard}
              style={{ left: px(drag.x - drag.grabX), top: px(drag.y - drag.grabY), width: px(drag.w), height: px(drag.h) }}
            />
          </div>
        </>
      )}

      {/* The building box following the cursor while it's dragged between slots. */}
      {slotDrag?.active && buildingById.has(slotDrag.id) && (
        <div className={styles.dragLayer} aria-hidden="true">
          <div
            className={styles.buildingDragClone}
            style={{
              left: px(slotDrag.x - slotDrag.grabX),
              top: px(slotDrag.y - slotDrag.grabY),
              width: px(slotDrag.w),
              height: px(slotDrag.h),
            }}
          >
            <BuildingBox inst={buildingById.get(slotDrag.id)!} gameover idle={idle} dragging />
          </div>
        </div>
      )}

      {/* The worker token following the cursor while it's dragged to/from a building. */}
      {workerDrag?.active && (
        <div className={styles.dragLayer} aria-hidden="true">
          <div
            className={styles.workerDragClone}
            style={{
              left: px(workerDrag.x - workerDrag.grabX),
              top: px(workerDrag.y - workerDrag.grabY),
              width: px(workerDrag.w),
              height: px(workerDrag.h),
            }}
          >
            🧍
          </div>
        </div>
      )}

      {/* Discard / removed pile contents, opened by clicking a pile. */}
      {pileView && (
        <div
          className={styles.pileBackdrop}
          onClick={() => setPileView(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.pilePanel}>
            <h3 className={styles.pileTitle}>
              {pileView.title} ({pileView.cards.length})
            </h3>
            {pileView.cards.length === 0 ? (
              <p className={styles.empty}>Empty.</p>
            ) : (
              <div className={styles.pileGrid}>
                {groupCards(pileView.cards).map((g) => {
                  const overrideText = CARDS[g.cardId].dynamicText?.(G, g.inst);
                  return (
                    <CardFace
                      key={g.key}
                      card={CARDS[g.cardId]}
                      overrideText={overrideText}
                      className={styles.staticCard}
                      countBadge={g.count}
                      onClick={(e) => { e.stopPropagation(); setZoom({ cardId: g.cardId, overrideText }); }}
                    />
                  );
                })}
              </div>
            )}
            <p className={styles.pileHint}>Click a card to zoom · click outside to close</p>
          </div>
        </div>
      )}

      {/* A card effect suspended awaiting a choice (e.g. Foresight's peek). Resolve-only: no
          dismiss path — clicking an option is the only way out (see .interactionBackdrop). */}
      {G.pendingInteraction && (
        <div className={styles.interactionBackdrop} role="dialog" aria-modal="true">
          <div className={styles.interactionPanel}>
            <h3 className={styles.interactionPrompt}>{G.pendingInteraction.prompt}</h3>
            <div className={styles.interactionGrid}>
              {G.pendingInteraction.options.map((opt, i) => (
                <CardFace
                  key={opt.id}
                  card={CARDS[opt.cardId]}
                  overrideText={CARDS[opt.cardId].dynamicText?.(G, opt)}
                  className={styles.interactionCard}
                  onClick={() => moves.resolveInteraction(i)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Zoomed card preview, opened by clicking a card. Sits above the pile viewer
          (CardZoomOverlay's backdrop is z-index 80 vs. .pileBackdrop's 75). */}
      <CardZoomOverlay
        cardId={zoom?.cardId ?? null}
        overrideText={zoom?.overrideText}
        onClose={() => setZoom(null)}
        hint="Drag a card onto the board to play · click anywhere to close"
      />

      {/* Minimized inspect pill — lives inside .app but pointer-events: auto overrides boardInert. */}
      {gameover && overlayMinimized && (
        <div className={styles.gameoverPill} style={{ bottom: insets.bottom + 8 }}>
          {gameover.outcome === 'victory' ? '🏛️ Victory' : '💀 Defeat'} — {mission.name}
          <button className={styles.gameoverPillReturn} onClick={() => setOverlayMinimized(false)}>
            Return to result
          </button>
        </div>
      )}
    </div>

    {/* End-of-run overlay — outside .app so boardInert doesn't affect it. */}
    {gameover && !overlayMinimized && (() => {
      const won = gameover.outcome === 'victory';
      const defeatMessage = (gameover.reason && COLLAPSE_MESSAGES[gameover.reason]) ?? 'your civilization has fallen.';
      // Preview-only: mirrors the same computeRewards call App.tsx's recordResult makes for
      // real on End Run, off the same pre-run mapProgress/collection, so the two can't diverge.
      const alreadyCompleted = won && isCompleted(mapProgress, mission.id);
      const reward = won ? computeRewards(mission, alreadyCompleted, collection) : null;
      const unlockedCard =
        reward && !isOwned(collection, mission.reward.unlockCardId) ? CARDS[mission.reward.unlockCardId] : null;
      return (
        <div className={styles.gameoverOverlay}>
          <div className={styles.gameoverPanel}>
            <h1 className={styles.gameoverTitle}>{won ? '🏛️ Victory' : '💀 Defeat'}</h1>
            <p className={styles.gameoverMission}>{mission.name}</p>
            <p className={styles.gameoverResult}>{won ? 'Objective achieved.' : defeatMessage}</p>
            <p className={styles.gameoverRound}>Reached round {G.round}</p>
            {reward && (
              <p className={styles.gameoverReward}>
                {alreadyCompleted
                  ? 'Already cleared — no reward for a replay.'
                  : `+${reward.influence} ⭐ Influence${unlockedCard ? ` · Unlocked ${unlockedCard.name}` : ''}`}
              </p>
            )}
            <div className={styles.gameoverBtns}>
              <button
                className={`${styles.gameoverBtn} ${styles.gameoverBtnRestart}`}
                onClick={() => onTransition(restart)}
                disabled={won}
                title={won ? "You've already won this run — end it to keep the result." : undefined}
              >
                Restart
              </button>
              <button className={`${styles.gameoverBtn} ${styles.gameoverBtnInspect}`} onClick={() => setOverlayMinimized(true)}>
                Inspect
              </button>
              <button className={`${styles.gameoverBtn} ${styles.gameoverBtnEnd}`} onClick={() => onTransition(endRun)}>
                End Run
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
