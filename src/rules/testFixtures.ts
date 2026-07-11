/**
 * Shared synthetic fixtures for the `rules/`+`run/` unit tests. The core engine resolves through the
 * *live* global catalogues at runtime (`CARDS[ctx.self.cardId]`, `BOARDS[config.board]`, sticker
 * lookups), so a test that asserts a *mechanism* (not a shipped card's numbers) still needs *some*
 * card/board/sticker installed in those maps for the test's duration. Rather than each test leaning on
 * a shipped id — which breaks the instant a catalogue is emptied for a content reset — tests install
 * these `test_*` fixtures, whose values are chosen freely to exercise the mechanism and can never
 * collide with real ids.
 *
 * `installFixtures()`/`uninstallFixtures()` splice the fixtures into the live `CARDS`/`BOARDS`/
 * `STICKERS` and remove them again — the generalization of `events.test.ts`'s original local
 * `FIXTURES` + `beforeAll`/`afterAll`. Call them in a suite's `beforeAll`/`afterAll` (or
 * `beforeEach`/`afterEach`). All run state is minted through the *real* production functions
 * (`instancesFromCardIds`, `collectionFromCounts`, `buildSeedDecks`, `blankState`) — never
 * re-implemented — so a fixture-backed test exercises the same paths a run does.
 *
 * **What belongs here vs. local to a test file:** a fixture that *multiple* files reuse — every
 * canonical producer/action/work shape, the threat/event/objective shapes, the three sticker shapes,
 * and the two `on`-handler observers (`test_threshold`, reused by events + upkeep) — lives here. A
 * fixture only *one* file needs (a bespoke cascade card, an interactive-`suspendChoice` card, a
 * per-copy-counter card) stays local to that file, layered on top via `installCards`.
 */
import { CARDS, type CardDef } from '../content/cards';
import { BOARDS, type BoardDef, type BoardId } from '../content/boards';
import { STICKERS, type StickerDef } from '../content/stickers';
import { BOARD_STICKERS, type BoardStickerDef } from '../content/boardStickers';
import { scaleResources, subtractResources } from './resources';
import { getCounter, bumpCounter } from './state';
import { gainResources, suspendChoice } from './effects';
import { peekTop, drawInstance, returnToDeck } from './deck';
import { effectiveGain } from './stickers';

// --- Synthetic board -------------------------------------------------------------------------------

/** The one fixture board. Every fixture-backed run seeds off *this* (never a shipped board id), so a
 *  board reset can't break board-dependent tests. All 8 starting values are distinct and non-trivial
 *  so `run/setup.ts` assertions can pin each one unambiguously. Its id is cast to `BoardId` because
 *  the shipped union doesn't (and shouldn't) know about a test-only board. */
export const TEST_BOARD_ID = 'test_board' as BoardId;
export const TEST_BOARD: BoardDef = {
  id: TEST_BOARD_ID,
  name: 'Test Board',
  description: 'A synthetic board for tests — distinct values on all 8 starting fields.',
  resources: { food: 5, production: 4, science: 3, military: 2, money: 1 },
  population: 2,
  territory: 7,
  culture: 0,
};

/** A second synthetic board, for the few tests that need to prove two boards stay independent (e.g.
 *  a board-sticker purchase touching only its target board). Distinct values from `TEST_BOARD`. */
export const TEST_BOARD_2_ID = 'test_board_2' as BoardId;
export const TEST_BOARD_2: BoardDef = {
  id: TEST_BOARD_2_ID,
  name: 'Test Board 2',
  description: 'A second synthetic board for board-independence tests.',
  resources: { food: 2, production: 6, science: 1, military: 4, money: 3 },
  population: 1,
  territory: 5,
  culture: 0,
};

// --- Synthetic cards -------------------------------------------------------------------------------

/** Base gain of the dynamic-text fixture — the single source both its `resolve` and its `dynamicText`
 *  read (like a self-scaling card's `base`), so the two can't disagree once a sticker folds over it. */
const DYNAMIC_BASE = { food: 2 } as const;

/** Every shared `test_*` card, keyed by id. Covers each `CardKind`, one canonical producer per
 *  resource, the staffing variants, the canonical `effect`-field actions, a bespoke-`resolve` card, a
 *  `dynamicText` card, the threat/event/objective shapes, and the one reused `on`-handler observer. */
export const FIXTURE_CARDS: Record<string, CardDef> = {
  // --- Building producers: one clean single-resource producer per resource (all need 1 worker). ---
  // The food producer doubles as the restricted-sticker (food-only) eligible card.
  test_food: {
    id: 'test_food', name: 'Test Food', kind: 'building',
    cost: { production: 2 }, produces: { food: 2 }, workers: 1,
  },
  test_prod: {
    id: 'test_prod', name: 'Test Prod', kind: 'building',
    cost: { production: 2 }, produces: { production: 2 }, workers: 1,
  },
  test_sci: {
    id: 'test_sci', name: 'Test Science', kind: 'building',
    cost: { production: 3 }, produces: { science: 2 }, workers: 1,
  },
  test_money: {
    id: 'test_money', name: 'Test Money', kind: 'building',
    cost: { production: 2 }, produces: { money: 2 }, workers: 1,
  },
  // Culture producer: output via `cultureOutput` (no `produces`), like a Theater.
  test_culture: {
    id: 'test_culture', name: 'Test Culture', kind: 'building',
    cost: { production: 3 }, cultureOutput: 2, workers: 1,
  },
  // Self-sufficient building (workers:0): always operating, no staffing needed — the staffing variant.
  test_selfstaffed: {
    id: 'test_selfstaffed', name: 'Test Self-Staffed', kind: 'building',
    cost: { production: 2 }, produces: { military: 3 }, workers: 0,
  },
  // Multi-output building — proves an additive-gain sticker bumps *every* produced key.
  test_multi: {
    id: 'test_multi', name: 'Test Multi', kind: 'building',
    cost: { production: 2 }, produces: { production: 1, military: 2 }, workers: 1,
  },
  // Wonder: plays exactly like a building (occupies a slot, produces while staffed) but is `kind:
  // 'wonder'` — proves the wonder gates (no copies, no stickers, one per deck) and the shared
  // `isStructure`/`isStaffable` production/placement paths.
  test_wonder: {
    id: 'test_wonder', name: 'Test Wonder', kind: 'wonder',
    cost: { production: 2 }, cultureOutput: 2, workers: 1,
  },

  // --- Work cards: produce their `effect.gain` only while staffed, file to discard at end of turn. ---
  test_work: {
    id: 'test_work', name: 'Test Work', kind: 'work',
    cost: {}, workers: 1, effect: { gain: { production: 3 } },
  },
  test_work_food: {
    id: 'test_work_food', name: 'Test Work Food', kind: 'work',
    cost: {}, workers: 1, effect: { gain: { food: 3 } },
  },

  // --- Action cards: one per canonical `effect` field, so a test can exercise each declaratively. ---
  test_action: {
    id: 'test_action', name: 'Test Action', kind: 'action',
    cost: { science: 1 }, effect: { gain: { science: 3 } },
  },
  test_draw: {
    id: 'test_draw', name: 'Test Draw', kind: 'action',
    cost: { money: 1 }, effect: { draw: 2 },
  },
  test_settlers: {
    id: 'test_settlers', name: 'Test Settlers', kind: 'action',
    cost: { food: 2 }, effect: { population: 1 },
  },
  test_territory: {
    id: 'test_territory', name: 'Test Territory', kind: 'action',
    cost: { military: 3 }, effect: { territory: 1 },
  },
  test_festival: {
    id: 'test_festival', name: 'Test Festival', kind: 'action',
    cost: { food: 2 }, effect: { culture: 3 },
  },
  // Carries a discard cost (extra cards discarded from hand to play it), like Eureka.
  test_discard: {
    id: 'test_discard', name: 'Test Discard', kind: 'action',
    cost: {}, discardCost: 1, effect: { gain: { science: 3 } },
  },
  // Gated behind a minimum culture level (a gate, not a cost), like The Philosopher.
  test_cultreq: {
    id: 'test_cultreq', name: 'Test Culture-Req', kind: 'action',
    cost: { science: 1 }, cultureLevelReq: 1, effect: { gain: { science: 3 }, draw: 1 },
  },
  // Destroy action: demolishes a chosen tableau building (`effect.destroy`).
  test_destroy: {
    id: 'test_destroy', name: 'Test Destroy', kind: 'action',
    cost: { production: 1 }, effect: { destroy: true },
  },
  // Interactive peek action: reveals the top 3 of the draw pile into a choice tray,
  // you draw 1, the rest shuffle back. Its resolver suspends into a `pendingInteraction` and resumes
  // on the chosen index — the canonical interactive/`suspendChoice` fixture. `revealsFromDeck` both
  // drives the peek count and gates the card as unplayable when both piles are empty.
  test_peek: {
    id: 'test_peek', name: 'Test Peek', kind: 'action', cost: { science: 1 },
    revealsFromDeck: 3,
    description: 'Peek the top 3 cards; draw 1, shuffle the rest back',
    resolve: (ctx) => {
      if (ctx.answer === undefined) {
        suspendChoice(ctx, {
          kind: 'chooseCard',
          prompt: 'Draw one — the rest shuffle back',
          options: peekTop(ctx, 3),
          pick: 1,
        });
        return;
      }
      const pending = ctx.G.pendingInteraction;
      if (!pending) return;
      const chosen = pending.options[ctx.answer];
      const rest = pending.options.filter((_, i) => i !== ctx.answer);
      if (chosen !== undefined) drawInstance(ctx, chosen);
      returnToDeck(ctx, rest);
      ctx.G.pendingInteraction = null;
    },
  },
  // Bespoke-`resolve` action with no declarative `effect`: adds its gain through `gainResources`, so a
  // sticker's `effectiveGain` still folds over it (the gap a bespoke resolver's output would otherwise miss).
  test_bespoke: {
    id: 'test_bespoke', name: 'Test Bespoke', kind: 'action', cost: {},
    description: '+2🔬',
    resolve: (ctx) => gainResources(ctx, { science: 2 }),
  },
  // `dynamicText` action: its face text reads the *same* base through `effectiveGain` its `resolve`
  // gains — so the displayed number always matches what a play actually adds, sticker-adjusted.
  test_dynamic: {
    id: 'test_dynamic', name: 'Test Dynamic', kind: 'action', cost: {},
    description: '+2🌾',
    dynamicText: (_G, self) => `+${effectiveGain(DYNAMIC_BASE, self)!.food}🌾`,
    resolve: (ctx) => gainResources(ctx, DYNAMIC_BASE),
  },
  // Growing per-instance gain: +1🌾 the first play of a copy, +1 more per prior play
  // *of that same copy* (the count lives in the instance's own `counters`, riding with the card). The
  // canonical per-copy-state fixture.
  test_growing: {
    id: 'test_growing', name: 'Test Growing', kind: 'action', cost: {},
    description: '+1🌾',
    dynamicRule: '+1 each time played',
    dynamicText: (_G, self) => `+${effectiveGain(scaleResources({ food: 1 }, getCounter(self, 'plays') + 1), self)!.food}🌾`,
    resolve: (ctx) => {
      gainResources(ctx, scaleResources({ food: 1 }, getCounter(ctx.self, 'plays') + 1));
      bumpCounter(ctx.self, 'plays');
    },
  },

  // --- The one reused `on`-handler observer (events.test.ts + upkeep.test.ts both need it). ---
  // Threshold observer: the first time money crosses 10 while operating, pays +5🔬 once (per-copy
  // `fired` counter), like Treasury. Events-only observers (draw/discard reactors) stay local to
  // events.test.ts — this one is shared because two files drive it.
  test_threshold: {
    id: 'test_threshold', name: 'Test Threshold', kind: 'building',
    cost: { production: 2 }, workers: 1,
    description: 'While staffed, the first time 💰 reaches 10: +5🔬 (once)',
    on: {
      resourceChange: (ctx) => {
        const e = ctx.event;
        if (e?.type !== 'resourceChange') return;
        if (getCounter(ctx.self, 'fired')) return;
        if (e.before.resources.money < 10 && ctx.G.resources.money >= 10) {
          gainResources(ctx, { science: 5 });
          bumpCounter(ctx.self, 'fired');
        }
      },
    },
  },

  // --- Event: mission-injected; auto-resolves at end of turn, then exiles itself (`remove: true`). ---
  test_event: {
    id: 'test_event', name: 'Test Event', kind: 'event',
    cost: {}, effect: { loss: { military: 2 }, remove: true },
  },

  // --- Threats: flat drain, escalating drain, and a deadline that owns its own defeat. ---
  // Flat per-round drain via the declarative default (`effect.loss`), ticked by the `endTurn`
  // broadcast through the shared resolver spine.
  test_threat: {
    id: 'test_threat', name: 'Test Threat', kind: 'threat',
    cost: {}, effect: { loss: { food: 2 } },
    description: '−2🌾 every round',
  },
  // Escalating drain via a bespoke `resolve` reading its own `level` counter (−1🔨, then −2, …), like
  // Creeping Decay. Reused by threats + the mission-spine relocation, hence shared.
  test_escalating: {
    id: 'test_escalating', name: 'Test Escalating', kind: 'threat', cost: {},
    description: '−1🔨 every round, worsening',
    resolve: ({ G, self }) => {
      subtractResources(G.resources, scaleResources({ production: 1 }, getCounter(self, 'level') + 1));
      bumpCounter(self, 'level');
    },
  },
  // Deadline threat: owns its own driven defeat as a pure-read predicate (no resource drain), the loss
  // counterpart to an objective's win. `round > 5` (not `>= 5`) mirrors the shipped deadline convention.
  test_deadline: {
    id: 'test_deadline', name: 'Test Deadline', kind: 'threat', cost: {},
    description: 'Defeat once round 5 fully elapses.',
    defeat: (G) => G.round > 5 && 'test deadline',
  },

  // --- Objective: owns its mission's win as a pure-read predicate over `G` (never mutates it). ---
  test_objective: {
    id: 'test_objective', name: 'Test Objective', kind: 'objective', cost: {},
    description: 'Reach 10 Science.',
    objective: (G) => G.resources.science >= 10,
    dynamicText: (G) => `${G.resources.science}/10🔬`,
  },
};

// --- Synthetic stickers ----------------------------------------------------------------------------

/** The three sticker *shapes* the mechanism tests need — chosen values, not catalogue numbers:
 *  - `test_addgain` (Reinforced-like): +1 to every produced key (unrestricted output bump).
 *  - `test_costcut` (Efficient-like): −1 off every cost key, floored at 0 (never negative).
 *  - `test_restricted` (Irrigation-like): attaches only to a food-producing building; bumps its food. */
export const FIXTURE_STICKERS: Record<string, StickerDef> = {
  test_addgain: {
    id: 'test_addgain', name: 'Test Add-Gain', description: "+1 to this copy's output",
    icon: '➕', cost: 10,
    applyGain: (base) => {
      if (!base) return base;
      const out: typeof base = {};
      for (const [k, v] of Object.entries(base) as [keyof typeof base, number][]) out[k] = v + 1;
      return out;
    },
  },
  test_costcut: {
    id: 'test_costcut', name: 'Test Cost-Cut', description: 'Costs 1 less to play',
    icon: '➖', cost: 3,
    applyCost: (cost) => {
      const out: typeof cost = {};
      for (const [k, v] of Object.entries(cost) as [keyof typeof cost, number][]) out[k] = Math.max(0, v - 1);
      return out;
    },
  },
  test_restricted: {
    id: 'test_restricted', name: 'Test Restricted', description: '+1🌾 on a food building',
    icon: '💧', cost: 3,
    appliesTo: (c) => c.kind === 'building' && (c.produces?.food ?? 0) > 0,
    applyGain: (base) => (base ? { ...base, food: (base.food ?? 0) + 1 } : base),
  },
};

// --- Synthetic board stickers ----------------------------------------------------------------------

/** Board stickers are a *separate* catalogue from card stickers (`content/boardStickers.ts`): each
 *  tweaks a board's starting profile via one `applyToBoard` fold. Three distinct shapes/ids so a test
 *  can exercise a core-resource bump, a strategic-gauge bump, stacking, composing two, and rejecting a
 *  third at the cap. All unrestricted (attach to any board). */
export const FIXTURE_BOARD_STICKERS: Record<string, BoardStickerDef> = {
  test_bs_food: {
    id: 'test_bs_food', name: 'Test BS Food', description: '+2 starting Food', icon: '🌾', cost: 3,
    applyToBoard: (b) => ({ ...b, resources: { ...b.resources, food: b.resources.food + 2 } }),
  },
  test_bs_territory: {
    id: 'test_bs_territory', name: 'Test BS Territory', description: '+1 starting Territory', icon: '🗺️', cost: 10,
    applyToBoard: (b) => ({ ...b, territory: b.territory + 1 }),
  },
  test_bs_military: {
    id: 'test_bs_military', name: 'Test BS Military', description: '+1 starting Military', icon: '⚔️', cost: 3,
    applyToBoard: (b) => ({ ...b, resources: { ...b.resources, military: b.resources.military + 1 } }),
  },
};

// --- Install / uninstall ---------------------------------------------------------------------------

/** Splice an arbitrary card record into the live `CARDS` for a test's duration — the generic primitive
 *  a test uses to install *its own* local fixtures (e.g. `events.test.ts`'s cascade/self-removal cards,
 *  which are specific to that suite and don't belong in the shared set) on top of the shared ones,
 *  without itself value-importing `content/cards`. Pair with `uninstallCards` in teardown. */
export function installCards(cards: Record<string, CardDef>): void {
  for (const [id, def] of Object.entries(cards)) CARDS[id] = def;
}

/** Remove a card record from the live `CARDS`, undoing an `installCards`. */
export function uninstallCards(cards: Record<string, CardDef>): void {
  for (const id of Object.keys(cards)) delete CARDS[id];
}

/** Splice every shared fixture into the live catalogues for a test's duration. Call in `beforeAll`
 *  (or `beforeEach`); pair with `uninstallFixtures` in `afterAll`/`afterEach`. Idempotent overwrite. */
export function installFixtures(): void {
  installCards(FIXTURE_CARDS);
  for (const [id, def] of Object.entries(FIXTURE_STICKERS)) STICKERS[id] = def;
  for (const [id, def] of Object.entries(FIXTURE_BOARD_STICKERS)) BOARD_STICKERS[id] = def;
  BOARDS[TEST_BOARD_ID] = TEST_BOARD;
  BOARDS[TEST_BOARD_2_ID] = TEST_BOARD_2;
}

/** Remove every shared fixture from the live catalogues, restoring them to their pre-install contents. */
export function uninstallFixtures(): void {
  uninstallCards(FIXTURE_CARDS);
  for (const id of Object.keys(FIXTURE_STICKERS)) delete STICKERS[id];
  for (const id of Object.keys(FIXTURE_BOARD_STICKERS)) delete BOARD_STICKERS[id];
  delete BOARDS[TEST_BOARD_ID];
  delete BOARDS[TEST_BOARD_2_ID];
}
