# Sword & chariot — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the post-convergence spine: [Bronze](bronze.md) → **Sword & chariot** → The Sea
Peoples (capstone).
**Placement:** `prereqs: ['bronze']`, bronze col 12 row 0.
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Design ✅ (converged — numbers are Implement's)

**Identity — the arms race.** The age's military climax and its power fantasy: the player finally
fields the bronze-armed host, one node before the collapse mission shows it can't save them. The
mission is about **standing military** — cashing the promise the [Sea Lanes](sea-lanes.md) dossier
wrote down when Convoy shipped ("Sword & chariot and the Sea Peoples want standing ⚔️").

- **Goal: muster — hold N ⚔️ at once.** A hoard goal on the one pool with no alternate faucet, so it
  is un-shortcuttable by construction. Deliberately **not** the seeded-completion pattern: five
  siblings already use it, and [Raiding](raiding.md) is literally "spend ⚔️ to crack targets" — this
  node flips the verb from *spend* to *hold*.
- **Three muster routes, one per board identity**, each paying in a different currency, and the
  drain below charges all three the same so none is a free turtle:
  - **City Walls** — 🔨 and *territory slots*, no workers: the settled boards' route.
  - **War Horse**, then the Chariot it unlocks — *workers*, no land: Warband's native play.
  - **Convoy**-stickered routes — route rent and the 🔨 surcharge, no land, no workers: Port's.

  (Hunting nominally makes a fourth, but a 1⚔️ worker in a deck that owns 3⚔️ workers is already out
  of every real deck by this node — not counted.)
- **Pressure: army upkeep** — a threat draining **🪙 scaled to the player's current ⚔️**. The palace
  pays for every spear: standing armies are the palace economy's ruinous line item, and mechanically
  it lands the bill on a **different pool from the goal** — the split [Bronze](bronze.md) settled as
  what keeps a run from out-earning its own pressure. It also makes **Marketplace load-bearing one
  node after it is granted**: the new money building is what funds the host. Sequencing rule holds:
  🪙 is producible on every chain in (Trader at Accounting, Bead Workshop at Raiders at the Border,
  Marketplace at Bronze itself).
- **Scorer expectation, not a design flaw:** hold-N-while-charged-per-unit-held is mildly
  completion-deterring (the optimal line ramps late), the one shape the race scorer reads worst.
  The split pools are the standing content-side fix; expect the planner number to undersell the
  mission and weigh the `prover` column accordingly at Balance.
- **Reserve knob**, not in the base design: a muster deadline (the rival host arrives at round R — a
  threat `defeat` hook). Add only if Balance finds turtling free; the upkeep drain should already
  price delay.
- **Reward — two grants**, the bronze military kit, split **standing vs. burst**:
  - **Sword** (building) — the standing infantry: staffed, ⚔️ per worker per round, tin-gated
    **continuously** — with no Tin Route standing it produces nothing that round (mothball, not
    play-block; the gate the TODO's continuous-gating note calls for). Sits above City Walls without
    invalidating it: Walls stay the workerless flat garrison, Sword scales with staffing.
  - **Chariot** (work box) — the elite troops: the War Horse successor, same shape with a better ⚔️
    rate per worker, cross-age progression paid for by its tin gate. Play-time gating suffices — a
    work box lives one turn, so play-time *is* continuous for it.
- **Seam to the capstone:** the continuous gate is what gives The Sea Peoples its teeth — the
  collapse cuts the tin and the standing army goes dark mid-run. The Sea Peoples' design therefore
  owes a route-removal/closure mechanism (the cancellation item in [`../TODO.md`](../TODO.md), or a
  threat that closes routes); nothing in *this* mission removes a route.
- **Lore seam:** the arms race read straight — every power on the board is casting bronze now, and
  the player's answer is the largest chariot host the world has seen. The dramatic irony is the
  capstone's to spring, not this node's to telegraph.

## Implement ✅ (shipped)

The `sword_chariot` mission (bronze col 12 row 0, prereqs `bronze`, 12⭐) seeding the `soldiers_wages`
threat over the `sword_chariot_goal` objective — no events, alone among the arc's late nodes; the
`sword` building and `chariot` work box as rewards. The goal is the plain declarative threshold over
`G.resources.military`, tied to the `victoryHint` by a shared `MUSTER_TARGET`. The threat is the
`overextension` shape read off a pool instead of a zone: one `soldiersWages` tally behind both the drain
and its readout, and no `defeat` hook — an unpayable payroll is the universal 🪙 collapse, which
`checkEndIf` reads after victory, so reaching the muster on the round the treasury empties still wins.

The tin gate now has one definition in two shapes: `tinRouteStands` is the bare predicate,
`needsTinRoute` the play-time `CardCost.check` wrapping it (still exported for the Bronze Tools
charge-back). Chariot takes the check, where a one-turn box makes play-time gating continuous by
itself. Sword takes the predicate on the *production* side — its `produces` is all closure, so it
mothballs by returning early and owns the per-worker scaling `resolveProduction` applies only to a
declarative bundle, reading `producingUnits` off `findStaffable` exactly as that function does. The
consequence to carry forward: a resolve-only `produces` is invisible to `race.ts`'s plan scan and
`enablers.ts`, both of which walk `produces.resources` (the standing Wharf/Merchant Ship limitation).
It does not touch *this* node's cells — the Sword is this mission's reward, so no deck here holds one —
but any downstream cell decking the Sword (The Sea Peoples first) inherits it: the policies cannot see
the card's ⚔️ output and may never build it.

## Balance ✅

**Shipped at muster 40 · Soldiers' Wages −1🪙 per 5⚔️ above the free 10.** All three reachable boards
were hand-piloted to comfortable-but-challenging wins on this exact form, and that reading — not the
policy columns — is the reachability verdict here (why below). The target was picked off a planner
ladder over 30–50 on the Warband cell: every trend monotone (win 76→52%, bankruptcy's defeat share
37→77%, win median 26.5→62.5 turns) with famine dead flat, so the pressure is specifically monetary;
40 sits at the solvency elbow — winners' end-🪙 p25 crosses zero there — where 45–50 turn the mission
into a race the *median* winner finishes insolvent.

Two cross-cutting content changes are this pass's:

- **Convoy rework** — the +2🔨 open surcharge became a standing **−1🪙/round** on the stickered
  route's upkeep (escort wages, charged in the pool the mission squeezes). This, not the target, is
  what engaged the bronze economy: the target ladder saturated tin/Marketplace engagement at N=35,
  while the rent tripled tin opens and doubled Marketplace under identical targets. On its own board
  it is win-rate-neutral for the planner and trades ~20 stalls for ~19 bankruptcies — it steers, it
  doesn't execute.
- **Merchant Ship +1 → +2🪙 per open route** — at +1 it never outbid a flat Trader.

Fixtures ×3 — one per reachable board, each on its hand-piloted winning deck; `sword_chariot_port`
is the standing set's first fixture carrying board stickers (2× Opulence):

| | greedy @100 | planner @100 | prover @10 |
|---|---|---|---|
| Warband (45 cards, conquest-fed, 2 double-Convoy routes) | 19% | 54% (win med 66) | 4/10 |
| City (37 cards, Road-bought land, Convoyed Bartering) | 0% | 0% | 0/10 |
| Port (34 cards + 2× Opulence, Merchant Ships) | 0% | 2% | 0/10 |

**The settled boards' near-zero columns are a fidelity artifact, not a rating** — the route-opening
blind spot ([`../TODO.md`](../TODO.md) → *Simulator · Fidelity*, the `setting_sail`/`sea_lanes`
delivery items; the `bronze_port` precedent). Both cells were hand-won on these decks; the policies
open routes in ≤16% of runs, every winning line (human and the prover's earlier Port wins alike)
stands on routes, and 0 of 210 recorded City runs even reached 40⚔️ — a ceiling reading, not a
difficulty one. Port's prover fell 3/10 → 0/10 across a deck revision that improved every other axis
(31→34 cards widening the branching), filed with the same items. Warband, whose deck musters without
depending on the sea, is the one cell the policies rate truly.

What the pass settled about the cards:

- **City Walls is out of every deck** — +1⚔️/round for 3🔨 *and* a land slot no longer competes at
  this stage. The Sword reward is its standing-⚔️ successor, so the fade is cross-age progression
  working — but it kills the Design section's "Walls-led City muster" leg: City musters on War
  Horses + Bows + a Convoyed Bartering like everyone else, and the three-route story is really
  Warband-vs-Port plus a shared work-card spine.
- **A double-Convoyed Coastal Route is too expensive anywhere settled** (3🪙 open + 2🪙 rent + 2🪙
  escort): both settled decks dropped the escorts or the route; only Warband's spoils economy keeps
  the pair and pays.
- **Warband's opening is a knife by design**: 8⚔️ start + one War Horse = 11⚔️ = 1🪙 of wages against
  a 0🪙 treasury — 18/100 greedy runs die by turn 3. Kept: the free-10 floor *is* the grace period,
  and the board's native line banks a Trader first.
- **The reserve deadline knob is not needed** — the wage drain prices delay (no hand pilot turtled,
  and stalls on the one truly-rated cell stayed modest).

Measurement debt cleared: the **Warband board** (first real rating — 54% planner on a conquest-fed
building deck, ending the "degenerate cell" reading), **Convoy** (both forms), **Merchant Ship**
(first rating — 104 plays/100 in Port's planner runs, zero dead cards in that deck), **Marketplace**
and **Bronze Tools** (load-bearing in all three decks). The **Wheel sticker** remains unmeasured.

## Polish ⬜

Not started — card text, art, lore.
