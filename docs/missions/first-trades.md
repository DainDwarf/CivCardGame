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

**The two cards** — ✅ **both reworked and shipped**, granted by `raiders_at_border` (landed ahead of
this mission so they can be played in the meantime):

| Card | Was | Is now |
|---|---|---|
| Bead Workshop | `action`, 1🔨 → 2🪙 | **`building`**, 2🔨 to build, 1🪙 per staffed worker |
| Bartering | `trade` route, 2🪙 to open, −1🪙/round, +1🌾/round | **`trade`** route, 1🪙 to open, 1🪙 rent → **2🌾**/round |

**Why the faucet is a building and not a work box.** A route's rent is charged every round
unconditionally, while a work card only pays out on the turns it is *drawn* — one copy in a ~23-card
deck reaches a 4-card hand about 17% of the time, four copies about 53%. No number of copies covers a
100% obligation, so a draw-dependent faucet funding a permanent rent runs a structural deficit into
bankruptcy. The income has to be as permanent as the debt. The same argument prices the route's 1🪙
entry: it can't be paid before the faucet is standing, so the trap of opening a route with no income
is closed by the cost rather than by a warning.

Both sit on money's **producer** side, so the one-way-hub topology holds: Bead Workshop no longer converts
🔨 into 🪙 (a worker does), and the route rents access rather than exchanging. Nothing converts the
route's 🌾 back into 🪙.

**Goal — undecided.** A 🪙 *hoard* target fights the topology (money's whole point is that it is
spent), so the likelier shape is **routes standing**: open N trade routes and keep them running for
K rounds — which forces the player to build the income that sustains rent rather than bank a pile.
Decide before implementing.

**Reward — undecided.**

## Balance ⬜ (not started)

**Resolved by lever 2 — the route's return, not the faucet's rate.** The line now reads:

- Bead Workshop building — 2🔨, 1 slot + 1 worker → 1🪙/round.
- Bartering route — 1🪙 to open, 1 slot + 0 workers → −1🪙/round, **+2🌾/round**.
- **Together: 2🔨, 2 slots + 1 worker → 2🌾/round.** Farm is 2🔨, 1 slot + 1 worker → 1🌾/round.

So the pair is **double a Farm's output for double its slots and the same single worker** — a real
trade rather than a strict loss, and the axis it trades on is the one the boards actually squeeze:
Settlement is pop 2 / terr 4, so slots are what you have spare and workers are what you don't.

Why lever 2 and not lever 1 (one faucet funding several routes): the faucet is fixed at 1🪙, so a
route's rent eats all of it. Lever 3 (routes cost no worker) is real but can't carry the pair alone —
at one route per faucet, the worker a route saves is spent on the faucet that funds it.

**Watch at the sweep:** the route now out-rates the building it depends on, so a second Bead Workshop
+ route pair scales linearly on slots with no diminishing term. Territory is the only brake. Check
whether a slot-rich board turns this into the dominant food line rather than an alternative to one.
Also unchanged: 🪙 is demanded outside routes — 30🪙 at `first_temple`, 6🪙 in Pyramid's build cost —
so the building keeps a job even where a route isn't worth its slot.

**Second check:** at this point in the arc, Bead Workshop is money's only faucet and the route its only
sink — a closed two-card system. Verify it is a decision and not a script before locking numbers.

## Polish ⬜ (not started)
