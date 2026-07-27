# Harsh Winter *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the arc restructure
> that created this mission is in [`../REBALANCE.md`](../REBALANCE.md) → *Stone Age branches 3–4
> restructure*. Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at
> ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ⬜ · Polish ⬜
**Branch:** Stone, lower (row +1) — the **threat** mission, first in its branch.
**Placement:** `prereqs: ['growing_numbers']`, stone col 2 row +1. Shipped as `harsh_winter`, replacing
`restless_people` outright — the slot is all it kept.
**Reward influence:** 9, inherited from the mission it replaces so the downstream faucet ledger is
unmoved. Provisional.

**Narrative.** A winter arrives that the stores were not cut for, and the tribe comes through it
thinner than it went in. Surviving is the whole of it — and surviving is what makes your people
resolve never to be caught by the turning year again. That resolve is *Reading the Seasons*.

## Design ✅

Teaches the **threat** mechanic and introduces **no new resource**, which is the point: it is playable
on the leaned starting collection, and its *reward* is what makes the branch's second mission possible.

**The arrival state is pinned**, and it is the same one `raiders_at_border` is measured on: Settlement
(10🌾 / 5🔨 / 4🗺️ / 2🧍), Growing Numbers' 15-card deck (4 Foraging · 4 Toolmaking · 2 Bow · 2 Dogs ·
Farm · Hut · Conquest), 6⭐ unspent, Irrigation unbought. Both col-2 missions fork off the same clear,
so neither can assume anything the other grants.

### The threat — `deep_cold`, two clauses on one card

| Clause | From | Effect |
|---|---|---|
| **Toll** | round 1 | −1⚔️ each round; with no ⚔️ held, −`DEEP_COLD_UNARMED_FOOD` 🌾 instead |
| **Famine** | `HARSH_WINTER_ONSET` | −1🌾, deepening by 1 each round, until the winter breaks |

A threat you **answer** and a threat you can only **weather**, on one face — which is the whole lesson,
and the reason this is one card rather than two. A second card would have bought the same two clauses at
the price of a second name, glyph, lifecycle and thematic justification, and diluted the mission's stated
teaching job.

**Why the toll exists at all:** without it the mission has no 🔨 and no ⚔️ sink, and 9 of 15 cards are
dead draws — the "one live axis" failure recorded against mission 1, worse. The toll makes
Toolmaking → Bow (2🔨 → 3⚔️ → three rounds of cover) the mission's production sink, reached through
military. Dogs is the other route at 1🌾 → 1⚔️, which is half the unarmed fallback, so it is worth
playing on sight — the toll's *real* price through most of the run is ~1🌾/round, not 1⚔️.

**Why it starts at round 1 while the famine waits.** The grace window is preparation time — without it
the mission only measures the board's starting stockpile — but four *empty* rounds is worse pacing than
four rounds with something to answer. The toll gives the preparation phase its own decision without
touching the food stockpile the grace window exists to protect.

**Why it auto-pays** rather than prompting: an upkeep handler may not open a `pendingInteraction`, and
the choice the toll is really asking — whether to have armed at all — was already made on earlier turns.

**Why not `long_winter`'s shape.** That ramp is unbounded, correctly: `ice_age` has no win, so its
threat must eventually beat you. Against a standard mission it can't be outlasted — the food ceiling is
1🌾/worker at a pop cap of 4, so an unbounded drain crosses maximum income around round 4 and is never
recoverable. "Survive N rounds" against it is a stopwatch, not a decision. Bounding it by a **lift** (it
deepens, then ends) rather than a **ceiling** (it deepens, then plateaus) was deliberate: a survivable
plateau lands at −3/−4, which pins every worker to farming forever and switches the second axis off
exactly when the mission should be tightest.

### The goal — survive to the break

`harsh_winter_goal` counts `G.round` against `HARSH_WINTER_BREAK`; the same two constants drive the
threat's ramp, so the deadline can't drift from the drain that makes it one. The win is checked at
`beginTurn`'s flush, so reaching the break round means the round before it was paid in full — and the
schedule needs no ceiling, because the run always ends the round the ramp would continue past.

The arc's only round-measured goal. Every other mission wins on a pool.

### The reward — the science pair

`reading_seasons`' prerequisites, so they had to land here.

- **Storytelling** — 2🔬 → **1🔬** per worker, onto the 1-per-worker base rate. Side effect worth noting:
  this fixes one of the three work-card/building pairs REBALANCE's *Diagnosis* still owed, since Archives
  (4🔨, 2🔬/worker) now **doubles** it the way Forge doubles Toolmaking.
- **Calendar** — shipped **unchanged** (1🔬, look-only peek at top 3). The dossier previously owed it a
  rework; the base-rate cut delivered one for free. At 2🔬/worker it cost half a worker-round, at
  1🔬/worker it costs a full one, so its price doubled in real terms without the card being touched.

**Consequence:** `reading_seasons` has lost Calendar and is now Influence-only, owing the branch's
culture card. Tracked in REBALANCE → *Culture leaves the Stone Age*, flagged at the reward site.

## Balance ⬜ (not started)

**Every number below is provisional and unswept.** `HARSH_WINTER_ONSET = 5`, `HARSH_WINTER_BREAK = 10`,
`DEEP_COLD_UNARMED_FOOD = 2`.

Paper arithmetic on the arrival deck. **It does not close**, which is the first thing the sweep has to
settle:

| Out (rounds 1–9) | 🌾 |
|---|---|
| Normal upkeep, pop 2 | 9 |
| Famine, rounds 5–9 at 1·2·3·4·5 | 15 |
| Toll remainder — 9 rounds, 6 covered by two Bows, 3 paid in Dogs at 1🌾 | 3 |
| **Total** | **27** |

| In | 🌾 |
|---|---|
| Settlement's start | 10 |
| Income ≈1.76/round × 9 — Farm plus a Foraging drawn ~76% of rounds | 15.8 |
| Less a Toolmaking worker-round: Farm (2🔨) + two Bows (4🔨) is 6🔨 against a 5🔨 start | −1 |
| **Total** | **≈24.8** |

**Short by ~2🌾 on close to the optimal line**, so the mission may currently have no line at all. The
constraint is that income is **draw-capped, not worker-capped**: at pop 2 with Farm holding one worker,
at most one Foraging can be staffed per round, and it is in hand only ~76% of the time. Growing doesn't
help — Hut's 3🔨 competes with the Bows, and pop 3 costs +1🌾/round upkeep for ~+0.7🌾/round of
draw-limited income.

Levers, least damage to the design first: **`ONSET` → 6** (drops the −5 round, keeps the 10-round length
and adds the preparation round the grace window exists for) or **`BREAK` → 9** (drops the same round and
a toll round with it). **Not the toll's round-1 start** — that is the clause carrying the second axis.

**Watch list.**

1. **The two clauses tune together.** If it comes out too hard, the ramp is the knob, not the toll — the
   toll carries the second axis, the ramp is only the clock. Suspect the peak lands at −4 (i.e. `BREAK`
   at 9) or the grace stretches to 5.
2. **Is the toll actually payable, or a permanent 2🌾 tax?** If competent policies never hold ⚔️ and just
   eat the fallback every round, the 🔨/⚔️ sink is decorative and the mission is back to one axis.
   Read `unplayedCards` for Bow and Dogs — that is the direct signal.
3. **⚠️ Read the planner's number as instrumentation before reading it as difficulty.** This is the arc's
   only goal that reads neither `G.resources` nor a zone, and that has two consequences in `sim/`.
   `objectiveProgress` folds to `min(G.round, BREAK)/BREAK` — it rises by *ending turns* and is identical
   across every within-turn action sequence, unlike every other shipped mission. And `deriveEnablers`
   registers nothing off it: no capacity credit, no producer credit, no card-cost credit, so the planner
   is given no reason to build a Farm. **The tell is direction** — `heuristicPolicy` never consults
   `objectiveProgress`, so if heuristic *beats* planner here (the inverse of missions 1–3, where planner
   led 100/100/100 against 95/26/100), that is the empty enabler model talking, not the mission. Settle
   which it is before retuning any constant, or the content gets tuned against a sim artifact.
4. **Skill separation may be genuinely compressed too.** A fixed deadline means everyone who survives
   wins on the same round, so turn count carries no gradient here the way it did at Raiders. Separate
   from the instrumentation caveat above, and only readable once that one is ruled out.
5. **Conquest is the one accepted dead card** — territory 4 already exceeds what the mission needs. One
   of fifteen is tolerable; if the sweep shows more, the ramp is starving out plays rather than pressuring
   them.
6. **The fixture doesn't exist yet.** `scripts/sim/baselines/harsh_winter.json` is Balance's to cut, on
   the arrival deck above. `restless_people.json` is deleted along with its mission, and its rows are
   stripped from both files in `baselines/results/`.

## Polish ⬜ (not started)

- **The lifted winter has no exit.** Nothing removes a threat from the board, so `deep_cold` sits in the
  zone after it breaks. Today the run ends on the same flush, so it is never *seen* lifted — but the
  moment anything extends the mission past `BREAK` it would read as a bug. The `dynamicText` countdown
  is the current answer; a real one may want the threat to leave.
- **Mission name still provisional**, and the threat's (`The Deep Cold`) deliberately differs from the
  mission's so the objective card can carry the mission name, matching `ice_age`/`long_winter`.

## What this rework retired

- **`unrest`** (threat, −1🪙 per 🧍 on reshuffle) — **deleted**. It was broken as it stood: every board
  reachable at this point starts at 0🪙 and the money faucet is granted on the *other* branch, so anyone
  coming straight down this one bankrupted on the first reshuffle. The `on.reshuffle` bus it was the test
  vehicle for is now covered by a synthetic fixture (`test_reshuffle_drain`), so deleting the card cost
  the engine no coverage.
- **`restless_people_goal`** (objective, 🎭 level 2) — **deleted**; the arc no longer teaches culture at
  all. The culture-threshold tests it anchored now read the synthetic `test_culture_objective`.
- **Beer** — was this mission's grant; it moved to `first_trades` (reworked to 1🌾 → 2🎭), which is what
  left the slot free for the science pair.
