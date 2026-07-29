# CivCardGame — TODO / Planner

> A **rudimentary, temporary planner** — a lightweight ticket manager and
> scratchpad, *not* a durable record. Items are planned here, executed one by one,
> and brainstormed/refined in place. Content is grouped by codebase area, with a
> *Done / shipped* archive at the bottom.
>
> **Scope:** *transversal* bugs / improvements / features + the shipped-work archive. The Phase 4
> **content** roadmap (mission arcs, per-mission dossiers) lives in [`BACKLOG.md`](BACKLOG.md), not here.
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
> `[blocked]` waiting on something else.

## UI (`src/components/`)

- **Deck editor: the fixed deck-tray banner swallows clicks on the picker's last section.** At a
  ~949px-tall viewport the picker's bottom-most section sits *under* `.banner`
  (`position: fixed; bottom: 0`) at the default unscrolled position — `.picker`'s
  `padding-bottom: 260px` clearance isn't enough. `elementFromPoint` on a tile there resolves to a
  card in the tray beneath, so the click silently toggles **a different card** out of the deck; no
  error, no visual cue. Scrolling the picker down clears it. Found when Bartering became the first
  *ownable* `trade` card and its new **Trade Routes** section landed last in the picker — so every
  future kind added at the end walks into this. Fix the clearance/stacking, not the section order.
  `[size: S]`
- **Danger-button text contrast (app-wide)** — the `--danger-strong` / white pairing on danger
  buttons (GameMenu's Clear/Replace confirms, the deck-editor discard confirm, etc.) measures
  ~3.74:1 white-on-red — short of WCAG AA (4.5:1) for its bold ~15.7px size, in both light and dark.
  A transversal color-token decision (darken `--danger-strong` or bump the label size), not a
  per-dialog fix — touch it once so every danger button stays consistent. `[size: S] [?]`
- **Per-pip worker drag** — independent per-pip *drag* (drag a specific pip to another box); box-level
  worker drag still moves one worker at a time. Deferred follow-up from the shipped multi-pip staffing UI. `[?]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]`
- **Re-polish the victory / gameover screens + flow** — revisit the end-of-run overlay and the transition back to the meta loop now that missions grant real rewards: the win/loss screen should surface what the run earned (Influence, any unlocks) and read well for both outcomes, and the hand-back-to-meta flow should feel finished rather than functional. `[?]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`
- **Work reordering + insert-at-drop** — let the player reorder placed work cards, and have a newly-played
  work card insert at the drop position rather than appending. `[?]`
- **Show the food-upkeep change on population-granting cards** — Hut, House and any future `+N 🧍` card
  read as a pure gain, but upkeep is `floor(pop²/4)`, so the *marginal* mouth costs `floor(pop/2)` 🌾 a
  round and the price of growing rises as you grow. A player can't see that from the card face and only
  discovers it after building. Surface the delta on the face (and/or in the play preview) — `foodPerNextPop`
  (`rules/population.ts`) already exists for exactly this, so the curve isn't re-derived in the UI. Note it
  is state-dependent: the same card shows a different number at pop 2 than at pop 5. `[size: S]` `[?]`
- **Sticker locked/unlocked visual on mission preview** — rework how a mission's sticker reward reads locked vs. unlocked (currently a generic locked chip → real face). Maybe extract a **shared sticker widget** (the `CardFace`/`BoardMini` counterpart for a single sticker) reused across the mission-detail preview and elsewhere. `[?]`

## Run loop (`src/rules/`, `src/run/`)

- **Collapse the three board zones into one** `[size: M]` `[?]` — `GameState` still holds `tableau`,
  `workZone` and `tradeRoutes` as three separate `PlacedCard[]`s; they are already *presented* as one
  board in the data (`territory.ts`'s `placedCards` concatenates them for the instance-id scan and the
  UI's box lookup) even though they now render as three zones again and only the tableau is capped.
  Merging them into one array would read the per-kind behaviour off `CARDS[c.cardId].kind` where it's
  actually needed. **Re-read under the zone split before building it** — the three zones being visible
  again weakens the "they're already one board" argument this item opened with.
  - **What the split still encodes** is lifecycle, and that's what has to survive the merge: the
    tableau persists, the workZone clears every end of turn (`upkeep.ts`'s `discardWorkZone`), routes
    persist but take no workers and tick flat rather than per-worker. Today those are "which array am
    I in"; after, they're a kind check at the filing and production sites.
  - **Consequence for goals/effects that count board cards:** `first_trades_goal` reads
    `G.tradeRoutes.length` to mean "a route stands". Against one merged array that has to become a
    kind filter, or it counts every Farm. Sweep for other zone-name reads before starting —
    `sim/enablers.ts`'s goal probe and `oracleKey.ts`'s per-zone folds both name the zones directly.
  - Was an IDEAS candidate; promoted here 2026-07-27.
- **Removal cards — trade cancellation + building destroy** `[size: M]` `[?]` — the trade zone ships with
  routes **permanent**; this is the half deliberately held back. Playing a trade route would *also* mint a
  free **Trade Cancellation** into the **discard**; playing that closes one chosen route (route →
  `discard`, cancellation → `removed`). A **building destroy** card is the same shape for the tableau, and
  cashes in the destroy/demolish verb [`BACKLOG.md`](BACKLOG.md) parked for Bronze/Iron.
  - **The point is deck dilution, not convenience.** Buildings and routes stand on the board without
    thinning the deck; their removal cards are what keep circulating. So a standing thing would carry an
    ongoing *draw* cost on top of its resource cost — which is the actual design question, and wants a
    feel-play of permanent routes first.
  - **The territory question is settled (`trade-redesign`):** territory caps the **tableau** alone — a
    route costs rent and nothing else. So closing one buys back money, not board space, which is the
    weaker of the two benefits the shared-cap version would have offered. Weigh the deck-dilution price
    against that alone.
  - **Implementation notes to carry forward:**
    - The cancellation must mint into **`discard`, never `hand`** — that is what keeps the reversible
      play/close pair out of a single turn's `expandTurn` line enumeration. Minting to hand blows up the
      planner and oracle search.
    - It self-exiles on the **resume** pass (splice itself out of `discard` by id → `removed`), not on
      the suspending pass; a `bow`-style pre-exile leaves a committed, undo-visible state where the
      cancellation is gone but the route still stands.
    - Build the choice's `options` in a **canonical order** (sorted by `contentKey`): `oracleKey.ts`'s
      `pendingToken` joins them positionally while `keyOf` folds `tradeRoutes` as a multiset.
    - Gate it in `playability.ts` on at least one standing route — a zero-option `pendingInteraction`
      is an unrecoverable soft-lock (non-cancelable, `endTurn` no-ops, undo blocked).
  - **Bronze gating stays continuous, not play-time.** A bronze card checks for a route every round (on
    `produces`), so losing tin **mothballs** the forge rather than preventing its construction. Once
    removal exists, a play-time `gate.check` leaks: `gate` is evaluated at play and `upkeep` fires at the
    `endTurn` boundary, so play-route → play-building → close-route-before-ending-turn pays zero 🪙 and
    keeps the building forever. Continuous gating also gives the Sea Peoples capstone its teeth.
- **Escalating route rent** `[size: S]` `[?]` — routes ship with a **flat** rent. The treasury is the
  zone's *only* cap again, so the case for this is back at full strength. The originally-planned
  auto-cap is a rent that scales with the number of parallel
  routes: a per-card `upkeep.resolve` reading `G.tradeRoutes.length` (like `tamed_horses`/`overextension`,
  a drain reading a count — but **self-referential** where those aren't, since the card reads the size of
  the zone it sits in). Pure authoring, zero engine work; `sim/zoneOrderInvariance.test.ts` already pins
  the shape via its `test_route_scaling` fixture. A **balance** question, not a blocking one.
- **Sim policies answer interactions blindly** `[size: S]` — `greedyPolicy`/`greedy2Policy` pick a
  random `pendingInteraction` option and `heuristicPolicy` always answers `0`, each justified by a comment
  ("options aren't scored — recovering a card to hand rarely moves `scoreState`") that stops being true the
  moment a choice is a real decision, e.g. *which* route to close. Also worth recording alongside:
  `heuristicPolicy`'s `staticValue` scores a trade route's 🪙 cost against no immediate gain, so that
  policy will essentially never open one — a low heuristic win rate on a trade deck is the policy, not the
  balance. Same trap one level down: a route's *only* positive signal in the value function is
  `enablers.ts`'s `producerCredit` (`scoreState`'s operating-count credit deliberately excludes the zone,
  since `isOperating` throws on a workerless card), so under `bareBest`/`plannerNoProducers` or any
  producers-off ablation a route scores **pure negative**. Expect those cells to show routes as
  strictly-bad; that's the ablation, not the card.

- **The simulator can't steer a survival objective** `[size: M]` — a mission that wins on *rounds
  survived* names no resource in its goals, so `sim/objective.ts`'s `objectiveProgress` is a flat
  function of `G.round`: it rises by ending the turn and is identical across every within-turn action
  sequence. `sim/enablers.ts` then builds an **empty** model, since it derives everything by probing that
  same function — no goal-valued resource, no producer credit, no capacity credit. The competent
  policies are given no reason to bank the resource the drain is eating or to build the producer that
  makes it. **Measured on `harsh_winter`** (the first such mission): temporarily blending a synthetic
  "stockpile 20🌾" term into the gradient moved greedy **3 → 37%** and planner **25 → 73%** on one cell
  with no content change, redirecting labour off Toolmaking and onto Foraging. So those cells' numbers
  are a floor, not a difficulty reading, and only the oracle (which searches the real shuffle rather than
  steering) reads true.
  The fix must be **general and mechanical**, never a per-mission steering term (see CLAUDE.md →
  *sim/-is-a-consumer*): a survival goal's real currency is the **runway** against the drain that bounds
  it, so the gradient likely wants a term derived from the seeded threats' projected upkeep — how many
  more rounds the current stores survive — the same way `enablers.ts` derives its slope from
  `cost`→`produces` rather than from authored hints. Blocks trusting greedy/planner on any
  rounds-survived mission; `ice_age` and `sandbox` dodge it only because the sim doesn't drive them.
- **The objective gradient credits a goal term the instant it lands, ignoring what it then costs**
  `[size: M]` — `sim/objective.ts`'s `objectiveProgress` scores a met sub-goal as pure progress, so the
  planner takes one as soon as it can afford it even when holding it is a standing drain. The cost
  accrues over later rounds, past the beam's horizon, so nothing ever charges it back.
  **Measured on `growing_numbers`**, where it inverts the policy bracket: **planner 78/100 vs greedy
  97/100** — the only cell in the set where greedy beats the planner. Every planner loss is famine, and
  `farm` plays/run is **0.78**, exactly its win rate: the Farm is the term it dies before reaching.
  Planner ends on 3.3🌾, greedy on 10.6.
  The mission's two building terms are asymmetric and share one slot (the goal's 2🗺️ is *exactly* Hut +
  Farm, so at 1🗺️ they compete). **Farm** is a staffed permanent producer, +1🌾/worker/round. **Hut**
  grants +1🧍, which raises upkeep from `floor(2²/4)=1` to `floor(3²/4)=2` — and the marginal worker
  foraging returns +1🌾, so it is *break-even at best* and negative the moment that worker does anything
  else. The Hut is a liability from the turn it lands until the turn you win.
  `--seed 0` shows it cleanly on one shuffle: planner plays Hut turn 7, never affords the second
  Conquest, and dies turn 13 on 0🌾 holding **7🔨 it has nothing to spend on** (its only slot is under
  the Hut). Greedy on the same seed plays Farm turn 10, banks ⚔️, Conquests turn 17 and plays **Hut as
  the winning move on turn 18**, never dropping below 8🌾 — paying the pop tax for zero rounds.
  So this cell's 78% is a policy reading, not a difficulty one, and the same shape will bite any goal
  whose terms carry ongoing upkeep. Next measurements, both cheap: `--policies greedy2 --seeds 100` on
  the fixture (should also win high if this is the gap), and `--policies deepPlanner --seed 0` (a flip
  to a win says horizon, not weighting). The fix must be **general and mechanical** like its sibling
  above — a met goal's *carried* cost is derivable from the card's `effect`/`upkeep` against
  `foodUpkeep`, never a per-mission hint.

## Tech debt / architecture

- **Audit existing tests for the integration split** — the `*.integration.test.ts` convention (end-to-end/
  balance-sensitive suites that drive a full `simulateRun`; see CLAUDE.md → *Conventions*) so far tags only
  `plannerPolicy`. Sweep the rest of the suite for tests that belong there too (anything driving whole runs
  / asserting emergent balance) and rename them, so `npm run test:unit` is a genuinely fast, deterministic
  inner loop. `[size: S]`
- **Buildings pay upkeep even when unstaffed** `[?]` — today a staffable's `upkeep` only fires while it's
  *operating* (staffed), because `resolveEndTurn` runs only on operating boxes (the `isOperating` gate in
  `events.ts`'s `dispatchEvent`). Make a built-but-idle building still pay its maintenance — an idle
  structure is a cost, not free. Reverses the documented "idle staffable box never reacts" contract, so
  decide the scope: upkeep only (production still gated on staffing), or the whole `endTurn` handler?
  `workers: 0` cards (City Walls) are unaffected (always operating); the Pyramid's −2🌾 would then bleed
  while idle. `[size: M]`
- **Card art must be unique across the player collection** — nothing pins it today, and the near-miss
  just happened: Fire wanted 🔥 and Raiding already held it (Raiding moved to 🏴). Two ownable cards
  sharing a glyph is a **bug** — the art is how a card is recognized on the board and in the picker.
  **The relaxation:** mission-only kinds (`objective`/`threat`/`event`) may share a glyph with each
  other as long as **no single mission seeds both**, since the player never sees them side by side.
  Belongs next to `content/cards.test.ts`'s existing "every deckable card sets its own art glyph"
  coherence test, which is where art is ruled on. Note the relaxed half can't be checked off `CARDS`
  alone — it has to read `MISSIONS`' `threats`/`events`/`objectiveCardId` lists to know what co-occurs.
  The catalogue is clean as of the Fire/Raiding swap, so this lands green. `[size: S]`
- **One sim baseline file per configuration, holding its own results** `[size: M]` — today a cell's
  launch config (`scripts/sim/baselines/<mission>.json`) and its measured numbers (a global
  `results/<policy-set>.json`) live apart, so re-cutting a fixture silently strands rows keyed by label
  in a file nobody edits, and one mission can't hold two cells without hand-splicing both sides. Fold
  them into a single per-configuration file carrying config **and** recorded results. Optional second
  half: teach `scripts/sim.ts` the format — report a sweep as a **delta against the recorded numbers**,
  and take a flag to overwrite them in place.
- **Simulator: full move-surface fuzz test over synthetic fixtures** — a fuzz pass exercising the
  building/`discardCost` move surface (the paths the current random-policy smoke test doesn't
  hit yet), built on synthetic fixtures. Deferred until real content exists in Step 6, or an explicit
  later fuzz pass. `[size: S] [blocked]`

## Misc

- **Rework the Influence economy and the copy-count ladder together.** Explicitly **not** the
  `trade-redesign` branch's job — parked here so it isn't rediscovered from a card. How many copies of
  a card a player can reach is what decides whether a second-rate line is worth building at all, and
  right now that scarcity is doing load-bearing balance work it was never tuned for — a second Farm
  is a shop purchase *and* a territory slot, while a second Bead Workshop + Bartering pair needs only the one slot
  (see [`missions/first-trades.md`](missions/first-trades.md) → *Balance*). **Which of the two food
  lines wins is therefore set by the copy ladder, not by their rates**, so re-read that pair when the
  ladder moves. `npm run economy` prints the faucet ledger and price list the rework starts from.
  `[size: L]`

---

## Done / shipped

> Completed **transversal** work moves here (newest first) so the backlog stays current but nothing
> silently vanishes; at a version bump these become one-line [`CHANGELOG.md`](../CHANGELOG.md)
> entries. **Mission** work is *not* archived here — a finished mission's record is its dossier
> (`docs/missions/<name>.md`), tracked in [`BACKLOG.md`](BACKLOG.md); the changelog is drawn from
> both. Everything through **v0.0.4** has already moved to `CHANGELOG.md`.

- **A `prover` policy, and an honest oracle** ✅ — `oracle`'s win rate silently meant "winnable by search
  **or** by the fallback policy", because a seed whose search found no line was played out by another
  brain and its collapse filed under the oracle's name. Two changes. `Policy.abort` is a new seam — a
  policy returns a `gameover.reason` to decline a run outright, mirroring how the drive loop synthesizes
  `stall`; `simulate.ts` consults it before each action. On it rides **`prover`**: the same search with no
  fallback, so its wins are search-proven and every other seed reports `noWinFound:<bound>`.
  Read an `oracle` number as a ceiling on *play* and a `prover` number as a lower bound on *winnability* —
  `noWinFound` means "not proven within the search bounds", never "unwinnable". Which bound is part of the
  reason: `searchWinningLine` returns a `SearchResult` naming the `SearchExhaustion` that stopped it
  — `budget` (out of `nodeBudget`), `depth` (survived `maxRounds` without a win) or `deadEnd` (a whole
  level produced no successors, so the beam's *ranking* kept only positions that die). They are separate
  `defeatCauses` buckets because each indicts a different knob, and a bare "no line" names none of them.
  `oracle`'s fallback also moved `greedy2` → `deepPlanner`, whose knobs became the shared
  `DEEP_PLANNER_OPTIONS` so the registry entry and the fallback can't drift.

- **`--search-beam` exposes the oracle/prover beam width** ✅ — the diagnostic a `noWinFound:deadEnd`
  demands: that mode says a whole level died, i.e. the beam's *ranking* kept only losing positions, and the
  test is whether widening recovers wins the ranking had discarded. `BatchOptions.search?: OracleOptions`
  rides alongside `sim` to the policy factories, merged *over* the depth `searchBoundsFor` derives, so the
  same field reaches `nodeBudget`/`enablers` later without more plumbing. **Superlinear in the width** — a
  wider beam keeps more states alive and so searches deeper, not merely wider (~3.3× per doubling measured
  on one 50-seed cell). `baselines/results/` is swept at the default width throughout: a `--search-beam`
  row is a diagnostic and is not comparable to it.

- **`--max-rounds` sets the oracle/prover search depth** ✅ — the search's round cap was hardcoded at 50
  while the drive loop's stall cutoff was a separate flag, so the two could disagree in both directions: a
  proven line longer than the cutoff is discarded as a `stall` anyway (wasted search), and a cap shorter
  than it reports `noWinFound` on seeds winnable inside the runs the sweep asked for (a false negative).
  `POLICY_FACTORIES` entries now take the sweep's `SimOptions`, and the two search policies derive their
  depth from it via `searchBoundsFor`. Only an *explicit finite* cutoff propagates — the drive loop's own
  default (200) is a runaway backstop, not a search depth, and `Infinity` would never terminate.

- **Mission detail panel shows mid-play injections** ✅ — the panel's card list read `threats`/`events`
  alone, so a card a run only *breeds* was invisible: Accounting is about Thieves, but the Thief is
  minted mid-run by the Envious Population threat and the player first met one in their own draw pile.
  New authored `MissionDef.alsoDisplay` (Accounting: `['thief']`) rendered after the seeded faces,
  badgeless since the copy count is a function of how the run goes, deduped against the seeded set, with
  an id-existence coherence case beside the `threats`/`events` one.

- **Coherence-check mission `prereqs` ids** ✅ — the suite pinned a mission's `objectiveCardId`,
  threat/event ids and every reward-unlock id against the real catalogues, but **not** `prereqs` — the
  one content id that fails silently: `campaign.ts`'s `isAvailable` simply never satisfies a bad one, so
  the mission drops out of the campaign for the whole game with no error anywhere. Two cases in
  `content/missions.test.ts`: an id-existence iterator, and acyclicity asserted *through* `foldOrder`
  (the real topological sort, not a re-derived copy) — a mission inside a cycle being just as
  unreachable, and just as quiet. Both verified against a deliberately broken catalogue.
- **Unified play area** ✅ *— shipped, then reversed.* Buildings, Work boxes and trade routes briefly
  shared one **territory** cap and one grid. Played, the shared cap wasn't the feel wanted, so it was
  reverted: territory caps the **tableau** alone (`usedTerritory` folds `G.tableau`, the gate keys on
  `isStructure`, and `occupiesTerritory` is gone), and the work strip and right-hand trade column are
  back. **Conquest and Road are `work` cards again** — the trap that forced them to be actions only
  existed while work took a slot. Board territory went back to its pre-merge figures (Tribe 0,
  Settlement 2, Chiefdom 0, City 2). Two things from the merge were kept because they were never about
  the cap: `placedCards` as the one board-wide read, and the single `BoardBox` drawing all three zones.
  **Everything measured under the shared cap is stale** — every row in `scripts/sim/baselines/results/`
  and every "measured" claim in [`REBALANCE.md`](REBALANCE.md).
- **Trade-route zone** ✅ — a new `trade` **card kind** and a standing `G.tradeRoutes` zone. Playing a
  trade card files it there via `rules/tradeRoutes.ts`'s `openTradeRoute`, where the `endTurn` broadcast
  ticks it like a threat — flat `produces` yield plus `upkeep` rent, no worker scaling. A route takes
  **no workers**, no territory, and nothing closes one, so the rent alone bounds it: an
  unpayable one runs money negative into **bankruptcy**. This is the sink money's one-way-hub topology
  spends through (see [`REBALANCE.md`](REBALANCE.md)).
  - **One design change from the original ticket: routes are permanent.** The ticket had them removable
    at will; removal is now its own deferred item above (a minted cancellation *card*), because the real
    subject turned out to be deck dilution.
    So there are no reversible play/remove actions and the planner/oracle search is unaffected.
  - A standing route renders as a board **box** (the building/work treatment), not a card face, and the
    face reads its rent→yield as one exchange (`1🪙 → 1🌾`).
  - **Bartering is the first route** (1🪙 to open, then −1🪙 / +1🌾 every round), converted from a
    one-shot action as the mechanic's test vehicle. Nine baseline fixtures carry it and the integration
    suites' win rates held unchanged, but **that is not evidence the card is fine** — they'd pass
    identically with Bartering deleted from those decks. The measurements below were taken at the
    card's original 2🪙 opening cost, against boards starting at 0–2🪙 with no faucet at all, so they
    need re-reading anyway (they also predate the unified cap). **The signal to
    read in the sweep is `unplayedCards`, not the win rate.** Confirmed on masonry × 3 seeds: planner
    leaves `bartering` unplayed; the random policy plays it once and one of its runs dies to
    **bankruptcy**, so the path and the rent both work — the non-play is a decision, not a dead path.
  - **Colour:** deep plum `#7d2f57`, picked by measuring CIEDE2000 distance to every other kind banner
    under all three CVD sims (worst 7.8, against the palette's own tightest existing pair at 4.2).
    Deliberately *not* the brighter magenta, which is already Tritanopia's culture-gauge hue.
- **Unsaved-changes warning on leaving the deck editor** ✅ — leaving the editor mid-edit with unsaved
  changes now prompts before discarding. `DeckEditor` reports a `dirty` flag up (variant-grouped
  content + name vs. `initialDeck`, so a remove-then-re-add of the same variant doesn't false-flag);
  `MetaMenu` funnels every exit — Cancel *and* the nav tabs (previously a fully silent discard) —
  through one `attemptLeave` choke point that parks the leave behind a "Discard / Keep editing" confirm.
  Backdrop-click keeps editing. Dialog reuses GameMenu's confirm styling.
- **Golden scenarios — simulator trust harness** ✅ — landed as the committed **baseline fixture
  system** (`scripts/sim/baselines/`): self-contained `(mission, deck, board)` fixtures that each own
  their three axes, swept via `npm run sim -- --baseline`, with measured results committed under
  `baselines/results/` whose commit *is* their content-SHA record — the regression pins for the
  *instrument*, decoupling "policy too weak" from "content too hard". Standing set is First Settlement →
  Writing (the Stone-Age ones deliberately minimal no-purchase decks). Soundness-only framing holds (a
  found win is fact; a *not*-found win is only "not within budget", never a mission verdict); human
  playtests aim at these fixtures as the non-circular policy-strength calibration. The oracle-gap
  difficulty readout + the ECONOMY-EXPLORER demand phase remain as separate later ideas.
- **Calibrate the planner's search knobs** ✅ — the planner's search knobs had **never been measured**.
  Calibrating three of them (`determinizations` 2 → 8, `turnConfigLimit` 8 → 16, `depth` 1 → 2) beats the
  shipped planner on every cell tested — pyramid 0.23 → 0.82, accounting 0.54 → 0.88, writing-A 0.20 → 0.73,
  masonry 0.92 → 0.96, restless_people 0.59 → 0.96 — against an oracle ceiling of 0.90 / 1.00 / 0.93 /
  1.00 / 1.00, and shipped as the `deepPlanner` tier. `nodeBudget` never binds (0% aborts against a 100k
  cap); `beamWidth` is inert at `depth: 1` by construction. The step counts recorded during that sweep
  (peak ~2.9k) do **not** hold for the calibrated config — `bareBest` on pyramid measures mean 17.8k /
  max 31.7k steps per re-plan (see the profile entry below). Treat the ~2.9k figure as superseded,
  whatever its origin.

  - `beamWidth` 2/6 at `depth: 2` — measured since: no significant change either way, so the default
    (4) stands.

  - **The reveal-boundary design** (decided; dormant until a card that draws/reads the deck *mid-turn*
    first ships, e.g. the idea pool's draw-on-expand / on-draw combo cards — such a card breaks the
    within-turn-play-never-touches-the-deck invariant the planner's shared line enumeration *and* the
    shipped world-graft both rest on): don't detect deck-touching lines and fall back to full replay —
    instead make any deck-touching action **terminate the candidate line**, the same rule `commitPrefix`
    already applies to a parked peek. The line becomes a chance node valued per-world (resolve the draw
    with that world's deck, continue the turn in-world, look ahead, average) — so every candidate line is
    deck-independent *by construction* and the graft stays valid forever. Costs are per-world post-draw
    continuation search + shorter commit horizons (more re-plans), not correctness. (The parked-line half
    of this — valuing a line that ends at a reveal through its answers instead of its bare leaf — shipped
    ahead of the rest; see the *Value parked planner lines through their answers* entry below. What stays
    blocked on content is the draw-as-chance-node machinery itself.) One gap the line-termination rule
    does *not* cover: an effect that **reads** deck contents without touching them (e.g. a "deck holds N
    of X" goal) — a deck-dependent state with no deck-touching action to terminate on. No current content
    does this; it would need its own treatment. And a ceiling to keep expectations honest: **PIMC cannot
    value information prospectively** — inside a sampled world the lookahead already knows that world's
    deck, so an information-only action (a peek) has no modeled upside in any world and its play cost is
    pure downside (strategy fusion). No leaf-valuation surgery changes that; making the planner *seek*
    reveals would need an explicit information bonus, a separate (hackier) design. `[size: M]` `[blocked]`
    **Behavioral baseline** (re-pinned 2026-07-23 after the parked-line valuation shipped): on the
    committed `restless_people` fixture × 10 sweep seeds, Calendar is played only by **seed 9 under both
    deepPlanner and bareBest** (turn 8, mid-line, healthy run — incidental near-tie), winRate 0.8 / 0.9
    (replay via `--baseline scripts/sim/baselines/restless_people.json --policies <p> --seed <i>`). The
    pre-valuation baseline (deepPlanner 6/7/8, bareBest 1/7 — late desperation plays in dying runs) is
    superseded; this is the reference point for the draw-era chance-node work. Bonus fix folded in: today a
    line parked at a peek is valued as its **bare leaf** (`evalLine`'s no-op-`endTurn` path) with no
    in-world continuation, undervaluing information moves — the chance-node valuation is the refinement
    that fixes that too.

- **Per-cell progress line on stderr** ✅ — a multi-hour sweep no longer prints nothing until it
  finishes: `runBatch` fires an optional `onProgress` after every run (the sim library writes no I/O
  itself — tests stay quiet), and `scripts/sim.ts` renders a `\r`-updated stderr line tracking the whole
  sweep (`runsDone/runsTotal` across every policy × scenario cell, plus the active policy/scenario).
  stdout (report / JSON) stays clean.

- **Value parked planner lines through their answers** ✅ — the parked-line half of the reveal-boundary
  design (above), shipped ahead of the content that needs the rest: `evalLine` no longer scores a line
  that ends at a parked interaction as its **bare leaf** — it takes the best answer's continuation
  (resolve, then end the turn into the sampled world), so commit-at-the-reveal lines are valued through
  the same future as every other line. **Measured effect was the opposite sign of "peeks now valued
  fairly"**: the bare leaf had been *over*valuing parked lines in collapsing positions (present-state
  score vs. every real continuation being valued through the incoming famine — a freeze-frame illusion),
  so the change *removed* Calendar desperation plays: restless_people 10-seed sweep, plays 3→1
  (shapedBest) / 2→1 (bareBest), the survivors' old late-game dying-run plays (seeds 6/7/8 · 1/7) all
  gone, one healthy mid-game near-tie play (seed 9, both policies) appearing instead; win rates
  unchanged (0.8/0.9), pyramid/masonry byte-identical (control). The planner still never *seeks* a peek
  — the PIMC strategy-fusion ceiling (noted above) stands, as predicted; the desperation-play removal
  was the part no one predicted, which is why the test ran.

- **Graft sampled worlds onto planner line states** ✅ — `plannerPolicy.ts` no longer replays each
  candidate line into each sampled world (`applyActions`, 16 × 8 = 128 replays per re-plan): `expandTurn`
  already computed every line's end state on the *real* state, and within-turn play never touches the
  deck, so each world is **grafted** on — a shallow `G` copy with the world's `deck` + `rngState`
  spliced in (safe because `endTurn` clones `G` before mutating, so the shared arrays stay pristine).
  Output verified **byte-identical** (sweep JSON + stderr budget stats; restless_people/pyramid/masonry
  × shapedBest,bareBest × 10 seeds — restless_people's Calendar exercising the parked-peek path, the
  one field-divergent case: a grafted parked line carries the *real* peeked `pendingInteraction.options`
  where a replay would carry the world's, and nothing downstream reads them). Measured ~**6% wall
  clock** by min-of-3 interleaved A/B reps on pyramid (means unusable — the machine was under game
  load, spread 310–601 s; min is sound since interference only adds time). **The ticket's premise was
  wrong**: the 128 replays were never part of the ~17.8k measured steps — `budget.steps` counts only
  `expandTurn` expansions, so the real cost is the 128 independent per-(line,world) lookahead beams and
  their uncounted `endTurn`s, which the graft can't touch. That's the follow-up lever if the calibrated
  config ever needs a real speedup; the reveal-boundary design (above) is the plan for content that
  touches the deck mid-turn.

- **Ship the lean enabler-term set as the planner default** ✅ — `DEFAULT_ENABLER_TERMS` =
  capacity + producers + cardCosts (conversions/floor/handSize off), now `PlannerOptions.enablers`'s
  default; `enablers: true` remains the full all-on model (`plannerFull`), and the **oracle keeps the
  full model** — its job is proving winnability and the full model finds strictly more wins.
  Measured (full baseline set, paired seeds; full → lean → lean+conversions):
  - **Planner @ 100 seeds**: pyramid 30→**44**→32 · restless_people 59→**74**→67 · writing
    61→**71**→71 · masonry 92→87→87 · first_temple 100→94→**100** · accounting 50→44→49; the six
    easy cells unchanged. Aggregate **+23pp** (lean) / +15pp (lean+conv) over full.
  - **Tuned depth-2 config @ 10 seeds** (bare/full/lean): masonry 9/10/**10** · writing 7/10/**10** ·
    pyramid 6/**10**/9 · restless 9/6/**8** · first_temple 10/10/10 · accounting 8/9/**9** — totals
    49/55/**56** of 60. The lean set's depth-1 stall-cell regressions (first_temple/accounting) are
    shallow-search artifacts; restless's bare > lean > full ordering is the one term effect stable
    across depths.
  - **Oracle @ 10 seeds**: full 12×10/10 · lean drops accounting to 8/10 · lean+conv drops accounting
    and pyramid to 9/10 — hence the oracle's full-model default.
  The shipped set is recorded on `DEFAULT_ENABLER_TERMS` in `sim/enablers.ts` and test-pinned in
  `enablers.test.ts`.

- **Split the enabler shaping into separately-togglable terms** ✅ — `EnablerTerms` on both
  `PlannerOptions`/`OracleOptions` (`enablers: boolean | EnablerTerms`; a missing key = on): `conversions` ·
  `capacity` · `floor` · `handSize` · `producers`, ablated at model *derivation* (`deriveEnablers(G, terms)`).
  The floor/capacity `max` is now orthogonal (`strategicWeight`), and each enabled term prices through
  whatever model the other enabled terms built — no synthetic cross-terms. All-on is exactly the old model
  (test-pinned; the post-split planner reproduced writing-A 7/30 verbatim). New `batch.ts` policies:
  `plannerNo*`/`plannerOnly*` ×5 and `bareOracle`. **Measured** (shipped planner, 30 paired seeds per cell;
  endpoints = `planner`/`bareW2`; writing-A = `scripts/sim/decks/writing-variant-a.json` on `city`, the
  recovered calibration cell):
  - **Endpoints**: masonry 83↔20 · pyramid 27↔7 · restless_people 63↔83 · writing-A 23↔33 (shaped↔bare).
    The oracle (beam 64) only feels the shaping on masonry (100 vs 87 bare); elsewhere ≤1 seed.
  - **writing-A** (card-count goal): the **floor is the whole harm** — necessary (NoFloor = bare 33%) *and*
    sufficient (OnlyFloor 20%; every other single term = bare). Nothing is goal-valued there, so the derived
    terms are empty and only the unconditional floor acts.
  - **restless_people**: the −20 is **emergent stacking** — no single removal recovers more than +7, and
    every term alone is ≈ harmless (Only\* 77–83% vs bare 83%).
  - **masonry**: **capacity alone ≈ the whole benefit** (OnlyCap 80% vs all-on 83%, bare 20%); conversions
    alone partial (33%); every leave-one-out ≥ 80%, so the terms are redundant here. OnlyFloor lands *below*
    bare (10%, 22/30 stalls).
  - **pyramid**: **producers alone = all-on** (27%) and capacity near it (23%); conversions/hand-size alone
    = bare (7%), and *removing* either from the full model helps (NoConv +10, NoHand +7).
  Follow-up: the default-term-set decision (since made — see the lean-default entry above). The card-cost
  probe later landed as a sixth term (`cardCosts`, with `plannerNoCardCost`/`plannerOnlyCardCost`); the
  writing-A numbers above predate it. Re-measured with the probe in play (30 seeds): all-on 33% = bare
  33% (the probe is what closed the old −10), NoFloor jumps to **60%**, OnlyFloor stays 20% — the floor's
  liability sharpened rather than washed out.

- **Drop `tsx`'s `keepNames` from the sim run path** ✅ — the dev scripts (`sim`/`seed-save`/`economy`)
  now run as a plain esbuild bundle under bare `node` (`scripts/bundle.mjs`, rebuilt each `npm run`)
  instead of through `tsx`, whose default `keepNames` transform wrapped every closure with an `__name`
  call. Confirmed the premise structurally first: two bundles from one esbuild invocation differing
  only in `--keep-names`, profiled back to back — `__name` + `set metrics` (~15% self combined) don't
  shrink, they **vanish** when off, and the `run` dispatch closure reappears at its real ~4.8% self.
  `tsx` can't toggle it (CLI exposes only `--no-cache`/`--tsconfig`; dist hardcodes `keepNames: true`),
  and Node's native type-stripping chokes on the codebase's directory imports — so bundling is the
  route. `deepClone` is now the unambiguous top cost (~33% self). Pure dev-tooling: no `src/` change,
  identical sweep output. `esbuild` added as a direct devDep; `tsx` kept for ad-hoc use.

- **Hash the transposition key** ✅ — the answer to the interning attempt's challenge below (*eliminate
  the per-instance touch or the final string*): `hashOf` does both, folding each unordered zone
  **commutatively** into a 53-bit fingerprint so the sort, the intermediate array and the join all
  disappear rather than move. `keyOf` stays as the readable statement of the equivalence relation and
  as the test oracle the hash is checked against. Measured on pyramid · `oracle` · 20 seeds under the
  profiler: key cost **18.8% → 9.9%** cum (~26 s → ~12 s), accounting for essentially the whole
  139.9 → 124.7 s drop; `deepClone`'s sample count was flat (88 → 87), so its larger *share* is
  dilution, not a regression. Sweep output identical (win rate, turns, actions, end resources).
  A collision now merges two distinct states — affordable because it costs **completeness, never
  soundness**, over ~10⁴ live states against 2⁵³. No clean unprofiled A/B was run, so the ~11%
  wall-clock figure is indicative only.

- **Profile the calibrated planner** ✅ — measured on pyramid · `bareBest` · 10 seeds (372.6 s,
  1,613 samples, `profile` skill). **Both premises of the original ticket were wrong.** A `bareBest`
  re-plan touches **mean 17.8k engine steps (max 31.7k)**, not ~340 — that figure was a *depth-1*
  number that did not transfer to `depth: 2`, so what grew is **search size**, not per-step cost.
  `nodeBudget` still never binds (0% aborts), which now says the cap is loose rather than the search
  small. Where the time goes: `deepClone` **23.3%** self · `keyOf` **21.5%** cum · esbuild `keepNames`
  (`__name` + `set metrics`) **~14.1%** · engine advancement **~35.7%** (hand-summed from the call
  tree; flame truncates caller lists). The ticket's prime suspect — `scoreState` running
  `cloneState`+upkeep twice per leaf (`projectNextTurn` + `permanentDelta`) — is **exonerated**: the
  *duplicated* clone is worth ~2.6%, and the engine path outweighs it ≈4.7 : 1. Follow-ups split into
  the two open items above.
  - **Tried and reverted: interning content keys to ints in `oracleKey.ts`.** Correctness was exact —
    byte-identical sweep JSON and identical `replans`/`meanSteps`/`maxSteps`, confirming the token
    scheme preserved the key's merge classes — but performance was a **wash**: `keyOf` 21.5% → **22.8%**
    cum, wall clock 372.6 → **380.7 s**. The numeric sort worked as designed (`multiset` 8.2% → 5.4%
    self, `contentKey` 4.4% → 3.3%), but the new per-instance `Map` lookup cost **6.6%** self, more
    than the ~5.2% saved across the other frames — and `join()` re-stringifies every int anyway, so
    string materialization was moved rather than removed. **The generalizable lesson: `keyOf`'s cost is
    per-instance work + string materialization, not comparison order** — so a count/multiset
    representation (which only shrinks the sort) would not rescue it either. Any future attempt must
    eliminate the per-instance touch or the final string. Kept the four invariant tests it motivated
    (stickers folded order-independently, empty `counters`/`stickers` treated as bare, no `#` in any
    cardId — the separator the `contentKey` format depends on), all passing against the unchanged
    implementation.

- **Retire the objective `OVERRIDES` seam** ✅ — the per-mission progress-gradient overrides in
  `sim/objective.ts` were a bring-up safety net; `sim/enablers.ts` now derives the between-thresholds
  conversion slope mechanically from card `cost`, subsuming them. Finding Copper was the last entry
  (Masonry/Growing Numbers already gone). A 100-seed sweep (stone-age deck / settlement) showed it was
  net-*harmful*: its "bank 🔨/🔬 toward the next vein" gradient drove policies to hoard and starve —
  removing it took greedy 99→100% and planner 85→99% (famine deaths 15→1). Dropped the override, then
  folded `objectiveProgress`/`hasObjectiveGradient` down to the goals-average path and deleted the vacated
  coherence test. (En route: fixed a planner deadlock where a parked look-only peek — Calendar — was never
  resolved, looping a no-op `endTurn` to the action wall.)
- **Pet the doggo** ✅ — "can you pet the dog?" easter egg: clicking the Hunting card's art band in the
  zoom overlay puffs floating *pet* *pet* text + a woof! bubble instead of closing. Lives in
  `CardZoomOverlay` (gated on `cardId === 'dogs'`) via a new `CardFace` `onArtClick` prop, so it works
  on every zoom surface.

## Jot — `permanentDelta` comment/code mismatch (which side is authoritative?)

`sim/value.ts`'s `permanentDelta` comment says it drops the *transient* contributors — "the work zone
… **and the hand** (an unplayed event's drain is hand-contingent, not permanent)" — but the code only
sets `clone.workZone = []`. It still runs `applyUpkeep`, whose `resolveHandEvents` fires any unplayed
`event`'s `upkeep`, so a hand event's drain **does** land in the band-3 permanent buffer. Either the
comment is stale (add `clone.hand = []` to match it) or the code is intended and the comment is wrong.
A band-3 (survival-buffer) question, not a perf one — decide which is authoritative. Found while
profiling the oracle's clone cost (the two `scoreState` projections).

