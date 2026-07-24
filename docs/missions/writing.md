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
- **Cost choice:** tablets cost 🔨/🌾, *not* 🔬 — Storytelling is the only science faucet until this
  mission's own reward lands.
- **Reward:** unlocks the **Archives** (building, 4🔨, 2🔬/worker — the Forge's science twin, obsoleting
  Storytelling) and the **Writing** action (2🔬, return a chosen card from discard to hand).

## Implement ✅ (shipped)

First shipping consumers of the `chooseCard` interaction, `recoverFromDiscard`, and the `discardEmpty`
gate. Tablet cost is `{ production: 6, food: 2 }` in `cards.ts`.

## Balance 🟡 (open)

The 🔬 drain is the design's **load-bearing** number — it is the mission's *only* pressure.

- An unrecorded tablet fires upkeep **once** then files to discard, so at −1 the total bleed
  (≈−5🔬 per full deck cycle) may be **too slight** to force the record-early-or-bleed decision,
  leaving the mission a softer *Finding Copper*.
- Too high and an opening-hand tablet on a low-science board can dark-age before the player can act.
- The sim question: does a value exist inside that window? If not — scale the drain by tablets *in
  hand*, add a grace round, or introduce a light threat.
- No committed baseline fixture yet (mid-balance).

**Open — tablet cost mismatch (needs a call):** `missions.ts` `writing.victoryHint` promises "pay 3🔨
and 2🌾 for each" tablet, but `clay_tablet` costs `{ production: 6, food: 2 }`. Over 5 tablets that's
30🔨 vs the 15🔨 the player is told to budget. Either the hint went stale when the tablet escalated, or
6 is the typo — unknown which, so no fix applied.

## Polish ⬜ (not started)

- Resolve the tablet-cost / hint mismatch above (a text-vs-number call).
- Card display/text, art, lore.
