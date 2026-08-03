# Raiding — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ (form converged; numbers provisional) · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the **military** branch's closing node ([Horse taming](horse-taming.md) → Raiding).
Prereq **horse-taming**; the branch converges into **Bronze**.
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Identity (agreed)

The **payoff** of the arc's plunder line: you now field the **War Horse** (a staffed ⚔️ work box, 3⚔️
per play) and the **Raiding** action (single-use, 3⚔️ → 4🌾+4🔨) unlocked by
[Horse taming](horse-taming.md), and turn martial power into plunder.

⚠️ **The 🪙 half of this mission's design is now unmoored.** *Goal + pressure* below rests on money
being what a raid pays — the retaliation drain and the plunder burst were both authored against the
card's old ⚔️→🪙 shape. The card no longer touches money, so the mission's own 🪙 burst is either the
one place plunder is still paid in coin, or it re-points onto 🌾+🔨 like the card. **Undecided** — it is
the first thing to settle when this mission reaches Design.

## Agreed (settled at design)

- **Reward — Chiefdom → Warband** `boardUpgrade` (retires Chiefdom, like Settlement→City on the settled
  line): a **military + money** government keeping Chiefdom's **low-territory / high-population** shape.
  Name **Warband** is locked. **Blocked on a Chiefdom rebalance first** — Warband's numbers derive from a
  re-tuned Chiefdom (a balance-stage task, not a design blocker). ✅ **Unblocked:** Chiefdom is now
  measured and settled at pop 3 / terr **1** / 8🌾, with its one slot spent on the pre-built **War
  Camp** (each territory taken brings one more) — so Warband has a real board to derive from, and with
  **no free slot** its shortage is specifically a *building* shortage (three pairs of hands, none of
  them working *in a building* until the board takes land). What Warband inherits is that pair: a
  landless start and a reason to expand out of it. The axis is the one
  [`DESIGN.md`](../DESIGN.md) → *Government boards* names as a board's persistent identity.

## Goal + pressure ✅ (converged; numbers provisional)

**Money is the reward, never the goal.** The player already owns cheap, repeatable money faucets
(Trader +3🪙 per play, Bead Workshop +1🪙 per worker per round, plus whatever Naval adds), so any "hold N 🪙" win check is
solvable without raiding *or* fielding military — the raiding loop would be optional flavour. So the
win condition is the raiding **act** (proven un-shortcuttable by a money pile), and plunder is the
**payoff** for it — which is also truer to the identity ("turn martial power into plunder").

The tension is a **race, not a resource split**: ⚔️ has exactly *one* job (crack fortifications), the
retaliation is a *money* drain, and delay hurts on both fronts, both saying *raid faster*.

- **Goal:** sack all **N seeded raid-target `event` cards** (N provisional). **Sacking** = *play* it,
  paying its crack-cost in **⚔️** → exiled to `removed`, which the goal counts (the Copper/Roads/Horse
  seeded-completion pattern). Money can't tick the goal — only the raid act does.
- **Fortification escalation (per-pass-up):** each target carries its **own per-instance counter**
  (`CardInstance.counters`). Every end-of-turn it sits **unplayed in hand**, its upkeep fires and
  **bumps its counter → its ⚔️ crack-cost rises** ("the fortifications reinforce"). Escalation is
  per-target and self-inflicted by passing *that* card up — deliberately **not** read off the removed
  pile (that per-already-removed shape reads too close to Horse taming's Tamed-Horses threat). Clean
  consequence: a target's cost only grows on a turn the player actually *held it and chose not to crack
  it*.
- **Retaliation upkeep (money):** the same unplayed-in-hand upkeep drains **🪙** — money, not
  population (pop loss is far too punishing at current tuning). "Hits harder the more remain" falls out
  for free: three uncracked targets fire three money upkeeps; no separate scaling term.
- **Plunder = reward, not goal:** cracking a target hands a **🪙 burst** (the predatory-faucet identity,
  realized as the payoff), but money never touches the win check.

**Distinct from Horse taming** (its sibling on this branch, same seeded-completion skeleton) on two
axes, both of which *are* the aggressive-twin flavour: targets are **fortified** (a rising ⚔️ threshold
to out-muscle, not a flat cost paid when affordable) and **active aggressors** (they raid *you* each
round they stand), so the pressure curve **shrinks as you win** (external siege you dismantle) rather
than Horse taming's self-inflicted food drain that **grows as you win**. Opposite emotional curve.

## Implement ⬜ — warnings recorded at design

1. ~~**Escalating crack-cost is likely a small new mechanic.**~~ ✅ **The mechanism already exists** —
   `rules/cost.ts`'s `CardCost.resolve` (built for Conquest's doubling price on the `trade-redesign`
   rebalance). A target authors `cost: { resources: {...}, resolve: ({ self }, base) => ... }` reading its
   own `counters`; the gate, the payment and the card face all price through `currentCost`. Note the
   *resolve returns a cost, it never pays one* rule: the fortification threshold must stay expressible in
   declarative fields, or `unplayableReason` can't say what's missing and the face can't render it.

## Balance ⬜ — watch items recorded at design

1. **Runaway / softlock spiral.** If a target fortifies faster than the thin ⚔️ economy (City Walls /
   Bow / Hunting / Conquest / War Horse) can catch up, it can climb out of reach *while* its money upkeep
   bleeds — an unrecoverable death spiral. Decide at balance whether the counter needs a **hard cap**, a
   gentle increment, or just a careful sweep. Compounds with the Horse-taming watch note that the
   in-mission ⚔️ economy is thin.
2. **The knife-edge: ⚔️-crack-cost + escalation rate vs. ⚔️-economy growth.** As with Horse taming,
   difficulty rides on how fast the player *can* raise ⚔️ relative to how fast costs escalate and money
   drains. Needs an especially careful sweep.

## Polish ⬜

Not started.
