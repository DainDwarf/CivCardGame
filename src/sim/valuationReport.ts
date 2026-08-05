import { CORE_KEYS, STRATEGIC_KEYS, type Resources } from '../rules';
import { ENABLER_CONSTANTS, weightSource, type EnablerExplain } from './enablers';
import { OBJECTIVE_WEIGHT, SCORE_WEIGHTS, type ScoreBreakdown } from './value';

/**
 * Renders the derived goal valuation — `sim/objective.ts`'s gradient, `sim/value.ts`'s bands and
 * `sim/enablers.ts`'s model — for the `sim:valuation` CLI. Pure over its input like `sim/report.ts`, whose
 * split this follows: rendering lives here, I/O and flags in `scripts/`.
 *
 * The unit throughout is a **goal step** (`gs`): a score figure over `OBJECTIVE_WEIGHT`, so `60` reads as
 * `0.20 gs` and is comparable against the objective it is shaping toward. A raw score point is meaningless
 * on its own — it is a fifth of the win or a twelfth of it depending on a constant in another file.
 */

/** One term set's derivation of a cell, under the name it was asked for (`planner`, `full`, `no-floor`…). */
export interface ValuationModel {
  name: string;
  explain: EnablerExplain;
  /** `enablerPotential` at the run root — what the shaping is worth before a move is made. */
  rootPotential: number;
}

/** One inspected cell: its config, the term-set-independent facts (the objective gradient and the score
 *  bands, which carry no shaping), and one derivation per requested term set. */
export interface ValuationCell {
  label: string;
  /** The fixture this came from, when it came from one. */
  source?: string;
  missionId: string;
  missionName: string;
  objectiveCardId: string;
  board: string;
  boardStickers: string[];
  deckSize: number;
  /** `objectiveProgress` at the root — the gradient's starting point. */
  rootProgress: number;
  score: ScoreBreakdown;
  permanent: Resources;
  resources: Resources;
  projected: Resources;
  models: ValuationModel[];
}

const RESOURCE_LABEL: Record<keyof Resources, string> = {
  food: 'food',
  production: 'production',
  science: 'science',
  military: 'military',
  money: 'money',
  population: 'population',
  culture: 'culture',
  territory: 'territory',
};

const ALL_KEYS: (keyof Resources)[] = [...CORE_KEYS, ...STRATEGIC_KEYS];
const CAPACITY_POOLS = ['territory', 'population', 'culture'] as const;

function n1(x: number): string {
  return x.toFixed(1);
}

function gs(x: number): string {
  return (x / OBJECTIVE_WEIGHT).toFixed(3);
}

/** The summed durable-producer credit, and whether `PRODUCER_CREDIT_CAP` binds it — a total well past the
 *  cap means a further structure's *marginal* credit is zero, which the per-card figures never show. */
function producerTotal(e: EnablerExplain): number {
  return Object.values(e.model.producerCredit).reduce<number>((n, v) => n + (v ?? 0), 0);
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

const LABEL_W = 28;
/** Wide enough for the longest cell the model produces — a chained conversion naming both its target pool
 *  and its card (`0.8 (2) conv>territory:conquest`). A column that overflows silently runs into its
 *  neighbour, which misreads as the neighbour's value. */
const COL_W = 33;

/** One `label` + one cell per term set. */
function row(label: string, cells: string[]): string {
  return `  ${pad(label, LABEL_W)}${cells.map((c) => pad(c, COL_W)).join('')}`.trimEnd();
}

function cellBlock(cell: ValuationCell): string {
  const out: string[] = [];
  const names = cell.models.map((m) => m.name);
  const first = cell.models[0]?.explain;

  out.push('');
  out.push(
    `── ${cell.label} · ${cell.missionName} · ${cell.board}${
      cell.boardStickers.length ? ` +${cell.boardStickers.join('+')}` : ''
    } · ${cell.deckSize} cards ${'─'.repeat(6)}${cell.source ? `  ${cell.source}` : ''}`,
  );
  out.push(`objective ${cell.objectiveCardId} · progress@root ${cell.rootProgress.toFixed(3)}`);
  out.push('');

  // The bands carry no shaping, so they print once above the columns rather than per term set.
  const s = cell.score;
  const band = (tag: string, label: string, value: number, note: string): string =>
    `  ${pad(tag, 8)}${pad(label, 17)}${pad(n1(value), 10)} ${note}`.trimEnd();
  out.push(`scoreState @root ${n1(s.total)}   (bands 2/4/5 read the projection, band 3 reads raw)`);
  out.push(band('band 2', 'collapse cliff', s.collapseCliff, `x${SCORE_WEIGHTS.collapseCliff} per unit projected negative`));
  out.push(
    band(
      'band 3',
      'buffer shortfall',
      s.buffer,
      `x${SCORE_WEIGHTS.bufferWeight} below floor ${SCORE_WEIGHTS.bufferFloor} + ${SCORE_WEIGHTS.bufferTurns} turns of permanent drain`,
    ),
  );
  out.push(band('band 4', 'objective', s.objective, `progress ${cell.rootProgress.toFixed(3)} x ${SCORE_WEIGHTS.objective}`));
  out.push(band('', 'operating', s.operating, `x${SCORE_WEIGHTS.operating} per staffed box`));
  out.push(band('band 5', 'accumulate', s.accumulate, `capped at ${SCORE_WEIGHTS.accumulateCap} x ${SCORE_WEIGHTS.accumulateWeight}`));
  out.push(band('band 1', 'victory', s.victory, ''));
  out.push(`permanent delta/round  ${ALL_KEYS.filter((k) => cell.permanent[k] !== 0).map((k) => `${RESOURCE_LABEL[k]} ${cell.permanent[k]}`).join(' · ') || '(flat)'}`);
  out.push(`resources raw          ${CORE_KEYS.map((k) => `${RESOURCE_LABEL[k]} ${cell.resources[k]}`).join(' · ')}`);
  out.push(`          projected    ${CORE_KEYS.map((k) => `${RESOURCE_LABEL[k]} ${cell.projected[k]}`).join(' · ')}`);
  out.push('');

  // The two probes are term-independent (nothing ablates a probe), so they also print once.
  if (first) {
    const gv = Object.entries(first.goalValued) as [keyof Resources, number][];
    out.push('goal-valued pools (objectiveProgress marginal per unit)');
    if (gv.length === 0) out.push('  (none — this objective names no resource pool)');
    for (const [k, marginal] of gv) {
      out.push(`  ${pad(RESOURCE_LABEL[k], 14)}${marginal.toFixed(4)}/u -> ${n1(marginal * OBJECTIVE_WEIGHT)} pts/u`);
    }
    const cc = Object.entries(first.cardCosts) as [keyof Resources, EnablerExplain['cardCosts'][keyof Resources]][];
    out.push('goal card costs (a resource funding a card the objective counts)');
    if (cc.length === 0) out.push('  (none — no run card moves the objective by being played)');
    for (const [k, e] of cc) {
      if (!e) continue;
      out.push(
        `  ${pad(RESOURCE_LABEL[k], 14)}${e.marginal.toFixed(4)}/u -> ${n1(ENABLER_CONSTANTS.HOP_DISCOUNT * e.marginal * OBJECTIVE_WEIGHT)} pts/u (cap ${e.costAmt}) via ${e.cardId}`,
      );
    }
    out.push('');
  }

  // Term-set columns start here. The ablation each name stands for goes in a legend rather than a second
  // header row — spelled in-column it is wider than any value beneath it, so it would set the column width
  // for the whole block.
  out.push(
    `term sets: ${cell.models
      .map((m) => {
        const off = (Object.entries(m.explain.terms) as [string, boolean][]).filter(([, v]) => !v).map(([k]) => `-${k}`);
        return `${m.name} = ${off.length ? off.join(' ') : '(all on)'}`;
      })
      .join(' · ')}`,
  );
  out.push(row('', names));

  out.push('weight pts/u (cap) · source');
  for (const k of ALL_KEYS) {
    if (!cell.models.some((m) => m.explain.model.weight[k] !== undefined)) continue;
    out.push(
      row(
        RESOURCE_LABEL[k],
        cell.models.map((m) => {
          const w = m.explain.model.weight[k];
          if (w === undefined) return '—';
          return `${n1(w)} (${m.explain.model.cap[k] ?? '∞'}) ${weightSource(m.explain, k)}`;
        }),
      ),
    );
  }

  out.push(
    `capacity pass  throughput x${ENABLER_CONSTANTS.CAPACITY_HORIZON}, cap ${ENABLER_CONSTANTS.CAPACITY_CAP}, floor ${n1(ENABLER_CONSTANTS.INTRINSIC_CAPACITY_CREDIT)} when eligible`,
  );
  for (const pool of CAPACITY_POOLS) {
    out.push(
      row(
        pool,
        cell.models.map((m) => {
          const c = m.explain.capacity[pool];
          const via = c.cardId ? `:${c.cardId}` : '';
          return `${n1(c.throughput)}/rd${via} -> ${n1(c.weight)}${c.floorApplied ? ' (floor)' : ''}`;
        }),
      ),
    );
  }

  out.push('other credits');
  out.push(
    row(
      'hand size /level',
      cell.models.map((m) => (m.explain.model.handsizePerLevel !== undefined ? `${n1(m.explain.model.handsizePerLevel)} (<=${ENABLER_CONSTANTS.HANDSIZE_LEVEL_CAP})` : '—')),
    ),
  );
  // "not charged" is the load-bearing half: the deck can feed a worker at this rate, but with no derived
  // population throughput nothing nets that food off, so the rate is real and unused.
  out.push(
    row(
      'food per worker',
      cell.models.map((m) =>
        m.explain.model.foodPerWorker !== undefined
          ? `${n1(m.explain.model.foodPerWorker)} netting`
          : `${n1(m.explain.foodPerWorker.value)} not charged`,
      ),
    ),
  );

  out.push(`producer credit  x${ENABLER_CONSTANTS.PRODUCER_TAIL_HORIZON} rounds, tableau cap ${n1(ENABLER_CONSTANTS.PRODUCER_CREDIT_CAP)}`);
  const producerIds = [...new Set(cell.models.flatMap((m) => Object.keys(m.explain.model.producerCredit)))].sort();
  for (const id of producerIds) {
    out.push(row(id, cell.models.map((m) => (m.explain.model.producerCredit[id] !== undefined ? n1(m.explain.model.producerCredit[id]!) : '—'))));
  }
  out.push(
    row(
      'total',
      cell.models.map((m) => {
        const t = producerTotal(m.explain);
        return t > ENABLER_CONSTANTS.PRODUCER_CREDIT_CAP ? `${n1(t)} -> capped ${n1(ENABLER_CONSTANTS.PRODUCER_CREDIT_CAP)}` : n1(t);
      }),
    ),
  );

  out.push('totals');
  out.push(row('enablerPotential @root', cell.models.map((m) => `${n1(m.rootPotential)} (${gs(m.rootPotential)} gs)`)));
  out.push(row('leaf value @root', cell.models.map((m) => `${n1(cell.score.total + m.rootPotential)} (score+potential)`)));
  return out.join('\n');
}

/** The whole report: one scale preamble, then a block per cell. */
export function formatValuation(cells: ValuationCell[]): string {
  const c = ENABLER_CONSTANTS;
  const head = [
    'CivCardGame — goal valuation (sim/value.ts bands + sim/enablers.ts model)',
    `scale: OBJECTIVE_WEIGHT ${c.OBJECTIVE_WEIGHT} · "gs" = goal steps = pts / ${c.OBJECTIVE_WEIGHT}`,
    'derived once at the run root, from content alone — seed-independent, so no run is simulated',
    `constants: HOP_DISCOUNT ${c.HOP_DISCOUNT} · CAPACITY_HORIZON ${c.CAPACITY_HORIZON} · CAPACITY_CAP ${c.CAPACITY_CAP} · INTRINSIC_CAPACITY_CREDIT ${n1(c.INTRINSIC_CAPACITY_CREDIT)}`,
    `           HANDSIZE_LEVEL_CREDIT ${n1(c.HANDSIZE_LEVEL_CREDIT)} (<=${c.HANDSIZE_LEVEL_CAP} levels) · PRODUCER_TAIL_HORIZON ${c.PRODUCER_TAIL_HORIZON} · PRODUCER_CREDIT_CAP ${n1(c.PRODUCER_CREDIT_CAP)}`,
  ];
  return [...head, ...cells.map(cellBlock)].join('\n');
}

// ---- CSV -------------------------------------------------------------------------------------------

const CSV_COLUMNS = ['cell', 'mission', 'board', 'terms', 'section', 'key', 'cardId', 'value', 'goalSteps', 'cap'];

export function valuationCsvHeaderLine(): string {
  return CSV_COLUMNS.join(',');
}

/** A term-set-independent fact carries this in the `terms` column, so a pivot on `terms` can't duplicate
 *  it into one copy per column. */
const NO_TERMS = '-';

interface Row {
  terms: string;
  section: string;
  key: string;
  cardId?: string;
  value: number;
  /** Set only where `value` is in score points, so a probe marginal isn't divided by a score constant. */
  scoreUnit?: boolean;
  cap?: number;
}

/**
 * The runs of a valuation as **one row per fact** — long/tidy rather than wide, because `producerCredit`
 * is variable-width per deck and most facts carry an argmax card, neither of which a fixed column set can
 * hold. Pivots in one `PIVOT … ON terms` (the duckdb recipe the `sim` skill documents for sweep rows), so
 * "which missions weight population, and how much" is one `WHERE section='weight'` over the standing set.
 */
export function valuationCsvLines(cell: ValuationCell): string[] {
  const rows: Row[] = [];
  const s = cell.score;

  for (const [key, value] of Object.entries(s)) {
    rows.push({ terms: NO_TERMS, section: key === 'total' ? 'rootScore' : 'band', key, value, scoreUnit: true });
  }
  rows.push({ terms: NO_TERMS, section: 'objectiveProgress', key: 'root', value: cell.rootProgress });
  for (const k of ALL_KEYS) {
    rows.push({ terms: NO_TERMS, section: 'permanentDelta', key: k, value: cell.permanent[k] });
    rows.push({ terms: NO_TERMS, section: 'resource', key: k, value: cell.resources[k] });
    rows.push({ terms: NO_TERMS, section: 'resourceProjected', key: k, value: cell.projected[k] });
  }
  for (const [key, value] of Object.entries(ENABLER_CONSTANTS)) {
    rows.push({ terms: NO_TERMS, section: 'constant', key, value });
  }

  // The two probes read the objective, which no term ablates, so they are recorded once off the first
  // derivation rather than repeated identically per column.
  const first = cell.models[0]?.explain;
  if (first) {
    for (const [k, marginal] of Object.entries(first.goalValued) as [keyof Resources, number][]) {
      rows.push({ terms: NO_TERMS, section: 'goalValued', key: k, value: marginal });
    }
    for (const [k, e] of Object.entries(first.cardCosts)) {
      if (!e) continue;
      rows.push({ terms: NO_TERMS, section: 'cardCost', key: k, cardId: e.cardId, value: e.marginal, cap: e.costAmt });
    }
  }

  for (const m of cell.models) {
    const e = m.explain;
    for (const k of ALL_KEYS) {
      const w = e.model.weight[k];
      if (w === undefined) continue;
      rows.push({ terms: m.name, section: 'weight', key: k, cardId: weightSource(e, k), value: w, scoreUnit: true, cap: e.model.cap[k] });
    }
    for (const pool of CAPACITY_POOLS) {
      const c = e.capacity[pool];
      rows.push({ terms: m.name, section: 'capacityThroughput', key: pool, cardId: c.cardId, value: c.throughput, scoreUnit: true });
      rows.push({ terms: m.name, section: 'capacityDerived', key: pool, value: c.derived, scoreUnit: true });
    }
    if (e.model.handsizePerLevel !== undefined) {
      rows.push({ terms: m.name, section: 'handsize', key: 'perLevel', value: e.model.handsizePerLevel, scoreUnit: true });
    }
    rows.push({
      terms: m.name,
      section: 'foodPerWorker',
      key: e.model.foodPerWorker !== undefined ? 'charged' : 'notCharged',
      cardId: e.foodPerWorker.cardId,
      value: e.foodPerWorker.value,
    });
    for (const [id, v] of Object.entries(e.model.producerCredit)) {
      rows.push({ terms: m.name, section: 'producerCredit', key: id, cardId: id, value: v ?? 0, scoreUnit: true });
    }
    rows.push({ terms: m.name, section: 'producerCreditTotal', key: 'total', value: producerTotal(e), scoreUnit: true });
    rows.push({ terms: m.name, section: 'potential', key: 'root', value: m.rootPotential, scoreUnit: true });
    rows.push({ terms: m.name, section: 'leaf', key: 'root', value: cell.score.total + m.rootPotential, scoreUnit: true });
  }

  return rows.map((r) =>
    [
      cell.label,
      cell.missionId,
      cell.board,
      r.terms,
      r.section,
      r.key,
      r.cardId ?? '',
      String(r.value),
      r.scoreUnit ? String(r.value / OBJECTIVE_WEIGHT) : '',
      r.cap !== undefined ? String(r.cap) : '',
    ].join(','),
  );
}
