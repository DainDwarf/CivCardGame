import type { Resources } from '../rules';
import {
  RACE,
  absorbed,
  routeCause,
  type CoverClockExplain,
  type PlanCandidate,
  type PlanClockExplain,
  type RaceModelExplain,
  type RaceValueExplain,
  type RescueClockExplain,
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
  if (c.requires) parts.push(`gated on ${c.requires}`);
  return parts.join(' · ') || '—';
}

/** The payment/delivery split inside one `landingClock`, three lines: each clock with the weight it folded
 *  at, then the fold. The delivery figure is the whole of that half, so its two summands are spelled out
 *  beside it — the census as the arithmetic it is (`held × hand / pool`), then the citizen a box waits on
 *  where it waits at all — because a clock nobody can reconstruct is a number to take on faith; the price
 *  is the leaf's own, which
 *  the scan table above quotes at the root's — a card whose price climbs with its own use is two different
 *  numbers, and the pair is the only place that reads. */
function planLines(tag: string, p: PlanClockExplain, taken: boolean): string[] {
  const [wPay, wDel] = p.weights;
  const out = [
    `      ${pad(tag, 9)} ${p.cardId} × ${n(p.copies)}${p.recycles ? ' (recycles)' : ''} · price ${bag(p.price)}${taken ? '   ← taken' : ''}`,
    `        payment  ${padLeft(n(p.payment), 8)} rd   ${n(p.workerRounds)} wr outstanding at ${n(p.realized)} wr/rd standing income, netted ${bag(p.netted)}   ${weight(wPay)}`,
    `        delivery ${padLeft(n(p.delivery + p.staffing), 8)} rd   ${p.held} held × ${n(p.hand, 1)} hand / ${p.pool} pool = ${n(p.perRound, 3)}/rd${
      p.staffing > 0 ? ` + ${n(p.staffing)} rd waiting on a free citizen` : ''
    }   ${weight(wDel)}`,
  ];
  if (p.prereq) {
    const q = p.prereq;
    out.push(
      `        gate     ${padLeft(n(q.t), 8)} rd   ${
        q.satisfied ? `${q.cardId} stands — the play is no longer refused` : `${q.cardId} must stand first`
      }`,
    );
    // The gate's own two halves, one line rather than the three a route gets: it is a single copy of a
    // single card, and what the reader is after is why the term is the size it is.
    if (q.route) {
      out.push(
        `          × 1 · price ${bag(q.route.price)} · payment ${n(q.route.payment)} rd · delivery ${
          n(q.route.delivery + q.route.staffing)} rd (${q.route.held} held × ${n(q.route.hand, 1)} hand / ${
          q.route.pool} pool)`,
      );
    }
  }
  // Only where the clock is a sum of parts: a plain landing is its own whole, and naming its one term
  // would print `lands N = N`.
  const terms = [
    ...(p.prereq ? [`gate ${n(p.prereq.t)}`] : []),
    `lands ${n(p.lands)}`,
    ...(p.collect > 0 ? [`collect ${n(p.collect)}`] : []),
  ];
  out.push(
    terms.length > 1
      ? `        ${terms.join(' + ')} = ${n(p.t)} rd`
      : `        landingClock = ${n(p.t)} rd`,
  );
  return out;
}

/** The same split for a cover, with the members between the two halves they compose into: one bill for the
 *  payment, the latest arrival for the delivery. Each member's own clock rides beside it because the cover
 *  exists precisely where none of those numbers finished the goal. */
function coverLines(p: CoverClockExplain, taken: boolean): string[] {
  const [wPay, wDel] = p.weights;
  const out = [
    `      ${pad('cover', 9)} ${p.cardIds.join(' + ')} · bill ${bag(p.bill)}${taken ? '   ← taken' : ''}`,
  ];
  for (const m of p.members) {
    out.push(
      `        member   ${pad(m.cardId, 20)} × ${n(m.copies)} · price ${pad(bag(m.price), 22)} ${m.held} held × ${
        n(m.hand, 1)} hand / ${m.pool} pool = ${n(m.perRound, 3)}/rd → ${n(m.delivery + m.staffing)} rd (alone ${n(m.t)} rd)`,
    );
  }
  out.push(`        payment  ${padLeft(n(p.payment), 8)} rd   one bill, netted ${bag(p.netted)}   ${weight(wPay)}`);
  out.push(`        delivery ${padLeft(n(p.delivery), 8)} rd   the latest member   ${weight(wDel)}`);
  out.push(`        landingClock = ${n(p.t)} rd`);
  return out;
}

/** One threatened pool's rescue, under the pool it charges for: each route with the two clocks that fold to
 *  its landing, then the urgency and the product. The pool's `t` above is deliberately unchanged by any of
 *  it — printing the charge beside the untouched clock is what makes that visible. */
function rescueLines(r: RescueClockExplain): string[] {
  const out: string[] = [];
  for (const { kind, route } of r.routes) {
    out.push(
      `      rescue   ${pad(kind, 9)} ${pad(route.cardId, 20)} · price ${pad(bag(route.price), 24)} payment ${
        n(route.payment)} rd · delivery ${n(route.delivery + route.staffing)} rd → lands ${n(route.t)} rd${
        route.cardId === r.cardId ? '   ← soonest' : ''
      }`,
    );
  }
  out.push(
    `      charge   urgency ${n(r.urgency, 3)} × ${n(Math.min(r.lands, RACE.rescueRounds))} rd${
      r.lands > RACE.rescueRounds ? ` (lands ${n(r.lands)}, ceiling ${RACE.rescueRounds})` : ''
    } = −${n(r.penalty, 3)} rd off the margin`,
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
    out.push('        root workforce 0, so every root clock below reads ∞ past what its standing income pays');
    out.push('        — a route is kept on its price and its copies, which is why these are kept all the same');
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

  // The loss-side scan, printed even when it kept nothing: a pool with no rescue is what says a run in
  // trouble there has nowhere to steer, which no clock below can report.
  out.push('rescues — how the deck could take a core pool off the death list. Nothing here lengthens a clock:');
  out.push('          a leaf reads the soonest route only for how far off it still is');
  if (model.rescues.length === 0) {
    out.push('  (no card in the run feeds or defuses a core pool)');
  }
  for (const r of model.rescues) {
    out.push(
      `  pool ${pad(r.key, 12)} kept ${r.routes.length} of ${r.candidates.length}${
        r.dropped?.length ? ` · dropped for ${r.dropped.join(' + ')}` : ''
      }`,
    );
    out.push(
      `    ${pad('card', 24)}${pad('kind', 10)}${padLeft('delta', 8)}${padLeft('staffs', 9)}${padLeft('root t', 9)}  ${pad('verdict', 26)}price`,
    );
    for (const c of r.candidates) {
      out.push(
        `    ${pad(c.cardId, 24)}${pad(c.kind, 10)}${padLeft(n(c.delta), 8)}${padLeft(n(c.workerRounds), 6)} wr${
          padLeft(n(c.route.t), 9)}  ${pad(c.unpriceable.length ? `skipped: ${c.unpriceable.join('/')}` : c.route.kept ? 'kept' : `✗ ${c.route.reject}`, 26)}${bag(c.price)}`,
      );
    }
  }
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
    // Only where it binds: a set of routes that reaches the goal is short of nothing, and the shortfall is
    // the one fact none of the per-route lines below can carry — each is live at what it can deliver.
    if ((g.plan?.landings.length ?? 0) > 0 && g.reach < c.need) {
      out.push(
        `      ${pad('reach', 9)} ${padLeft(n(g.reach), 8)} of ${n(c.need)} units   the landing routes cannot together close this goal`,
      );
    }
    for (const p of g.landings) out.push(...planLines('landing', p, c.route === 'landing' && c.cardId === p.cardId));
    for (const p of g.covers) out.push(...coverLines(p, c.route === 'cover'));
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
      }${p.shortfall ? `   the coming boundary takes it ${n(p.shortfall, 1)} below zero` : ''}`,
    );
    if (p.rescue) out.push(...rescueLines(p.rescue));
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
  // The bare clock and what the margin made of it. Past the cap the two part, and the margin below is
  // then a reading of the second with no trace of the first left in it — while the near-death steepening
  // beside it still reads the bare one.
  out.push(
    `    slack ${n(b.tLoss)} → ${n(b.slack)} rd into the margin${
      b.slack < b.tLoss ? ` (capped at ${RACE.slackCap} rd)` : ''
    }`,
  );
  out.push('');

  out.push(
    `value  margin ${n(b.margin, 3)} · nearDeath ${n(b.nearDeath, 3)} · rescue ${n(b.rescue, 3)} · wealth ${n(b.wealth, 3)} · score ${n(b.score, 3)} · victory ${b.victory} · total ${n(b.total, 3)}`,
  );
  return out.join('\n');
}

/** The whole report: one constants preamble, then a block per cell. */
export function formatRaceValuation(cells: RaceValuationCell[], maxRounds: number): string {
  const head = [
    'CivCardGame — race valuation (sim/race.ts: min(T̂loss, slackCap) − T̂win, in rounds)',
    'scale: everything is rounds, except worker-rounds (wr) and the dimensionless softMax weights',
    `derived at the run root from content alone — seed-independent (every zone read as a multiset), so no run is simulated`,
    `horizon: maxRounds ${maxRounds}, the drive-loop cutoff every estimate clamps to`,
    `constants: victory ${RACE.victory} · goalSoftening ${RACE.goalSoftening} × the leading clock · slackCap ${RACE.slackCap} rd · nearDeathSteepness ${RACE.nearDeathSteepness} · rescueRounds ${RACE.rescueRounds} rd · wealthRounds ${RACE.wealthRounds} rd at wealthCap ${RACE.wealthCap} · scoreRounds ${RACE.scoreRounds} rd a point`,
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

/** One row per fact — long/tidy for the same reason the band valuation's is: the candidate table is
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
      if (c.requires) rows.push({ goal, section: 'candidateGate', key: c.requires, cardId: c.cardId, value: 1 });
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
    rows.push({ goal, section: 'clock', key: 'reach', value: g.reach, unit: 'units' });
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
        ['realized', p.realized, 'wr/rd'],
        ['payment', p.payment, 'rounds'],
        ['delivery', p.delivery, 'rounds'],
        ['staffing', p.staffing, 'rounds'],
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
      // The leaf's own price, pool by pool: the candidate table's `price` is the root's, and on a card whose
      // cost climbs with its use the two are the reading and its floor.
      for (const [k, v] of Object.entries(p.price) as [keyof Resources, number][]) {
        rows.push({ goal, section: tag, key: `price.${k}`, cardId: p.cardId, value: v, unit: 'units' });
      }
      // The gate rides on the route it gates, keyed by the card it names — so "which cells still owe a
      // prerequisite" pivots without joining back to the candidate table.
      if (p.prereq) {
        rows.push({ goal, section: tag, key: `gate.${p.prereq.cardId}`, cardId: p.cardId, value: p.prereq.t, unit: 'rounds' });
        rows.push({ goal, section: tag, key: 'gate.satisfied', cardId: p.cardId, value: p.prereq.satisfied ? 1 : 0 });
      }
    }
    // A cover's own facts carry no `cardId` — it is the set that has them — while its members carry theirs,
    // so the two nest in one long table the way a landing's price rows already do under their route.
    for (const p of g.covers) {
      for (const [key, v, unit] of [
        ['payment', p.payment, 'rounds'],
        ['delivery', p.delivery, 'rounds'],
        ['t', p.t, 'rounds'],
        ['weightPayment', p.weights[0] ?? 1, ''],
        ['weightDelivery', p.weights[1] ?? 1, ''],
      ] as [string, number, string][]) {
        rows.push({ goal, section: 'cover', key, value: v, unit });
      }
      for (const [k, v] of Object.entries(p.bill) as [keyof Resources, number][]) {
        rows.push({ goal, section: 'cover', key: `bill.${k}`, value: v, unit: 'units' });
      }
      for (const m of p.members) {
        for (const [key, v, unit] of [
          ['copies', m.copies, 'copies'],
          ['delivery', m.delivery, 'rounds'],
          ['staffing', m.staffing, 'rounds'],
          ['held', m.held, 'cards'],
          ['pool', m.pool, 'cards'],
          ['hand', m.hand, 'cards'],
          ['perRound', m.perRound, 'copies/rd'],
          ['t', m.t, 'rounds'],
        ] as [string, number, string][]) {
          rows.push({ goal, section: 'coverMember', key, cardId: m.cardId, value: v, unit });
        }
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
    if (p.shortfall) rows.push({ goal: NO_GOAL, section: 'poolShortfall', key: p.key, value: p.shortfall, unit: 'units' });
    // Keyed by the pool rather than by the card, so "which cells are charged for an unmade rescue, and of
    // what" pivots the same way the pool clocks above it do.
    if (p.rescue) {
      rows.push({ goal: NO_GOAL, section: 'rescueUrgency', key: p.key, value: p.rescue.urgency });
      rows.push({ goal: NO_GOAL, section: 'rescueLands', key: p.key, cardId: p.rescue.cardId, value: p.rescue.lands, unit: 'rounds' });
      rows.push({ goal: NO_GOAL, section: 'rescuePenalty', key: p.key, cardId: p.rescue.cardId, value: p.rescue.penalty, unit: 'rounds' });
      for (const { kind, route } of p.rescue.routes) {
        rows.push({ goal: NO_GOAL, section: 'rescueRoute', key: `${p.key}.${kind}`, cardId: route.cardId, value: route.t, unit: 'rounds' });
      }
    }
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
  rows.push({ goal: NO_GOAL, section: 'value', key: 'slack', value: b.slack, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'bottleneck', value: b.bottleneck });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'margin', value: b.margin, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'nearDeath', value: b.nearDeath, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'rescue', value: b.rescue, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'wealth', value: b.wealth, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'score', value: b.score, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'victory', value: b.victory, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'value', key: 'total', value: b.total, unit: 'rounds' });
  rows.push({ goal: NO_GOAL, section: 'lossCause', key: b.lossCause, cardId: b.lossCardId, value: b.tLoss, unit: 'rounds' });

  return rows.map((r) =>
    [cell.label, cell.missionId, cell.board, r.goal, r.section, r.key, r.cardId ?? '', String(r.value), r.unit ?? ''].join(','),
  );
}
