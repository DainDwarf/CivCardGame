# Harsh Winter *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the arc restructure
> that created this mission is in [`../REBALANCE.md`](../REBALANCE.md) → *Stone Age branches 3–4
> restructure*. Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at
> ship. Live state only.

**Stage:** Design 🟡 · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Stone, lower (row +1) — the **threat** mission, first in its branch.
**Placement:** `prereqs: ['growing_numbers']`, stone col 2 row +1 — ✅ the slot swap has landed, so
`restless_people` already sits there and `reading_seasons` has moved to col 3. What remains is the
rewrite: this mission keeps nothing of `restless_people` but that slot.
**Reward influence:** undecided.

**Narrative.** A winter arrives that the stores were not cut for, and the tribe comes through it
thinner than it went in. Surviving is the whole of it — and surviving is what makes your people
resolve never to be caught by the turning year again. That resolve is *Reading the Seasons*.

## Design 🟡 (open)

Teaches the **threat** mechanic — a persistent board hazard in the threat zone, ticking every round
— and introduces **no new resource**, which is the point: it is playable on the leaned starting
collection, and its *reward* is what makes the branch's second mission possible.

**Threat — to author.** A bounded famine drain on 🌾. `long_winter` (the `ice_age` threat) is the
unbounded escalating version and must not be reused: this one has to be outlastable, so it needs
either a ceiling on the escalation or a fixed number of rounds after which it lifts.

**Goal — undecided.** Survival-shaped rather than a stockpile: last N rounds, or hold the drain off
until it lifts. Whatever the shape, it must be reachable with food/production/military only.

**Reward — the science pair, both reworked.** These are `reading_seasons`' prerequisites, so they
must land here:

| Card | Currently | Rework |
|---|---|---|
| Storytelling | `work`, free, 2🔬 per worker | rate is out of line with the 1-per-worker base cut (REBALANCE → mission 1); almost certainly 1🔬 — confirm |
| Calendar | `action`, 1🔬, look-only peek at top 3 | rework unspecified — decide what it becomes |

Calendar moving here means **`reading_seasons` loses its current reward and needs a new one.**

## What this rework retires

- **`unrest`** (threat, −1🪙 per 🧍 on reshuffle) — no longer used. It is also **broken as it stands**:
  every board a player can reach at this point starts at 0🪙, and the only faucets are Bead Workshop
  (granted on the *upper* branch, so this chain doesn't guarantee it) and Trader (gated behind
  `accounting`) — so the first reshuffle is a bankruptcy for anyone who came straight down this branch. Delete it, or re-key it off
  a resource the player actually produces before reusing it anywhere.
- **`restless_people_goal`** (objective, 🎭 level 2) — the arc no longer teaches culture at all.
- **Nothing of the reward.** Beer was this mission's grant; it has moved to `first_trades` (reworked to
  1🌾 → 2🎭), leaving the slot card-less for the science pair to fill.

## Polish ⬜ (not started)
