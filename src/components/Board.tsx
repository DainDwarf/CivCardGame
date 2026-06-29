import { useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { BuildingInstance, GameState, Resources } from '../rules';
import {
  canAfford,
  freePopulation,
  isOperating,
  projectedDelta,
  requiredWorkers,
  totalDefense,
} from '../rules';
import { CARDS, type CardDef } from '../content/cards';
import { MISSIONS } from '../content/missions';
import styles from './Board.module.css';

const COST_ICON: Record<keyof Resources, string> = { food: '🌾', production: '🔨', science: '🔬' };

/** Presentation-only cost label, e.g. "2🌾" · "3🔨 · discard 1" · "free". */
function describeCost(c: CardDef): string {
  const parts = (Object.entries(c.cost) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}${COST_ICON[k]}`);
  if (c.discardCost) parts.push(`discard ${c.discardCost}`);
  return parts.join(' · ') || 'free';
}

/** Presentation-only summary of what a card does (no game logic here). */
function describeCard(c: CardDef): string {
  if (c.kind === 'recurring') {
    const parts: string[] = [];
    if (c.effect?.gain) {
      parts.push('+' + Object.entries(c.effect.gain).map(([k, v]) => `${v} ${k}`).join(', '));
    }
    if (c.effect?.draw) parts.push(`draw ${c.effect.draw}`);
    if (c.effect?.population) parts.push(`+${c.effect.population} 👥`);
    return parts.join(' · ') || 'action';
  }
  const parts: string[] = [];
  if (c.tags?.includes('wonder')) parts.push('WONDER');
  if (c.produces) {
    parts.push(Object.entries(c.produces).map(([k, v]) => `+${v} ${k}/turn`).join(', '));
  }
  if (c.defense) parts.push(`🛡️${c.defense}`);
  if (c.workers) parts.push(`👷${c.workers}`);
  return parts.join(' · ');
}

/** A hoverable stat chip: icon + value (+ optional projected delta), with a tooltip. */
function Stat({
  icon,
  label,
  description,
  value,
  delta,
}: {
  icon: string;
  label: string;
  description: string;
  value: string | number;
  delta?: number;
}) {
  return (
    <span className={styles.stat} tabIndex={0}>
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

interface BuildingGroup {
  cardId: string;
  count: number;
  instances: BuildingInstance[];
}

/** Collapse repeated buildings into one row per type, keeping first-seen order. */
function groupTableau(tableau: BuildingInstance[]): BuildingGroup[] {
  const order: string[] = [];
  const map = new Map<string, BuildingInstance[]>();
  for (const b of tableau) {
    const list = map.get(b.cardId);
    if (list) {
      list.push(b);
    } else {
      map.set(b.cardId, [b]);
      order.push(b.cardId);
    }
  }
  return order.map((cardId) => {
    const instances = map.get(cardId)!;
    return { cardId, count: instances.length, instances };
  });
}

/** A card play awaiting its discard cost: which card (by hand index) and the sacrifices picked so far. */
interface PendingPlay {
  cardId: string;
  handIdx: number;
  need: number;
  discards: number[]; // hand indices marked to discard
}

export function Board({ G, ctx, moves, events }: BoardProps<GameState>) {
  const mission = MISSIONS[G.missionId];
  const [pending, setPending] = useState<PendingPlay | null>(null);

  /** Handle a click on a hand card at index `i`. */
  function onPlay(id: string, i: number) {
    if (pending) {
      if (i === pending.handIdx) return setPending(null); // click the pending card again to cancel
      const discards = pending.discards.includes(i)
        ? pending.discards.filter((d) => d !== i)
        : [...pending.discards, i];
      if (discards.length === pending.need) {
        moves.playCard(pending.cardId, discards.map((d) => G.hand[d]));
        setPending(null);
      } else {
        setPending({ ...pending, discards });
      }
      return;
    }
    const need = CARDS[id].discardCost ?? 0;
    // Only prompt for discards if you actually have that many other cards to spare;
    // otherwise it plays free.
    if (need > 0 && G.hand.length - 1 >= need) setPending({ cardId: id, handIdx: i, need, discards: [] });
    else moves.playCard(id);
  }

  if (ctx.gameover) {
    const won = ctx.gameover.outcome === 'victory';
    const famine = ctx.gameover.reason === 'famine';
    return (
      <div className={styles.app}>
        <h1>{won ? '🏛️ Victory' : '💀 Defeat'}</h1>
        <p>
          <strong>{mission.name}</strong> —{' '}
          {won
            ? 'objective achieved.'
            : famine
              ? 'famine struck — your people starved.'
              : 'your civilization has fallen.'}
        </p>
        <p>Reached round {G.round}</p>
      </div>
    );
  }

  const idle = freePopulation(G);
  const proj = projectedDelta(G, mission.onUpkeep);
  const groups = groupTableau(G.tableau);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>{mission.name} — Round {G.round}</h1>
        <p className={styles.desc}>{mission.description}</p>
        <p className={styles.progress}>🎯 {mission.progress(G)}</p>
      </header>

      <div className={styles.resources}>
        <Stat
          icon="🌾"
          label="Food"
          description="Sustenance from staffed farms. Your population eats it each round — if it goes negative, famine ends the run. The (±) is the net change if you end the round now."
          value={G.resources.food}
          delta={proj.food}
        />
        <Stat
          icon="🔨"
          label="Production"
          description="Your build budget, spent to play cards. The (±) is what your staffed buildings will add at end of round."
          value={G.resources.production}
          delta={proj.production}
        />
        <Stat
          icon="🔬"
          label="Science"
          description="Knowledge from staffed libraries; the goal of science missions. The (±) is end-of-round output."
          value={G.resources.science}
          delta={proj.science}
        />
        <Stat
          icon="👥"
          label="Population"
          description="Your people — a pool of workers. Each eats 1 food/round whether working or idle. Assign them to buildings to operate them; grow them with Settlers cards."
          value={`${G.population} (${idle} idle)`}
        />
        <span className={styles.sep} aria-hidden="true">|</span>
        <Stat
          icon="🛡️"
          label="Defense"
          description="Protection from your operating buildings and wonders (an unstaffed barracks defends nothing). In threat missions, keep it above the rising Threat."
          value={totalDefense(G.tableau)}
        />
        <span className={styles.sep} aria-hidden="true">|</span>
        <Stat icon="🃏" label="Deck" description="Cards left to draw this run." value={G.deck.length} />
        <Stat
          icon="♻️"
          label="Discard"
          description="Recurring cards you've played. Reshuffled into the deck when it runs out."
          value={G.discard.length}
        />
      </div>

      <section>
        <h2>Hand</h2>
        {G.hand.length === 0 && <p className={styles.empty}>No cards in hand.</p>}
        {pending && (
          <p className={styles.discardPrompt}>
            Playing <strong>{CARDS[pending.cardId].name}</strong> — pick{' '}
            {pending.need - pending.discards.length} card to discard, or click{' '}
            {CARDS[pending.cardId].name} again to cancel.
          </p>
        )}
        <div className={styles.cards}>
          {G.hand.map((id, i) => {
            const c = CARDS[id];
            // The discard cost never blocks play — it's waived when you can't cover it.
            const affordable = canAfford(G.resources, c.cost);
            const isPending = pending?.handIdx === i;
            const isSacrifice = pending?.discards.includes(i) ?? false;
            const className = [
              c.kind === 'recurring' ? styles.action : styles.permanent,
              isPending ? styles.pending : '',
              isSacrifice ? styles.sacrifice : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={`${id}-${i}`}
                className={className}
                disabled={pending ? false : !affordable}
                onClick={() => onPlay(id, i)}
                title={describeCard(c)}
              >
                <span className={styles.cardName}>{c.name}</span>
                <span className={styles.cardCost}>{describeCost(c)}</span>
                <span className={styles.cardText}>{describeCard(c)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2>
          Civilization{' '}
          {idle > 0 && <span className={styles.idleHint}>· {idle} idle 👷 to assign</span>}
        </h2>
        {groups.length === 0 && <p className={styles.empty}>Nothing built yet.</p>}
        <ul className={styles.tableau}>
          {groups.map((g) => {
            const c = CARDS[g.cardId];
            const req = requiredWorkers(g.cardId);
            const selfSufficient = req === 0;
            const capacity = req * g.count;
            const assigned = g.instances.reduce((sum, b) => sum + b.workers, 0);
            const operatingCount = g.instances.filter(isOperating).length;
            const allOperating = operatingCount === g.count;
            return (
              <li key={g.cardId} className={allOperating ? styles.operating : styles.idleBuilding}>
                <span className={styles.bName}>
                  {c.name}
                  {g.count > 1 ? ` ×${g.count}` : ''}
                </span>
                <span className={styles.muted}>{describeCard(c)}</span>
                {selfSufficient ? (
                  <span className={styles.staff}>self-sufficient</span>
                ) : (
                  <span className={styles.staff}>
                    <button
                      onClick={() => moves.unassignWorker(g.cardId)}
                      disabled={assigned <= 0}
                      aria-label={`unassign worker from ${c.name}`}
                    >
                      −
                    </button>
                    👷 {assigned}/{capacity}
                    <button
                      onClick={() => moves.assignWorker(g.cardId)}
                      disabled={idle <= 0 || assigned >= capacity}
                      aria-label={`assign worker to ${c.name}`}
                    >
                      +
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <button className={styles.end} onClick={() => events.endTurn?.()}>
        End Round →
      </button>
    </div>
  );
}
