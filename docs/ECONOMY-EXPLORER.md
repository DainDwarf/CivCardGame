# Meta-progression economy explorer

## Context

The headless simulator (`src/sim/`) only exercises the **run loop** with a *fixed* deck. It cannot
answer the question that actually matters for balancing missions across the campaign: **how much
meta-progression (bought card copies, stickers, board choice) does a mission demand, and does the
campaign hand the player enough Influence to afford it by the time the mission unlocks?**

Masonry is the trigger case — "reach 6 🧍 population" is unwinnable without buying enough Hut copies
(and the food/territory to support them), so its difficulty lives half in the run loop and half in the
shop. But the need is **general**: the campaign is planned to span 9+ ages (`docs/IDEAS.md`), old cards
stay legal but semantically obsolesce (House is a strictly-better Hut yet never removes it), and the
user is "drowning in the economics of influence." The user is also considering changing the copy-buy
price formula (from the ×1→×2→×4→×8 tier ladder to a simpler per-copy cost) and wants to know whether
that must come first.

**Goal:** a tool that (a) shows the Influence *income* the campaign grants per mission, and (b) finds
the deck/sticker/board configurations that actually clear a mission and surfaces their Influence
*cost* — so mission difficulty can be read as an income-vs-demand margin, in a "clears-per-upgrade"
yardstick, across every mission and age.

## Decisions locked (from discussion + review)

- **"Works" = competent play wins it.** A deck counts as working when a competent policy wins it at a
  solid rate across seeds (real player-facing difficulty). The **oracle** (`proveWinnable`) runs
  *alongside only as a ceiling check* ("is it even winnable at all"). We do **not** minimize cost
  subject to oracle-winnable — that flags decks only perfect play beats and understates difficulty, and
  pays the oracle's 3M-node exhaustion cost on every bad deck.
  - **Update:** the competent baseline is now the **`planner`** (`sim/plannerPolicy.ts`), not `greedy2`.
    `greedy2` is one-ply and *plateaus indefinitely* on any mission needing a multi-turn conversion chain
    (Masonry was the trigger case — it wins 0%), so it can't stand in for competent play there. The
    `planner` is a fair (non-oracle), determinized multi-turn lookahead that clears Masonry ~7/8 at
    ~1–3 s/run; use it as the demand-explorer's inner-loop policy. Its cost is higher than `greedy2` (a
    search per turn), so the sweep budget must account for it — `PlannerOptions` exposes
    depth/beam/determinizations to trade competence for speed.
- **Income first, then demand.** Ship the pure income ledger (no sim) before building the sim-based
  explorer. It may relieve the economics pain on its own, and we learn its shape before committing to
  the heavier half.
- **Pricing is a formula-agnostic seam.** Every price is computed by calling the real `shop.ts` /
  `stickers.ts` cost functions, never hardcoded. So the copy-cost formula change is **decoupled and must
  not come first** — the tool is precisely what will tell us whether a new formula is calibrated: change
  it, re-run, re-price.
- **Knob discovery is mechanical, not per-mission semantic** (Phase B): derive the axes to vary from a
  resource-dependency closure over declarative card/sticker data, never a hand-maintained per-mission
  table.

## Phase A — Income ledger + price list (pure, no sim) — **SHIPPED**

> Status: done (`npm run economy`). The subsections below are the completed design record — the
> "build now" / future-tense phrasing and the seed-save line numbers are as-planned, not outstanding
> work. What actually shipped is under *The report* and *Reframing after Phase A*.

A new dev script, same pattern as `scripts/sim.ts` / `scripts/seed-save.ts` (bundled by
`scripts/bundle.mjs` and run under `node`, `parseArgs`, clean `economy: …` one-line errors,
`--format text|json`). No simulation — pure computation over content, so it runs instantly.

### Reuse / refactor first (unify, don't duplicate)

`scripts/seed-save.ts` already implements the transitive-prereq DAG walk (`closureOf`, lines 57-68) and
topological fold order (`foldOrder`, lines 78-90) as module-private helpers. Lift these into
**`src/rules/campaign.ts`** as pure functions that take the `missions` map as a parameter (matching the
existing `availableMissions` signature) and *return/throw* rather than `process.exit` (the `fail()` call
is a script concern that stays in the script). Then `seed-save.ts` imports them back. Add:

- `prereqClosure(missions, missionId)` — the mission's transitive prereqs (the seed-save `closureOf`
  generalized).
- `cumulativeInfluenceInto(missions, missionId)` — sum of `reward.influence` over
  `prereqClosure(missionId) \ {missionId}` (the guaranteed one-time faucet available *going into* the
  mission; excludes the mission's own reward since it isn't cleared yet). Only `'standard'` missions
  contribute a fixed reward; infinite missions pay per-attempt and are treated as a separate variable
  faucet, noted but not summed.

Pin these with a unit test in `src/rules/campaign.test.ts` (e.g. `cumulativeInfluenceInto(MISSIONS,
'masonry') === 52`).

### The report (`scripts/economy.ts`, `npm run economy`) — **SHIPPED**

1. **Faucet ledger** — every `'standard'` mission in `foldOrder`, showing its own `reward.influence`
   (`reward` column) and the cumulative running total banked arriving at it (`total` column,
   `cumulativeInfluenceInto`).
2. **Price list** — every shop upgrade priced through the real functions in **raw Influence**: copy
   tiers (cumulative to ×2/×4/×8, folding `shop.ts`'s `TIER_LADDER`), card stickers
   (`STICKERS[id].cost`), board stickers (`BOARD_STICKERS[id].cost`).
3. **`--format text|json`.**

**Yardstick removed (see reframing below).** The original plan normalized every figure to "clears"
(mean standard first-clear reward). That was scrapped after A shipped: mean-of-missions tells you
nothing about grind, and the yardstick the user actually wants — *how many grindable infinite-mission
runs a reward is worth* — is sim-measured and progression-dependent, not a content constant. The
report now prints **raw Influence only**; the grind yardstick moves to the sim half.

Key files (shipped): **new** `scripts/economy.ts`; `src/rules/campaign.ts` (+ `campaign.test.ts` —
`prereqClosure`/`foldOrder`/`cumulativeInfluenceInto`, masonry=52 anchor); `scripts/seed-save.ts`
(reuses the lifted helpers); `package.json` (`economy` script); `CLAUDE.md` (Commands + `campaign.ts`
entries).

## Reframing after Phase A — the grind yardstick is the real prize (next-session start here)

The user's reaction to A pinpointed the actual balance problem and reprioritized the sim half.

**Why mean-of-missions failed as a yardstick.** It's just the average of the reward column — it says
nothing about grind. What the user needs is to price rewards against the **grindable faucet**: how
much Influence one run of an infinite mission (`ice_age`) pays. Then a mission reward reads as "worth
N grind-runs," and (demand − banked) reads as "grind K runs to afford this" — the too-much-vs-too-
little-grind dial.

**Why it can't be a content constant.** An infinite run pays `turnsTaken`, and survival depends on the
deck, which depends on breadth (unlocked cards) *and* depth (bought copies) — both climb with
progression. So **Influence-per-grind-run is a function of progression, measured by simulation.** That
dependency *is* the positive-feedback loop the user is struggling with (more Influence → more depth →
longer survival → more Influence).

**Phase B (revised) — the infinite-income meter, ahead of the demand explorer.** The single most
useful deliverable: sweep `ice_age` across progression points (after each standard-mission clear,
derive the pool via the `seed-save` fold, build the best deck `greedy2` can from it, run N seeds,
record mean `turnsTaken`). Output: **Influence-per-run as a curve over progression** — literally a
graph of the feedback loop. Roughly linear/flatter ⇒ dampers holding; bending upward ⇒ grind income
running away. That curve is also the real yardstick to price every mission reward against.
- The `ice_age` reward multiplier being provisional doesn't block this: `turnsTaken` is the raw
  signal; set the Influence-per-round multiplier *after* seeing the curve's shape.
- Existing dampers to keep in mind when reading the curve: `long_winter` deepens every round (a
  built-in survival ceiling — a stronger deck buys only a few more rounds); one-time prereq-gated
  breadth; the rising ×2/×4/×8 price curve on depth.

## Phase B (cont.) — Demand explorer (sim-based) — *plan in detail later*

Per mission, find the configurations competent play clears and price them. Sketch (reuses the whole
existing sim pipeline — it is already deck-agnostic, so **no core-engine changes**):

- **Derive the owned pool at mission M** by folding `prereqClosure(M) \ {M}` through the real
  `applyRunResult` (the exact `seed-save` machinery) → the `PlayerStore` a player has *arriving* at M
  (unlocked cards/stickers/boards + accumulated influence).
- **Mechanical knob extraction** — from the objective's target resource, scan the pool for cards/stickers
  touching it (`produces` / `effect` / `applyGain`), then expand *one hop* through the engine's fixed
  mechanic relations (population→food via `foodUpkeep`, building→territory placement cap,
  staffable→workers) and pull in any sticker whose `appliesTo` matches a card already in the closure.
  This surfaces "irrigation on farms matters for a population mission" from data alone.
  - **Open question to resolve when planning B:** the objective's target resource is currently a closure
    (`goals[].measure = (G) => G.resources.population`), not declaratively inspectable. Resolving knob
    extraction cleanly likely needs a small declarative `resource?` tag on `goals` (a content change) —
    decide then.
- **Sweep** deck configs varying knob counts + candidate stickers/board, one `Scenario` per config
  (distinct `label` → independent seed streams); measure `greedy2` win-rate (primary) via
  `runPolicies`/`summarize`, and `proveWinnable` as a ceiling check. Price each config's **shopping list**
  (copies + stickers beyond the starting collection) through the Phase-A pricing seam.
- **Output:** per config — greedy2 win-rate, oracle-winnable?, mean turns, defeat causes, and influence
  cost vs. `cumulativeInfluenceInto(M)`. The margin is the mission's meta-difficulty.

## Manual pilot of the demand sweep (Wheel, 2026-07-24) — where the signal is, and isn't

Before building B's automated sweep, we ran it **by hand**: the Wheel mission (goal/threat scale on
*gained* territory, City board start 2 → reach 8), `planner`, 100 seeds/cell, sweeping deck edits and
reading win rate + turns + defeat causes + per-card plays. The point was to learn whether an automated
win-rate search can clear statistical noise. The blunt answer: **only at the structural granularity,
not the fine-tuning one.** Details, because they should shape B's scope:

- **Small levers (±1–2 copies of a card) are below the noise floor.** Six such edits landed in a
  50–61% band around a 60% baseline — an ~11-pt spread that is essentially all noise. At 100 seeds a
  win-rate estimate carries ~±10pt of binomial error (√(0.6·0.4/100)·2), and the planner's own
  determinization sampling adds more on top. Pulling the minimum detectable effect under ~5pt needs
  ~500 seeds (~4.5 min/cell at the cost below), and a real search visits candidates combinatorially. **A
  loop that diffs win rates over small deck edits is not affordable and will not separate signal** —
  treat fine count-tuning as unmeasurable, not just expensive.
- **Whole-type levers (add/remove a card entirely) *do* give clear, often noise-free signal.** Removing
  Dogs → **0% win, Conquest played 0×** (it strands the military→territory route — a structural fact, no
  seed count needed); removing House → **0%, ruin 97/100** (no workers to staff the economy); removing
  Foraging → 33%, famine 59. These are the reads an income-vs-demand tool actually needs ("is this
  configuration viable / what is load-bearing"), and they sit well above the noise.
- **Two secondary signals are lower-variance than win rate** because they're not binary, and moved
  cleanly where win rate stayed flat: the **defeat-cause composition** (a famine↔ruin tradeoff shifted
  visibly across nearly every cell as food/production was traded away) and **mean end-state resources**.
  Prefer these as the continuous "which way is it failing / how much margin" gradient.
- **The oracle is a cheap, crisp ceiling at low seeds** — 20 seeds gave clean winnability reads (20/20
  baseline vs 18/20 for a diluted deck) *and* proved a mechanism by watching the line it played: on a
  Cave-Art deck the oracle climbed culture to level 1 and played Cave Art 83–116×/100 runs to bank the
  `effectiveHandSize` +1-card draw, confirming **culture→draw is a real lever even on a territory
  mission**. It didn't raise this mission's ceiling (already 100% winnable, ~25 turns — too short for a
  culture engine to repay its dilution), but the oracle *pursued* it.
- **The `planner` is blind to whole synergy classes.** `DEFAULT_ENABLER_TERMS` ships with
  `handSize`/`conversions`/`floor` **off** (`sim/enablers.ts`), so the fair-play policy never builds
  toward culture→draw, a money→food conversion chain, etc. On the same Cave-Art decks the planner left
  culture ≈0 and Cave Art was pure dilution (60→48→45%). **Consequence for B: an automated search using
  the default planner will systematically miss draw/tempo/conversion decks** — either enable the
  relevant terms for the sweep (a code toggle today, not CLI-exposed) or read those levers with the
  oracle.
- **Cost, measured.** Bundle build is ~0.1s (amortizable). A healthy 100-seed planner cell is **~54s**
  (the per-candidate price a search pays). But **broken decks are the expensive ones**: cells that
  neither win nor collapse fast grind to `--max-rounds` (a −dogs cell averaged 122 turns), and a
  6-cell sweep containing two such cells took **11m** vs **6m** for a healthy 7-cell one — ~3–4× per
  candidate. **A search needs an early-abort / lowered `--max-rounds` guard**, or it spends most of its
  budget on its worst candidates.

**Net scoping steer for B:** aim the tool at *structural viability and the demand margin* (oracle
winnability as the yes/no ceiling + defeat-cause/end-resource gradients as the continuous signal), and
declare fine win-rate optimization over small levers **out of scope** as below the measurable floor.
That is a narrower tool than "automated deck discovery," but it's the half that matched the evidence.

## Phase C — Empirical search + campaign roll-up — *deferred, only if B earns it*

- Empirical local search (mutate a deck/stickers, keep winners) to discover non-resource synergies the
  dependency closure misses (draw/tempo) — costs a sim run per neighbour, heavier every age.
- Campaign-wide roll-up across all standard missions → the income-vs-demand **difficulty curve across all
  ages**, plus persona policies (`docs/IDEAS.md`) for more representative "achievability" than greedy2.

## Verification (Phase A)

- `npm run economy` prints the ledger + price list; hand-check the anchor: cumulative influence into
  `masonry` = **52** (0+6+8+9+8+9+12), and a full ×8 copy stack = **8** influence (1+2+5).
- `npx vitest run src/rules/campaign.test.ts` — the new closure/cumulative helper test passes.
- `npm run typecheck` — covers both the `src` and the Node `scripts` project (the lifted helpers cross
  that boundary).
- `npm test` — nothing regressed from the `campaign.ts` refactor / `seed-save.ts` re-import.
