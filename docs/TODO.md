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

- **Unsaved-changes warning on leaving the deck editor** — if the player has made edits in `DeckEditor.tsx`
  that aren't saved, prompt/confirm before discarding them on exit. `[?]`
- **Per-pip worker drag** — independent per-pip *drag* (drag a specific pip to another box); box-level
  worker drag still moves one worker at a time. Deferred follow-up from the shipped multi-pip staffing UI. `[?]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]`
- **Re-polish the victory / gameover screens + flow** — revisit the end-of-run overlay and the transition back to the meta loop now that missions grant real rewards: the win/loss screen should surface what the run earned (Influence, any unlocks) and read well for both outcomes, and the hand-back-to-meta flow should feel finished rather than functional. `[?]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`
- **Work reordering + insert-at-drop** — let the player reorder placed work cards, and have a newly-played
  work card insert at the drop position rather than appending. `[?]`
- **Sticker locked/unlocked visual on mission preview** — rework how a mission's sticker reward reads locked vs. unlocked (currently a generic locked chip → real face). Maybe extract a **shared sticker widget** (the `CardFace`/`BoardMini` counterpart for a single sticker) reused across the mission-detail preview and elsewhere. `[?]`

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
- **Simulator: full move-surface fuzz test over synthetic fixtures** — a fuzz pass exercising the
  building/`discardCost` move surface (the paths the current random-policy smoke test doesn't
  hit yet), built on synthetic fixtures. Deferred until real content exists in Step 6, or an explicit
  later fuzz pass. `[size: S] [blocked]`

## Misc

---

## Done / shipped

> Completed **transversal** work moves here (newest first) so the backlog stays current but nothing
> silently vanishes; at a version bump these become one-line [`CHANGELOG.md`](../CHANGELOG.md)
> entries. **Mission** work is *not* archived here — a finished mission's record is its dossier
> (`docs/missions/<name>.md`), tracked in [`BACKLOG.md`](BACKLOG.md); the changelog is drawn from
> both. Everything through **v0.0.4** has already moved to `CHANGELOG.md`.

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
- **Pet the doggo** ✅ — "can you pet the dog?" easter egg: clicking the Dogs card's art band in the
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

