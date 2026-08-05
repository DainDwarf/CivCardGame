# Writing — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
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

## Balance ✅ (settled)

The 🔬 drain **stands at its authored −0 / −1 / −2** — it is the mission's only pressure, and the cost
move onto 🔬 was enough to make it bite without touching it.

Fixture: `scripts/sim/baselines/writing.json` (City, 26 cards, 13⭐ of the 98 arriving), which carries its
own rows at the standing protocol — greedy/planner @100, oracle @10:

| policy | win rate | turns (min/med/mean/max) | defeats |
| --- | --- | --- | --- |
| greedy | 36% | 8 / 24.0 / 26.1 / 67 | famine 40, dark_age 24 |
| planner | 84% | 9 / 19.0 / 20.5 / 50 | dark_age 11, famine 5 |
| oracle | 100% (10/10) | 10 / 13.0 / 13.5 / 17 | — |

The cost move (6🔨+2🌾 → 4🔨+2🔬) alone cratered the cell — planner 84 → 19% *on the deck of the day*,
oracle 100% → 80%, mean
end 🔬 negative at every tier — and doubling Storytelling/Fire to ×4 recovered it to the row above.
So the mission is now tuned *against a science-heavy deck*; the un-doubled deck is the harder cell.

Left open, none of them blocking:

- **Planner mis-orders the designed dodge, and the oracle shows the right order.** Replaying 20 seeds
  under each and splitting every discard-cost play by whether a tablet in hand was affordable:

  | | playable → dodged | unplayable → dodged | no tablet in hand | outcomes |
  | --- | --- | --- | --- | --- |
  | planner | 16/20 = **80%** | 15/29 = **52%** | 100/149 | 15W 5L |
  | oracle | 10/22 = **45%** | 9/15 = **60%** | 90/127 | 20W 0L |

  The oracle dodges *more* when the tablet can't be paid for, which is the intent; the planner has it
  backwards. The load-bearing cell is the `playable` one (80 vs 45) — holding an affordable tablet, the
  planner burns it to Fire four times in five where the oracle records it. So part of the gap to the
  oracle is the planner's leaf valuation not crediting a held tablet for the goal step it converts into,
  and **84% understates what the deck does in competent hands.** A `sim/` matter, not a content one.
  (The split above was measured at the 79% tier, before the goal step was attributed by replacement cost;
  the direction is what it establishes, and the cell has since moved to 84%.)
  (`TAB=playable` means *some* tablet in hand was affordable, not necessarily the discarded one — a
  handful of 2+-tablet cases carry that slack. Direction is unaffected. Measured with a throwaway patch
  naming the sacrifice in `formatAction`, which prints only the count; not committed.)
- **Calendar is near-dead** in every configuration swept: 0 plays under greedy across six sweeps, 3 of
  100 runs under planner, 1 of 10 under oracle.
- **Planner wins on one worker.** Its end state is pop 2.0 / terr 2.0 with 10.4🔨 banked; a replay shows
  population parked at 1 of 2 assigned for all 20 turns. Neither Hut nor Conquest earns its slot.

## Polish ⬜ (not started)

- Card display/text, art, lore.
