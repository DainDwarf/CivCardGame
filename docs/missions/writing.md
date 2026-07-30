# Writing — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance 🟡 · Polish ⬜
**Branch:** Bronze — the age's literacy node, on the centre axis.
**Placement:** `prereqs: ['accounting']`, bronze col 7 row 0.
**Reward influence:** 12.

## Design ✅ (converged)

The escalating-drain sibling of Copper/Roads (Copper drains 🔨 via a threat, Roads 🌾 flat, Writing 🔬
escalating). No threat card — the events *are* the pressure (like Raiders).

- **Goal:** record all 5 **Clay Tablet** events (played → `removed`, which the goal counts).
- **Pressure:** an unrecorded tablet files to discard and comes back around, its 🔬 drain **worsening
  each time it fires** (−0, then −1, −2, … per copy, off a per-instance `level` counter). Since 🔬 is a
  core pool, letting too much slip collapses the run into a **dark age**.
- **Cost choice:** tablets cost 🔨 + 🔬 — the *same* pool the drain bleeds, so falling behind makes
  catching up dearer. Storytelling is the only science faucet until this mission's own reward lands.
- **Discarding a tablet is a designed out:** `resolveHandEvents` only visits the **hand**, so a tablet
  sacrificed to a discard cost neither drains nor advances its `level` — the escalation counts
  *firings*, not rounds, and paying a card to dodge one is a legitimate play.
- **Reward:** unlocks the **Archives** (building, 4🔨, 2🔬/worker — the Forge's science twin, obsoleting
  Storytelling) and the **Writing** action (2🔬, return a chosen card from discard to hand).

## Implement ✅ (shipped)

First shipping consumers of the `chooseCard` interaction, `recoverFromDiscard`, and the `discardEmpty`
gate. Tablet cost is `{ production: 4, science: 2 }` in `cards.ts`.

## Balance 🟡 (open)

The 🔬 drain is the design's **load-bearing** number — it is the mission's *only* pressure.

Fixture: `scripts/sim/baselines/writing.json` (City, 26 cards, 13⭐ of the 98 arriving). Measured but
**not yet recorded** — `baselines/results/` carries no `writing` row, and shouldn't until the drain
settles.

Measured at the 4🔨 + 2🔬 tablet, greedy/planner @100 · oracle @10:

| policy | win rate | turns (min/med/mean/max) | defeats |
| --- | --- | --- | --- |
| greedy | 36% | 8 / 24.0 / 26.1 / 67 | famine 40, dark_age 24 |
| planner | 79% | 9 / 19.0 / 19.9 / 50 | dark_age 14, famine 7 |
| oracle | 100% (10/10) | 10 / 13.0 / 13.5 / 17 | — |

The cost move (6🔨+2🌾 → 4🔨+2🔬) alone cratered the cell — planner 84% → 19%, oracle 100% → 80%, mean
end 🔬 negative at every tier — and doubling Storytelling/Fire to ×4 recovered it to the row above.
So the mission is now tuned *against a science-heavy deck*; the un-doubled deck is the harder cell.

Open questions, in order:

- **The drain is still the load-bearing number and is still unswept.** Nothing measured today moved it
  off −0/−1/−2. Candidates if it proves too slight: start the escalation at 1, scale it by tablets *in
  hand*, or advance `level` on something other than its own firing (which would also close the
  discard-dodge's free ride — see the Design note on why that ride is intended).
- **Planner underuses the designed dodge.** Over 20 replayed seeds, 149 discard-cost plays: a tablet
  was in hand for 49, and it sacrificed one in 31. Split by whether the tablet was affordable, it takes
  the dodge **80%** of the time when the tablet is *playable* but only **52%** when it is *unplayable* —
  the inverse of the intended read, so 79% likely understates the deck's real ceiling and part of the
  21-point gap to the oracle is policy quality, not difficulty.
- **Calendar is near-dead** in every configuration swept: 0 plays under greedy across six sweeps, 3 of
  100 runs under planner, 1 of 10 under oracle.
- **Planner wins on one worker.** Its end state is pop 2.0 / terr 2.0 with 10.4🔨 banked; a replay shows
  population parked at 1 of 2 assigned for all 20 turns. Neither Hut nor Conquest earns its slot.

## Polish ⬜ (not started)

- Card display/text, art, lore.
