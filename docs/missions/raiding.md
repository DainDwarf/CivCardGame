# Raiding — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ (form converged; numbers provisional) · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the **military** branch's closing node ([Horse taming](horse-taming.md) → Raiding).
Prereq **horse-taming**; the branch converges into **Bronze**.
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Identity (agreed)

The **payoff** of the arc's predatory money faucet: you now field the **War Horse** (⚔️/round) and the
**Raiding** action (⚔️ → 🪙) unlocked by [Horse taming](horse-taming.md), and turn martial power into
plunder.

## Agreed (settled at design)

- **Reward — Chiefdom → Warband** `boardUpgrade` (retires Chiefdom, like Settlement→City on the settled
  line): a **military + money** government keeping Chiefdom's **low-territory / high-population** shape.
  Name **Warband** is locked. **Blocked on a Chiefdom rebalance first** — Warband's numbers derive from a
  re-tuned Chiefdom (a balance-stage task, not a design blocker).

## Goal + pressure ✅ (converged; numbers provisional)

**Money is the reward, never the goal.** The player already owns cheap, repeatable money faucets
(Trader +3🪙/round, Jewelry 1🔨→2🪙, plus whatever Naval adds), so any "hold N 🪙" win check is
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

1. **Escalating crack-cost is likely a small new mechanic.** Every seeded-completion mission to date
   (Copper/Roads/Horse) uses a **static** `cost`. A cost that reads a per-instance counter needs the
   play-gate to compute cost dynamically — probably a `resolve`-side check rather than the declarative
   `cost` field. This is the **first non-fixed cost**; design it on the resolver spine, don't special-
   case the move.

## Balance ⬜ — watch items recorded at design

1. **Runaway / softlock spiral.** If a target fortifies faster than the thin ⚔️ economy (City Walls /
   Bow / Dogs / Conquest / War Horse) can catch up, it can climb out of reach *while* its money upkeep
   bleeds — an unrecoverable death spiral. Decide at balance whether the counter needs a **hard cap**, a
   gentle increment, or just a careful sweep. Compounds with the Horse-taming watch note that the
   in-mission ⚔️ economy is thin.
2. **The knife-edge: ⚔️-crack-cost + escalation rate vs. ⚔️-economy growth.** As with Horse taming,
   difficulty rides on how fast the player *can* raise ⚔️ relative to how fast costs escalate and money
   drains. Needs an especially careful sweep.

## Polish ⬜

Not started.
