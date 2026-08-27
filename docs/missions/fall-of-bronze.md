# Fall of the Bronze Age — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ✅
**Branch:** Bronze — the age's **scored survival infinite** (its Ice Age), opened by clearing
[The Sea Peoples](sea-peoples.md); the campaign's last unlock.
**Placement:** `prereqs: ['sea_peoples']`, `kind: 'infinite'` — no map node, campaign-banner only.
**Reward:** none (infinite) — pays its score as Influence every attempt.

## Design ✅ (converged — numbers are Implement's)

**Identity — the storm that never ends.** The capstone repelled one season of sails and won; this is
the counterfactual it telegraphed: the sea peoples keep coming, and the only question is how much of
the world-system you keep alive, for how long, at what price. Everything is the capstone's shipped
machinery with the cap taken off — no new mechanics, one new threat card.

- **Never-winning objective** (Ice Age shape: one bespoke always-false goal); the run ends only in
  collapse.
- **Score = 2⭐ per wave repelled, never rounds survived** — the first mission to use the
  objective-card `score` seam (built for it). Rounds-survived pays a player for hiding;
  waves-repelled pays for holding the lanes and fighting, which is the skill the capstone taught. It
  also closes the skip-turns Influence grind the Ice Age's rounds payout permits (that mission's
  re-score is a separate, later item).
- **The Catastrophe** (threat): a steady clock adding a fresh `sea_raid` to the deck every
  `RAID_SPAWN_PERIOD` rounds (via `spawnIntoDeck`, the Thieves' mechanism). The growing circulating
  census — each unanswered wave cutting/stripping/burning per round — **is** the deepening drain; no
  separate resource ramp. Meanwhile the repel ladder (4⚔️ + 4 per wave repelled, unbounded)
  guarantees repelling eventually outprices any income: census up, answer down, collapse certain.
  The wave is the capstone's machinery on the infinite's **own card** (`endless_raid`) at half the
  beach price — the capstone's ladder is a balanced win threshold and must not move; the endless
  ladder is the score's pace, and the measured knob matrix showed price, not spawn pressure, is
  what the tally responds to.
- **Play arc:** early, repels are cheap and permanently thin the census — spend ⚔️ to keep the sea
  clear while the economy compounds. Mid, every repel is dearer and triage begins. Late, repelling is
  unaffordable, the lanes fall, the board goes dark, and the tally stands. Skilled play is census
  management for as long as the tin holds.
- **Seeded start:** opens with 3 waves already in the deck (two short of the capstone's five, chosen
  off the capstone's measured pressure) — pressure from the first reshuffle, with the spawner
  supplying the rest forever.
- **The tin gate carries over unsoftened:** lose the last tin route past reopening and no wave is
  ever answered again — the intended endgame timer, blessed as in the capstone.
- **Turtle watch (the one feel-play question):** a max-score line of "never repel, tank the burn on a
  fat food engine" *should* be dead — the census grows without bound and each circulating wave burns
  every round — but this is the thing a feel pass verifies. The knob if it isn't: scale the burn with
  the census (the capstone's reserve drain, still in the pocket).

## Implement ✅ (shipped)

The `fall_of_bronze` mission (`kind: 'infinite'`, prereqs `sea_peoples`, `scoreUnit: '⭐'` — the best
recorded is the Influence banked, not a wave count) seeds **3** `endless_raid` events over the
`fall_of_bronze_goal` objective and the **`long_storm`** threat (Design's *Catastrophe*, renamed at
Polish).

**`endless_raid`** is the Sea Raid's machinery on its own card at a **4⚔️** beach price: the two
waves share one `raidLadder` cost resolve (+4⚔️ per wave repelled) and one `RAID_LANDING` upkeep
(cut / strip / burn), so only the printed base differs — and `wavesRepelled` counts both ids, one
tally whichever wave a mission circulates.

**The score seam** (generic, built here, mission-agnostic): `CardDef.score` — an objective card's
optional score measure, read once at run end by `rules/objective.ts`'s `runScore` into the new
**`RunResult.stats.score`**, which is what a scored infinite pays as Influence (`computeRewards`) and
records as its best (`applyRunResult`'s `bestInfinite`). An objective declaring no measure scores
nothing — the attempt pays nothing and records no best — so `ice_age_goal` declares its own measure
(snaps endured, since its cold-snap rework) and the sandbox stays unscored. The end-of-run overlay's payout
preview reads the same `runScore`, so the preview can't diverge. `MissionDef.scoreUnit` is the
display-only label the Stats best-scores board renders (default `'rounds'`).

**`fall_of_bronze_goal`** carries `score: (G) => 2 * wavesRepelled(G)` — the same `removed`-zone
tally the capstone's win threshold and the repel ladder read, so the three can never disagree on what
"repelled" means; the payout doubles it.

**`long_storm`** ticks a `clock` counter in its `upkeep` and every `RAID_SPAWN_PERIOD` (6) rounds
spawns one `endless_raid` via `spawnIntoDeck` — fresh instance ids, deterministic shuffle-in, the
face counting down to the next wave.

## Balance ✅

**Fixtured** — `scripts/sim/baselines/fall_of_bronze.json` pins the capstone's City deck + board,
recorded at `greedy`/`planner` @20 with **no prover** (a never-winning objective declines every seed,
so the column would measure nothing). The objective offers no **win** gradient; what the competent
policies steer by is the `score` measure itself (`sim/race.ts`'s score term, one round of margin a
point), and each row's `score` column is the Influence the attempt banks.

The shipped numbers — 4⚔️ base · +4 ladder · period 6 · 2⭐ a wave — came out of a measured
investigation rather than feel alone. The scorer was cleared first: at every state where a repel was
legal the race value favored it (greedy takes 100% of its windows), so the delivered ⭐ is
**opportunity-limited** — the tally is "how many ladder rungs the run's total ⚔️ mint affords", and
the knob matrix confirmed it: spawn-side knobs (seed count, onset, period) bought rounds but not
score, while the price axis moved it directly. The as-first-authored 8-base configuration delivered
1–2 waves flat; the applied one, on the capstone's own City deck + board, 20 seeds,
`--max-rounds 200` (every run ends in collapse):

| policy  | ⭐ mean | ⭐ max | rounds mean | defeats            |
|---------|--------|-------|-------------|--------------------|
| greedy  | 3.6    | 8     | 48.6        | ruin 16 · famine 3 · bank 1 |
| planner | 3.3    | 8     | 63.0        | ruin 13 · famine 5 · bank 2 |

(Planner row re-recorded when the Road went single-use — [`roads.md`](roads.md); the deck plays it
0.1×/run, so the movement is draw-order churn. Re-recorded again on the Road's price cut and Sword's
play-time tin gate ([`wheel.md`](wheel.md)): every ⭐ figure and defeat count identical, one round of
planner mean the only thing that moved — this deck holds both cards and is untouched by either.)

A good attempt and a poor one now separate (1–4 waves). Two caveats ride with the planner column:
its within-turn search cap under-finds three-action repel lines (TODO → *Simulator*, deferred past
0.1), so read greedy as the search-independent floor; and the biggest untapped lever is the deck's
own ⚔️ throughput — a stronger Bronze military economy raises the tally with no mission edit.

**Feel-play signed off** with no number moved. The turtle watch closed with it — hiding banks nothing,
since the score is waves and the census grows either way; the burn-scales-with-census knob stays in
the pocket, unused.

## Polish ✅

Polished **as a pair with `ice_age`**, the Stone infinite it was designed to echo. The two now say the
same things the same way at every surface, so a player who met the Long Winter reads this mission on
sight:

| | Ice Age | Fall of the Bronze Age |
|---|---|---|
| objective title | Ice Age | Bronze Age |
| objective text | Remove as many Cold Snaps as you can. | Remove as many Endless Raids as you can. |
| objective art | ⭐ | ⭐ |
| readout | `3❄️ removed` / `3⭐` | `3🏴‍☠️ removed` / `6⭐` |
| threat | The Long Winter | The Long Storm |
| threat text | Adds a Cold Snap in the deck every 6 rounds | Adds an Endless Raid in the deck every 6 rounds |
| threat readout | `Next ❄️ in 4` | `Next 🏴‍☠️ in 4` |
| victory hint | Gain 1⭐ Influence for every Cold Snap you removed. | Gain 2⭐ Influence for every Endless Raid you removed. |
| failure hint | Every Cold Snap costs 2🔨 more to remove… | Every Endless Raid costs 4⚔️ more to remove… |

**The objective art is the ⭐ Influence glyph on both**, which is the one thing telling a player at a
glance that these missions pay per removal rather than per round. The rewardless sandbox keeps 🏖️, so
the star reads as "this one banks".

**The threat is `long_storm`, not `catastrophe`.** *The Catastrophe* named the outcome; every other
threat names the standing condition, and its Stone twin is *The Long Winter*. The id was renamed with
the name — a threat is not zero-filled into `cardsPlayed` (deck + `events` + `alsoDisplay` only), so
no recorded row moved and no fixture was re-cut.

**Both ladders' steps are shared constants** — `SNAP_STEP` (2🔨) and the now-exported `RAID_STEP`
(4⚔️) — so a failure hint and a card's rule line cannot quote a step the cost resolve doesn't charge.

**Lore cut 121 words → 28**, to the Ice Age's two-beat shape: state the dependency, ask the question.
It leads on the tin road because losing the last route is the hard failure the hint now names, and
that dependency is the real Late Bronze Age collapse in one line.

The Bronze failure hint keeps a second sentence the Ice Age has no counterpart for — *"Without a Tin
Route, none can be removed at all."* The `requiresRoute` gate is a distinct way to lose, so symmetry
gives way to it.
