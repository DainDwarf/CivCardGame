# Masonry — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the age's second mission, a *megalopolis* goal.
**Placement:** `prereqs: ['first_temple']`, bronze col 5 row 1 — a symmetric fork off gobekli
opposite Copper (Copper moved to row -1).
**Reward influence:** provisional.

## Design ✅ (converged)

- **Goal:** reach 5 🧍 population.
- **Pressure:** none — no threats/events.
- **Reward:** unlocks the **House** (building, 6🔨, +2🧍 one-shot — a bigger Hut), the **City Walls**
  (building, 3🔨, self-sufficient: +1⚔️/round, no upkeep — the first standing military producer), and
  upgrades **Settlement → City** board (12🌾 10🔨 2🪙 2🧍 5🏞️; the age's government — the City drawback
  per IDEAS is still deferred/to-author).

## Implement ✅ (shipped)

House/City Walls cards + the Settlement → City board upgrade shipped.

## Balance ✅ (closed 2026-08-25)

**The lever was the price, not the difficulty.** The 2026-08-23 beta playtest reopened the pass on what
the goal *charges*: House and City are this mission's own rewards, so the only in-mission population
source is the **Hut** (+1, one-shot, one territory slot), a mission unlock grants exactly one copy, and
every copy the goal forces the player to buy is superseded by the House the clear then hands over. At
6🧍 that bill was three bought copies with zero variance in their use — Hut plays were exactly
`6 − startingPop` on every seed under every policy — and one of the four Chiefdom copies never reached
the table at all.

**Settled at 5🧍.** The one-point cut halves the forced purchase (Settlement buys two copies, Chiefdom
one) without moving winnability: both cells stay at 100% for the planner and 10/10 for the prover,
every deck card is played on every run — the dead Chiefdom copy is gone — and the mission runs about
ten rounds shorter, since the last Hut was the slowest purchase in the chain. Leftover 🔨 collapses from
4–5 to under 1.6 and end territory settles near 4.6 rather than a pinned 6.0: the run stops over-banking
for a Hut it no longer needs. Food stays at 22–30 throughout, so it is not the binding pool at either
goal. The Chiefdom greedy alone gives up 2 seeds (100 → 98%) to its one-ply plateau on the conversion
chain — never landing a Hut and stalling at the round cap — which two copies in the deck expose more
often than four did; the planner and prover never see it.

The *House as a card upgrade* candidate (converting the bought Huts instead of superseding them) was
dropped: it needed a new reward kind reaching into `cardAge`, deck instance references and two
downstream fixtures, for a bill the goal cut already halves.

**Two fixtures, one per board**, since Settlement (2🧍/4🏞️) and Chiefdom (3🧍/2🏞️) meet the same goal
from opposite ends: `scripts/sim/baselines/masonry.json` (Hut ×3) and `masonry_chiefdom.json` (Hut ×2).
The measured numbers live in those fixtures' own `results` keys — read them with `npm run sim:report`,
which is the authority. No transcription here: the previous one drifted out of date against the files
it quoted.

## Open

- **Masonry is the first mission that forces buying**, with nothing having taught buying — the
  onboarding half of the *Stone → Bronze cliff* in [`../BACKLOG.md`](../BACKLOG.md), which the goal cut
  shrinks (≈12⭐) but does not close. Not a content fix.
- **Both rewards were re-cut after the sweep and are unmeasured** — City Walls 4🔨/−1🔨 upkeep → **3🔨
  flat, no upkeep**; the City board 6🔨 → **10🔨** start. They are this mission's own rewards, so no
  fixture here can reach them; the six City-board fixtures downstream (accounting, horse_taming,
  pyramid, roads, wheel, writing) all predate the board change. City Walls' cut was accepted unmeasured
  on the amortized reading — the card takes no workers, so it is priced against draw frequency rather
  than the worker-turn, and its flat 1⚔️/round already out-rates a War Horse drawn about every sixth turn.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore. (City drawback still to author.)
