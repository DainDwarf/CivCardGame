# Sea Lanes — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design 🟡 · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the closing node of the **naval / trade** branch
([Setting Sail](setting-sail.md) → Sea Lanes). Prereq **setting_sail**; the branch converges into
**Bronze**.
**Placement:** bronze col 10 row +1 — parallel to [Wheel](wheel.md) (col 10 row −1) and
[Raiding](raiding.md) (col 10 row 0).
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Identity (agreed)

The **payoff** of the branch: you hold the ships and the Coastal Route that
[Setting Sail](setting-sail.md) granted, and now run enough of them **at once** to reach the tin
islands. Where the opening node was one voyage after another, this one is the standing network — and
the branch identity ([Setting Sail](setting-sail.md) → *Branch identity*) lands hardest here, because
the goal is made entirely of the zone that takes no land and no workers.

## Goal (agreed)

**Hold X trade routes open at once** — `first_trades`' single-route term at Bronze scale, and the first
goal in the game measured in routes rather than pools. **X is provisional at 3.**

**Nothing closes a route**, so every step toward the goal is irreversible: the win condition *is* a
commitment, and the rent it takes on is permanent. Reachable only because the branch's first node
granted the zone's second card.

## Pressure (agreed)

**The navy, not the pirates.** A threat draining **−1⚔️ per open trade route** each round: the sea lanes
have to be patrolled for as long as they run.

- **Progress and pressure are the same act.** Each route is a goal tick *and* a standing military bill,
  so the last route is the one that can break you — the grows-as-you-win curve, in a currency neither
  sibling branch's closing node uses ([Raiding](raiding.md) drains 🪙 *shrinking* as you win;
  [Wheel](wheel.md) drains 🔨 per territory past a grace).
- **Routes take no workers; defending them does.** The sea is free and the navy is not — which is what
  makes a zone with no worker cost cost workers anyway, and is the whole reason the pressure is ⚔️
  rather than more 🪙 on top of the rent.
- **Deliberately not Accounting's shape.** [Accounting](accounting.md) already breeds `thief` events
  that are paid off in ⚔️; a second breed-and-catch mission inside one age would be a re-skin. A flat
  per-route drain needs no event cards at all.
- **Sequencing rule checked, not assumed.** [`../BACKLOG.md`](../BACKLOG.md) forbids draining a resource
  the player isn't guaranteed to *produce* on every prereq chain. ⚔️ clears it by **ownership** rather
  than by unlock: **Hunting** (work, 1⚔️ per worker per round) and **Bow** (single-use, 2🔨 → 3⚔️) are
  both in `STARTING_COLLECTION`. War Horse is the *military* branch's grant and cannot be assumed here,
  so the drain has to be priced against Hunting's rate.
- **No `defeat` hook.** ⚔️ going negative is the universal core collapse, and `checkEndIf` checks
  victory before collapse — so opening the last route on the collapsing turn still wins.

## Reward (agreed)

Three grants — the branch's deliverable to the Bronze convergence, its engine card, and its sticker.

### Tin Route (`trade`) — standing access, no yield

Costs 🪙 to open, pays a 🪙 **rent** every round, and **produces nothing**. What it buys is the right to
play the Bronze cards downstream: they gate on a standing tin route.

- **Mechanism:** `rules/cost.ts`'s `CardCost.check` — the existing bespoke-precondition seam (a peek
  card needing a non-empty pile) — on the *gated* cards. No engine verb, and `costReason` reports the
  missing route the same way it reports a missing resource.
- Nothing removes a route, so the gate is **opened once and taxed forever**: an unpayable rent collapses
  the treasury into bankruptcy. This is [`DESIGN.md`](../DESIGN.md)'s "money buys standing access, not
  raw materials" in its purest form — the first card in the game whose entire output is permission.

### Merchant Ship (`work`)

Must not be **Trader** repainted (free to play, 1 worker, +3🪙) — a strictly-equal card is dead on
arrival. The agreed differentiating axis: it pays **per open trade route**, so it is worthless in an
empty zone and the deck's best card in a full one, and the branch's goal is its own engine.

**Open:** resolve against the **Port** board's prebuilt ([Setting Sail](setting-sail.md)), which is also
a per-route payer — the two must differ in currency or in kind.

### A trade sticker

Applies to `kind: 'trade'` cards. [`DESIGN.md`](../DESIGN.md) requires every sticker to be a
**trade-off, not an upgrade** — it must charge in one currency for what it gives in another (a cheaper
rent bought with a costlier opening, say). Undecided.

## Open

- **X**, the route count the goal asks for (provisional 3).
- The **drain rate** per route (provisional −1⚔️), against Hunting's 1⚔️ per worker per round. **It
  cannot be settled independently of the Port board's population**: at 1⚔️ per route per round, holding
  X routes parks X workers on Hunting just to break even, and the Port board
  ([Setting Sail](setting-sail.md)) is deliberately short of workers — yet this is the first mission it
  can be played on. The board's limitation and this mission's pressure are the same constraint pulling
  opposite ways; a rate that works on City may make the branch's own reward board unwinnable.
- The per-route **currency split** between Merchant Ship and the Port board's prebuilt — half-settled:
  the Wharf pays **🎭**, so the Ship has the money side of the split if it wants it.
- **The Port board's own balance pass lands here.** It ships with [Setting Sail](setting-sail.md) at
  provisional numbers (10🌾 · 6🪙 · **1🧍** · 3🗺️, prebuilt Wharf at +1🎭 per route) and this is the first
  mission that can be played on it, so it is this pass that has to rate it — and it can't be rated apart
  from the drain above, since one citizen against a per-route ⚔️ bill is the same constraint pulled from
  both ends. A cell per board, the way the Chiefdom counterparts are fixtured.

## Seam to Bronze

This node is what the convergence's lore turns on — the tin routes exist because the trade branches
built them. [`../BACKLOG.md`](../BACKLOG.md) still proposes Bronzeworking as a building converting
🪙 → 🔨, which was written when the tin route was expected to *pay* the metal. It doesn't: it pays
nothing and gates instead, so the conversion is Bronzeworking's whole job and the two no longer
overlap — worth re-reading that proposal when Bronze is authored rather than inheriting it.

## Implement ⬜

Not started.

## Balance ⬜

Not started.

## Polish ⬜

Not started — card text, art, lore.

- **Name:** *Sea Lanes* is provisional (*The Tin Islands* is the alternative). Deliberately **not**
  named for its reward card: [Raiding](raiding.md) already carries a mission and a card sharing a name,
  and that readability smell is one to fix, not to repeat.
