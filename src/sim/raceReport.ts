import type { Resources } from '../rules';
import {
  RACE,
  absorbed,
  routeCause,
  type PlanCandidate,
  type PlanClockExplain,
  type RaceModelExplain,
  type RaceValueExplain,
} from './race';

/**
 * Renders the race model's derivation — `sim/race.ts`'s plans and its `T̂loss − T̂win` margin — for the
 * `sim:valuation` CLI under `--scorer race`. Pure over its input like `sim/valuationReport.ts`, whose split
 * this follows: rendering here, I/O and flags in `scripts/`.
 *
 * The unit throughout is a **round**, which is the whole point of the model it reports on: no scale
 * preamble is needed because nothing here is denominated in points. The two other units are named where
 * they appear — **worker-rounds** (`wr`), what a price converts to, and the dimensionless softMax
 * **weights**, which are what make absorption visible at all.
 */

/** One inspected cell: its config, the root derivation of its plans, and the value of the root state. */
export interface RaceValuationCell {
  label: string;
  /** The fixture this came from, when it came from one. */
  source?: string;
  missionId: string;
  missionName: string;
  objectiveCardId: string;
  board: string;
  boardStickers: string[];
  deckSize: number;
  /** The round the state reported on sits at — the horizon counts down from it. */
  round: number;
  resources: Resources;
  model: RaceModelExplain;
  value: RaceValueExplain;
}

function n(x: number, places = 2): string {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (Number.isNaN(x)) return 'NaN';
  return x.toFixed(places);
}

/** A softMax weight, with the annotation that is the point of printing one. Below a thousandth it goes to
 *  its exponent: fixed decimals print an absorbed weight and a live one 45 orders of magnitude apart as the
 *  same `0.000`, which is the one confusion this column exists to prevent. */
function weight(w: number | undefined): string {
  if (w === undefined) return 'w —';
  return `w ${w >= 0.001 ? w.toFixed(3) : w.toExponential(1)}${absorbed(w) ? ' ABSORBED' : ''}`;
}

function bag(b: Partial<Record<keyof Resources, number>>): string {
  const parts = Object.entries(b).map(([k, v]) => `${k} ${n(v as number, 1)}`);
  return parts.length ? parts.join(' ') : '(none)';
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function padLeft(s: string, w: number): string {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

/** What became of one card in the scan: the routes it offered, kept or with the reason it was dropped. The
 *  refusal to price a card at all pre-empts both, so it is reported once rather than twice. */
function verdict(c: PlanCandidate): string {
  if (c.unpriceable.length) return `skipped: ${c.unpriceable.join('/')}`;
  const parts: string[] = [];
  for (const [tag, r] of [['landing', c.landing], ['building', c.building]] as const) {
    if (r) parts.push(r.kept ? tag : `${tag} ✗ ${r.reject}`);
  }
  return parts.join(' · ') || '—';
}

/** The payment/delivery split inside one `landingClock`, three lines: each clock with the weight it folded
 *  at, then the fold. The census is spelled as the arithmetic it is (`held × hand / pool`) because a
 *  delivery clock nobody can reconstruct is a number to take on faith. */
function planLines(tag: string, p: PlanClockExplain, taken: boolean): string[] {
  const [wPay, wDel] = p.weights;
  const out = [
    `      ${pad(tag, 9)} ${p.cardId} × ${n(p.copies)}${p.recycles ? ' (recycles)' : ''}${taken ? '   ← taken' : ''}`,
    `        payment  ${padLeft(n(p.payment), 8)} rd   ${n(p.workerRounds)} wr outstanding, netted ${bag(p.netted)}   ${weight(wPay)}`,
    `        delivery ${padLeft(n(p.delivery), 8)} rd   ${p.held} held × ${n(p.hand, 1)} hand / ${p.pool} pool = ${n(p.perRound, 3)}/rd   ${weight(wDel)}`,
  ];
  out.push(
    p.collect > 0
      ? `        lands ${n(p.lands)} + collect ${n(p.collect)} = ${n(p.t)} rd`
      : `        landingClock = ${n(p.t)} rd`,
  );
  return out;
}

function cellBlock(cell: RaceValuationCell): string {
  const out: string[] = [];
  const { model, value } = cell;
  const b = value.breakdown;

  out.push('');
  out.push(
    `── ${cell.label} · ${cell.missionName} · ${cell.board}${
      cell.boardStickers.length ? ` +${cell.boardStickers.join('+')}` : ''
    } · ${cell.deckSize} cards ${'─'.repeat(6)}${cell.source ? `  ${cell.source}` : ''}`,
  );
  out.push(
    `objective ${cell.objectiveCardId} · round ${cell.round} · horizon ${n(value.horizon, 0)} rounds · ${model.runCards.length} card ids in run`,
  );
  out.push('');

  out.push('unitCost — worker-rounds per unit obtained (replacementCost)');
  const priced = Object.entries(model.model.unitCost) as [keyof Resources, number][];
  out.push(`  priced      ${priced.length ? priced.map(([k, v]) => `${k} ${n(v, 3)}`).join(' · ') : '(none)'}`);
  // The absent half is the load-bearing one: a price naming an unpriceable pool yields no plan at all,
  // which reads in a `RaceModel` as a goal that simply has no route.
  out.push(`  no cost     ${model.unpriceable.length ? model.unpriceable.join(' · ') : '(every pool priced)'}`);
  out.push('');

  out.push('plans — every card the scan ranked; every route deliverable at the root is kept, and each leaf');
  out.push('        takes the soonest of them, so a cheap card the deck cannot deal shadows nothing');
  if (model.workforce <= 0) {
    out.push('        root workforce 0, so every root clock below divides by nothing and reads ∞ — a route is');
    out.push('        kept on its price and its copies, which is why these are kept all the same');
  }
  model.goals.forEach((g, i) => {
    const p = g.plan;
    out.push(
      `  goal ${i} ${g.icon}  scanned ${g.scanned} · ${g.inert} moved nothing · kept ${p.landings.length} landing, ${p.buildings.length} building${
        p.dropped?.length ? ` · dropped for ${p.dropped.join(' + ')}` : ''
      }`,
    );
    if (g.candidates.length === 0) {
      out.push('    (no card in the run moves this measure — the model reports no plan)');
      return;
    }
    out.push(
      `    ${pad('card', 24)}${padLeft('delta', 8)}${padLeft('tau', 8)}${padLeft('wr', 9)}${padLeft('per unit', 10)}${padLeft('land t', 9)}${padLeft('build t', 9)}  ${pad('verdict', 30)}price`,
    );
    for (const c of g.candidates) {
      out.push(
        `    ${pad(c.cardId, 24)}${padLeft(n(c.delta), 8)}${padLeft(n(c.tau), 8)}${padLeft(n(c.workerRounds), 9)}${padLeft(n(c.perUnit, 3), 10)}${
          padLeft(c.landing ? n(c.landing.t) : '—', 9)}${padLeft(c.building ? n(c.building.t) : '—', 9)}  ${pad(verdict(c), 30)}${bag(c.price)}`,
      );
    }
  });
  out.push('');

  out.push(`clocks @root — T̂win ${n(b.tWin)} · bottleneck goal ${b.bottleneck}`);
  value.goals.forEach((g, i) => {
    const c = g.clock;
    const via = c.cardId ? `:${c.cardId}` : '';
    const cause = routeCause(g);
    out.push(
      `  goal ${i} ${c.icon}  need ${n(c.need)} · τ ${n(c.tau, 3)}/rd · t ${n(c.t)}${
        g.clamped ? ` (raw ${n(g.raw)} — HORIZON CLAMPED)` : ''
      }  route ${c.route}${via}${cause ? ` (${cause})` : ''}   ${weight(value.foldWeights[i])}`,
    );
    out.push(
      `      ${pad('throughput', 9)} ${padLeft(n(g.throughput), 8)} rd   need / τ${
        g.workforce > 0 ? '' : '   — workforce 0, so both plan routes are gated off'
      }`,
    );
    for (const p of g.landings) out.push(...planLines('landing', p, c.route === 'landing' && c.cardId === p.cardId));
    for (const p of g.buildings) out.push(...planLines('building', p, c.route === 'building' && c.cardId === p.cardId));
  });
  out.push('');

  out.push(`T̂loss ${n(b.tLoss)} — ${b.lossCause}${b.lossCardId ? `:${b.lossCardId}` : ''}`);
  out.push(`    ${pad('pool', 12)}${padLeft('level', 8)}${padLeft('drain/rd', 10)}${padLeft('t', 9)}`);
  for (const p of value.pools) {
    // The escalation rides as a suffix rather than a column: it is empty on all but the few cells whose
    // pressure deepens, and `t` is the plain `level / drain` wherever it is absent.
    out.push(
      `    ${pad(p.key, 12)}${padLeft(n(p.level, 1), 8)}${padLeft(n(p.drain, 2), 10)}${padLeft(n(p.t), 9)}${
        p.accel ? `   escalating: t solves ${n(p.level, 1)} = ${n(p.drain, 2)}·t + ${n(p.accel, 4)}·t²` : ''
      }`,
    );
  }
  for (const t of value.threats) {
    out.push(`    threat ${pad(t.cardId, 22)}${padLeft(n(t.t), 9)}  (probed under cap ${n(t.cap)})`);
  }
  // The drains above carry a recurring event at a fraction of what one boundary of it takes, which no
  // per-pool figure can be reconstructed from.
  if (value.events) {
    const e = value.events;
    out.push(
      `    events ${e.copies} of ${e.pool} in circulation · ${n(e.hand, 1)} hand / ${e.pool} pool = ${n(e.share, 3)} of a boundary each · full rate ${bag(e.full)}${
        e.escalation ? ` · deepening ${bag(e.escalation)} per resolution` : ''
      }`,
    );
  }
  out.push('');

  out.push(
    `value  margin ${n(b.margin, 3)} · nearDeath ${n(b.nearDeath, 3)} · wealth ${n(b.wealth, 3)} · victory ${b.victory} · total ${n(b.total, 3)}`,
  );
  return out.join('\n');
}

/** The whole report: one constants preamble, then a block per cell. */
export function formatRaceValuation(cells: RaceValuationCell[], maxRounds: number): string {
  const head = [
    'CivCardGame — race valuation (sim/race.ts: T̂loss − T̂win, in rounds)',
    'scale: everything is rounds, except worker-rounds (wr) and the dimensionless softMax weights',
    `derived at the run root from content alone — seed-independent (every zone read as a multiset), so no run is simulated`,
    `horizon: maxRounds ${maxRounds}, the drive-loop cutoff every estimate clamps to`,
    `constants: victory ${RACE.victory} · goalSoftening ${RACE.goalSoftening} × the leading clock · nearDeathSteepness ${RACE.nearDeathSteepness} · wealthRounds ${RACE.wealthRounds} rd at wealthCap ${RACE.wealthCap}`,
    'ABSORBED marks a softMax weight under the ULP of 1: the fold came out bit-identical to a hard max, so',
    'the state has no gradient on that clock at all. A temperature that is a fraction of the leading clock',
    `floors every weight at exp(-1/${RACE.goalSoftening}) = ${Math.exp(-1 / RACE.goalSoftening).toExponential(1)}, so nothing is absorbed at this softening`,
  ];
  return [...head, ...cells.map(cellBlock)].join('\n');
}

// ---- CSV -------------------------------------------------------------------------------------------

const CSV_COLUMNS = ['cell', 'mission', 'board', 'goal', 'section', 'key', 'cardId', 'value', 'unit'];

export function raceCsvHeaderLine(): string {
  return CSV_COLUMNS.join(',');
}

/** A cell-level fact carries this in the `goal` column, so a pivot on `goal` can't duplicate it. */
const NO_GOAL = '-';

interface Row {
  goal: string;
  section: string;
  key: string;
  cardId?: string;
  value: number;
  unit?: string;
}

/** One row per fact — long/tidy for the same reason the classic valuation's is: the candidate table is
 *  variable-width per deck and most facts carry a card, neither of which a fixed column set holds. Pivots
 *  in duckdb like the sweep rows, so "which cells derive a goal at route none" is one
 *  `WHERE section='route' AND key='none'` over the standing set. */
export function raceCsvLines(cell: RaceValuationCell): string[] {
  const rows: Row[] = [];
  const { model, value } = cell;
  const b = value.breakdown;

  rows.push({ goal: NO_GOAL, section: 'horizon', key: 'rounds', value: value.horizon, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'meta', key: 'round', value: cell.round });
  rows.push({ goal: NO_GOAL, section: 'meta', key: 'deckSize', value: cell.deckSize });
  for (const [k, v] of Object.entries(cell.resources) as [keyof Resources, number][]) {
    rows.push({ goal: NO_GOAL, section: 'resource', key: k, value: v });
  }
  rows.push({ goal: NO_GOAL, section: 'meta', key: 'rootWorkforce', value: model.workforce });
  for (const [k, v] of Object.entries(model.model.unitCost) as [keyof Resources, number][]) {
    rows.push({ goal: NO_GOAL, section: 'unitCost', key: k, value: v, unit: 'wr/unit' });
  }
  for (const k of model.unpriceable) {
    rows.push({ goal: NO_GOAL, section: 'unpriceable', key: k, value: 1 });
  }

  model.goals.forEach((g, i) => {
    const goal = String(i);
    rows.push({ goal, section: 'scan', key: 'scanned', value: g.scanned });
    rows.push({ goal, section: 'scan', key: 'inert', value: g.inert });
    for (const c of g.candidates) {
      rows.push({ goal, section: 'candidate', key: 'delta', cardId: c.cardId, value: c.delta, unit: 'units' });
      rows.push({ goal, section: 'candidate', key: 'tau', cardId: c.cardId, value: c.tau, unit: 'units/rd' });
      rows.push({ goal, section: 'candidate', key: 'workerRounds', cardId: c.cardId, value: c.workerRounds, unit: 'wr' });
      rows.push({ goal, section: 'candidate', key: 'perUnit', cardId: c.cardId, value: c.perUnit, unit: 'wr/unit' });
      rows.push({
        goal, section: 'candidate', key: 'kept', cardId: c.cardId,
        value: (c.landing?.kept ? 1 : 0) + (c.building?.kept ? 2 : 0),
      });
      for (const [tag, r] of [['landing', c.landing], ['building', c.building]] as const) {
        if (!r) continue;
        rows.push({ goal, section: 'candidateRoute', key: `${tag}.t`, cardId: c.cardId, value: r.t, unit: 'rounds' });
        rows.push({ goal, section: 'candidateRoute', key: `${tag}.kept`, cardId: c.cardId, value: r.kept ? 1 : 0 });
        // The two halves are absent where the route was refused before costing, and a row saying so would be
        // a measurement of a probe that never ran.
        if (r.payment !== undefined) {
          rows.push({ goal, section: 'candidateRoute', key: `${tag}.payment`, cardId: c.cardId, value: r.payment, unit: 'rounds' });
        }
        if (r.delivery !== undefined) {
          rows.push({ goal, section: 'candidateRoute', key: `${tag}.delivery`, cardId: c.cardId, value: r.delivery, unit: 'rounds' });
        }
        if (r.reject) rows.push({ goal, section: 'candidateReject', key: `${tag}: ${r.reject}`, cardId: c.cardId, value: 1 });
      }
      for (const k of c.unpriceable) {
        rows.push({ goal, section: 'candidateUnpriceable', key: k, cardId: c.cardId, value: 1 });
      }
    }
    for (const cause of g.plan.dropped ?? []) {
      rows.push({ goal, section: 'dropped', key: cause, value: 1 });
    }
  });

  value.goals.forEach((g, i) => {
    const goal = String(i);
    const c = g.clock;
    rows.push({ goal, section: 'clock', key: 'need', value: c.need, unit: 'units' });
    rows.push({ goal, section: 'clock', key: 'tau', value: c.tau, unit: 'units/rd' });
    rows.push({ goal, section: 'clock', key: 't', value: c.t, unit: 'rounds' });
    rows.push({ goal, section: 'clock', key: 'raw', value: g.raw, unit: 'rounds' });
    rows.push({ goal, section: 'clock', key: 'clamped', value: g.clamped ? 1 : 0 });
    rows.push({ goal, section: 'clock', key: 'workforce', value: g.workforce });
    rows.push({ goal, section: 'clock', key: 'throughput', value: g.throughput, unit: 'rounds' });
    rows.push({ goal, section: 'route', key: c.route, cardId: c.cardId ?? routeCause(g), value: c.t, unit: 'rounds' });
    const fold = value.foldWeights[i] ?? 1;
    rows.push({ goal, section: 'foldWeight', key: 'weight', value: fold });
    // The predicate as a column of its own: `1 + w = 1` is not a comparison a SQL reader can spell.
    rows.push({ goal, section: 'foldWeight', key: 'absorbed', value: absorbed(fold) ? 1 : 0 });
    for (const [tag, p] of [
      ...g.landings.map((p) => ['landing', p] as const),
      ...g.buildings.map((p) => ['building', p] as const),
    ]) {
      for (const [key, v, unit] of [
        ['copies', p.copies, 'copies'],
        ['recycles', p.recycles ? 1 : 0, ''],
        ['workerRounds', p.workerRounds, 'wr'],
        ['payment', p.payment, 'rounds'],
        ['delivery', p.delivery, 'rounds'],
        ['held', p.held, 'cards'],
        ['pool', p.pool, 'cards'],
        ['hand', p.hand, 'cards'],
        ['perRound', p.perRound, 'copies/rd'],
        ['lands', p.lands, 'rounds'],
        ['collect', p.collect, 'rounds'],
        ['t', p.t, 'rounds'],
        ['weightPayment', p.weights[0] ?? 1, ''],
        ['weightDelivery', p.weights[1] ?? 1, ''],
        ['absorbedPayment', absorbed(p.weights[0] ?? 1) ? 1 : 0, ''],
        ['absorbedDelivery', absorbed(p.weights[1] ?? 1) ? 1 : 0, ''],
      ] as [string, number, string][]) {
        rows.push({ goal, section: tag, key, cardId: p.cardId, value: v, unit });
      }
    }
  });

  for (const p of value.pools) {
    rows.push({ goal: NO_GOAL, section: 'poolClock', key: p.key, value: p.t, unit: 'rounds' });
    rows.push({ goal: NO_GOAL, section: 'poolLevel', key: p.key, value: p.level });
    rows.push({ goal: NO_GOAL, section: 'poolDrain', key: p.key, value: p.drain, unit: 'units/rd' });
    // Absent rather than zero-filled: a pool whose drain does not deepen has no such fact, and a row
    // saying so would put a `0` beside every flat clock in the standing set.
    if (p.accel) rows.push({ goal: NO_GOAL, section: 'poolAccel', key: p.key, value: p.accel, unit: 'units/rd²' });
  }
  for (const t of value.threats) {
    rows.push({ goal: NO_GOAL, section: 'threatClock', key: 'rounds', cardId: t.cardId, value: t.t, unit: 'rounds' });
    rows.push({ goal: NO_GOAL, section: 'threatClock', key: 'cap', cardId: t.cardId, value: t.cap, unit: 'rounds' });
  }
  if (value.events) {
    const e = value.events;
    for (const [key, v, unit] of [
      ['copies', e.copies, 'cards'],
      ['pool', e.pool, 'cards'],
      ['hand', e.hand, 'cards'],
      ['share', e.share, ''],
    ] as [string, number, string][]) {
      rows.push({ goal: NO_GOAL, section: 'eventDrain', key, value: v, unit });
    }
    for (const [k, v] of Object.entries(e.full) as [keyof Resources, number][]) {
      rows.push({ goal: NO_GOAL, section: 'eventFullDrain', key: k, value: v, unit: 'units/boundary' });
    }
    for (const [k, v] of Object.entries(e.escalation ?? {}) as [keyof Resources, number][]) {
      rows.push({ goal: NO_GOAL, section: 'eventEscalation', key: k, value: v, unit: 'units/resolution' });
    }
  }

  rows.push({ goal: NO_GOAL, section: 'value', key: 'tWin', value: b.tWin, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'tLoss', value: b.tLoss, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'bottleneck', value: b.bottleneck });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'margin', value: b.margin, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'nearDeath', value: b.nearDeath, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'wealth', value: b.wealth, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'victory', value: b.victory, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'total', value: b.total, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'lossCause', key: b.lossCause, cardId: b.lossCardId, value: b.tLoss, unit: 'rounds' });

  return rows.map((r) =>
    [cell.label, cell.missionId, cell.board, r.goal, r.section, r.key, r.cardId ?? '', String(r.value), r.unit ?? ''].join(','),
  );
}
