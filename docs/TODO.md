# CivCardGame — TODO / Planner

> A **rudimentary, temporary planner** — a lightweight ticket manager and
> scratchpad, *not* a durable record. Items are planned here, executed one by one,
> and brainstormed/refined in place. Content is grouped by codebase area, with a
> *Done / shipped* archive at the bottom.
>
> **This content is designed to be discarded:** at each version bump the shipped
> items are erased and replaced by short one-line [`CHANGELOG.md`](../CHANGELOG.md)
> entries. So TODO.md holds *transient* planning state; [`DESIGN.md`](DESIGN.md)
> holds the *decided design*, and `CHANGELOG.md` the *durable history*. Nothing
> durable should reference an item here — the citation would rot when this is wiped.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else · `[phase: N]` roadmap phase (1 = run loop · 2 = contract + meta shell · 3 = economy & progression · 4 = content & balance).

## Phase 3 — planned steps (economy & progression)

> The Phase 3 design is locked in [`DESIGN.md`](DESIGN.md) (*Economy & progression*); this is
> the actionable cut, held here for later sessions. Suggested order: 1 → 2 & 3 → 4 → 5 → 6 → 7 → 8
> (Steps 0, 1, 2, and 3 are **done**). **Steps 1+2+3+4 form a playable spine** — unlock cards from
> missions, own copies, build capped decks — before the map/shop UI (Step 5) lands.
> Pre-alpha: **no save migration**, replace the store shape freely.

- **Step 1 — Ownership & currency core** ✅ done — see *Done / shipped* below. `[phase: 3]`
- **Step 2 — Deck-editor copy caps** ✅ done — see *Done / shipped* below. `[phase: 3]`
- **Step 3 — Mission model + campaign-map data** ✅ done — see *Done / shipped* below. `[phase: 3]`
- **Step 4 — Reward computation + run-end wiring** ✅ done (standard-mission half) — see
  *Done / shipped* below. `[phase: 3]`
- **Step 5 — Meta UI: map + shop** — Influence display in the nav ✅ done (see
  *Done / shipped* below); the rest is split into substeps. `[phase: 3]`
  - **Step 5.1 — Campaign Map screen** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 5.2 — Shop** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 5.3 — Mission detail panel** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
- **Step 6 — Infinite missions** — endless, replayable missions that never win and pay
  Influence = rounds survived. Cut into substeps; suggested order **6.1 → 6.2 → 6.3a → 6.3b → 6.3c**.
  `[phase: 3]`
  - **Step 6.1 — Non-fixed (dynamic) card effects** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 6.2 — Infinite-mission plumbing + campaign UI + scoring** — ✅ done — see
    *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 6.3a — Threat zone (pure core)** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 6.3b — Threat UI + Long Winter's food drain as a real threat card** — ✅ done — see
    *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 6.3c — Creeping Decay infinite mission** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
- **Step 7 — Card stickers** *(last, deepest)* — permanent per-copy card buffs bought with Influence
  (DESIGN.md *Economy & progression*: "a card sticker buffs a *single owned copy* forever"). **Design
  settled in discussion (2026-07-07):** model the meta collection as **uniform card instances** — every
  owned copy is an identified `CardInstance` and decks reference copies by instance id — rather than
  lazily minting identity only when a sticker is applied. Rationale: with uniform instances, stickering
  is a pure *in-place mutation of one instance that touches nothing else* — no bare-count→instance
  conversion, so no deck reconciliation and no way to duplicate a copy by forgetting a branch (the trap
  the first attempt hit: the deck already held both farms, was unaware of the sticker, and a stickered
  3rd farm slipped past the 2-copy cap). Every deck referencing that instance sees the sticker for free
  (single source of truth); the "which of my two farms gets it, the decked one or the shelf one?"
  ambiguity is resolved by an explicit per-instance pick (7.3) over stable, ordered identities (7.4).
  The run boundary still deep-copies each meta instance into a fresh run `CardInstance` (run `counters`
  mutate and must never persist back). The precursor is already **done** (Stage 4 of the resolver
  rewrite): pile cards are `CardInstance`s with per-copy state (`counters`). Suggested order 7.1 → 7.9
  (7.7/7.8/7.9 added 2026-07-07, after 7.6 shipped — polish/expansion, not required for the core loop).
  `[size: L]` `[phase: 3]`
  - **Step 7.1 — Bounded copy tiers (drop `'unlimited'`)** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 7.2 — Uniform meta card instances** — ✅ done — see *Done / shipped* below.
    `[size: L]` `[phase: 3]`
  - **Step 7.3 — Collection per-instance view** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 7.4 — Ordered deck assignment** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 7.5 — Card stickers in the meta (not yet in the run)** — ✅ done — see *Done / shipped*
    below. `[size: M]` `[phase: 3]`
  - **Step 7.6 — Card stickers in the run loop** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 7.7 — Raise the sticker cap to 2 per instance** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 7.8 — Add Irrigation sticker** — ✅ done — see *Done / shipped* below. `[size: S]` `[phase: 3]`
  - **Step 7.9 — Sticker UI: per-sticker icons, bottom-left badge, effective values everywhere** —
    four related gaps left after 7.5/7.6:
    1. **Distinct icons** ✅ done — see *Done / shipped* below.
    2. **Bottom-left placement** ✅ done — see *Done / shipped* below.
    3. **Meta screens show effective values too** ✅ done — see *Done / shipped* below.
    4. **Loop cards stay visibly stickered** ✅ done — see *Done / shipped* below.
- **Step 8 — Board stickers** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
- **Step 9 — Meta UI rework** — a multi-part pass over the meta screens now that the
  economy (Steps 1–8) is in place; cut into substeps. Only ordering constraint is **9.1 → 9.2**
  (9.2 reworks the detail view 9.1 fuses into); 9.3, 9.4, 9.5, and 9.6 are independent of each
  other and of 9.1/9.2 (9.4 touches the mission-flow *detail* step, 9.5 its *launch* step —
  disjoint). `[phase: 3]`
  - **Step 9.1 — Fuse Shop into Collection** — ✅ done — see *Done / shipped* below.
    `[phase: 3]`
  - **Step 9.2 — Collection UI rework + card upgrades** — ✅ done — see *Done / shipped* below.
    `[phase: 3]`
  - **Step 9.3 — Board UI rework** ✅ done — see *Done / shipped* below.
  - **Step 9.4 — Mission lore page: show the cards the mission is about** — ✅ done — see
    *Done / shipped* below. `[size: S]` `[phase: 3]`
  - **Step 9.5 — Mission select page: boards as `BoardMini`** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 9.6 — Stats UI rework** — ✅ done — see *Done / shipped* below. `[phase: 3]`

## Phase 4 — planned steps (content & balance)

> Phase 4 is content expansion + balance tuning with the headless simulator (see
> [`DESIGN.md`](DESIGN.md) *Build roadmap*). It kicks off with tutorial onboarding, since new
> content is what a new player meets first.

- **Step 1 — Tutorial missions** — the first few meta missions double as tutorials,
  introducing mechanics progressively; tutorial entry-node missions on the map. Covers
  designing several missions, onboarding indicators/popups, and careful pacing so new
  mechanics aren't dumped on the player all at once. Rough pacing: the starting deck holds
  only `work`/`action` cards, no buildings — mission 1 unlocks the first buildings (House,
  Farm, Workshop); mission 2 introduces territory limitation (and maybe conquest?) alongside
  them. Goal is to reach a certain population. Unlocks culture stuff. Mission 3 explains culture, goal to reach culture lvl2. `[size: L]` `[?]` `[phase: 4]`

- **Step 2 — Headless simulator (balance tooling)** — a code-driven, no-browser/no-React
  runner over the pure core, for statistical balance answers no human can play enough games
  to reach (is a mission winnable? is a sticker overpowered? is a card ever played? is the
  food economy too tight?). Feasible because the core is already framework-free, deterministic
  (seeded RNG), and — post the "cards/stickers own their logic" + event-bus refactors — holds
  *all* real game behaviour behind `resolveCard`/`StickerDef` hooks/the always-drained bus, so a
  sim consumes the genuine behaviour with no duplicated branch; the bus's fixed dispatch order +
  `MAX_EVENT_CASCADE` cap guarantee determinism and termination even under a fuzzing policy. Only
  new consideration is throughput (millions of `endTurn`s), not viability. **First deliverable:** a
  tiny `simulateRun(config, policy)` helper beside `run/engine.ts` + a **random-legal-move policy**
  (doubles as a crash/illegal-state fuzzer), before any smarter policy or result aggregation.
  Later: heuristic policies, batch runs across seeds/decks/missions, aggregation/reporting.
  `[size: M]` `[?]` `[phase: 4]`

## Cards & content (`src/content/`)

- **Remove Settlers, replace with a Hut building** `[?]` `[phase: 4]`
- **Disasters — expand** — the `event` card mechanic shipped (see `CHANGELOG.md`); grow it out with more disaster types beyond the Barbarian and missions that inject them (details TBD) `[?]` `[phase: 4]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`
- **Age tag on cards** — tag each card with the age it unlocks in, so the player can sort/filter by age `[?]` `[phase: 4]`

## UI (`src/components/`)

- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`

## Game design & balance

- Card that gives a draw when expanding territory `[?]` `[phase: 4]`
- Card effects that trigger on discard / on draw, to enable combos `[?]` `[phase: 4]`
- **Minimum deck size — 20 cards** — enforce a floor on deck size (mirrors the existing
  `MAX_DECKS` cap precedent — a core rule enforced at the deck writer, not just a UI gate);
  also means adjusting `content/decks.ts`'s starter deck up to 20 cards to satisfy it.
  `[phase: 4]`
- **Default hand limit — 4 instead of 5** — lower the base starting hand size from 5 to 4.
  `[phase: 4]`

## Tech debt / architecture

_(none open)_

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.3 (end of Phase 3)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 4 onward.
