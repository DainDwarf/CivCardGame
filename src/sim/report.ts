import { addResources, emptyResources, type Resources } from '../rules/resources';
import type { ScenarioRuns } from './batch';

/** The folded statistics for one scenario's runs — the balance answer `formatReport` renders. All
 *  pure over the `ScenarioRuns` (no I/O), so it's unit-testable off hand-built outcomes. */
export interface ScenarioSummary {
  label: string;
  runs: number;
  wins: number;
  /** Fraction in `[0, 1]`; `0` when `runs === 0`. */
  winRate: number;
  turns: { min: number; mean: number; median: number; max: number };
  /** Mean of each `RunResult.stats.finalResources` at run end. */
  meanResources: Resources;
  meanStrategic: { population: number; territory: number; culture: number };
  /** How defeats ended, grouped by the authoritative `gameover.reason` (a `CollapseReason` like
   *  `famine`, or a threat cause like the sandbox deadline) — never re-derived from resources, since a
   *  deadline defeat leaves no negative pool. Victories are omitted. The "food economy too tight?" cue. */
  defeatCauses: Record<string, number>;
  /** Total accepted `playCard` count per cardId, summed across runs. */
  cardPlays: Record<string, number>;
  /** Distinct `scenario.deckCardIds` that were *never* played in any run — the "dead card?" cue. */
  unplayedCards: string[];
  meanActions: number;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Fold one scenario's runs into a {@link ScenarioSummary}. */
export function summarize(runs: ScenarioRuns): ScenarioSummary {
  const { scenario, outcomes } = runs;
  const n = outcomes.length;

  const turnsList = outcomes.map((o) => o.result.stats.turnsTaken);
  const wins = outcomes.filter((o) => o.result.outcome === 'victory').length;

  const meanResources = emptyResources();
  let popSum = 0;
  let terrSum = 0;
  let cultSum = 0;
  // min/max folded into the loop rather than `Math.min(...turnsList)` — the spread overflows the call
  // stack at the large seed counts this tool exists to enable.
  let turnsMin = Infinity;
  let turnsMax = -Infinity;
  const defeatCauses: Record<string, number> = {};
  const cardPlays: Record<string, number> = {};

  for (const o of outcomes) {
    const t = o.result.stats.turnsTaken;
    if (t < turnsMin) turnsMin = t;
    if (t > turnsMax) turnsMax = t;
    addResources(meanResources, o.result.stats.finalResources);
    popSum += o.result.stats.strategicResources.population;
    terrSum += o.result.stats.strategicResources.territory;
    cultSum += o.result.stats.strategicResources.culture;
    if (o.result.outcome === 'defeat') {
      const cause = o.gameover.reason ?? 'unknown';
      defeatCauses[cause] = (defeatCauses[cause] ?? 0) + 1;
    }
    for (const [cardId, count] of Object.entries(o.cardPlays)) {
      cardPlays[cardId] = (cardPlays[cardId] ?? 0) + count;
    }
  }
  if (n > 0) {
    for (const k of Object.keys(meanResources) as (keyof Resources)[]) meanResources[k] /= n;
  }

  const unplayedCards = [...new Set(scenario.deckCardIds)].filter((id) => !cardPlays[id]);

  return {
    label: scenario.label,
    runs: n,
    wins,
    winRate: n === 0 ? 0 : wins / n,
    turns: {
      min: n === 0 ? 0 : turnsMin,
      mean: mean(turnsList),
      median: median(turnsList),
      max: n === 0 ? 0 : turnsMax,
    },
    meanResources,
    meanStrategic: { population: n === 0 ? 0 : popSum / n, territory: n === 0 ? 0 : terrSum / n, culture: n === 0 ? 0 : cultSum / n },
    defeatCauses,
    cardPlays,
    unplayedCards,
    meanActions: mean(outcomes.map((o) => o.actionsApplied)),
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function round1(x: number): string {
  return x.toFixed(1);
}

/** Sort a count map into `label ×N` lines, most frequent first. */
function histLines(counts: Record<string, number>, indent = '    '): string[] {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return [`${indent}(none)`];
  return entries.map(([k, v]) => `${indent}${k}: ${v}`);
}

/** Render a batch of summaries as a plain-text report (mission-agnostic; used by the `sim` CLI). */
export function formatReport(summaries: ScenarioSummary[]): string {
  const blocks = summaries.map((s) => {
    const r = s.meanResources;
    const lines = [
      `## ${s.label}`,
      `  runs        : ${s.runs}`,
      `  win rate    : ${pct(s.winRate)}  (${s.wins}/${s.runs})`,
      `  turns       : min ${s.turns.min} · median ${round1(s.turns.median)} · mean ${round1(s.turns.mean)} · max ${s.turns.max}`,
      `  mean actions: ${round1(s.meanActions)}`,
      `  mean end res: food ${round1(r.food)} · prod ${round1(r.production)} · sci ${round1(r.science)} · mil ${round1(r.military)} · money ${round1(r.money)}`,
      `  mean strat  : pop ${round1(s.meanStrategic.population)} · terr ${round1(s.meanStrategic.territory)} · cult ${round1(s.meanStrategic.culture)}`,
      `  defeat causes:`,
      ...histLines(s.defeatCauses),
      `  card plays:`,
      ...histLines(s.cardPlays),
      `  unplayed cards: ${s.unplayedCards.length ? s.unplayedCards.join(', ') : '(none)'}`,
    ];
    return lines.join('\n');
  });
  return blocks.join('\n\n');
}
