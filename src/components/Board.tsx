import { useEffect, useRef, useState } from 'react';
import type { BuildingInstance, Resources } from '../rules';
import { useGame } from '../run/GameContext';
import {
  canAfford,
  freePopulation,
  freeTerritory,
  isOperating,
  projectedDelta,
  requiredWorkers,
  usedTerritory,
} from '../rules';
import { CARDS, type CardDef } from '../content/cards';
import { BUILDINGS, type BuildingDef } from '../content/buildings';
import { MISSIONS, type MissionDef } from '../content/missions';
import type { GameState } from '../rules';
import styles from './Board.module.css';

const COST_ICON: Record<keyof Resources, string> = { food: '🌾', production: '🔨', science: '🔬', military: '⚔️', money: '🪙' };

/** Presentation-only "art" glyph shown on each card face. */
const CARD_ART: Record<string, string> = {
  farm: '🌾',
  granary: '🌽',
  workshop: '⚒️',
  library: '📚',
  university: '🎓',
  theater: '🎭',
  walls: '🧱',
  barracks: '⚔️',
  pyramids: '🔺',
  great_library: '📜',
  colossus: '🗿',
  settlers: '⛺',
  forced_labor: '⛓️',
  eureka: '💡',
  harvest: '🧺',
  inspiration: '✨',
  cultural_festival: '🎉',
  philosopher: '🏛️',
  village_settlement: '🏘️',
  conquest: '🗡️',
  develop: '🏗️',
  destroy: '💥',
};
const artFor = (id: string) => CARD_ART[id] ?? '🏛️';

/** Presentation-only cost label, e.g. "2🌾" · "10🌾 · 2👥" · "3🔨 · discard 1" · "free". */
function describeCost(c: CardDef): string {
  const parts = (Object.entries(c.cost) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}${COST_ICON[k]}`);
  if (c.popCost) parts.push(`${c.popCost}👥`);
  if (c.discardCost) parts.push(`discard ${c.discardCost}`);
  return parts.join(' · ') || 'free';
}

/** Presentation-only summary of a building's output. */
function describeBuilding(b: BuildingDef): string {
  const parts: string[] = [];
  if (b.produces) {
    parts.push(Object.entries(b.produces).map(([k, v]) => `+${v} ${k}/turn`).join(', '));
  }
  if (b.cultureOutput) parts.push(`+${b.cultureOutput} 🎭/turn`);
  if (b.workers) parts.push(`👷${b.workers}`);
  return parts.join(' · ');
}

/** Presentation-only summary of what a card does (no game logic here). */
function describeCard(c: CardDef): string {
  const e = c.effect;
  const parts: string[] = [];
  if (c.cultureThreshold) parts.push(`requires 🎭 ${c.cultureThreshold}`);
  if (e?.gain) parts.push('+' + Object.entries(e.gain).map(([k, v]) => `${v} ${k}`).join(', '));
  if (e?.draw) parts.push(`draw ${e.draw}`);
  if (e?.population) parts.push(`+${e.population} 👥`);
  if (e?.territory) parts.push(`+${e.territory} 🗺️ territory`);
  if (e?.culture) parts.push(`+${e.culture} 🎭`);
  if (e?.destroy) parts.push('demolish a building → free its slot');
  if (e?.build) {
    const bld = BUILDINGS[e.build];
    // A permanent card *is* the building, so just show its stats; a recurring builder
    // (e.g. Village Settlement) names the building it erects, since the names differ.
    if (c.kind === 'recurring') parts.push(`🏗️ ${bld.name}`);
    const stats = describeBuilding(bld);
    if (stats) parts.push(stats);
  }
  return parts.join(' · ') || 'action';
}

/** The card's type banner — label + colour variant, shown under the name. */
function cardBanner(c: CardDef): { label: string; variant: string } {
  const built = c.effect?.build ? BUILDINGS[c.effect.build] : undefined;
  if (built?.tags?.includes('wonder')) return { label: 'Wonder', variant: styles.bannerWonder };
  if (c.kind === 'recurring') return { label: 'Action', variant: styles.bannerAction };
  return { label: 'Building', variant: styles.bannerBuilding };
}

/** The visual face of a card — shared by hand cards and the play-animation ghost. */
function CardFace({ card }: { card: CardDef }) {
  const text = describeCard(card);
  const banner = cardBanner(card);
  return (
    <>
      <div className={styles.cardTop}>
        <span className={styles.cardName}>{card.name}</span>
        <span className={styles.cardCost}>{describeCost(card)}</span>
      </div>
      <div className={`${styles.cardBanner} ${banner.variant}`}>{banner.label}</div>
      <div className={styles.cardArt} aria-hidden="true">
        {artFor(card.id)}
      </div>
      {text && <div className={styles.cardText}>{text}</div>}
    </>
  );
}

/** A hoverable stat chip: icon + value (+ optional projected delta), with a tooltip. */
function Stat({
  icon,
  label,
  description,
  value,
  delta,
  warn,
}: {
  icon: string;
  label: string;
  description: string;
  value: string | number;
  delta?: number;
  warn?: boolean;
}) {
  return (
    <span className={`${styles.stat}${warn ? ` ${styles.statWarn}` : ''}`} tabIndex={0}>
      <span aria-hidden="true">{icon}</span> {value}
      {delta !== undefined && (
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

/** Left-column widget in the top banner: shows mission name, round, live progress, and a tooltip. */
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
        <span className={styles.ttFamine}>
          {mission.failureHint ? '☠️ Famine also ends all runs.' : '☠️ Famine (food going negative) ends all runs.'}
        </span>
      </div>
    </div>
  );
}

interface BuildingGroup {
  buildingId: string;
  count: number;
  instances: BuildingInstance[];
}

/** Collapse repeated buildings into one row per type, keeping first-seen order. */
function groupTableau(tableau: BuildingInstance[]): BuildingGroup[] {
  const order: string[] = [];
  const map = new Map<string, BuildingInstance[]>();
  for (const b of tableau) {
    const list = map.get(b.buildingId);
    if (list) {
      list.push(b);
    } else {
      map.set(b.buildingId, [b]);
      order.push(b.buildingId);
    }
  }
  return order.map((buildingId) => {
    const instances = map.get(buildingId)!;
    return { buildingId, count: instances.length, instances };
  });
}

/** Collapse a flat list of card ids into one entry per type with a count, keeping first-seen order. */
function groupCards(ids: string[]): { cardId: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    const n = counts.get(id);
    if (n) counts.set(id, n + 1);
    else {
      counts.set(id, 1);
      order.push(id);
    }
  }
  return order.map((cardId) => ({ cardId, count: counts.get(cardId)! }));
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
  /** Index into `G.hand` this render (what the moves API expects). */
  handIdx: number;
  /** True only on the render where the card first appears — drives the deal-in animation. */
  isNew: boolean;
  /** Sequence among newly-dealt cards this render, for staggering the deal. */
  newOrder: number;
}

/**
 * `G.hand` is a bare `string[]` with no per-card identity. To animate draws without
 * re-animating cards that were already in hand, we give each physical card a stable key:
 * greedily match the new hand against the previously-seen one by cardId; anything left
 * over is freshly drawn (`isNew`). Keys are derived purely from the committed mapping
 * (no mutation during render), so it's safe under StrictMode's double-render.
 */
function useAnimatedHand(hand: string[]): HandCard[] {
  const committedRef = useRef<{ key: number; cardId: string }[]>([]);
  const committed = committedRef.current;
  let nextKey = committed.reduce((m, c) => Math.max(m, c.key), 0) + 1;
  let newOrder = 0;
  const used = new Array(committed.length).fill(false);

  const display: HandCard[] = hand.map((cardId, handIdx) => {
    for (let j = 0; j < committed.length; j++) {
      if (!used[j] && committed[j].cardId === cardId) {
        used[j] = true;
        return { key: committed[j].key, cardId, handIdx, isNew: false, newOrder: 0 };
      }
    }
    return { key: nextKey++, cardId, handIdx, isNew: true, newOrder: newOrder++ };
  });

  // Commit after render so the next render sees these keys and stops flagging them as new.
  useEffect(() => {
    committedRef.current = display.map((d) => ({ key: d.key, cardId: d.cardId }));
  });

  return display;
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

export function Board() {
  const { G, gameover, moves, endTurn } = useGame();
  const mission = MISSIONS[G.missionId];
  const [pending, setPending] = useState<PendingPlay | null>(null);
  const [pendingDestroy, setPendingDestroy] = useState<PendingDestroy | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pileView, setPileView] = useState<{ title: string; cards: string[] } | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const [shake, setShake] = useState<{ key: number; n: number } | null>(null);
  const [warnEndRound, setWarnEndRound] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const cardEls = useRef<Map<number, HTMLButtonElement>>(new Map());
  const handBarRef = useRef<HTMLDivElement>(null);
  const ghostSeq = useRef(0);
  const shakeSeq = useRef(0);
  const hand = useAnimatedHand(G.hand);

  /** Flash a "can't afford" shake on a card that snapped back to the hand. */
  function rejectShake(key: number) {
    const n = ++shakeSeq.current;
    setShake({ key, n });
    window.setTimeout(() => setShake((s) => (s && s.n === n ? null : s)), 420);
  }

  // Keep a ref in lockstep with drag state so the window pointer listeners read fresh values.
  function setDrag(d: DragState | null) {
    dragRef.current = d;
    setDragState(d);
  }

  /** Spawn a transient clone that animates a card out, then clean it up. */
  function spawnGhost(cardId: string, rect: Rect, anim: 'play' | 'drop') {
    const id = ghostSeq.current++;
    setGhosts((gs) => [...gs, { id, cardId, rect, anim }]);
    window.setTimeout(() => setGhosts((gs) => gs.filter((x) => x.id !== id)), anim === 'drop' ? 360 : 440);
  }

  /** Fly-up animation from a card's slot in the hand (used by the discard-cost flow). */
  function ghostFromSlot(key: number, cardId: string) {
    const el = cardEls.current.get(key);
    if (!el) return;
    const r = el.getBoundingClientRect();
    spawnGhost(cardId, { left: r.left, top: r.top, width: r.width, height: r.height }, 'play');
  }

  /** Try to play a dragged card released over the board. */
  function attemptPlay(d: DragState, x: number, y: number) {
    const card = CARDS[d.cardId];
    // Unaffordable (resources, idle population, no open building slot, or no building to destroy).
    if (
      !canAfford(G.resources, card.cost) ||
      (card.popCost ?? 0) > freePopulation(G) ||
      (card.cultureThreshold && G.culture < card.cultureThreshold) ||
      (card.effect?.build && freeTerritory(G) <= 0) ||
      (card.effect?.destroy && G.tableau.length === 0)
    ) {
      return rejectShake(d.key);
    }
    // Destroy card: player must choose a building target before the move fires.
    if (card.effect?.destroy) {
      setPendingDestroy({ cardId: d.cardId, handIdx: d.handIdx, playedKey: d.key });
      return;
    }
    const need = card.discardCost ?? 0;
    // A discard cost only applies if you have spare cards; then pick the sacrifice by clicking.
    if (need > 0 && G.hand.length - 1 >= need) {
      setPending({ cardId: d.cardId, handIdx: d.handIdx, playedKey: d.key, need, discards: [] });
      return;
    }
    spawnGhost(d.cardId, { left: x - d.grabX, top: y - d.grabY, width: d.w, height: d.h }, 'drop');
    moves.playCard(d.handIdx);
  }

  /** Resolve a finished drag: a non-drag press zooms; a drag over the board plays. */
  function finishDrag(d: DragState, x: number, y: number) {
    if (!d.active) {
      setZoom(d.cardId); // it was a click, not a drag
    } else {
      const barTop = handBarRef.current?.getBoundingClientRect().top ?? Infinity;
      if (y < barTop) attemptPlay(d, x, y); // released above the hand bar = over the board
    }
    setDrag(null);
  }

  function onCardPointerDown(e: React.PointerEvent, card: HandCard) {
    if (e.button !== 0 || pending || pendingDestroy) return; // in selection mode, clicks select instead
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

  const idle = freePopulation(G);
  const territory = freeTerritory(G);
  const hasUnstaffedCapacity = G.tableau.some((b) => !isOperating(b));
  const shouldWarn = idle > 0 && hasUnstaffedCapacity;

  // Clear pending sacrifice-pick, pending destroy, and end-round warning at the start of each new round.
  useEffect(() => {
    setPending(null);
    setPendingDestroy(null);
    setWarnEndRound(false);
  }, [G.round]);

  // warnEndRound is only meaningful while shouldWarn is true; reset it if the player
  // staffs all buildings after triggering the dialog (so it can't ghost-trigger later).
  useEffect(() => {
    if (!shouldWarn) setWarnEndRound(false);
  }, [shouldWarn]);

  /** In sacrifice-pick mode, a click toggles a card as the discard (or cancels the play). */
  function handlePendingClick(card: HandCard) {
    if (!pending) return;
    const i = card.handIdx;
    if (i === pending.handIdx) return setPending(null); // click the pending card again to cancel
    const discards = pending.discards.includes(i)
      ? pending.discards.filter((d) => d !== i)
      : [...pending.discards, i];
    if (discards.length === pending.need) {
      ghostFromSlot(pending.playedKey, pending.cardId);
      moves.playCard(pending.handIdx, discards);
      setPending(null);
    } else {
      setPending({ ...pending, discards });
    }
  }

  /** Fire the destroy move against a chosen building, then exit targeting mode. */
  function handleDestroyTarget(buildingId: string) {
    if (!pendingDestroy) return;
    ghostFromSlot(pendingDestroy.playedKey, pendingDestroy.cardId);
    moves.playCard(pendingDestroy.handIdx, [], buildingId);
    setPendingDestroy(null);
  }


  if (gameover) {
    const won = gameover.outcome === 'victory';
    const COLLAPSE_MESSAGES: Record<string, string> = {
      famine:     'famine struck — your people starved.',
      ruin:       'ruin befell — your economy collapsed.',
      bankruptcy: 'bankruptcy struck — your treasury ran dry.',
      dark_age:   'a dark age descended — knowledge was lost.',
      revolt:     'revolt erupted — your people rose against you.',
    };
    const defeatMessage = (gameover.reason && COLLAPSE_MESSAGES[gameover.reason]) ?? 'your civilization has fallen.';
    return (
      <div className={styles.app}>
        <h1>{won ? '🏛️ Victory' : '💀 Defeat'}</h1>
        <p>
          <strong>{mission.name}</strong> —{' '}
          {won ? 'objective achieved.' : defeatMessage}
        </p>
        <p>Reached round {G.round}</p>
      </div>
    );
  }

  const proj = projectedDelta(G, mission.onUpkeep);
  const collapseRisk = (key: keyof typeof G.resources) => G.resources[key] + proj[key] < 0;
  const groups = groupTableau(G.tableau);
  const canEndRound = !pending && !pendingDestroy && !drag;

  return (
    <div className={styles.app}>
      <header className={styles.topBanner}>
        <MissionWidget mission={mission} G={G} />

        <div className={styles.strategicGroup}>
          <Stat
            icon="👥"
            label="Population"
            description="Your people — a pool of workers. Each eats 1 food/round whether working or idle. Assign them to buildings to operate them; grow them with Settlers cards."
            value={`${G.population} (${idle} idle)`}
          />
          <Stat
            icon="🗺️"
            label="Territory"
            description="Building slots. Each building you construct fills one; building cards can't be played once it's full. Certain cards expand it."
            value={`${usedTerritory(G.tableau)}/${G.territory}`}
          />
          <Stat
            icon="🎭"
            label="Culture"
            description="Your civilization's cultural level — it grows but is never spent. Cultural buildings add to it each round; certain action cards give an immediate boost. Some cards require a minimum culture level to play."
            value={G.culture}
            delta={proj.culture}
          />
        </div>

        <div className={styles.coreGroup}>
          <Stat
            icon="🌾"
            label="Food"
            description="Sustenance from staffed farms. Your population eats it each round — if it goes negative, famine ends the run. The (±) is the net change if you end the round now."
            value={G.resources.food}
            delta={proj.food}
            warn={collapseRisk('food')}
          />
          <Stat
            icon="🔨"
            label="Production"
            description="Your build budget, spent to play cards. The (±) is what your staffed buildings will add at end of round."
            value={G.resources.production}
            delta={proj.production}
            warn={collapseRisk('production')}
          />
          <Stat
            icon="🪙"
            label="Money"
            description="Coin from your markets and trade. Spent on action cards."
            value={G.resources.money}
            delta={proj.money}
            warn={collapseRisk('money')}
          />
          <Stat
            icon="⚔️"
            label="Military"
            description="Military power stockpiled from your operating defenses. In Barbarian Tide, threat drains it each round — let it hit zero and the city falls."
            value={G.resources.military}
            delta={proj.military}
            warn={collapseRisk('military')}
          />
          <Stat
            icon="🔬"
            label="Science"
            description="Knowledge from staffed libraries; the goal of science missions. The (±) is end-of-round output."
            value={G.resources.science}
            delta={proj.science}
            warn={collapseRisk('science')}
          />
        </div>
      </header>

      <section className={styles.civSection}>
        <h2>Civilization</h2>
        {groups.length === 0 && <p className={styles.empty}>Nothing built yet.</p>}
        <ul className={styles.tableau}>
          {groups.map((g) => {
            const bld = BUILDINGS[g.buildingId];
            const req = requiredWorkers(g.buildingId);
            const selfSufficient = req === 0;
            const capacity = req * g.count;
            const assigned = g.instances.reduce((sum, b) => sum + b.workers, 0);
            const operatingCount = g.instances.filter(isOperating).length;
            const allOperating = operatingCount === g.count;
            return (
              <li key={g.buildingId} className={allOperating ? styles.operating : styles.idleBuilding}>
                <span className={styles.bName}>
                  {bld.name}
                  {g.count > 1 ? ` ×${g.count}` : ''}
                </span>
                <span className={styles.muted}>{describeBuilding(bld)}</span>
                {selfSufficient ? (
                  <span className={styles.staff}>self-sufficient</span>
                ) : (
                  <span className={styles.staff}>
                    <button
                      onClick={() => moves.unassignWorker(g.buildingId)}
                      disabled={assigned <= 0}
                      aria-label={`unassign worker from ${bld.name}`}
                    >
                      −
                    </button>
                    👷 {assigned}/{capacity}
                    <button
                      onClick={() => moves.assignWorker(g.buildingId)}
                      disabled={idle <= 0 || assigned >= capacity}
                      aria-label={`assign worker to ${bld.name}`}
                    >
                      +
                    </button>
                  </span>
                )}
                {pendingDestroy && (
                  <button
                    className={styles.demolishBtn}
                    onClick={() => handleDestroyTarget(g.buildingId)}
                    aria-label={`demolish ${bld.name}`}
                  >
                    💥 Demolish
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className={styles.handBar} ref={handBarRef}>
        <div className={styles.handBarInner}>
          <Pile variant={styles.pileDeck} label="deck" count={G.deck.length} />

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
            <div className={styles.hand}>
              {hand.length === 0 && <p className={styles.empty}>No cards in hand.</p>}
              {hand.map((card) => {
                const c = CARDS[card.cardId];
                // The discard cost never blocks play — it's waived when you can't cover it.
                // A building card also needs an open slot; a destroy card needs a building to target.
                const affordable =
                  canAfford(G.resources, c.cost) &&
                  (c.popCost ?? 0) <= idle &&
                  (!c.cultureThreshold || G.culture >= c.cultureThreshold) &&
                  (!c.effect?.build || territory > 0) &&
                  (!c.effect?.destroy || G.tableau.length > 0);
                const isPending = pending?.handIdx === card.handIdx;
                const isPendingDestroy = pendingDestroy?.handIdx === card.handIdx;
                const isSacrifice = pending?.discards.includes(card.handIdx) ?? false;
                const isDragging = drag?.active === true && drag.key === card.key;
                const className = [
                  styles.card,
                  c.kind === 'recurring' ? styles.action : styles.permanent,
                  card.isNew ? styles.dealIn : '',
                  isPending || isPendingDestroy ? styles.pending : '',
                  isSacrifice ? styles.sacrifice : '',
                  isDragging ? styles.dragging : '',
                  !affordable && !pending && !pendingDestroy ? styles.unaffordable : '',
                  shake?.key === card.key ? styles.shake : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={card.key}
                    ref={(el) => {
                      if (el) cardEls.current.set(card.key, el);
                      else cardEls.current.delete(card.key);
                    }}
                    className={className}
                    style={card.isNew ? { animationDelay: `${Math.min(card.newOrder, 6) * 70}ms` } : undefined}
                    onPointerDown={(e) => onCardPointerDown(e, card)}
                    onClick={() => {
                      if (pending) handlePendingClick(card);
                      else if (pendingDestroy && card.handIdx === pendingDestroy.handIdx) setPendingDestroy(null);
                    }}
                  >
                    <CardFace card={c} />
                  </button>
                );
              })}
            </div>
          </div>

          <Pile
            variant={styles.pileDiscard}
            label="discard"
            count={G.discard.length}
            onView={() => setPileView({ title: 'Discard pile', cards: [...G.discard] })}
          />
          <Pile
            variant={styles.pileRemoved}
            label="removed"
            count={G.removed.length}
            onView={() => setPileView({ title: 'Removed from deck', cards: [...G.removed] })}
          />

          {warnEndRound && shouldWarn ? (
            <div className={styles.endRoundWarn}>
              <span className={styles.endRoundWarnMsg}>
                {idle} idle 👷<br />unstaffed buildings
              </span>
              <div className={styles.endRoundWarnBtns}>
                <button
                  className={styles.endRoundConfirm}
                  disabled={!canEndRound}
                  onClick={() => { setWarnEndRound(false); endTurn(); }}
                >
                  End anyway
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
              disabled={!canEndRound}
              onClick={() => { if (shouldWarn) setWarnEndRound(true); else endTurn(); }}
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
            <div
              key={g.id}
              className={[
                styles.ghostCard,
                CARDS[g.cardId].kind === 'recurring' ? styles.action : styles.permanent,
                g.anim === 'drop' ? styles.ghostDrop : styles.ghostPlay,
              ].join(' ')}
              style={{ left: g.rect.left, top: g.rect.top, width: g.rect.width, height: g.rect.height }}
            >
              <CardFace card={CARDS[g.cardId]} />
            </div>
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
            <div
              className={`${styles.dragCard} ${
                CARDS[drag.cardId].kind === 'recurring' ? styles.action : styles.permanent
              }`}
              style={{ left: drag.x - drag.grabX, top: drag.y - drag.grabY, width: drag.w, height: drag.h }}
            >
              <CardFace card={CARDS[drag.cardId]} />
            </div>
          </div>
        </>
      )}

      {/* Zoomed card preview, opened by clicking a card. */}
      {zoom && (
        <div className={styles.zoomBackdrop} onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <div className={styles.zoomWrap}>
            <div
              className={`${styles.card} ${styles.zoomCard} ${
                CARDS[zoom].kind === 'recurring' ? styles.action : styles.permanent
              }`}
            >
              <CardFace card={CARDS[zoom]} />
            </div>
          </div>
          <p className={styles.zoomHint}>Drag a card onto the board to play · click anywhere to close</p>
        </div>
      )}

      {/* Discard / removed pile contents, opened by clicking a pile. */}
      {pileView && (
        <div
          className={styles.zoomBackdrop}
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
                {groupCards(pileView.cards).map((g) => (
                  <div key={g.cardId} className={styles.pileGridItem}>
                    <div
                      className={`${styles.card} ${styles.staticCard} ${
                        CARDS[g.cardId].kind === 'recurring' ? styles.action : styles.permanent
                      }`}
                    >
                      <CardFace card={CARDS[g.cardId]} />
                    </div>
                    {g.count > 1 && <span className={styles.pileQty}>×{g.count}</span>}
                  </div>
                ))}
              </div>
            )}
            <p className={styles.zoomHint}>Click anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
