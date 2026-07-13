import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BuildingInstance, CardInstance, CoreResources, Resources, WorkInstance } from '../rules';
import { useGame } from '../run/GameContext';
import {
  cultureProgress,
  freePopulation,
  isOperating,
  producingUnits,
  projectedDelta,
  workerCapOf,
  unplayableReason,
} from '../rules';
import { CARDS, isStructure, type CardDef } from '../content/cards';
import { STICKERS } from '../content/stickers';
import { BOARD_STICKERS } from '../content/boardStickers';
import { BOARDS } from '../content/boards';
import { MISSIONS } from '../content/missions';
import type { GameState } from '../rules';
import { isCompleted } from '../rules/campaign';
import { computeRewards } from '../rules/rewards';
import { isOwned, type OwnedCards } from '../rules/collection';
import { effectiveCard } from '../rules/stickers';
import { sortDeckEntries } from '../rules/deckBuilder';
import { CardFace, RESOURCE_ICON, StickerRow, artFor, describeBuilding } from './CardFace';
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
        <span aria-hidden="true">{RESOURCE_ICON.culture}</span> {level}
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

/** The board's left strip: the mission's **objective** card (`G.objective`, the goal) pinned as its
 *  own distinct plaque flush in the very **top-left corner** — always exactly one card — above the
 *  separate **threat zone** of persistent **hazards** (`G.threats`, which can be several and scroll).
 *  Each is a real `CardFace` — click to zoom, same as any other card. Both live on `GameState`, so
 *  this reads *only* `GameState`, never the mission: the objective card's own `dynamicText` supplies
 *  its live progress and its `Objective` violet identity (echoed by the corner's violet frame) sets
 *  it apart from the red threat cards below. A real layout column, not a floating overlay: the slot
 *  grid reflows beside it via the sibling `.gameContent`. Renders nothing when neither exists. */
function BoardLeftColumn({
  G,
  onZoom,
  hiddenIds,
  registerEl,
}: {
  G: GameState;
  onZoom: (cardId: string, overrideText?: string, stickerBadge?: string[]) => void;
  /** During the run-start injection animation, instance ids not yet landed — rendered
   *  `visibility: hidden` so they hold their layout (and stay measurable) but don't show until the
   *  flying card lands on them. Absent outside the intro (everything visible). */
  hiddenIds?: Set<number>;
  /** Collects each card's root element, keyed by instance id, so the intro can measure where to
   *  fly a card. Absent outside the intro. */
  registerEl?: (id: number, el: HTMLElement | null) => void;
}) {
  const objective = G.objective;
  if (!objective && G.threats.length === 0) return null;
  const objectiveCard = objective ? CARDS[objective.cardId] : undefined;
  const objectiveText = objective && objectiveCard ? objectiveCard.display?.dynamicText?.(G, objective) : undefined;
  const hiddenStyle = (id: number) => (hiddenIds?.has(id) ? { visibility: 'hidden' as const } : undefined);
  return (
    <div className={styles.boardLeft}>
      {objective && objectiveCard && (
        <div className={styles.objectiveCorner}>
          <CardFace
            card={objectiveCard}
            overrideText={objectiveText}
            stickerBadge={objective.stickers}
            className={styles.staticCard}
            style={hiddenStyle(objective.id)}
            ref={(el) => registerEl?.(objective.id, el)}
            onClick={() => onZoom(objective.cardId, objectiveText, objective.stickers)}
          />
        </div>
      )}
      {G.threats.length > 0 && (
        <div className={styles.threatZone}>
          {G.threats.map((t) => {
            const card = CARDS[t.cardId];
            const overrideText = card.display?.dynamicText?.(G, t);
            return (
              <CardFace
                key={t.id}
                card={card}
                overrideText={overrideText}
                stickerBadge={t.stickers}
                className={styles.staticCard}
                style={hiddenStyle(t.id)}
                ref={(el) => registerEl?.(t.id, el)}
                onClick={() => onZoom(t.cardId, overrideText, t.stickers)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Collapse a list of card instances into one tile per type with a count, keeping first-seen
 *  order — *except* a card with `dynamicText`, or a stickered instance, neither of which ever
 *  groups: each such copy can carry its own live value or its own sticker-adjusted stats (e.g.
 *  two self-scaling copies with different play counts, or one stickered copy among several plain ones),
 *  so a shared count would either hide that or force picking one copy's value to speak for the
 *  stack. Each stays its own single-count entry, keyed by its stable instance id, carrying the
 *  instance so the caller can compute its current `dynamicText`/`effectiveCard`. */
function groupCards(insts: CardInstance[]): { key: number | string; cardId: string; inst: CardInstance; count: number; instanceId?: number }[] {
  const order: string[] = [];
  const groups = new Map<string, { inst: CardInstance; count: number }>();
  const singles: { key: number; cardId: string; inst: CardInstance; count: number; instanceId: number }[] = [];
  for (const inst of insts) {
    if (CARDS[inst.cardId].display?.dynamicText || inst.stickers?.length) {
      singles.push({ key: inst.id, cardId: inst.cardId, inst, count: 1, instanceId: inst.id });
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
  return sortDeckEntries([...grouped, ...singles]);
}

/** A pile token flanking the hand (deck / discard / removed). Clickable when `onView` is given. */
function Pile({
  count,
  label,
  variant,
  onView,
  elRef,
}: {
  count: number;
  label: string;
  variant: string;
  onView?: () => void;
  /** Exposes the pile button so the run-start intro can measure the deck pile as a fly target. */
  elRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={elRef}
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
   *  own per-copy state (e.g. a self-scaling card's play count). */
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

/** Per-round output labels for a staffable box, scaled to its current staffing (`unit × units`).
 *  A minimum of ×1 keeps an unstaffed/idle box showing its per-worker rate rather than "+0" (it's
 *  greyed as idle anyway), matching how a single-worker building shows its output while unstaffed. */
function boxOutputLabels(produces: Partial<Resources> | undefined, units: number): string[] {
  const u = Math.max(1, units);
  // Every produced resource — core or strategic — renders the same way through the shared icon map.
  // The output bag is signed (a work box reads its `produces`, which may drain): a positive gets an
  // explicit "+", a negative already carries its own "-".
  return (Object.entries(produces ?? {}) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const n = v * u;
      return `${n > 0 ? '+' : ''}${n}${RESOURCE_ICON[k]}`;
    });
}

/** A column of worker pips — one per capacity slot; filled (🧍) up to the staffed count, empty
 *  below. Click an empty pip to staff one worker, a filled pip to unstaff one; a filled pip is also
 *  the grab handle for dragging a worker out (to the tray or another box). Shared by `BuildingBox`
 *  and `WorkBox`; replaces the old single all-or-nothing staff toggle now that a building can hold
 *  several workers (Göbekli Tepe is the first). The whole column registers as the one fly-target
 *  element per box, so `flyWorkers`' tray↔box animation is unchanged. */
function StaffPips({
  inst,
  name,
  cap,
  gameover,
  idle,
  dragSource,
  dropTarget,
  onStaffPointerDown,
  containerRef,
}: {
  inst: BuildingInstance | WorkInstance;
  name: string;
  cap: number;
  gameover: boolean;
  idle: number;
  /** True while one of this box's workers is being dragged out of it (fades the column). */
  dragSource?: boolean;
  /** True while a dragged worker hovers this box and it can accept it — keeps the pips enabled so a
   *  valid drop target doesn't render an OS "not-allowed" cursor mid-drag (see the box gates). */
  dropTarget?: boolean;
  onStaffPointerDown?: (e: React.PointerEvent, inst: BuildingInstance | WorkInstance, pipFilled: boolean) => void;
  /** Registers the column so a worker-deployment token knows where to land. */
  containerRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <div className={`${styles.staffPips}${dragSource ? ` ${styles.staffDragSource}` : ''}`} ref={containerRef}>
      {Array.from({ length: cap }, (_, i) => {
        const filled = i < inst.workers;
        // Only disable when there's nothing to do: an empty pip needs an idle worker to fill it (or a
        // worker being dragged onto this box, which fills it directly); a filled pip is always
        // interactive so its worker can be pulled back off.
        const disabled = gameover || (!filled && idle <= 0 && !dropTarget);
        return (
          <button
            key={i}
            type="button"
            className={`${styles.staffPip} ${filled ? styles.staffFull : styles.staffEmpty}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStaffPointerDown?.(e, inst, filled);
            }}
            disabled={disabled}
            aria-label={filled ? `unstaff a worker from ${name}` : `staff a worker on ${name}`}
          >
            <span aria-hidden="true">🧍</span>
          </button>
        );
      })}
    </div>
  );
}

/** The visual face of one building box — shared by the slot grid and the drag clone. Each box is
 *  a single `BuildingInstance`; same-type buildings are never coalesced, so its stable `id` keys
 *  its slot and drives per-instance staffing. */
function BuildingBox({
  inst,
  gameover,
  idle,
  dragging,
  workerDragSource,
  workerDropTarget,
  onPointerDown,
  onStaffPointerDown,
  onZoomClick,
  staffRef,
}: {
  inst: BuildingInstance;
  gameover: boolean;
  idle: number;
  dragging?: boolean;
  /** True while one of this building's workers is being dragged out of it (fades the pip column). */
  workerDragSource?: boolean;
  /** True while a dragged worker hovers this building and it can accept it (see the matching
   *  gate in `StaffPips` — the carried worker fills the slot directly, no idle pool needed). */
  workerDropTarget?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onStaffPointerDown?: (e: React.PointerEvent, inst: BuildingInstance | WorkInstance, pipFilled: boolean) => void;
  /** Gameover inspect mode only — normal-mode zoom is handled by the slot-drag click/drag split
   *  instead, since `onPointerDown` never fires there (view-only board). */
  onZoomClick?: () => void;
  /** Registers the staffing pip column so a worker-deployment token knows where to land. */
  staffRef?: (el: HTMLElement | null) => void;
}) {
  const bld = effectiveCard(CARDS[inst.cardId], inst);
  const cap = workerCapOf(inst);
  const selfSufficient = cap === 0;
  const staffed = isOperating(inst);
  const className = [
    styles.buildingBox,
    staffed ? styles.operating : styles.idleBuilding,
    dragging ? styles.boxDragging : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className} onPointerDown={onPointerDown} onClick={onZoomClick}>
      {!selfSufficient && (
        <StaffPips
          inst={inst}
          name={bld.name}
          cap={cap}
          gameover={gameover}
          idle={idle}
          dragSource={workerDragSource}
          dropTarget={workerDropTarget}
          onStaffPointerDown={onStaffPointerDown}
          containerRef={staffRef}
        />
      )}
      <div className={styles.bldBody}>
        <span className={styles.bName}>{bld.name}</span>
        <div className={styles.bldFace} aria-label={describeBuilding(bld)}>
          <span className={styles.bldIcon} aria-hidden="true">{artFor(bld)}</span>
          <span className={styles.bldOutput} aria-hidden="true">
            {boxOutputLabels(bld.produces?.resources, producingUnits(inst)).join(' ')}
          </span>
        </div>
      </div>
      <StickerRow stickers={inst.stickers} />
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
  staffRef,
}: {
  inst: WorkInstance;
  gameover: boolean;
  idle: number;
  /** True while one of this box's workers is being dragged out of it (fades the pip column). */
  workerDragSource?: boolean;
  /** True while a dragged worker hovers this box and it can accept one (highlights the box). */
  dropTarget?: boolean;
  boxRef?: (el: HTMLDivElement | null) => void;
  onStaffPointerDown?: (e: React.PointerEvent, inst: BuildingInstance | WorkInstance, pipFilled: boolean) => void;
  /** Registers the staffing pip column so a worker-deployment token knows where to land. */
  staffRef?: (el: HTMLElement | null) => void;
}) {
  const card = effectiveCard(CARDS[inst.cardId], inst);
  const cap = workerCapOf(inst);
  const selfSufficient = cap === 0;
  const staffed = isOperating(inst);
  const className = [
    styles.buildingBox,
    styles.workBox,
    staffed ? styles.operating : styles.idleBuilding,
    dropTarget ? styles.workerDropTarget : '',
  ]
    .filter(Boolean)
    .join(' ');
  const gain = boxOutputLabels(card.produces?.resources, producingUnits(inst)).join(' ');
  return (
    <div className={className} ref={boxRef}>
      {!selfSufficient && (
        <StaffPips
          inst={inst}
          name={card.name}
          cap={cap}
          gameover={gameover}
          idle={idle}
          dragSource={workerDragSource}
          dropTarget={dropTarget}
          onStaffPointerDown={onStaffPointerDown}
          containerRef={staffRef}
        />
      )}
      <div className={styles.bldBody}>
        <span className={styles.bName}>{card.name}</span>
        <div className={styles.bldFace}>
          <span className={styles.bldIcon} aria-hidden="true">{artFor(card)}</span>
          <span className={styles.bldOutput} aria-hidden="true">{gain}</span>
        </div>
      </div>
      <StickerRow stickers={inst.stickers} />
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

type Rect = { left: number; top: number; width: number; height: number };

/** A transient clone that animates a card leaving the hand: 'play' flies up, 'drop' absorbs. */
interface Ghost {
  id: number;
  /** Captured at spawn time (via `effectiveCard`) so a stickered copy's true cost/output still
   *  shows on the flying clone, same as the hand card it left. */
  card: CardDef;
  rect: Rect;
  anim: 'play' | 'drop';
  /** A dynamic card's live current-value text, captured at spawn time (before its resolver runs
   *  and bumps its counter) so the flying clone shows the same value the hand card just did. */
  overrideText?: string;
  /** The played instance's attached sticker id(s) — captured at spawn time so the flying clone
   *  shows the same sticker badge the hand card just did. */
  stickers?: string[];
}

/** One mission-injected card flying from center-stage into its place during the run-start
 *  animation (objective → corner, threat → column, event → deck). `from`/`to` are in *local*
 *  (pre-scale) px — computed via `px()` — and rendered raw (not re-converted like the play ghost). */
interface IntroGhost {
  /** Stable key for this group (target + cardId) — also the React key, so each card remounts
   *  (re-plays its pop-in). */
  key: string;
  card: CardDef;
  overrideText?: string;
  stickers?: string[];
  /** How many copies fly as this one swipe — shown as a ×N badge (like any grouped card face). */
  count: number;
  from: Rect;
  to: Rect;
  /** false = resting at center (the readable pause); true = transitioning into `to`. */
  moving: boolean;
}

/** A single 🧍 token flying from the population tray into a box's staffing pip column, giving the
 *  **non-drag** deployment paths (a click-to-staff pip, or the auto-staff when a building/work card
 *  is placed) the same visible motion a drag already gives. Purely presentational — no rule reads it.
 *  `from`/`to` are in *local* (pre-scale) px (via `px()`); `moving` flips false→true one tick after
 *  spawn so the CSS transition swipes it from `from` to `to`. */
interface WorkerFlight {
  id: number;
  from: Rect;
  to: Rect;
  moving: boolean;
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
  /** Whether the pressed pip held a worker (only meaningful when dragging from a building): a filled
   *  pip can be pulled out (drag) or emptied (click); an empty pip can only be filled (click). */
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
function whyUnplayable(card: CardDef, G: GameState, self: CardInstance): string | null {
  const reason = unplayableReason(G, card, self);
  if (!reason) return null;
  switch (reason.kind) {
    case 'cost': {
      const missing = (Object.entries(reason.missing) as [keyof CoreResources, number][])
        .map(([k, v]) => `${v}${RESOURCE_ICON[k]}`);
      return `need ${missing.join(' ')}`;
    }
    case 'cultureLevel':
      return `need ${RESOURCE_ICON.culture} level ${reason.required}`;
    case 'territory':
      return 'territory full';
    case 'emptyDrawPile':
      return 'no cards to reveal';
    case 'discardEmpty':
      return 'discard empty';
  }
}

/** One group in the run-start injection animation: all copies of the same card heading for the same
 *  target fly as a single swipe (duplicate threats / event copies don't each get their own beat). */
interface IntroGroup {
  /** Stable animation key (`target:cardId`) — also the flying card's React key. */
  key: string;
  card: CardDef;
  target: 'objective' | 'threat' | 'deck';
  /** Every instance in the group. `[0]` is the representative (its slot is the fly target, its
   *  per-copy state drives the flying face); all of them are revealed together when the group lands. */
  insts: CardInstance[];
}

/** The mission's run-start injection set, grouped by card and in the order the intro animation places
 *  them: the objective (into its corner), then each threat (into the column), then the mission's event
 *  cards (which get shuffled into the deck). Copies of the same card in the same target collapse into
 *  one group so duplicates fly together. Read purely from GameState — event cards are identifiable
 *  because the player never builds decks with event-kind cards (`isDeckable`), so at run start the
 *  only event-kind cards in the deck are the mission-injected ones. */
function introInjections(G: GameState): IntroGroup[] {
  const groups: IntroGroup[] = [];
  const push = (target: IntroGroup['target'], inst: CardInstance) => {
    const existing = groups.find((g) => g.target === target && g.card.id === inst.cardId);
    if (existing) existing.insts.push(inst);
    else groups.push({ key: `${target}:${inst.cardId}`, card: CARDS[inst.cardId], target, insts: [inst] });
  };
  if (G.objective) push('objective', G.objective);
  for (const t of G.threats) push('threat', t);
  // Events are shuffled into the deck, but the opening hand is already drawn by the time the intro
  // runs — so a mission event copy can sit in the hand, not the deck. Count both zones (the only
  // places a card can be at setup) so the ×N reflects every injected event, not just the undrawn ones.
  for (const c of [...G.deck, ...G.hand]) if (CARDS[c.cardId].kind === 'event') push('deck', c);
  return groups;
}

export function Board({
  confirmEndTurn,
  uiScale,
  onTransition,
  mapProgress,
  collection,
  unlockedStickers,
  unlockedBoardStickers,
  unlockedBoards,
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
  /** The player's unlocked-sticker sets + unlocked boards entering this run — same read-only preview
   *  role, so the gameover overlay can announce (and not double-announce) the card/board stickers and
   *  board this clear unlocks. */
  unlockedStickers: Record<string, true>;
  unlockedBoardStickers: Record<string, true>;
  unlockedBoards: Record<string, true>;
}) {
  const { G, gameover, board, moves, endTurn, undo, canUndo, restart, endRun, runGen } = useGame();
  // The whole board renders inside a `transform: scale(uiScale)` wrapper (App.tsx). Pointer
  // coordinates and getBoundingClientRect() are in *visual* (post-scale) px; when written into
  // an inline left/top/width/height on a drag/ghost clone — which lives inside that scaled
  // wrapper — the value would be scaled a second time. Divide by the scale to convert
  // visual → local so the clone lands under the cursor at its true size. (offsetHeight-derived
  // insets stay in layout space and need no conversion; hit-testing compares visual-to-visual.)
  const px = (v: number) => v / uiScale;
  const mission = MISSIONS[G.missionId];
  const [pending, setPending] = useState<PendingPlay | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [zoom, setZoom] = useState<{ cardId: string; overrideText?: string; overrideCard?: CardDef; stickerBadge?: string[] } | null>(null);
  const [pileView, setPileView] = useState<{ title: string; cards: CardInstance[] } | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const [shake, setShake] = useState<{ key: number; n: number } | null>(null);
  const [deckShuffling, setDeckShuffling] = useState(false);
  // Run-start injection animation (see the layout effect below): `intro` greys the board + holds the
  // hand back while cards swipe into place; `introIds` is every objective/threat instance being
  // placed and `introLanded` the ones already landed (a card stays hidden until it lands);
  // `introGhost` is the single card currently flying.
  const [intro, setIntro] = useState(false);
  // Held slightly past `intro`: the scrim lifts and the deck riffles first, *then* the hand deals in
  // (the requested run-start order). See the intro layout effect.
  const [handHeld, setHandHeld] = useState(false);
  const [introIds, setIntroIds] = useState<Set<number>>(() => new Set());
  const [introLanded, setIntroLanded] = useState<Set<number>>(() => new Set());
  const [introGhost, setIntroGhost] = useState<IntroGhost | null>(null);
  const introTimers = useRef<number[]>([]);
  // Objective + threat card roots, keyed by instance id, so the intro can measure where to fly each.
  const introEls = useRef<Map<number, HTMLElement>>(new Map());
  const deckPileRef = useRef<HTMLButtonElement | null>(null);
  const lastReshuffleRef = useRef(G.reshuffleCount);
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const [warnEndRound, setWarnEndRound] = useState(false);
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  // Slot layout: which building (by instance id) sits in each territory slot; `null` is empty.
  // Length tracks G.resources.territory. Pure UI state — the core never knows where boxes sit.
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
  // Staffable instance id → its staffing pip column, the fly target for a worker-deployment token
  // (see flyWorkers). A self-sufficient box renders no pips, but it never deploys either.
  const staffEls = useRef<Map<number, HTMLElement>>(new Map());
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
  const shuffleSeq = useRef(0);
  const rejectMsgSeq = useRef(0);
  // Worker-deployment tokens in flight (tray → box), for the non-drag staffing paths.
  const [workerFlights, setWorkerFlights] = useState<WorkerFlight[]>([]);
  const workerFlightSeq = useRef(0);
  // Diff bookkeeping for the placement-deploy animation (see the layout effect below):
  // the staffable ids seen last render (null until the first, so mount fires nothing), and a
  // retry queue for newly-placed boxes whose toggle isn't measurable yet (a building appears one
  // reconcile-render after its tableau entry; a work box is measurable the same render).
  const prevStaffIdsRef = useRef<Set<number> | null>(null);
  const pendingDeployRef = useRef<{ toId: number; count: number; tries: number }[]>([]);
  // Hold the hand back during the run-start injection animation — feeding an empty hand means every
  // real card reads as freshly drawn (`isNew`) when `handHeld` clears, so the deal-in fires on reveal.
  const hand = useAnimatedHand(handHeld ? [] : G.hand);
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
    if ((e.target as HTMLElement).closest('button')) return; // let staffing clicks through
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
    if (gameover || pending) return;
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

  /** Begin a pointer interaction on one staffing pip (a building or a Work box): a plain click on a
   *  filled pip unstaffs one worker, on an empty pip staffs one (both handled on release); a real
   *  drag from a filled pip releases its worker onto the tray/another box. `pipFilled` records which
   *  kind of pip was pressed. Only `id`/`workers` are read, so it accepts either instance kind. */
  function onStaffPointerDown(e: React.PointerEvent, inst: BuildingInstance | WorkInstance, pipFilled: boolean) {
    if (e.button !== 0) return;
    if (gameover) return;
    const btnRect = e.currentTarget.getBoundingClientRect();
    setWorkerDrag({
      pointerId: e.pointerId,
      fromBuildingId: inst.id,
      hadWorker: pipFilled,
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

  /** Fly `count` 🧍 tokens between the population tray and the staffing pip column of box `boxId`,
   *  giving the non-drag staffing paths the visible motion a drag already has: `recall: false`
   *  (deploy) flies tray → box (a click-to-staff pip, or auto-staff on placing a card); `recall:
   *  true` flies box → tray (a click-to-unstaff pip). No-op if the tray or the pip column isn't
   *  measurable (e.g. a self-sufficient box, which never deploys). Rects are converted visual→local
   *  (`px`) since the flight layer lives inside the scaled app wrapper. */
  function flyWorkers(boxId: number, count: number, recall = false) {
    if (count <= 0) return;
    const trayEl = popTrayRef.current;
    const boxEl = staffEls.current.get(boxId);
    if (!trayEl || !boxEl) return;
    const fr = trayEl.getBoundingClientRect();
    const br = boxEl.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const id = workerFlightSeq.current++;
      // A token-sized spot centered in the tray (nudged per token so several don't stack exactly),
      // and the box's staffing pip column where a worker rests. Deploy flies tray→box; recall, box→tray.
      const nudge = (i - (count - 1) / 2) * br.width * 0.8;
      const trayPoint: Rect = {
        left: px(fr.left + fr.width / 2 - br.width / 2 + nudge),
        top: px(fr.top + fr.height / 2 - br.height / 2),
        width: px(br.width),
        height: px(br.height),
      };
      const boxPoint: Rect = { left: px(br.left), top: px(br.top), width: px(br.width), height: px(br.height) };
      const from = recall ? boxPoint : trayPoint;
      const to = recall ? trayPoint : boxPoint;
      setWorkerFlights((f) => [...f, { id, from, to, moving: false }]);
      const delay = i * 90; // stagger multiple tokens
      window.setTimeout(
        () => setWorkerFlights((f) => f.map((x) => (x.id === id ? { ...x, moving: true } : x))),
        20 + delay,
      );
      window.setTimeout(() => setWorkerFlights((f) => f.filter((x) => x.id !== id)), 480 + delay);
    }
  }

  /** Spawn a transient clone that animates a card out, then clean it up. */
  function spawnGhost(card: CardDef, rect: Rect, anim: 'play' | 'drop', overrideText?: string, stickers?: string[]) {
    const id = ghostSeq.current++;
    setGhosts((gs) => [...gs, { id, card, rect, anim, overrideText, stickers }]);
    window.setTimeout(() => setGhosts((gs) => gs.filter((x) => x.id !== id)), anim === 'drop' ? 360 : 440);
  }

  /** Fly-up animation from a card's slot in the hand (used by the discard-cost flow). */
  function ghostFromSlot(key: number, card: CardDef, overrideText?: string, stickers?: string[]) {
    const el = cardEls.current.get(key);
    if (!el) return;
    const r = el.getBoundingClientRect();
    spawnGhost(card, { left: r.left, top: r.top, width: r.width, height: r.height }, 'play', overrideText, stickers);
  }

  /** Try to play a dragged card released over the board. */
  function attemptPlay(d: DragState, x: number, y: number) {
    if (gameover) return; // run is over — drags may still zoom on click, but never play
    const card = CARDS[d.cardId];
    const reason = whyUnplayable(card, G, G.hand[d.handIdx]);
    if (reason) {
      rejectShake(d.key, reason);
      return;
    }
    // A card that erects a structure (building/wonder) drops it into the slot under the release
    // point (or the nearest free slot if that one's taken); the reconcile effect places the new
    // instance there. Reserved actions occupy no slot, so a pop-reserve card needs no placement.
    // This must be captured now, at the drop point — not after the discard-cost branch below, which
    // can defer the actual moves.playCard call until a later click, by which point the release
    // position is long gone.
    if (isStructure(card)) {
      // Use the card's own center, not the raw cursor — the cursor can sit anywhere within the
      // card depending on where it was grabbed, which otherwise skews "closest slot" toward
      // wherever the grab point happened to land instead of where the card visually rests.
      const cx = x - d.grabX + d.w / 2;
      const cy = y - d.grabY + d.h / 2;
      pendingBuildSlotRef.current = chooseBuildSlot(cx, cy);
    }
    const need = card.gate?.discardCost ?? 0;
    // A discard cost only applies if you have spare cards; then pick the sacrifice by clicking.
    if (need > 0 && G.hand.length - 1 >= need) {
      setPending({ cardId: d.cardId, handIdx: d.handIdx, playedKey: d.key, need, discards: [] });
      return;
    }
    spawnGhost(
      effectiveCard(card, G.hand[d.handIdx]),
      { left: x - d.grabX, top: y - d.grabY, width: d.w, height: d.h },
      'drop',
      card.display?.dynamicText?.(G, G.hand[d.handIdx]),
      G.hand[d.handIdx].stickers,
    );
    moves.playCard(d.handIdx);
  }

  /** Resolve a finished drag: a non-drag press zooms; a drag over the board plays. */
  function finishDrag(d: DragState, x: number, y: number) {
    if (!d.active) {
      // it was a click, not a drag
      setZoom({
        cardId: d.cardId,
        overrideCard: effectiveCard(CARDS[d.cardId], G.hand[d.handIdx]),
        overrideText: CARDS[d.cardId].display?.dynamicText?.(G, G.hand[d.handIdx]),
        stickerBadge: G.hand[d.handIdx].stickers,
      });
    } else {
      const barTop = handBarRef.current?.getBoundingClientRect().top ?? Infinity;
      if (y < barTop) attemptPlay(d, x, y); // released above the hand bar = over the board
    }
    setDrag(null);
  }

  function onCardPointerDown(e: React.PointerEvent, card: HandCard) {
    if (e.button !== 0 || pending) return; // in selection mode, clicks select instead
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
        if (inst) setZoom({ cardId: inst.cardId, overrideCard: effectiveCard(CARDS[inst.cardId], inst), stickerBadge: inst.stickers });
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
  // a release with no real movement is treated as a plain click (staff/unstaff one pip), matching the
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
        // No real movement — a plain click on one pip (tray tokens have no click behavior). A filled
        // pip unstaffs one worker (recall a token → tray); an empty pip staffs one if idle is free
        // (deploy a token tray → box). Both move exactly one worker.
        if (d.fromBuildingId != null) {
          if (d.hadWorker) {
            moves.unassignWorker(d.fromBuildingId);
            flyWorkers(d.fromBuildingId, 1, true);
          } else if (idle > 0) {
            moves.assignWorker(d.fromBuildingId);
            flyWorkers(d.fromBuildingId, 1);
          }
        }
      } else if (d.fromBuildingId == null) {
        // Dropped an idle token — staff whichever building or Work box is under the cursor, if it
        // can still accept a worker.
        const inst = staffableUnder(e.clientX, e.clientY);
        if (inst && inst.workers < workerCapOf(inst)) moves.assignWorker(inst.id);
      } else if (isOverTray(e.clientX, e.clientY)) {
        // Dragged a worker out of its box and dropped it on the population tray.
        if (d.hadWorker) moves.unassignWorker(d.fromBuildingId);
      } else if (d.hadWorker) {
        // Dragged a worker out of one box and released it over another (building or Work box) —
        // transfer it directly (one atomic move) rather than unassign-then-assign, which would
        // split undo into two steps.
        const inst = staffableUnder(e.clientX, e.clientY);
        if (inst && inst.id !== d.fromBuildingId && inst.workers < workerCapOf(inst)) {
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
  // is built (the key signature changes) or territory grows. Existing placements —
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
      while (next.length < G.resources.territory) next.push(null);
      if (next.length > G.resources.territory) next.length = G.resources.territory; // defensive; territory is monotonic
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
  }, [tableauSig, G.resources.territory]);

  // Worker-deployment animation for the non-drag *placement* path: when a building/work card is
  // played, the core auto-staffs it (population.ts's autoStaffCount) and the new box appears already
  // carrying workers. A newly-appeared staffable id can only come from a play (never a drag, which
  // only shuffles workers between existing boxes), so any new id with workers > 0 is an auto-staff
  // to animate — the count is read straight off the instance (the core's decision), never re-derived
  // here. Detection is a plain diff of the staffable id set against last render. A building's box
  // only becomes measurable one render *after* its tableau entry (it's gated behind the layout
  // reconcile effect above), so an un-measurable target is queued and retried next render; a work
  // box registers its toggle the same render and fires at once. Placed after the reconcile effect so
  // render-1 ordering is deterministic. Purely presentational — no rule reads it.
  useLayoutEffect(() => {
    const current = new Map<number, number>();
    for (const b of G.tableau) current.set(b.id, b.workers);
    for (const w of G.workZone) current.set(w.id, w.workers);

    const prev = prevStaffIdsRef.current;
    if (prev && !intro) {
      for (const [id, workers] of current) {
        if (!prev.has(id) && workers > 0) pendingDeployRef.current.push({ toId: id, count: workers, tries: 0 });
      }
    }
    prevStaffIdsRef.current = new Set(current.keys());

    // Flush the queue: fly a box's tokens once its toggle is measurable, else retry a few renders.
    // The `tries` cap is pure safety — an enqueued id has workers > 0 ⟹ a toggle is rendered ⟹ it
    // registers — so it should never actually expire (if it does, something else is wrong).
    if (pendingDeployRef.current.length > 0) {
      const still: typeof pendingDeployRef.current = [];
      for (const d of pendingDeployRef.current) {
        if (staffEls.current.has(d.toId)) flyWorkers(d.toId, d.count);
        else if (d.tries < 4) still.push({ ...d, tries: d.tries + 1 });
      }
      pendingDeployRef.current = still;
    }
  });

  // The canvas fills the gap between the banner and the hand bar; track their heights so it
  // stays flush as they reflow (e.g. the hand bar grows when a discard prompt shows).
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

  // Clear pending sacrifice-pick and the end-round warning at the start of each new round.
  useEffect(() => {
    setPending(null);
    setWarnEndRound(false);
  }, [G.round]);

  /** Briefly riffle the deck pile (the `shuffle` keyframe). Shared by the run-start intro and every
   *  mid-run reshuffle; the `shuffleSeq` guard drops a stale timer if another riffle starts first. */
  function fireRiffle() {
    const n = ++shuffleSeq.current;
    setDeckShuffling(true);
    window.setTimeout(() => {
      if (shuffleSeq.current === n) setDeckShuffling(false);
    }, 500);
  }

  function clearIntroTimers() {
    introTimers.current.forEach((id) => window.clearTimeout(id));
    introTimers.current = [];
  }

  // Mid-run reshuffles riffle the pile. The run-start riffle is owned by the intro sequence below
  // (which pre-syncs `lastReshuffleRef` so the fresh/restart-reset count reads as already-seen),
  // so this fires only on a genuine later change — never on mount or on a restart.
  useEffect(() => {
    if (G.reshuffleCount === lastReshuffleRef.current) return;
    lastReshuffleRef.current = G.reshuffleCount;
    fireRiffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G.reshuffleCount]);

  // The run-start injection animation: greys the board and swipes each mission-injected card into
  // place one at a time (objective → corner, threats → column, events → deck); only once it finishes
  // does the deck riffle and the first hand deal in. Purely presentational — like `reshuffleCount`,
  // no rule reads it. Keyed on `runGen` so it replays on restart (which reuses this Board without a
  // remount). A *layout* effect so the board is greyed / the hand hidden before the first paint (no
  // flash) and so it runs before the passive reshuffle effect above — letting it pre-claim ownership
  // of the run-start riffle. Cleanup clears every pending timer, so StrictMode's double-invoke (and a
  // restart mid-intro) just restart the sequence cleanly.
  useLayoutEffect(() => {
    clearIntroTimers();
    lastReshuffleRef.current = G.reshuffleCount;
    const items = introInjections(G);
    setIntroGhost(null);
    setIntroLanded(new Set());
    setIntroIds(new Set(items.flatMap((g) => (g.target !== 'deck' ? g.insts.map((i) => i.id) : []))));

    if (items.length === 0) {
      setIntro(false);
      setHandHeld(false);
      fireRiffle();
      return clearIntroTimers;
    }

    setIntro(true);
    setHandHeld(true);
    const schedule = (delay: number, fn: () => void) => {
      introTimers.current.push(window.setTimeout(fn, delay));
    };
    const HOLD = 550; // readable pause center-stage
    const MOVE = 550; // swipe into place
    const GAP = 180; // beat between cards
    const centerRect = (): Rect => {
      const w = 168;
      const h = 232; // enlarged, readable local px
      return { left: px(window.innerWidth / 2) - w / 2, top: px(window.innerHeight / 2) - h / 2, width: w, height: h };
    };
    const targetRect = (target: 'objective' | 'threat' | 'deck', id: number): Rect | null => {
      if (target === 'deck') {
        // An event card doesn't shrink into the pile — it flies full-size and lands centered over the
        // deck (then vanishes). So keep the center-stage card dims, just re-position onto the pile.
        const el = deckPileRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const c = centerRect();
        return {
          left: px(r.left + r.width / 2) - c.width / 2,
          top: px(r.top + r.height / 2) - c.height / 2,
          width: c.width,
          height: c.height,
        };
      }
      const el = introEls.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: px(r.left), top: px(r.top), width: px(r.width), height: px(r.height) };
    };

    // Reveal every real copy in a group at once (they all animated as one swipe).
    const revealGroup = (g: IntroGroup) =>
      setIntroLanded((s) => {
        const n = new Set(s);
        for (const inst of g.insts) n.add(inst.id);
        return n;
      });

    let t = 300; // let the board layout settle before the first card
    items.forEach((item) => {
      const rep = item.insts[0];
      const at = t;
      schedule(at, () => {
        const to = targetRect(item.target, rep.id);
        if (!to) {
          // Target not measurable (shouldn't happen — the real cards render hidden in place) —
          // just reveal it without the fly rather than stall the sequence.
          if (item.target !== 'deck') revealGroup(item);
          return;
        }
        setIntroGhost({
          key: item.key,
          card: item.card,
          overrideText: item.card.display?.dynamicText?.(G, rep),
          stickers: rep.stickers,
          count: item.insts.length,
          from: centerRect(),
          to,
          moving: false,
        });
      });
      schedule(at + HOLD, () => setIntroGhost((g) => (g ? { ...g, moving: true } : g)));
      schedule(at + HOLD + MOVE, () => {
        // An event just vanishes into the deck; an objective/threat is revealed where it landed.
        if (item.target !== 'deck') revealGroup(item);
        setIntroGhost(null);
      });
      t = at + HOLD + MOVE + GAP;
    });

    // All cards placed: lift the grey and riffle the (now visible) deck, then a beat later deal the
    // first hand — the requested order of scrim-lift → shuffle → hand.
    schedule(t, () => {
      setIntro(false);
      fireRiffle();
    });
    schedule(t + 480, () => setHandHeld(false));
    return clearIntroTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runGen]);

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
      ghostFromSlot(
        pending.playedKey,
        effectiveCard(CARDS[pending.cardId], G.hand[pending.handIdx]),
        CARDS[pending.cardId].display?.dynamicText?.(G, G.hand[pending.handIdx]),
        G.hand[pending.handIdx].stickers,
      );
      moves.playCard(pending.handIdx, discards);
      setPending(null);
    } else {
      setPending({ ...pending, discards });
    }
  }

  const COLLAPSE_MESSAGES: Record<string, string> = {
    famine:     'famine struck — your people starved.',
    ruin:       'ruin befell — your economy collapsed.',
    bankruptcy: 'bankruptcy struck — your treasury ran dry.',
    dark_age:   'a dark age descended — knowledge was lost.',
    revolt:     'revolt erupted — your people rose against you.',
    // card-declared defeats (G.pendingDefeat) reuse this shell map too, not just core collapses:
    'the sands of time': 'the age turned — the long wander ended.',
  };

  const proj = projectedDelta(G);
  const collapseRisk = (key: keyof CoreResources) => G.resources[key] + proj.resources[key] < 0;
  const canEndRound = !pending && !drag;

  return (
    <>
    <div className={styles.app}>
      <div className={styles.groundBackdrop} data-board={board} />
      <header className={styles.topBanner} ref={bannerRef}>
        <div
          ref={popTrayRef}
          className={`${styles.populationTray}${workerOverTray ? ` ${styles.trayReturnTarget}` : ''}`}
        >
          <PopulationTokens population={G.resources.population} idle={idle} onTokenPointerDown={onPopTokenPointerDown} />
        </div>

        <div className={styles.coreGroup}>
          <Stat
            icon={RESOURCE_ICON.food}
            label="Food"
            description="Sustenance from food-producing buildings. Your population eats it each round."
            value={G.resources.food}
            delta={proj.resources.food}
            warn={collapseRisk('food')}
          />
          <Stat
            icon={RESOURCE_ICON.production}
            label="Production"
            description="Your build budget, spent to construct buildings."
            value={G.resources.production}
            delta={proj.resources.production}
            warn={collapseRisk('production')}
          />
          <Stat
            icon={RESOURCE_ICON.money}
            label="Money"
            description="Coin from commercial buildings. Spent on action cards."
            value={G.resources.money}
            delta={proj.resources.money}
            warn={collapseRisk('money')}
          />
          <Stat
            icon={RESOURCE_ICON.military}
            label="Military"
            description="Military power of your civilization."
            value={G.resources.military}
            delta={proj.resources.military}
            warn={collapseRisk('military')}
          />
          <Stat
            icon={RESOURCE_ICON.science}
            label="Science"
            description="Knowledge from research buildings."
            value={G.resources.science}
            delta={proj.resources.science}
            warn={collapseRisk('science')}
          />
        </div>

        <CultureBar culture={G.resources.culture} projected={proj.resources.culture} />
      </header>

      <div
        className={styles.gamearea}
        ref={gameareaRef}
        style={{ top: 0, bottom: insets.bottom }}
      >
        <BoardLeftColumn
          G={G}
          onZoom={(cardId, overrideText, stickerBadge) => setZoom({ cardId, overrideText, stickerBadge })}
          hiddenIds={intro ? new Set([...introIds].filter((id) => !introLanded.has(id))) : undefined}
          registerEl={
            intro
              ? (id, el) => {
                  if (el) introEls.current.set(id, el);
                  else introEls.current.delete(id);
                }
              : undefined
          }
        />
        {/* The banner is centered/narrow, so only the full-width play column needs to clear it —
            the left strip sits at the far edge where the banner isn't, letting the objective rise
            into the true top-left corner. So the banner-height top inset lives here, not on the
            whole gamearea. */}
        <div className={styles.gameContent} style={{ paddingTop: insets.top }}>
          <div className={styles.slotGrid}>
            {layout.map((key, slotIdx) => {
              const inst = key != null ? buildingById.get(key) : undefined;
              const isDropTarget = slotDrag?.active === true && hoverSlot === slotIdx;
              const isDragSource = slotDrag?.active === true && slotDrag.fromSlot === slotIdx;
              const canAcceptWorker = !!inst && inst.workers < workerCapOf(inst);
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
                      workerDropTarget={isWorkerDropTarget}
                      onPointerDown={(e) => onBoxPointerDown(e, inst, slotIdx)}
                      onStaffPointerDown={onStaffPointerDown}
                      staffRef={(el) => {
                        if (el) staffEls.current.set(inst.id, el);
                        else staffEls.current.delete(inst.id);
                      }}
                      onZoomClick={
                        gameover && overlayMinimized
                          ? () =>
                              setZoom({
                                cardId: inst.cardId,
                                overrideCard: effectiveCard(CARDS[inst.cardId], inst),
                                stickerBadge: inst.stickers,
                              })
                          : undefined
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
                const canAcceptWorker = inst.workers < workerCapOf(inst);
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
                    staffRef={(el) => {
                      if (el) staffEls.current.set(inst.id, el);
                      else staffEls.current.delete(inst.id);
                    }}
                    onStaffPointerDown={onStaffPointerDown}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.handBar} ref={handBarRef}>
        <div className={styles.handBarInner}>
          <div className={styles.deckColumn}>
            <Pile
              variant={`${styles.pileDeck} ${deckShuffling ? styles.pileShuffling : ''}`}
              label="deck"
              count={G.deck.length}
              elRef={deckPileRef}
            />
            <button
              className={styles.undoBtn}
              disabled={!canUndo || !!pending || drag?.active === true}
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
            {rejectMsg && (
              <p className={styles.rejectToast} role="alert">{rejectMsg}</p>
            )}
            <div className={styles.hand}>
              {hand.length === 0 && <p className={styles.empty}>No cards in hand.</p>}
              {hand.map((card) => {
                const c = CARDS[card.cardId];
                // A stickered copy's true cost/output (e.g. Efficient's discount) — same object as
                // `c` when unstickered, see `effectiveCard`.
                const ec = effectiveCard(c, card.inst);
                // Discard cost never blocks play — it's waived when you can't cover it.
                const affordable = whyUnplayable(c, G, card.inst) === null;
                const isPending = pending?.handIdx === card.handIdx;
                const isSacrifice = pending?.discards.includes(card.handIdx) ?? false;
                const isDragging = drag?.active === true && drag.key === card.key;
                const className = [
                  styles.handCard,
                  card.isNew ? styles.dealIn : '',
                  isPending ? styles.pending : '',
                  isSacrifice ? styles.sacrifice : '',
                  isDragging ? styles.dragging : '',
                  !affordable && !pending ? styles.unaffordable : '',
                  shake?.key === card.key ? styles.shake : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <CardFace
                    key={card.key}
                    as="button"
                    card={ec}
                    // A card owning run-aware text (e.g. a self-scaling card's growing gain) renders its
                    // current value here; the shell just asks, with no per-card branch.
                    overrideText={c.display?.dynamicText?.(G, card.inst)}
                    stickerBadge={card.inst.stickers}
                    ref={(el) => {
                      if (el) cardEls.current.set(card.key, el as HTMLButtonElement);
                      else cardEls.current.delete(card.key);
                    }}
                    className={className}
                    style={card.isNew ? { animationDelay: `${Math.min(card.newOrder, 6) * 70}ms` } : undefined}
                    onPointerDown={(e) => onCardPointerDown(e, card)}
                    onClick={() => {
                      if (gameover && overlayMinimized) {
                        setZoom({
                          cardId: card.cardId,
                          overrideCard: ec,
                          overrideText: c.display?.dynamicText?.(G, card.inst),
                          stickerBadge: card.inst.stickers,
                        });
                        return;
                      }
                      if (pending) handlePendingClick(card);
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
              disabled={!!gameover || !canEndRound || handHeld}
              onClick={() => { if (shouldWarn || confirmEndTurn) setWarnEndRound(true); else endTurn(); }}
            >
              <span className={styles.endRoundLabel}>End Round</span>
              <span className={styles.endRoundRound}>Rd {G.round}</span>
            </button>
          )}
        </div>
      </div>

      {/* Run-start injection: a grey scrim over the board while each mission card swipes into place. */}
      {intro && <div className={styles.introScrim} aria-hidden="true" />}
      {introGhost && (
        <div className={styles.introLayer} aria-hidden="true">
          <CardFace
            key={introGhost.key}
            card={introGhost.card}
            overrideText={introGhost.overrideText}
            stickerBadge={introGhost.stickers}
            countBadge={introGhost.count}
            className={`${styles.introCard} ${introGhost.moving ? styles.introMoving : ''}`}
            style={{
              left: (introGhost.moving ? introGhost.to : introGhost.from).left,
              top: (introGhost.moving ? introGhost.to : introGhost.from).top,
              width: (introGhost.moving ? introGhost.to : introGhost.from).width,
              height: (introGhost.moving ? introGhost.to : introGhost.from).height,
            }}
          />
        </div>
      )}

      {ghosts.length > 0 && (
        <div className={styles.ghostLayer} aria-hidden="true">
          {ghosts.map((g) => (
            <CardFace
              key={g.id}
              card={g.card}
              overrideText={g.overrideText}
              stickerBadge={g.stickers}
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
              card={effectiveCard(CARDS[drag.cardId], G.hand[drag.handIdx])}
              overrideText={CARDS[drag.cardId].display?.dynamicText?.(G, G.hand[drag.handIdx])}
              stickerBadge={G.hand[drag.handIdx].stickers}
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

      {/* Worker-deployment tokens flying tray → box for the non-drag staffing paths (click-toggle
          staff, auto-staff on placing a card) — the motion a drag already gives for free. */}
      {workerFlights.length > 0 && (
        <div className={styles.workerFlightLayer} aria-hidden="true">
          {workerFlights.map((f) => {
            const at = f.moving ? f.to : f.from;
            return (
              <div
                key={f.id}
                className={`${styles.workerFlight} ${f.moving ? styles.workerFlightMoving : ''}`}
                style={{ left: at.left, top: at.top, width: at.width, height: at.height }}
              >
                🧍
              </div>
            );
          })}
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
                  const overrideText = CARDS[g.cardId].display?.dynamicText?.(G, g.inst);
                  const ec = effectiveCard(CARDS[g.cardId], g.inst);
                  return (
                    <CardFace
                      key={g.key}
                      card={ec}
                      overrideText={overrideText}
                      stickerBadge={g.inst.stickers}
                      className={styles.staticCard}
                      countBadge={g.count}
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoom({ cardId: g.cardId, overrideCard: ec, overrideText, stickerBadge: g.inst.stickers });
                      }}
                    />
                  );
                })}
              </div>
            )}
            <p className={styles.pileHint}>Click a card to zoom · click outside to close</p>
          </div>
        </div>
      )}

      {/* A card effect suspended awaiting a choice (e.g. Storytelling's discard choice). Resolve-only: no
          dismiss path — clicking an option is the only way out (see .interactionBackdrop). */}
      {G.pendingInteraction && (
        <div className={styles.interactionBackdrop} role="dialog" aria-modal="true">
          <div className={styles.interactionPanel}>
            <h3 className={styles.interactionPrompt}>{G.pendingInteraction.prompt}</h3>
            <div className={styles.interactionGrid}>
              {G.pendingInteraction.options.map((opt, i) => (
                <CardFace
                  key={opt.id}
                  card={effectiveCard(CARDS[opt.cardId], opt)}
                  overrideText={CARDS[opt.cardId].display?.dynamicText?.(G, opt)}
                  stickerBadge={opt.stickers}
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
        overrideCard={zoom?.overrideCard}
        overrideText={zoom?.overrideText}
        stickerBadge={zoom?.stickerBadge}
        onClose={() => setZoom(null)}
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
      // An 'infinite' mission has no win state and never touches mapProgress — its Influence
      // (rounds survived) is paid every attempt, win or lose, so its preview isn't gated on `won`.
      const alreadyCompleted = won && mission.kind !== 'infinite' && isCompleted(mapProgress, mission.id);
      // The player's unlock state entering this run, bundled to pass through `computeRewards` (a
      // preview — only `reward.influence` is read here; the id lists below drive the unlock names).
      const progress = { collection, unlockedStickers, unlockedBoardStickers, unlockedBoards };
      const reward =
        mission.kind === 'infinite'
          ? computeRewards(mission, false, progress, G.round)
          : won
            ? computeRewards(mission, alreadyCompleted, progress)
            : null;
      // The names of every unlock this clear actually grants — each reward card not already owned
      // (a mission may open several at once, e.g. the Stone Age set), and each card/board sticker or
      // board not already unlocked. `alreadyCompleted` already suppresses the whole reward line on a replay.
      const unlockedNames =
        reward && mission.reward
          ? [
              ...(mission.reward.unlockCardIds ?? []).filter((id) => !isOwned(collection, id)).map((id) => CARDS[id].name),
              ...(mission.reward.unlockStickerIds ?? []).filter((id) => !unlockedStickers[id]).map((id) => STICKERS[id].name),
              ...(mission.reward.unlockBoardStickerIds ?? [])
                .filter((id) => !unlockedBoardStickers[id])
                .map((id) => BOARD_STICKERS[id].name),
              ...(mission.reward.unlockBoardIds ?? []).filter((id) => !unlockedBoards[id]).map((id) => BOARDS[id].name),
              // A board upgrade grants its `to` board (the from→to swap the pickers show) — name it here
              // too so the win summary announces the headline reward, not just the card unlocks.
              ...(mission.reward.boardUpgrade && !unlockedBoards[mission.reward.boardUpgrade.to]
                ? [BOARDS[mission.reward.boardUpgrade.to].name]
                : []),
            ]
          : [];
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
                  : [
                      reward.influence > 0 ? `+${reward.influence} ⭐ Influence` : null,
                      unlockedNames.length ? `Unlocked ${unlockedNames.join(', ')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
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
