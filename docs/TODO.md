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
> `[blocked]` waiting on something else · `[bug]` shipped behaviour is wrong.

## UI (`src/components/`)

- **Danger-button text contrast (app-wide)** — the `--danger-strong` / white pairing on danger
  buttons (GameMenu's Clear/Replace confirms, the deck-editor discard confirm, etc.) measures
  ~3.74:1 white-on-red — short of WCAG AA (4.5:1) for its bold ~15.7px size, in both light and dark.
  A transversal color-token decision (darken `--danger-strong` or bump the label size), not a
  per-dialog fix — touch it once so every danger button stays consistent. `[size: S] [?]`
- **Card-banner text contrast (app-wide)** — the same shape as the danger-button item above, on the
  card-kind palette: white on `--card-wonder-banner` / `--card-work-banner` / `--card-action-banner`
  measures 3.25 / 3.35 / 3.41:1, under AA in *every* theme, and bottoms out at **1.96:1** for Wonder in
  tritanopia — where the hue shift to `#e0b400` that fixed its confusability with Event/Threat is
  exactly what pushed it too light. The card face is the surface that hurts: its banner is 0.55rem bold
  uppercase, well under even the AA-large floor, where the Codex pill wearing the same hues is 0.85rem.
  So the fix is on the tokens (darken the three, or darken tritanopia's Wonder alone and re-check the
  collision it was raised to solve), not on either call site. Measured 2026-08-28 by the CVD pass over
  the Codex card-kind rows. `[size: S] [?]`
- **Per-pip worker drag** — independent per-pip *drag* (drag a specific pip to another box); box-level
  worker drag still moves one worker at a time. Deferred follow-up from the shipped multi-pip staffing UI. `[?]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`
- **Work reordering + insert-at-drop** — let the player reorder placed work cards, and have a newly-played
  work card insert at the drop position rather than appending. `[?]`
- **Show the food-upkeep change on population-granting cards** — Hut, House and any future `+N 🧍` card
  read as a pure gain, but upkeep is `floor(pop²/4)`, so the *marginal* mouth costs `floor(pop/2)` 🌾 a
  round and the price of growing rises as you grow. A player can't see that from the card face and only
  discovers it after building. Surface the delta on the face (and/or in the play preview) — `foodPerNextPop`
  (`rules/population.ts`) already exists for exactly this, so the curve isn't re-derived in the UI. Note it
  is state-dependent: the same card shows a different number at pop 2 than at pop 5. `[size: S]` `[?]`

- **Discard-mode affordance when a play costs cards** `[size: S]` — *(beta playtest)* playing Fire
  (`cost: { discard: 1 }`) drops the player into choosing a card to give up with nothing saying so; the
  discard reads as cards vanishing. Wants a visible "choose N to discard" mode on the hand while the
  payment is pending. Fire is the **only** card with a discard cost today, but `discard` is a first-class
  `CardCost` field, so hang this off `cost.ts`'s `discardCount` choke point — any play that sacrifices
  cards enters the mode — never a Fire branch.
- **Resource-icon tooltips on a zoomed card** `[size: S]` — *(beta playtest)* hovering a resource glyph
  in `CardZoomOverlay` should name the pool. The 8 icons are the game's whole economic vocabulary and
  nothing teaches them; the zoom is where a player is already looking closely. Per the tooltip
  convention, keep the text generic — name the resource, don't cite cards or missions.
- **Buy copies / stickers from inside the Deck Editor** `[size: M]` `[?]` — *(beta playtest)* hitting a
  card you don't own enough of means leaving the editor for the Collection and coming back. Both the
  player and a first-time player felt it. **Explicitly low priority and not a publish blocker** (user
  call): nothing is confusing, nothing is broken, every feature is reachable — it is convenience only.
  No obvious cheap fix, hence the `[?]`.

## Run loop (`src/rules/`, `src/run/`)

- **A raid's escort never survives the cut** `[bug]` `[size: S]` — `RAID_LANDING`
  (`content/cards.ts`) closes a route *only* where `stripSticker(route, 'convoy')` fails, so carrying
  an escort is exactly what stops the cut and a route always reaches the discard already bare of
  Convoys. [The Sea Peoples](missions/sea-peoples.md) asks for the opposite: a cut route re-standing
  with its **surviving** convoys. `closeTradeRoute` does carry stickers across, so the mechanism is
  there and it is Convoy alone that can never reach it — a Bartering comes back with its Irrigation, a
  Coastal Route with its Bronze Tools, and the Tin Route (which no other sticker fits) always comes
  back plain. The fix is to strip *and* cut in one landing, so an escort softens the blow instead of
  absorbing it. **Deferred past publish by decision** — it moves the mission's difficulty and owes
  `sea_peoples_city` / `_port` / `_warband` a re-sweep. Same shape applies to `endless_raid`.

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
    - It removes itself on the **resume** pass (splice itself out of `discard` by id → `removed`), not on
      the suspending pass; a `bow`-style pre-removal leaves a committed, undo-visible state where the
      cancellation is gone but the route still stands.
    - Build the choice's `options` in a **canonical order** (sorted by `contentKey`): `oracleKey.ts`'s
      `pendingToken` joins them positionally while `keyOf` folds `tradeRoutes` as a multiset.
    - Gate it in `playability.ts` on at least one standing route — a zero-option `pendingInteraction`
      is an unrecoverable soft-lock (non-cancelable, `endTurn` no-ops, undo blocked).
  - **Bronze gating must stay continuous *as well as* play-time.** A bronze structure carries both:
    `cost.requiresRoute` refuses the build, and `producesWhile` checks for the route every round. Dropping
    the continuous half once removal exists leaks — a play-time gate is evaluated at play while `upkeep`
    fires at the `endTurn` boundary, so play-route → play-building → close-route-before-ending-turn would
    pay zero 🪙 and keep the building forever. The continuous half is also what gives the Sea Peoples
    capstone its teeth.
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
  `workers: 0` cards (City Walls) are unaffected (always operating), and no shipped *staffable* prints an
  `upkeep` today — so this buys nothing until one does, and the design question is whether a maintained
  building is a shape worth having. `[size: M]`
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

- **Player telemetry — collect real play data** `[size: M]` `[?]` — collect actual play data from
  players, ideally as the same CSV the simulator writes (`sim/record.ts`'s `RunRecord` /
  `recordToCsvLine`), so human runs and swept runs fold through the same `sim:report`/duckdb tooling.
  Needs an **opt-out option visible at start** (not buried in settings). Open questions: where the
  rows go (a collection endpoint — the app is a static Pages deploy today), and what identifies a
  submission. Wanted for next week's polish work.
- **Re-read Farm vs Bead Workshop + Bartering under the reworked ladder.** The remainder of the
  economy rework (→ *Done / shipped*): which of the two food lines wins is set by copy scarcity and
  price, not by their rates — a second Farm is a shop purchase *and* a territory slot, while the
  route pair takes one slot and no land — and the rework moved both inputs (Stone copies now flat
  2⭐ but capped ×4; the faucet halved). Nobody has re-read the pair since. `[size: S]`

- **Re-read the Calendar's price — measured, it is barely played.** *(beta playtest)* Two signals: it
  reads as **expensive before it is ever tried** (2🔬 plus a card slot, for a look-and-draw whose payoff
  isn't legible on the face), and the user reports **dropping it after a while**. Folding the committed
  fixtures (`npm run --silent sim:report -- --format csv scripts/sim/baselines`, group `cardsPlayed`)
  backs the second: across the 16 cells whose deck carries it, `planner` plays it **0.03–1.35×/run** —
  under 1 in most cells, for a card sitting in the deck the whole run. So the question is whether 2🔬 is
  the wrong price or whether peek-and-draw is the wrong *effect* for this slot. `[size: S]` `[?]`

## Simulator (`src/sim/`, `scripts/sim.ts`)

> Balance answers are only as good as the policies taking them. Items here are why a number is wrong,
> or what would make the next one cheaper to get.

### Fidelity — where a policy mis-measures

> The race scorer's known weak cells, each with the constraint a fix must respect. The prover column in
> the fixtures says which of these hide winnable seeds.

- **`turnConfigLimit: 8` under-searches multi-action turns** `[size: M]` — the planner's within-turn
  config cap stops before the three-action lines the one-ply greedy finds by construction (measured on
  `fall_of_bronze`: 47% of *legal* repels declined at 8; at 64 the take rate is 77% and delivered score
  2.4× — more than any content knob moved it). The knob is generic, so raising it slows every planner
  sweep ~8× and owes a **full baseline re-record**; until then, read a planner column as measuring the
  search budget first wherever a turn's best line takes 3+ actions. Deferred past 0.1.
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
  in one pass or neither. **`sea_lanes` (all three boards) is the third leg's closed-form witness**, which
  raises this item rather than forking it: the deck holds exactly the goal's copies, so `copies == held`
  is an identity and delivery is exactly `pool/hand` — a landing completing 25% of the goal prices at
  0.25 rd against a 9.44 rd win clock, while the same landing caps `T̂loss` at `bank/drain` (0 rd on Port,
  whose ⚔️ starts at 0). The planner refuses with a trade card in hand on 86/201 turns (190 idle; wins are
  hoard-then-burst at 109–133 median), and the width-64 beam fills with hoarders and declines `depth` —
  a 4× diagnostic beam converts that into 20–44 turn wins (3/10 → 6/10 proven). Extra route supply does
  not reach it (`coverMembers` asks the cheapest member for `min(reach, need)`, preserving the identity),
  and the cell also instantiates the `wheel` item's shape — the plan not pricing the drain its own
  completion creates — so the two may share a fix. Until this lands, `sea_lanes`' recorded ~0/13/11% rates
  are a fidelity artifact, not a rating.
- **`finding_copper_chiefdom` — the slack cap is in rounds, hoarding pays in units** `[size: M] [?]` — at
  pop 3 the food drain is 2🌾/rd, so the run sits under the cap on ~89% of turns and a food play outbids
  an affordable goal play ~2:1 (the goal's marginal being the `1/handSize` constant above). Race wins the
  cell 93% but at ~172 turns against the oracle's 34-turn ceiling, half its wins landing past round 182 of
  a 200-round cutoff — don't cut a chiefdom-board balance verdict from race turn counts here until closed.
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

- **Fixture board stickers are id-checked only** `[size: S]` — `simFiles.ts`'s `readBoard` accepts
  `"board": { "board": …, "stickers": [...] }` and validates the sticker **ids**, but checks neither
  `appliesTo` nor `MAX_BOARD_STICKERS` — harmless for the universal Opulence, but a board-restricted
  sticker (or an over-cap list) would measure a cell no player can assemble, silently. The checks
  exist as `rules/boardStickers.ts` leaves (`boardStickerAppliesTo`, the cap in
  `canAttachBoardSticker`); fold them into the loader's reject.
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
> both. Everything through **v0.1** has already moved to `CHANGELOG.md`.

- **The itch.io copy is pushed by CI, behind the Pages gate** ✅ — itch hosts an HTML game as an
  upload, not an embedded URL, so the published copy would otherwise be a hand-rebuilt zip that goes
  stale against Pages on the first 0.1.x patch. `ci.yml` grew an `itch` job on the same `Latest` tail:
  `npm run build:itch` (the bundle at a **relative** base — the Pages one is baked to `/CivCardGame/`
  and 404s every asset on itch) then `butler push dist-itch daindwarf/age-of-deckbuilder-prelude:html
  --userversion <package.json version>`, butler fetched from broth's permanent URL and authenticated by
  the `BUTLER_API_KEY` repo secret. butler because it is the only write path: the server-side API
  lists uploads and serves downloads but creates none. The "playable in browser" flag, the project
  kind and the embed viewport are page-side settings set once after the first push.

