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

- **Step 2 — Reset ALL content + decouple tests** DONE ✅

- **Step 3 — Starting content: Paleolithic set + Founding deck + Tribe board + sandbox mission** DONE ✅

- **Step 4 — Headless simulator (balance tooling)** — first deliverable DONE ✅; follow-on open.
  A code-driven, no-browser/no-React runner over the pure core, for statistical balance answers no
  human can play enough games to reach (is a mission winnable? is a sticker overpowered? is a card
  ever played? is the food economy too tight?).
  - **Shipped:** `src/sim/` — `simulateRun(config, policy)` + a seeded **random-legal-move policy**
    (`createRandomPolicy`, doubling as a crash/illegal-state fuzzer via `assertRunInvariants` after
    every action) + a content-agnostic `simConfig` builder. Legality reuses the prod
    `unplayableReason`; randomness runs through `rules/rng.ts`'s new `randInt` (the one seam). Smoke
    test (`sim/sim.test.ts`) runs the Founding deck / Tribe board / sandbox across 50 seeds.
  - **Shipped (batch + reporting):** `runBatch(scenarios, { seeds })` (`sim/batch.ts`) sweeps a flat
    `Scenario[]` ×N seeds (reproducible dual seed streams); `summarize`/`formatReport` (`sim/report.ts`)
    fold whole `SimOutcome`s into per-scenario stats (win rate · turns min/median/mean/max · mean end
    resources · defeat-cause histogram off `gameover.reason` · summed `cardPlays` + unplayed-cards).
    `SimOutcome.cardPlays` (accepted plays per cardId) is the new "dead card?" signal. `npm run sim`
    CLI prints it (`scripts/sim.ts`).
  - **Still open:** heuristic/greedy policies; `transferWorker` enumeration in the policy; a **full
    move-surface fuzz test over synthetic fixtures** (building/destroy/`discardCost` — deferred until
    real content exists in Step 6, or an explicit later fuzz pass). `[size: M]` `[phase: 4]`

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

- **Step 3 — Starting content (Paleolithic)** ✅ — refilled the minimum coherent slice so the game is
  launchable again, scoped to a **Paleolithic hunter-gatherer** start with **no buildings** in the deck
  or collection (buildings arrive with the Neolithic arc in Step 6). Authored: 10 base cards in `CARDS`
  (Foraging/Toolmaking work + Fire/Bow/Cave Art/Clothing/Jewelry/Bartering/Dogs/Kinship actions);
  a 20-card buildingless **Founding** deck (`DEFAULT_DECKS`); the **Tribe** board (`BOARDS`: food 5,
  pop 2, everything else 0 incl. territory); and the baseline **`sandbox`** infinite mission — a
  never-win `sandbox_goal` objective (`() => false`) plus a no-drain `sands_of_time` deadline threat
  ending the run once `SANDBOX_DEADLINE` (50) elapses, so it bounds the Step 4 simulator without
  skewing the economy. `STARTING_COLLECTION` counts are copy-tier-attainable (1/2/4/8, never 3);
  `rules/collection.test.ts` re-armed to pin that it covers the deck, and a new `cards.test.ts` pins
  catalogue coherence. Numbers are first-pass, to be tuned by the Step 4 sim. Pre-alpha: **wipe local
  save** (new card/board/mission ids) — [[prealpha-no-save-migration]].

- **Step 2 — Reset ALL content + decouple tests** ✅ — every content catalogue emptied to an empty
  export (files + types kept, never deleted): `CARDS`/`DEFAULT_DECKS`/`STARTING_COLLECTION`/`MISSIONS`/
  `STICKERS`/`BOARD_STICKERS`/`BOARDS` all `{}`/`[]`; `BoardId` widened to `string`. Suite runs green on
  a shared synthetic-fixture module (`rules/testFixtures.ts`: `test_*` `CardDef`s + `test_board` +
  synthetic stickers, spliced into the live maps via `installFixtures`/`uninstallFixtures`, state minted
  through the real prod functions). All `rules/`+`run/` mechanism tests decoupled off catalogue values;
  mislabeled content-module mechanism blocks (`compareCards`, the mission win/defeat spine) relocated to
  synthetic fixtures. Content-side coherence iterators (missions/decks/boards) kept but pass **vacuously**
  on empty catalogues — earmarked for Step 3 rewrite (incl. `STARTING_COLLECTION` owns-enough coverage).
  Game is knowingly **non-launchable** until Step 3 refills content (tests/typecheck stay green);
  `parsePlayerStore` confirmed shape-only so dead saved ids don't crash — pre-alpha **wipe local save**
  when Step 3 lands new ids ([[prealpha-no-save-migration]]).

- **Step 1 — Deck-construction constraints** ✅ — `MIN_DECK_SIZE` floor (provisional 20, enforced at
  `rules/deckBuilder.ts` + `App.saveDeck`, reflected by the deck editor's disabled Save + `X / 20`
  readout), default hand limit lowered 5→4 (`blankState`), per-card copy cap already existed. Founding
  deck padded to 20 (placeholder — reset in Step 2).
