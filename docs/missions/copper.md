# Finding Copper — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the age's opening mission.
**Placement:** `prereqs: ['first_temple']`, bronze col 5.
**Reward influence:** standard Bronze node.

## Design ✅ (converged)

- **Goal:** mine all 3 copper-vein events (2🔨+5🔬 each, played → `removed`).
- **Pressure:** the **Failing Stone Tools** threat — −1🔨 per round per worker staffed *in a building*;
  work cards exempt.
- **Reward:** unlocks the **Forge** (building, 3🔨, 2🔨/worker — deliberately obsoletes Toolmaking).

## Implement ✅ (shipped)

Threat drain counts workers staffed in buildings only, so a works-only deck sidesteps it (intended —
see Balance).

## Balance ✅ (settled)

Confirmed by simulation + hand-play. The works-are-exempt trade (a works-only deck can dodge the
drain) is **intended, not a leak** — and the re-cut baseline is what a deck leaning into it measures at.

**Re-swept under the rebalanced rates** (settlement · the First Temple pool, 62⭐ arrived, 6 of it spent
on the Farm's two Irrigation stickers). No threshold moved; the deck is what changed:

| policy | win rate | turns (min/med/mean/max) | defeat causes |
|---|---|---|---|
| random | 0/100 | 2 / 9 / 9.3 / 22 | famine 62 · ruin 38 |
| heuristic | 0/100 | 2 / 7 / 7.6 / 26 | ruin 91 · famine 9 |
| greedy | 96/100 | 10 / 41 / 41.7 / 73 | famine 4 |
| planner | 100/100 | 31 / 39 / 40.1 / 91 | — |
| oracle | 10/10 | 30 / 31.5 / 32.2 / 37 | — |

**The money pair is a trap here, and that is the mission working.** The Bead Workshop is the Stone Age
pool's only 🪙 faucet and it is a *building*, so once Bartering's 1🪙/round rent is running, the worker
funding it is pinned into the drain: staffed is ruin, unstaffed is bankruptcy. Planner opened the route
in 67 of 100 runs and ruined in 67 — dropping the pair took it from 28% to 100%. The threat taxes
permanent infrastructure, and the route is the most permanent thing in the pool.

## Open

- **Göbekli Tepe is unplayable-in-practice on this mission**, oracle included: 8🔨 and a culture level to
  enter, then 3 staffed workers producing +3🔨 against the threat's −3🔨 — it nets zero production on the
  one board slot it costs. Not a strand (it clears `first_temple`, which grants it, and reads normally
  elsewhere), but this is the mission where a wonder is worth *nothing*, and the drain is why.
- **Forge at 3🔨 is unmeasured *here*** — it is this mission's reward, so no fixture in this cell can
  reach it. It is measured downstream on [writing](writing.md)'s cell, the earliest swept one that
  stocks it: the single copy is played in 98 of 100 planner runs, 31 of 100 greedy, and 10 of 10 oracle.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
