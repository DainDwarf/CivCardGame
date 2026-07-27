# The First Trades — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the arc restructure
> that created this mission is in [`../REBALANCE.md`](../REBALANCE.md) → *Stone Age branches 3–4
> restructure*. Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at
> ship. Live state only.

**Stage:** Design 🟡 · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Stone, upper (row -1) — the **money** mission, second in its branch.
**Placement:** `prereqs: ['raiders_at_border']`, stone col 3 row -1. Takes the slot `rites_rituals`
held; `rites_rituals` leaves the arc entirely.
**Reward influence:** undecided.

**Narrative.** While fighting the raiders at the border, your people met the settlements that were
*not* raiding them — and found the other tribes had things worth having. War made the border; trade
makes it worth holding.

## Design 🟡 (open)

Introduces **money** and **trade routes** — the first mission where 🪙 is both produced and spent.
Its two cards are `raiders_at_border`'s reward, so they are owned before this mission is launched
(the cross-cutting sequencing rule in BACKLOG).

**The two cards** (both reworks of cards currently on trial, see REBALANCE → *Cards on trial*):

| Card | Was | Becomes |
|---|---|---|
| Jewelry | `action`, 1🔨 → 2🪙 | **`work`**, 1🪙 per staffed worker |
| Bartering | `trade` route, 2🪙 to open, −1🪙/round, +1🌾/round | **`trade`** route, 1🪙 rent → 1🌾/round |

Both sit on money's **producer** side, so the one-way-hub topology holds: Jewelry no longer converts
🔨 into 🪙 (a worker does), and the route rents access rather than exchanging. Nothing converts the
route's 🌾 back into 🪙.

**Goal — undecided.** A 🪙 *hoard* target fights the topology (money's whole point is that it is
spent), so the likelier shape is **routes standing**: open N trade routes and keep them running for
K rounds — which forces the player to build the income that sustains rent rather than bank a pile.
Decide before implementing.

**Reward — undecided.**

## Balance ⬜ (not started)

**The rate does not clear as specified — resolve this at Design, not in the sweep.** As written the
pair is strictly worse than a card the player already owns:

- Jewelry work box — 1 territory slot + 1 worker → 1🪙/round.
- Bartering route — 1 territory slot + 0 workers → −1🪙/round, +1🌾/round.
- **Together: 2 slots + 1 worker → 1🌾/round.** Foraging is 1 slot + 1 worker → 1🌾/round.

So the whole money loop costs an extra territory slot to do exactly what a starting card already
does. Under the unified territory cap that slot is the scarcest thing on the board, so this is
dead on arrival. Three levers, not yet chosen:

1. Raise Jewelry's rate (1 worker funds more than one route's rent).
2. Raise the route's return (1🪙 buys more than 1🌾, or the route yields something Foraging can't).
3. Give routes a value that isn't throughput at all — a route takes **no worker**, so a player who is
   worker-bound rather than slot-bound would pay a slot for it. That reframes the pitch, but only
   bites on boards where population is the binding constraint.

Lever 2 is the one that also makes the *mission* interesting, since the goal is likely route-count.

**Second check:** at this point in the arc, Jewelry is money's only faucet and the route its only
sink — a closed two-card system. Verify it is a decision and not a script before locking numbers.

## Polish ⬜ (not started)
