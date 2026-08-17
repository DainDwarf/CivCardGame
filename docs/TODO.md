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
- **Defeat on population ≤ 0** `[size: S]` `[?]` — a civilization at 0🧍 produces nothing and can only
  regrow through a card that costs 🔨 it can no longer make, so the run is over but keeps playing. Measured
  on Setting Sail: **50 of 84** planner crews-defeats on City end at population 0, some frozen for 11+
  rounds with both pools unchanged. Wants the same pull-not-push shape as the other defeats (re-derived
  each flush), and a decision on whether the trigger is `population <= 0` outright or that plus no
  reachable regrowth.
- **Escalating route rent** `[size: S]` `[?]` — routes ship with a **flat** rent. The treasury is the
  zone's *only* cap again, so the case for this is back at full strength. The originally-planned
  auto-cap is a rent that scales with the number of parallel
  routes: a per-card `upkeep.resolve` reading `G.tradeRoutes.length` (like `tamed_horses`/`overextension`,
  a drain reading a count — but **self-referential** where those aren't, since the card reads the size of
  the zone it sits in). Pure authoring, zero engine work; `sim/zoneOrderInvariance.test.ts` already pins
  the shape via its `test_route_scaling` fixture. A **balance** question, not a blocking one.

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
- **A prereq id can be real and still wrong** `[size: S]` — `content/missions.test.ts` pins that every
  `prereqs` id **exists** and that the graph is **acyclic**, which catches a typo and a cycle. It cannot
  catch a mission pointed at the wrong *real* mission: naming an upstream node instead of the branch tips
  passes both checks and quietly flattens the DAG, so a branch stops gating anything and no test says so.
  Wants a shape assertion — expected in-degree, or the reconvergence nodes named — rather than another id
  iterator.

## Misc

- **Rework the Influence economy and the copy-count ladder together.** Explicitly **not** the
  `trade-redesign` branch's job — parked here so it isn't rediscovered from a card. How many copies of
  a card a player can reach is what decides whether a second-rate line is worth building at all, and
  right now that scarcity is doing load-bearing balance work it was never tuned for — a second Farm
  is a shop purchase *and* a territory slot, while a second Bead Workshop + Bartering pair needs only
  the one slot (a route takes no land). **Which of the two food lines wins is therefore set by the copy
  ladder, not by their rates**, so re-read that pair when the ladder moves. `npm run economy` prints the faucet ledger and price list the rework starts from.
  `[size: L]`

## Simulator (`src/sim/`, `scripts/sim.ts`)

> Balance answers are only as good as the policies taking them. Items here are why a number is wrong,
> or what would make the next one cheaper to get.

### Fidelity — where a policy mis-measures

> The race scorer's known weak cells, each with the constraint a fix must respect. The prover column in
> the fixtures says which of these hide winnable seeds.

- **`accounting` — the race value has no savings gradient** `[size: L] [?]` — a bank's progress toward a
  big-step purchase prices as nothing until the purchase is affordable, and every search-shell experiment
  (wider beam, deeper planner, 4× budget) made the cell strictly *worse* under race while the same search
  improved the band scorer on identical seeds — the value's optimum is not the win there. The prover
  proves ~6/10 winnable under band's ranking, so the seeds exist. The fix is the leaf, not the search;
  `accounting_chiefdom` recovers only under the deep planner tier (a three-way knob interaction), so read
  its near-zero columns as "needs the diagnostic tier", not "unwinnable".
- **`wheel` family — a plan does not price the drain its own completion creates** `[size: M] [?]` —
  Conquest/Road race a territory goal whose expansion raises upkeep, so the margin sees the win clock move
  but not the death the landing brings, and the planner hoards or stalls. A completion-ramp charged at the
  root was tried and reverted twice: a candidate must keep a win-clock gradient where the ramp bites and
  must not make runway matter less.
- **`setting_sail` — refusing the launch is priced three ways** `[size: M] [?]` — `T̂loss` counts the bank
  a plan has earmarked as survival runway; a zero-workforce state reads payment `∞` one Hut away from a
  citizen; and a non-recycling plan holding exactly its copies has a delivery clock invariant to its own
  progress (landing a copy is worth a constant `1/handSize`, however much of the win it completes). The
  one-sided fix was measured and reverted: `T̂loss` paying for emptiness and the payment `∞` must be fixed
  in one pass or neither.
- **`finding_copper_chiefdom` — the slack cap is in rounds, hoarding pays in units** `[size: M] [?]` — at
  pop 3 the food drain is 2🌾/rd, so the run sits under the cap on ~89% of turns and a food play outbids
  an affordable goal play ~2:1 (the goal's marginal being the `1/handSize` constant above). Race wins the
  cell 99% but at ~174 turns against the oracle's 34-turn ceiling, seeds landing at rounds 181–190 of a
  200-round cutoff — don't cut a chiefdom-board balance verdict from race turn counts here until closed.
  A fix may not assume the goal's marginal reward exceeds `1/handSize`, and must leave the sub-cap margin
  bit-identical (`harsh_winter` pays for a violation).
- **`pyramid` — the many-goal fold inflates `T̂win` past a beatable deadline** `[size: M] [?]` — the
  softened bottleneck sits above its max by up to `max·f·ln n`; a traced root read 43.9 rounds against a
  40-round deadline off a 35.7 bottleneck. Shrinking the temperature un-inflates it and makes the cell
  *worse* (the same constant sets how hard side goals pull), so the fix is a term that drops the inflation
  while keeping the pull — not a retune.
- **A distinct-count goal is priced as copies of one card** `[size: S]` — the plan scan reads `delta = 1`
  off the cheapest building and asks for `need` copies of *it*: optimistic where the ids must differ,
  pessimistic where the deck is short of that one card. Harmless today (`growing_numbers` wins at 100%).
- **Retire the band scorer** `[size: S] [blocked]` — delete `--scorer band` (the `value.ts` bands and
  `enablers.ts`'s weighting half; the probes stay) the first time it would need a retune to stay useful,
  or after the first Bronze-age balance pass if its second opinion never changed a decision. Until then it
  is frozen — a band tuning item is by definition out of scope, which is why none appear above.
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

### Tooling

- **The `#sweep` header names no planner knobs** `[size: S]` — a sweep taken at an edited
  depth/determinizations/`turnConfigLimit` (or an experimental beam rule) is indistinguishable from a
  default one by its own record; the filename is the only provenance. Bitten twice during the search-shell
  riders. Want the effective planner config in the header the way `maxRounds`/`beamWidth` already are,
  with `sim:record` refusing a non-default one — the same contract the scorer field has.
- **Simulator: full move-surface fuzz test over synthetic fixtures** — a fuzz pass exercising the
  building/`discardCost` move surface (the paths the current random-policy smoke test doesn't
  hit yet), built on synthetic fixtures. Deferred until real content exists in Step 6, or an explicit
  later fuzz pass. `[size: S] [blocked]`

---

## Done / shipped

> Completed **transversal** work moves here (newest first) so the backlog stays current but nothing
> silently vanishes; at a version bump these become one-line [`CHANGELOG.md`](../CHANGELOG.md)
> entries. **Mission** work is *not* archived here — a finished mission's record is its dossier
> (`docs/missions/<name>.md`), tracked in [`BACKLOG.md`](BACKLOG.md); the changelog is drawn from
> both. Everything through **v0.0.4** has already moved to `CHANGELOG.md`.

- **A landing route reaches only as far as the copies the run holds** ✅ — the race scorer asked every
  landing to deliver a goal's whole target alone, so a goal counting a zone's *length* (Sea Lanes' four
  trade routes, the first of its kind) dropped both its routes for `copies short` and read flat at the
  horizon: no gradient toward opening a route at all. A non-recycling route is now ceilinged at what it
  circulates (`sim/race.ts`'s `landingReach`) and the existing cover composes the shares into one bill,
  while being short of copies moved from the route to the **goal**, the only place it is true
  (`GoalClockExplain.reach`). Sea Lanes' 🚢 clock reads 9.4 rounds by a Bartering + Coastal Route cover
  and its three cells are re-recorded: planner 1 → 17/18/2%, prover 0/1/1 → 3/3/2 of 10 proven. Across the
  standing set exactly one other cell moves — `first_settlement`, whose ⚔️ goal gains a Bow + Dogs cover
  (16.2 → 7.2 rounds); its win rate is unchanged at 100% under all three policies but its rows **owe a
  re-record**.
- **The run value function is the race margin** ✅ — every competent policy now ranks by
  `min(T̂loss, slackCap) − T̂win` in rounds (`sim/race.ts`), replacing the score-band leaf as the default;
  the band scorer stays selectable as a frozen `--scorer band` second opinion (see DESIGN.md → *Code
  architecture*). The standing set is re-recorded under the new default at `greedy`/`planner` @100 +
  `prover` @10 — the oracle column retired, prover's no-fallback rate being the cleaner ceiling. At the
  cutover verdict: greedy 43.2 → 56.4% set-wide, planner 65.6 → 70.8% (39 cells above / 14 below /
  7 equal), the survival cells the old model could not steer now reading true (`harsh_winter · greedy`
  0 → 89%); the cells still below carry Fidelity items above. Resolves three items from this section —
  the survival-objective steering gap (`T̂loss` is the runway term it asked for), the card-count capacity
  gap (landing plans price the counted copies), and the stale root-derived model (every scorer now
  re-derives per re-plan) — and retires the band-tuning items (goal-pool-feeds-threat, route food in the
  population net, the static goal-side scan, `PRODUCER_CREDIT_CAP`) with the freeze: the model they would
  tune is no longer the referee.
- **Price a goal card by what its price costs to obtain** ✅ — three compounding reads, each measured on
  its own. (a) A card's **price** is its `cost.resources` plus every pool its play `effect` takes away, so
  the citizen a Voyage sails with is priced like its 🪙 (`cost.resources` is core-only by construction, so a
  strategic price has nowhere else to ride). (b) A pool nothing in the run **`produces` per round** is
  banked at every copy's charge, not one card's: the cap-at-one-card rule assumes a bank refilled between
  plays, and a House mints citizens by being *bought*, which is spending, not income. (c) The goal step is
  split across the price by each pool's **replacement cost in worker-rounds** (Trader 3🪙/wr → 0.33, Forge
  2🔨/wr → 0.50, House 6🔨 for 2🧍 → 1.50), derived by relaxation since a one-shot grant's own price is in
  priced pools; a pool with no derived price leaves its card on the unit-count split, which the report
  names. Where a card charges one pool the rebasing is the identity, so only 4 of 30 cells moved.
  Setting Sail City planner **19 → 20 → 26 → 32%** across the three, prover 4/10 → 7/10 (a new yardstick,
  not easier content — the full model changed too); Writing 79 → 84%, `writing_chiefdom` 51 → 50%,
  `setting_sail_chiefdom` 31 → 32%, oracle 10/10 unchanged. Also fixed the collision the price reading
  exposed: `capacityOf` overwrote a card-cost weight unconditionally, and now keeps whichever credit is
  larger **at saturation** (the caps aren't commensurable — a price saturates at what the card charges, a
  capacity at `CAPACITY_CAP`).
- **Spell `cloneState` out field by field** ✅ — the generic recursive walk asked *what is this value* at
  every node while seeing numbers, strings, nine array shapes and six object shapes, so its checks ran
  megamorphic; writing the `GameState` shape out (plus a `CardInstance`/`PlacedCard`/`GameEvent` helper
  apiece, and every optional key assigned unconditionally so no type gets two shapes) gives each copy site
  one resident shape. Measured on `raiding_city` under the `profile` skill: the clone frame **36.4% →
  9.1%** self on planner·100 (24.6 s → 3.3 s of a 67.5 → 36.3 s run) and **41.6% → 7.0%** on prover·10
  (43.3 s → 3.6 s of 104.2 → 51.0 s), with whole-sweep runtime roughly **halved** on both cells.
  No per-frame multiplier is claimed: the old frame was self-recursive and the two captures sampled at
  different rates (21→35 Hz, 8→13 Hz), so these support "the share collapsed and the total halved" and
  not a ratio. Unprofiled 3-rep wall clock agrees in direction (prover 90.9/88.4/87.3 s →
  21.6/45.5/45.6 s) but spreads 2× within one condition, so it can't lead. Sweep output **byte-identical**, and
  `state.test.ts`'s three clone assertions passed untouched — the change is semantically invisible.
  En route, two things the profile settled: `assertRunInvariants` appears in **neither** capture (it runs
  only on applied drive-loop actions, a rounding error against search steps), and the follow-on
  *share-the-leaves* idea (clone sharing `CardInstance` objects, copying only the zone arrays) was
  **declined** — it would have traded `cloneState`'s no-shared-references contract, which the run-loop
  undo stack also leans on, for a frame now worth single digits. What the halving promoted instead:
  the transposition key (`tokenHash` 12.5/14.6% + `contentKey` 6.6/6.8% self) and the event bus
  (`dispatchEvent` 9.2/7.4% + `flushEvents` 7.9/6.1% self) are now the top two costs.
- **The measured runs are queryable as one table** ✅ — `npm run sim:report -- --format csv` flattens
  instead of folding: the runs come out as the same `recordToCsvLine` rows a sweep writes, so the standing
  set — a fixture apiece, nesting its rows a policy deep — reads as one rectangle. A sweep is already that
  shape, so **one query spans a fresh measurement and the committed one alike**, and a `JOIN` on
  `(cell, policy, seed)` says exactly which runs moved. Incompatible with `--against`, which compares
  summaries rather than emitting runs.
  - The report folds along **fixed axes**, so a question outside them — a median or a percentile rather
    than a mean, "dead in how many runs", what the *losses* ended holding — cost a hand-rolled re-parse
    every time it was asked. It is a *query*, not a missing tool: `duckdb` (winget `DuckDB.cli`) reads a
    CSV in place, so nothing loads and no session state has to be kept warm. Recipe in the `sim` skill →
    *Query the runs*.
  - **Checked against the fold rather than assumed**, since a dropped or mis-split row would make every
    later answer silently wrong: over `masonry`, SQL on the export reproduces `sim:report`'s win rate,
    min/median/mean/max turns, mean actions, mean pools and the famine counts exactly across all three
    policies, and the unpacked `cardsPlayed` totals match its card-plays list card for card.
- **Boards can stand a card on the table, and a standing card can bend what others yield** ✅ — two
  seams shipped together for Chiefdom's **Raider Camp**: a pre-built 🏕️ paying **+4🌾** per territory the
  board takes.
  - `BoardDef.prebuilt` lists structures `run/setup.ts` stands in the tableau at setup (through the
    real `addBuilding`, minted past the deck's ids, resolving **no** entry `effect` — so a board's own
    card can never register as a *gain* against the `startResources` snapshot the Wheel goal and the
    Overextension drain both read).
  - `CardDef.modifyGain` is a passive folded by `gainResources` over every standing card, after the
    resolving copy's stickers — the fifth `CardDef` slot and the only one that fires at no timing of
    its own. Answers DESIGN.md's *"do boards get behaviour?"* without the ruled-out shape: Conquest's
    printed numbers are untouched, and the spoils come from a card the player can see.
  - **The perk pays what the board is short of, not more of what it already does.** The first cut gave
    +1🗺️ per conquest — doubling Chiefdom's own strength, and on `wheel` (which counts territory *and*
    taxes it via `overextension`) scaling reward and punishment together for a net +4pp under 28 seeds
    of churn. Every Chiefdom cell's defeats are famine, so the spoils pay 🌾 instead. Rationale on
    DESIGN.md → *Government boards*.
  - **The rate was swept against the settled boards, not against its own before/after.** Three
    candidates over the ten cells: `+3🌾 +3🔨` cleared famine so completely it put Chiefdom above its
    counterpart on **5 of 10** cells at planner; `+3🌾` left it ahead on 2; **`+4🌾` on 3** (masonry
    92 vs 89, pyramid 54 vs 13, wheel 77 vs 73) and behind everywhere else, which is the shipped rate.
    The 🔨 half was what funded repeat Conquests — `horse_taming`, whose deck holds 4 of them, swung
    78% → 4% when it was dropped.
  - Chiefdom went `territory: 0 → 1` with the Raider Camp standing in it, so its **free** building room
    is unchanged and it stays landless in practice. `meta/Stats.tsx` subtracts `prebuiltCardIds()`
    from the collection denominator — a card nobody can own would otherwise put `X/N` out of reach.
  - **`sim/enablers.ts` reads a card's output through the same fold**, via `effects.ts`'s exported
    `realizedGain` — the read-only half of `gainResources`, sharing its empty-bag rule, so a projection
    over a card's printed output and the payment that output actually makes cannot disagree. Widening
    the *static* scans this way carries none of the objection that keeps the **sticker** fold off them
    (recorded on `bestFoodPerWorker`): a board standing no modifier gets the identity.
  - **Measured effect: none, and the reason is worth keeping.** Re-swept over all ten `*_chiefdom`
    cells, greedy+planner came back **20 of 20 unchanged** and oracle moved three cells by a few actions
    with **no win rate touched**. Conquest and Road are `work` cards, and every output-valuing mechanism
    the planner ships excludes them — `producerCredit` by `isDurableProducer` (deliberate: a Work box's
    single turn is what the one-turn leaf already prices), `bestGoalThroughput`'s territory pass by
    `isStructure`, and the conversions loop by being off in `DEFAULT_ENABLER_TERMS`. So the planner never
    priced Conquest's territory at the printed rate either; it never priced it here at all. Greedy carries
    no enabler term and already saw the real +2 through `scoreState`'s projection. The fix is a
    correctness one — it stops a `modifyGain` card being mis-priced the moment one lands on a card these
    terms *do* value — not a measured improvement, and the earlier "these numbers are a floor" reading of
    the Chiefdom cells was wrong.
  - Three checks, because no one of them covers it. **Neutrality** — `wheel`/City and `masonry`/Settlement
    re-swept unchanged under greedy+planner *and* under oracle; the oracle pass is the load-bearing one,
    since the planner's `conversions`/`handSize` being off means it never enters two of the five widened
    sites. **Refactor safety** — folding the guard into `realizedGain` left all 1000 `greedy` rows on the
    *Chiefdom* cells byte-identical, the only check taken on a board where the fold actually fires.
    **Catalogue safety** — `enablers.ts` now folds hooks over `CARDS[id].produces.resources` itself, so
    `cards.test.ts` pins that no hook mutates the bag it is handed.
- **Population's capacity credit is net of its food curve** ✅ — `sim/enablers.ts` credited a unit of
  population `CAPACITY_HORIZON` rounds of goal throughput and charged nothing for the food that person then
  eats every round after, so on `wheel`/City a House scored **+200** with its +3🌾/round standing cost
  unpriced. The two now net.
  - Charged **in worker-rounds, not in score**: the n-th person eats `foodPerNextPop(n)`, which takes
    `foodPerNextPop(n) / foodPerWorker` of a worker to source, so that fraction of their own credit goes on
    feeding themselves. Both sides are then one quantity — a worker's goal throughput — and the goal's
    target size cancels. Pricing the food in score was tried first, at band 3's own
    `bufferTurns × bufferWeight = 75`, and **abandoned**: the credit is a goal *fraction*, so the same
    worker is worth 100 on `wheel` (goal wants 6🗺️) and 10 on `pyramid` (40🔨), and a flat charge zeroes
    one while sparing the other.
  - `foodPerWorker` walks the run's **instances** through `effectiveGain`, so `wheel`'s double-Irrigated
    Farm feeds at 3🌾/worker; at the static `CARDS` rate the credit would vanish from the second person on
    every deck. Growth counts only past the board's starting population — those mouths are sunk — and is
    clamped per person at their own credit, which is where the derived saturation comes from.
  - Rides the *derived* throughput, not the composed weight, so a goal-valued pool (Masonry's population)
    and one carrying only the intrinsic floor are never charged.
  - Planner @100 over the standing set: `growing_numbers` **78 → 100** (famine 22 → 0), `wheel`
    **55 → 73** (famine 35 → 13, stall 8 → 12), `reading_seasons` 96 → 100, `rites_rituals` 96 → 99,
    `first_temple` 96 → 98, `pyramid` **18 → 13** (the deadline it now misses more often, having stopped
    dying of famine); the other 11 cells' win rates unmoved. Oracle @10 unmoved at every cell — the
    ceiling is unchanged, only the lines it takes to reach it.
- **Continuous integration on GitHub** ✅ — one workflow on every push to `main`/`Latest`: a fast
  `typecheck` · `test` · `build` job, plus a **fixture-per-runner** job that re-measures the standing
  baseline set and asserts it still describes the code (sweep → `sim:report --against` into the job
  summary → `sim:record` → `git diff --exit-code`). The gate is byte-exactness rather than a tolerance
  because the simulator is deterministic: rows that no longer reproduce mean the content moved and owes a
  re-record.
  - The fan-out is derived from each fixture's own `results` keys and row counts
    (`scripts/baselineMatrix.mjs`), never from a named protocol, so a cell measured under a different
    policy set re-verifies under that set. A fixture with no rows has nothing to sweep and falls out of
    the matrix — so a **separate job** asserts the set is fully measured, since a fixture is cut by a
    balance pass and one committed without its rows is an accident, not a stage.
  - Each runner uploads its sweep CSV, so a legitimate rebalance is recorded from CI's measurement
    rather than paying for the sweep a second time locally.
  - The Pages deploy became this workflow's tail (`deploy.yml` folded in), gated on both jobs, so a red
    baseline blocks a release.
- **A sweep reports as a delta against what was recorded** ✅ — `npm run sim:report -- variant.csv
  --against scripts/sim/baselines` pairs two measurements by (cell, policy) and then **by seed**, so a
  content edit reports as one block per cell that moved — win rate, turns, the end pools that shifted,
  the defeat causes that traded, and the seeds that crossed the win/defeat line — with unmoved cells
  collapsed to a count. That last is what a `git diff` over rows could not say without a hand join.
  - The per-seed reading is **paired only because seed `i` shuffles the same deck on both sides**, so
    `diffRecords` withholds the flip list when the seed sets differ, and `sim:report` withholds it when
    the fixture's deck/board/mission no longer matches what was swept (the check `sim:record` already
    made, lifted to `scripts/simFiles.ts` and shared). The aggregate comparison survives both, since
    comparing a rebalanced deck against the old baseline is a legitimate thing to want.
  - Collapses the *Compare a content variant* recipe from six steps to five: the baseline run is gone
    (the fixture holds it) and the two-report hand-diff is one command.
- **A baseline fixture holds its own rows** ✅ — a cell's launch config
  (`scripts/sim/baselines/<id>.json`) and its measured numbers (a global `results/<policy-set>.json`)
  lived apart, bound only by a label string, so re-cutting a fixture stranded rows in a file nobody
  edits and one mission couldn't hold two cells without hand-splicing both sides. A fixture now carries
  a `results` key, one entry per policy, holding **verbatim CSV rows** rather than the folded report —
  so the sweep survives the fold and "which seeds flipped?" is answerable without re-measuring, and a
  rebalance reads as a per-seed `git diff` instead of two moved percentages.
  - **Recording is a third tool, `npm run sim:record`**, not a `--record` flag on the sweep. That keeps
    `sim` a pure measurer, and moves every "is this a baseline?" rule off flag combinations and onto the
    sweep file's own `#sweep`/`#cell` header — so a filtered sweep, a non-default beam, an interrupted
    run count, a renamed cell and a fixture edited mid-sweep are each refused for a file taken any time.
  - The rows keep their constant `cell`/`policy` columns *because* that redundancy is checkable, and
    `maxRounds`/`columns` sit inside each policy entry so a partial re-record can't certify a sibling's
    stale rows. `#sweep` now records **effective** values, so a sweep that named no flag still says what
    it ran at.
  - `sim:report` reads a fixture (or a directory of them) as well as a sweep file, which is where a
    dossier's table now comes from.
- **The simulator measures; a second tool folds** ✅ — `npm run sim` had two unrelated front-ends over
  one engine: a batch mode that destroyed every per-run fact in-process behind an aggregate report, and
  a `--seed` replay that was a separate code path with a different output. So a second question about a
  finished sweep — which seeds lost, what the outliers held, how the wins differ — cost a whole re-run.
  Now the sweep's **only** output is one CSV row per run (`sim/record.ts`'s `RunRecord`), written as each
  run lands, and `npm run sim:report` folds that file into the same report as before. `summarize` takes a
  `RunRecord[]` whatever its provenance, so a live sweep and a re-read file agree by construction; its
  `--format json` was the committed-results shape, so recording a measurement was piping a sweep through
  it and nothing committed needed migrating. Verified by re-sweeping `masonry_chiefdom` and `accounting`
  × greedy/planner × 100 seeds: all four cells reproduce the committed rows field-for-field.
  - **`--seed` became a filter, not a mode** (`BatchOptions.seedIndices` keeps the selected index on the
    streams the full sweep would have given it, so its row is byte-identical), and `--verbose` carries
    the per-turn trace — on **stderr**, so stdout is pure CSV under every flag combination.
  - **`outcome` is one column** — `win`, else the defeat's authoritative cause verbatim. Wins, all
    defeats, and one cause are each a single equality, against a cause set that keeps growing
    (`noWinFound:budget`/`:depth`/`:deadEnd` alone are three).
  - **`cardsPlayed` is zero-filled** over the deck ∪ the mission's `events` ∪ its `alsoDisplay`. The
    last is what a run can only *mint* mid-play, so including it keeps the key set identical across
    every row of a cell — the packed column parses rectangular — and it makes "unplayed" a **per-run**
    fact where the summary could only ever say "never in any run of the cell". Measured immediately:
    29 of accounting's 100 greedy runs never play a Thief, which the old aggregate could not express.
  - A `#`-comment header carries the sweep's flags and one manifest line per cell (mission, board, and
    the deck regrouped into counts + per-copy stickers), so a sweep file is a complete record of itself.
    The reader skips anything ahead of the header, because `npm run sim > sweep.csv` prepends npm's own
    preamble to stdout and a sweep file that failed to load over that would be a trap; JSON has no
    comment syntax, so `sim:report --format json` wants `npm run --silent`.
  - Supersedes the *"report the first 5 seeds of each outcome"* item — filter the CSV and read the
    `seed` column.
- **Rebalanced the early game's resource economy** ✅ — a mission-by-mission pass over the rates from
  the campaign's first node forward, on the `trade-redesign` branch. The converters were cut to a
  **1-per-worker** base (Foraging, Toolmaking, Storytelling, Hunting — the last of the flat ×2 boxes
  gone), food upkeep went superlinear at `floor(pop²/4)`, and Conquest became a per-copy doubling price
  on the new cost spine. Money moved onto its **producer** side (a Bead Workshop building plus a
  Bartering route) and entered in the Stone Age rather than the Bronze, which restructured the age's DAG:
  each branch now leads with a **pressure** mission whose reward is the *next* mission's toolkit, and
  both branches reconverge on a culture node before the wonder capstone. The Stone Age's twelve
  thresholds were re-read against the new rates and the Bronze arc's nine measured cells re-cut on decks
  a player can actually own at each node, with the results committed alongside the fixtures under
  `scripts/sim/baselines/`. The **worker-turn** basis those rates were judged on, and the board
  and objective notes the pass settled, graduated to [`DESIGN.md`](DESIGN.md).
- **The deck editor's tray no longer overlays its picker** ✅ — the tray was `position: fixed` over a
  picker that scrolled with the whole meta content area, so whatever landed in the bottom ~260px at a
  given scroll position was hidden *and* still under the pointer: a click there resolved to the tray
  card painted on top and silently toggled a different card out of the deck. Bumping `.picker`'s
  bottom padding can't fix it — padding grows the content by the same amount it moves the row down,
  so the hidden band stays hidden. The editor is now a full-height flex column filling the content
  area: the picker is the only scroll region and the tray is a flow sibling below it, so the two can
  never occupy the same pixels (measured: picker bottom == tray top, at 700/949/1200px heights and
  empty/full trays). Drops the tray's `left: 220px` coupling to the nav's width with it.
- **A gated producer is worth reaching its gate, even when the gate is a goal term** ✅ — the strategic
  capacity credit was skipped whenever its pool was itself goal-valued, so nothing valued reaching 🎭 L1 to
  ungate a wonder paying the *other* goal terms. The derived credit now fires (with the pool's own key
  excluded, or it restates the objective's slope); only the intrinsic floor stays suppressed. Reaches
  territory and population identically. Cost: `first_temple` planner 98 → 96.
- **A multi-output producer is worth the sum of its goal terms** ✅ — `bestGoalThroughput` folded with
  `Math.max` *across* goal keys, so a card paying 🔨+🪙+🎭 every round was credited for one of them, ranking a
  single-output Forge above it. Now sums per card, then maxes across cards — matching `producerCredit`,
  which already summed; the two folds disagreed about what one card produces.
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
  on one 50-seed cell). The standing set's recorded rows are swept at the default width throughout: a
  `--search-beam` row is a diagnostic and is not comparable to them.

- **`--max-rounds` sets the oracle/prover search depth** ✅ — the search's round cap was hardcoded at 50
  while the drive loop's stall cutoff was a separate flag, so the two could disagree in both directions: a
  proven line longer than the cutoff is discarded as a `stall` anyway (wasted search), and a cap shorter
  than it reports `noWinFound` on seeds winnable inside the runs the sweep asked for (a false negative).
  `POLICY_FACTORIES` entries now take the sweep's `SimOptions`, and the two search policies derive their
  depth from it via `searchBoundsFor`. The search's own default moved 50 → 200 to match the drive loop's,
  so an unflagged sweep agrees by construction; only an *explicit finite* cutoff propagates, `Infinity`
  being dropped as an unbounded search would never terminate. Re-measuring the standing set's `oracle`
  rows across the move left every one unchanged — depth was not the binding bound on the standing set. Replay (`--seed`) builds its policy from the
  same `SimOptions`/`OracleOptions` as the batch, or it would reproduce a row at different bounds.

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
  Everything measured under the shared cap was re-cut afterwards, so the standing set's recorded rows
  read the split cap throughout.
- **Trade-route zone** ✅ — a new `trade` **card kind** and a standing `G.tradeRoutes` zone. Playing a
  trade card files it there via `rules/tradeRoutes.ts`'s `openTradeRoute`, where the `endTurn` broadcast
  ticks it like a threat — flat `produces` yield plus `upkeep` rent, no worker scaling. A route takes
  **no workers**, no territory, and nothing closes one, so the rent alone bounds it: an
  unpayable one runs money negative into **bankruptcy**. This is the sink money's one-way-hub topology
  spends through.
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
  their three axes, swept via `npm run sim -- --baseline`, with measured results committed beside them
  whose commit *is* their content-SHA record — the regression pins for the
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
  finishes: `runBatch` fires an optional per-run callback (the sim library writes no I/O itself — tests
  stay quiet), and `scripts/sim.ts` renders a `\r`-updated stderr line tracking the whole sweep
  (`runsDone/runsTotal` across every policy × scenario cell, plus the active policy/scenario). stdout
  stays clean. That callback later became the streaming seam for the measurement itself.

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
- **A discard cost's target is a searched decision** ✅ — `enumerateActions` fixed the sacrifice to the
  lowest-index other-hand cards, so no policy (oracle included) could ever *choose* to ditch an unplayed
  event with Fire and dodge its drain — a real line, since `resolveHandEvents` scans `G.hand` only and a
  tablet in the discard neither drains nor escalates. Now `enumeratePlays` emits one action per **distinct
  sacrifice**, deduped by `contentKey` so four identical copies are one choice while two copies at
  different counter levels are two; `canonicalPlay` stays as the heuristic ladder's single representative,
  and `randomPolicy`'s own re-randomization went away as a now-duplicate mechanism. Combination growth is
  deliberately unbounded (only a `discard: 1` card exists) with a warning where it would bite. Measured on
  the Writing player deck: greedy 10 → **22%**, planner 82 → 80%, oracle/prover 10/10 either way but ~1
  turn faster. The **whole** committed baseline set was re-swept at the standing protocol, and it moved
  exactly where the two mechanisms reach: the five cells stocking Fire, plus `raiders_at_border` (greedy
  100 → 99%), the only other cell whose mission seeds `event` cards for `permanentDelta` to have been
  mis-buffering. The six cells with neither came back **byte-identical** — the tightest confirmation
  available that nothing else shifted. Accounting's oracle row moved 90 → 70% @10: **cause unattributed**
  between the two changes (`scoreState` is also the beam's ranking heuristic), though a `prover`
  diagnostic rules out the search budget — its declines are `deadEnd`/`depth`, never `budget`.
- **`permanentDelta` counted a hand event's drain as permanent** ✅ — the resolved jot: the *comment* was
  authoritative, so `clone.hand = []` joins `clone.workZone = []` in `sim/value.ts`. Band 3 was buffering
  ~3 turns against a one-round, hand-contingent drain (a 100-point swing on the pinning test); the drain
  still reads at collapse scale in band 2, which projects the *actual* next turn.
