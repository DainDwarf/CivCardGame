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

## Phase 4 — planned steps (content & balance)

> Phase 4 is content expansion + balance tuning with the headless simulator (see
> [`DESIGN.md`](DESIGN.md) *Build roadmap*). The content target is the **first three ages —
> Neolithic, Bronze Age, Iron Age**. **Neolithic is the whole tutorial age** and introduces
> *all* core gameplay (buildings, territory, conquest, culture); Bronze Age + Iron Age add
> **no new mechanics** — they are content expansion, and their flavor is not yet decided
> (only the historical period is fixed). Steps are loosely independent; hard dependencies are
> noted inline.

- **Step 1 — Deck-construction constraints** DONE ✅

- **Step 2 — Reset ALL content + decouple tests** — set aside every content catalogue:
  cards, starting collection, decks, missions, **card stickers, board stickers, and the
  boards themselves** (`content/cards.ts`, `collection.ts`, `decks.ts`, `missions.ts`,
  `stickers.ts`, `boardStickers.ts`, `boards.ts`). `[size: L]` `[phase: 4]`

  Cut into six shippable substeps. **Invariant at every substep boundary (each = one commit):**
  `npm run typecheck` **and** `npm test` are green. Catalogues are **emptied to empty exports,
  files + types kept** (`export const CARDS = {}`), never deleted — the app keeps typechecking.
  **Two accepted costs:** (a) the game is knowingly *non-launchable* from the cards/boards reset
  (2.5–2.6) until Step 3 refills it — only a live run can't be built, tests/typecheck stay green;
  (b) **save wipe** — swapping ids leaves `localStorage`/`.civsave` referencing dead ids and the
  store *shape* is unchanged so the reset path may miss it; pre-alpha, so document "wipe local save"
  and confirm `parsePlayerStore` doesn't crash on dangling ids ([[prealpha-no-save-migration]]).

  *Why test work fully precedes content removal:* the engine resolves through the global maps at
  runtime (`effects.ts` `CARDS[ctx.self.cardId]`, `setup.ts` `BOARDS[config.board]`, sticker
  lookups), so the instant a catalogue empties every spine test breaks unless its fixtures are
  **installed into the live map** for the test's duration.

  - **2.1 — Delete content-behaviour tests** — remove the `describe`/`it` blocks asserting a
    *specific* shipped card's/sticker's inner values (Reinforced/Efficient/Irrigation deltas, a
    named card's bespoke `resolve`). **Triage is per-block, not per-file** — mixed files
    (`stickers.test.ts`, `boardStickers.test.ts`, `rewards.test.ts`, likely `effects.test.ts`/
    `moves.test.ts`) keep their *mechanism* blocks, lose only their *content-value* blocks.

  - **2.2 — Decouple surviving `rules/`+`run/` tests onto synthetic fixtures** — build a small shared
    `src/rules/testFixtures.ts`: synthetic `test_*` `CardDef`s (building/work/action/event/threat/
    **objective** shapes + staffing/production/destroy variants; the objective one carries an
    `objective` predicate), one `test_board`, one/two `StickerDef`s, **plus
    `installFixtures()`/`uninstallFixtures()`** that splice into the live `CARDS`/`BOARDS`/`STICKERS`
    (generalizing `events.test.ts`'s local `FIXTURES` + `beforeAll`/`afterAll`). Mint run state via
    the **real prod functions** (`instancesFromCardIds`, `collectionFromCounts`, `buildSeedDecks`,
    `blankState`), never re-implemented ([[feedback-test-fixtures-share-prod-code-path]]). **Exit
    condition:** no `rules/`/`run/` test imports `content/{cards,boards,decks,missions,stickers,
    boardStickers,collection}`. (2.1 before 2.2 so the migration doesn't port soon-deleted blocks.)

    *Mechanism coverage to re-add on synthetic fixtures* — the 2.1 deletions (7 `describe` blocks in
    `effects.test.ts` + `stickers.test.ts`) also carried the **only** coverage of these mechanisms; 2.2
    must re-assert each on synthetic cards/stickers (values chosen freely, not a catalogue number).
    Needs synthetic stickers of three shapes — an **additive-gain** one (Reinforced-like), a
    **cost-reducing** one (Efficient-like, floors at 0), and a **restricted/conditional** one
    (Irrigation-like, `appliesTo` gate) — plus a declarative-default card, a bespoke-`resolve` card,
    and a card with `dynamicText`:
    - `resolveCard` runs a card's **declarative-default** effect; a **bespoke `resolve`** still sees a
      sticker's bonus (the gap Cornucopia closed); **resolve/display agree** (`dynamicText` reflects the
      sticker-adjusted gain).
    - `effectiveGain` folds an output sticker's hook over a base bag · **stacks** two of the same ·
      leaves an unstickered instance untouched · passes `undefined` through unchanged.
    - `effectiveCost` subtracts per-resource · **floors at 0** (never negative) · stacks · leaves
      unstickered untouched.
    - `stickerAppliesTo` — a **restricted** sticker matches only eligible cards (by tag/kind), an
      **unrestricted** one matches everything.
    - two **different** stickers compose on one copy (gain + cost together).
    - `effectiveCard` — returns the *same object* when unstickered; reflects the gain hook in
      `produces`, the cost hook in `cost`, and a work card's `effect.gain`.

    *Content-module mechanism blocks to relocate here (mislabeled as content tests)* — two
    `content/*.test.ts` blocks index a *named* catalogue entry (`CARDS.farm`, `MISSIONS.enlightenment`)
    to test a **function/spine**, not the content — so they break on reset yet aren't coherence checks.
    Relocate their mechanism coverage here onto synthetic fixtures *now*, so 2.4/2.5 can gut the
    content-side originals freely (the empty-catalogue coherence iterators in those files survive
    vacuously — see 2.4/2.5):
    - **`compareCards`** (`content/cards.test.ts` — its *only* block) — the shared card comparator:
      kind order (building < work < action < event), alphabetical within a kind, leading-`'The '` strip
      (but *not* `'Theater'`), total order (0 only for equal name+kind). Re-assert on synthetic cards.
    - **mission win/defeat spine** (`content/missions.test.ts`'s per-mission + `bus-driven` blocks) — the
      per-mission blocks assert *shipped numbers* (30 science, 2 food/tick, 4 barbarians, round-12
      deadline): those specific values are 2.1-style content, **dropped**. But the spine they drive must
      be re-asserted on a synthetic mission (`MissionDef` built inline over the synthetic objective/threat
      ids): `seedMissionCards` seeds `threats` → `G.threats` and `events` → the deck; the `endTurn`
      broadcast (`dispatchEvent`) drains a synthetic threat; `objectiveMet`/`defeatMet` read the card's
      own predicate; `evaluateObjective`/`evaluateDefeat` re-derive `G.pendingVictory`/`pendingDefeat`
      at every `flushEvents` boundary (set-or-clear; false when unseeded).

    *Teardown order for 2.3–2.6: remove dependents before dependencies. Stickers hard-reference no
    ids; missions/decks/collection reference card ids; cards are referenced by all; boards thread
    through `setup`/`buildRunConfig`/`blankState` deepest → last.*

  - **2.3 — Reset sticker catalogues** (`content/stickers.ts`, `content/boardStickers.ts` → empty) —
    skeleton the coherence parts of `boardStickers.test.ts` + the sticker-content blocks in
    `upgrades.test.ts`. Leaf layer.

  - **2.4 — Reset missions** (`content/missions.ts` → empty `MISSIONS`) — by 2.4 the mechanism blocks
    in `content/missions.test.ts` are already relocated to synthetic (2.2), so gut what's left: drop the
    per-mission shipped-number blocks, keep only the **coherence iterators** (every mission names a real
    objective/threat/event card of the right kind) — they pass vacuously on empty `MISSIONS` and re-arm
    in Step 3. Also strip mission-content from `rewards.test.ts`/`campaign.test.ts`, keeping the
    reward/DAG *mechanism* on a synthetic `MissionDef`. Earmark for rewrite.

  - **2.5 — Reset the card layer together** (`content/cards.ts`, `decks.ts`, `collection.ts` → empty
    `CARDS`/`DEFAULT_DECKS`/`STARTING_COLLECTION`) — decks + collection ride *with* cards (splitting
    leaves dangling instance-id refs between commits). `content/cards.test.ts`'s only block
    (`compareCards`) is already relocated to synthetic in 2.2, so it empties cleanly; `decks.test.ts`'s
    coherence iterators (deck cardIds resolve · size ≥ `MIN_DECK_SIZE` · unique ids) pass vacuously on
    empty `DEFAULT_DECKS`. Skeleton those plus the content-dependent parts of `contract.test.ts`.
    Earmark for rewrite.

  - **2.6 — Reset boards** (`content/boards.ts` → empty `BOARDS`) — last, most deeply wired. Skeleton
    `content/boards.test.ts` + board-content parts of `setup.test.ts`; then close the save-wipe
    clause above (confirm `parsePlayerStore` survives a dead-id save; document "wipe local save").

- **Step 3 — Base set + Founding deck + a new board + sandbox mission** — author the
  always-owned base card set (Neolithic-tier), the new `STARTING_COLLECTION`, and a Founding
  deck that satisfies the Step 1 floor; **at least one new board** (boards were reset in
  Step 2 and a `RunConfig` needs one); and a baseline **infinite "sandbox" mission** to
  establish resource baselines for the simulator — a **never-win objective** (`() => false`,
  like the old `the_long_decline_goal`; the run loop always seeds `G.objective` and pins
  exactly one objective card, so it can't be truly objective-less) **plus a single no-drain
  deadline threat that ends the run at ~round 50** (a pure `defeat` predicate like the old
  `enlightenment_deadline`/Stagnation — *no* resource drain, so it bounds run length without
  skewing the economy baseline; the `50` is one tunable constant for simulation length).
  Depends on Step 2. `[size: L]` `[phase: 4]`

- **Step 4 — Headless simulator (balance tooling)** — a code-driven, no-browser/no-React
  runner over the pure core, for statistical balance answers no human can play enough games
  to reach (is a mission winnable? is a sticker overpowered? is a card ever played? is the
  food economy too tight?). Feasible because the core is already framework-free, deterministic
  (seeded RNG), and — post the "cards/stickers own their logic" + event-bus refactors — holds
  *all* real game behaviour behind `resolveCard`/`StickerDef` hooks/the always-drained bus, so a
  sim consumes the genuine behaviour with no duplicated branch; the bus's fixed dispatch order +
  `MAX_EVENT_CASCADE` cap guarantee determinism and termination even under a fuzzing policy. Only
  new consideration is throughput (millions of `endTurn`s), not viability. **First deliverable:** a
  tiny `simulateRun(config, policy)` helper in **`src/sim/`** (the architecture diagram's reserved
  home) + a **random-legal-move policy** (doubles as a crash/illegal-state fuzzer), before any
  smarter policy or result aggregation. Runs against Step 3's sandbox — the ~50-turn deadline
  guarantees bounded, terminating runs. Later: heuristic policies, batch runs across
  seeds/decks/missions, aggregation/reporting. `[size: M]` `[phase: 4]`

- **Step 5 — Ages map infrastructure** — promote ages from the undefined `era` placeholder to
  a real system: the `content/ages.ts` age→node/column model + the `CampaignMap.tsx` band
  layout that positions each age over its slice of the DAG (genuinely unbuilt today —
  `ages.ts` is a single `testing` placeholder and `CampaignMap.tsx` has no band layout). Own
  step, immediately before the first age's missions. Optionally folds in **age tag on cards**
  (tag each card with the age it unlocks in, for Collection sort/filter). `[size: M]`
  `[phase: 4]`

- **Step 6 — Neolithic arc** (the full tutorial content, mechanics-only, no onboarding UI) —
  the meat of Phase 4 gameplay: several missions introducing **all** core mechanics
  progressively — buildings (House/Farm/Workshop), then **territory limitation, conquest, and
  culture** (population targets, then culture-level goals). Author their unlock cards, reward
  amounts, prereqs, and DAG shape. **First place sticker unlocks happen:** extend
  `rules/rewards.ts` so a mission reward can unlock a **card or board sticker** (and gate which
  stickers are buyable) — not just a card. Balance via the Step 4 simulator. `[size: L]`
  `[?]` `[phase: 4]`

- **Step 7 — Bronze Age arc** (content expansion; flavor TBD) — new cards + missions themed
  to the Bronze Age, **no new mechanics**. Continues unlocking cards/stickers through mission
  rewards. Specific flavor/content **not yet decided** — placeholder until designed. If any
  building here needs 2–3 workers, the `[blocked]` multi-pip staffing UI + bulk-worker-transfer
  items (below) unblock. Balance via simulator. `[size: L]` `[?]` `[phase: 4]`

- **Step 8 — Iron Age arc** (content expansion; flavor TBD) — same shape as Step 7, Iron Age
  period; flavor/content **undecided**, placeholder until designed. Balance via simulator.
  `[size: L]` `[?]` `[phase: 4]`

- **Step 9 — Tutorial onboarding UI** — the scripted popups/indicators layer over the
  **Neolithic** arc (the sole tutorial age), so new mechanics aren't dumped on the player at
  once. "Tutorial seen" state belongs in device-local `Settings` (`meta/settings.ts`), **not**
  `PlayerStore` (not game progress). Mild tension with the anti-surprise unlock convention
  (tutorials reveal; unlocks surprise). `[size: L]` `[?]` `[phase: 4]`

> **Cross-cutting (not a step):** the Influence economy — shop tier + sticker prices — is
> tuned to the *old* content and must be re-tuned as new content lands, running *through*
> Steps 5–7, simulator-informed, not as a one-shot.

## Cards & content ideas — Phase 4 idea pool (unslotted)

> A pool to draw from while authoring the age arcs (Steps 5–7); each will land in whichever
> age's mechanics fit. All `[phase: 4]`.

- **Disasters — expand** — the `event` card mechanic shipped (see `CHANGELOG.md`); grow it out with more disaster types and missions that inject them (details TBD) `[?]`
- New mission type: "Metropolis" `[?]`
- New mission: "Build the Wonder" `[?]`
- Culture-based missions (depend on the Culture resource) `[?]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Resources transformation? Like a building that transforms production into science for example
- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`

## UI (`src/components/`)

- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]) — Step 7 may unblock it. `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`

## Tech debt / architecture

_(none open)_

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.3 (end of Phase 3)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 4 onward.

- **Step 1 — Deck-construction constraints** ✅ — `MIN_DECK_SIZE` floor (provisional 20, enforced at
  `rules/deckBuilder.ts` + `App.saveDeck`, reflected by the deck editor's disabled Save + `X / 20`
  readout), default hand limit lowered 5→4 (`blankState`), per-card copy cap already existed. Founding
  deck padded to 20 (placeholder — reset in Step 2).
