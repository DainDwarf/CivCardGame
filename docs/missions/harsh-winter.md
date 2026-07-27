# Harsh Winter *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the arc restructure
> that created this mission is in [`../REBALANCE.md`](../REBALANCE.md) → *Stone Age branches 3–4
> restructure*. Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at
> ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
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

### The threat — `deep_cold`

Nothing until `HARSH_WINTER_ONSET`, then −1🌾 deepening by 1 every round until the winter breaks at
`HARSH_WINTER_BREAK`, which is also the win. The grace window is preparation time: without it the
mission would only measure the board's starting stockpile.

**Deliberately one-dimensional.** It is the arc's threat tutorial, and simple to the point of a single
axis beats a second mechanic layered on top. The accepted cost is that the mission has **no 🔨 and no
⚔️ sink** — Toolmaking, Bow, Dogs and Conquest are played, but their output is inert. A ⚔️ toll clause
was built and measured against exactly this, and cut: see *What was tried and cut*.

**Why not `long_winter`'s shape.** That ramp is unbounded, correctly: `ice_age` has no win, so its
threat must eventually beat you. Against a standard mission it can't be outlasted — the food ceiling is
1🌾/worker at a pop cap of 4, so an unbounded drain crosses maximum income around round 4 and is never
recoverable. "Survive N rounds" against it is a stopwatch, not a decision. Bounding it by a **lift** (it
deepens, then ends) rather than a **ceiling** (it deepens, then plateaus) was deliberate: a survivable
plateau lands at −3/−4, which pins every worker to farming forever.

### The goal — survive to the break

`harsh_winter_goal` counts `G.round` against `HARSH_WINTER_BREAK`; the same two constants drive the
threat's ramp, so the deadline can't drift from the drain that makes it one. The win is checked at
`beginTurn`'s flush, so reaching the break round means the round before it was paid in full — and the
schedule needs no ceiling, because the run always ends the round the ramp would continue past.

The arc's only round-measured goal. Every other mission wins on a pool — which is what the simulator
is built around, and why this cell has to be read carefully (below).

### The reward — the science pair

`reading_seasons`' prerequisites, so they had to land here. **Both make 🔬, neither spends it** — the
mission they feed asks the player to *stockpile* science, so a card priced in 🔬 would work against the
goal it was granted for.

- **Storytelling** — 2🔬 → **1🔬** per worker, onto the 1-per-worker base rate. Side effect worth noting:
  this fixes one of the three work-card/building pairs REBALANCE's *Diagnosis* still owed, since Archives
  (4🔨, 2🔬/worker) now **doubles** it the way Forge doubles Toolmaking.
- **Fire** — new: an action paying **1🔬** for **one card discarded from hand**. Storytelling's
  alternative rather than its better — the same 1🔬, bought with a card instead of a worker-round, which
  is the trade worth having at a pop cap of 4. The first shipped consumer of `CardCost.discard`; the
  field, `playCard`'s validation, the sim enumeration and the Board's sacrifice-picker were all already
  built and tested, so the card is content only.

**The 1🔬 is unmeasured**, and this mission's cell cannot measure it — Harsh Winter names no 🔬, and the
reward isn't in the run's deck anyway. `reading_seasons`' sweep is what judges the number, and it needs
three things known before the numbers land:

- **Its fixture must gain Fire.** `baselines/reading_seasons.json` is marked STALE and predates the
  restructure; Fire is granted by its *direct* prereq, so a re-cut that omits it measures the mission
  without the card it was added for.
- **The enabler model prices Fire as free.** `enablers.ts` derives value from `cost` → `effect` over
  *resource* costs; a card cost has no representation there, so the model reads Fire as +1🔬 for nothing
  and the planner may over-play it. Hard to spot on a 🔬-stockpile goal, where over-playing it looks like
  good play.
- **The oracle biases *down*, not up.** Its key treats `hand` as a multiset (`oracleKey.ts`) while
  `canonicalPlay` picks the sacrifice by hand *index*, so two hands with the same contents in a different
  order merge although their sacrifices differ. Per `oracle.ts` that costs completeness, never soundness —
  every returned line is replayed through the real engine — so a proven win stays proven and a miss is the
  only error available.

Also note that `discardCount` waives the sacrifice when the hand has no card to spare, so Fire played
last is a free 1🔬 — that's the card's floor, and it's the existing rule for every discard cost rather
than something this card introduces.

**Consequences.**

- **Calendar is benched.** It was this mission's second grant and is now unlocked by nothing, so it joins
  REBALANCE's *Cards on trial* to be re-slotted or cut on its own merits. Cutting it is not free: it is
  the only shipped consumer of `peekTop` and the look-only `reveal` interaction.
- `reading_seasons` stays Influence-only, owing the branch's culture card. Tracked in REBALANCE →
  *Culture leaves the Stone Age*, flagged at the reward site.
- **The Balance ✅ above still holds.** A reward is granted on clear, never played during the run, so
  swapping one leaves `baselines/harsh_winter.json` and its measured numbers untouched.

## Balance ✅

`HARSH_WINTER_ONSET = 5`, `HARSH_WINTER_BREAK = 10`. Measured on
`scripts/sim/baselines/harsh_winter.json` (the arrival deck above), records in `baselines/results/`:

| policy | seeds | result | turns (min · median · max) | end 🌾 | end ⚔️ |
|---|---|---|---|---|---|
| greedy | 100 | 3/100 | 8 · 9 · 10 | −2.5 | 6.0 |
| planner | 100 | 25/100 | 8 · 9 · 10 | −1.5 | 5.2 |
| oracle | 10 | **9/10** | 8 · 10 · 10 | 0.0 | 3.6 |

**⚠️ Only the oracle's number is a difficulty reading.** The mission wins on rounds survived, so its
objective names no resource: `objectiveProgress` is a flat function of the round, and because
`deriveEnablers` builds its whole model by probing that function, the model comes out **empty** — greedy
and planner are given no reason to bank food or build a Farm, and bank 🔨/⚔️ the mission cannot use
(note the 5–6 mean end ⚔️ above). This was measured, not assumed: temporarily blending a synthetic
"stockpile 20🌾" term into the gradient moved **greedy 3 → 37%** and **planner 25 → 73%** on this exact
cell with no content change, redirecting labour off Toolmaking and onto Foraging. The oracle is
unaffected — it searches the real shuffle rather than steering by the gradient.

So the cell reads: **winnable, with a real skill gradient** (random 0/10 · oracle 9/10), and the
competent-policy numbers are a **floor** until the simulator can steer a survival objective. That gap is
logged as transversal work in [`../TODO.md`](../TODO.md) — it belongs to the objective *shape*, not to
this mission, and anything later that wins on rounds survived meets it too.

`ONSET = 5` was chosen over `6` on the oracle: 9/10 against 10/10, i.e. the extra preparation round is
worth ~1 seed at the ceiling while costing the mission its whole margin — end 🌾 at the oracle is 0.0 at
5 against 3.7 at 6. The tighter number is the one that makes the mission a decision. (For the record,
`ONSET = 6` measured greedy 66% · planner 99% · heuristic 61% — but through the same distorted
instrument, so those are not comparable to a pool-goal mission's numbers either.)

**Watch when replaying by hand:** every winning run takes exactly `BREAK` turns, so unlike Raiders
there is no tempo gradient — skill shows only as surviving or not.

## What was tried and cut

A second clause on `deep_cold`: a **1⚔️ toll every round from round 1**, falling back to 2🌾 for a tribe
holding none. Its purpose was to give the mission a 🔨/⚔️ sink (Toolmaking → Bow → three rounds of
cover) and to give the grace window its own decision instead of four empty rounds.

**Measured and cut** — kept here because the numbers are the argument against re-adding it:

- With the toll at these constants the mission was **unwinnable**: 0/100 at heuristic, greedy and
  planner, and **0/10 at the oracle**, every defeat famine at round 7–9 against a round-10 win.
- Removing it alone took the oracle to 9/10 on the same constants, so the toll was the entire overrun.
- The toll clause itself was working as designed — greedy, planner and oracle all armed and paid in ⚔️
  (Bow ~1.9 plays/run) rather than eating the 🌾 fallback. It was affordable *and* unaffordable
  alongside the famine.

Cut on design grounds rather than re-tuned: a tutorial mission is better one-dimensional than
correct-but-layered.

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
