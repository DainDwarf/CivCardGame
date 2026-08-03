# Raiding — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ (provisional numbers, unswept) · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the **military** branch's closing node ([Horse taming](horse-taming.md) → Raiding).
Prereq **horse-taming**; the branch converges into **Bronze**. Placed bronze col 10 row 0 (parallel to
Wheel at col 10 row −1).
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Identity (agreed)

The **payoff** of the arc's plunder line: you now field the **War Horse** (a staffed ⚔️ work box, 3⚔️
per play) and the **Raiding** action (single-use, 3⚔️ → 4🌾+4🔨) unlocked by
[Horse taming](horse-taming.md), and turn martial power into plunder.

## Agreed (settled at design)

- **Plunder is paid in 🪙 here**, even though the Raiding *card* was re-pointed onto 🌾+🔨 — this is the
  one place plunder is still coin. The retaliation drains the same pool the sack refills, so the race is
  legible in one currency.
- **The 🪙 drain clears the arc's sequencing rule.** [`../BACKLOG.md`](../BACKLOG.md) forbids draining a
  resource the player isn't guaranteed to *produce* on **every** prereq chain reaching the mission (what
  got `unrest` deleted). Raiding's chain is linear back to **Accounting**, which grants **Trader** (free
  work box, +3🪙/play); further back **Raiders at the Border** is mandatory too (`rites_rituals` needs
  both branch tips, and `first_trades` needs it), granting **Bead Workshop** (+1🪙/worker/round). Two
  repeatable faucets, both guaranteed — checked, not assumed.
- **Reward — Chiefdom → Warband** `boardUpgrade` (retires Chiefdom, like Settlement→City on the settled
  line): a **military + money** government keeping Chiefdom's **low-territory / high-population** shape.
  Chiefdom is measured and settled at pop 3 / terr **1** / 8🌾, its one slot spent on a pre-built camp
  (each territory taken pays +4🌾) — so Warband derives from a real board, and with **no free slot** its
  shortage is specifically a *building* shortage. What Warband inherits is that pair: a landless start
  and a reason to expand out of it. The axis is the one [`DESIGN.md`](../DESIGN.md) → *Government boards*
  names as a board's persistent identity.

## Goal + pressure ✅

**Money is the reward, never the goal.** The player already owns cheap, repeatable money faucets
(Trader +3🪙 per play, Bead Workshop +1🪙 per worker per round, plus whatever Naval adds), so any "hold N 🪙" win check is
solvable without raiding *or* fielding military — the raiding loop would be optional flavour. So the
win condition is the raiding **act** (proven un-shortcuttable by a money pile), and plunder is the
**payoff** for it — which is also truer to the identity ("turn martial power into plunder").

The tension is a **race, not a resource split**: ⚔️ has exactly *one* job (crack fortifications), the
retaliation is a *money* drain, and delay hurts on both fronts, both saying *raid faster*.

- **Goal:** sack all **N seeded `stronghold` `event` cards**. **Sacking** = *play* it, paying its
  crack-cost in **⚔️** → exiled to `removed`, which the goal counts (the Copper/Roads/Horse
  seeded-completion pattern). Money can't tick the goal — only the raid act does.
- **Fortification escalation (per-pass-up):** each stronghold carries its **own per-instance counter**
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

## Implement ✅ (shipped, unswept)

Seeded `stronghold` events sacking to `removed`; no threat card — the strongholds are the whole
pressure, and each one's single `upkeep` does both halves of it. No new engine verbs: the escalating
price is `rules/cost.ts`'s `CardCost.resolve` (the seam Conquest's doubling price is built on), reading
the copy's own `walls` counter, so the gate, the payment and the card face all price through
`currentCost` and the threshold stays in declarative fields.

- **Numbers (all provisional):** **4** strongholds · **8⚔️** base crack cost, **+2⚔️** per round held
  unplayed · **−2🪙** retaliation per round held · **+6🪙** plunder per sack.
- **Reward:** the **Warband** board (`chiefdom` → `warband` `boardUpgrade`), plus 12⭐. No card unlock —
  the government *is* the reward.
- **Warband:** 12🌾 · 2🔨 · 8⚔️ · 0🪙 · pop **4** · terr **1** · pre-built **War Camp** (each 🗺️ taken
  pays +8🌾 +2🪙). Chiefdom's shape, sharpened: a fourth pair of hands with the same single slot still
  spoken for, so the shortage stays a *building* shortage. The money identity lives in the camp's
  standing rule, not in a starting pool — [`DESIGN.md`](../DESIGN.md) is explicit that a board differing
  only in spendable pools reads as a head start rather than a different civilization.
  **The pop bump costs more than it reads:** `foodUpkeep` is `floor(pop²/4)`, so pop 3→4 raises the
  round tax from 2🌾 to 4🌾 — a *doubling*, not a third. 12🌾 is three eating turns at pop 4 against
  Chiefdom's four at pop 3, so Warband opens on a **shorter** food runway, and the camp's +8🌾 per
  territory (double Chiefdom's rate) is what has to close that gap. Whether it does is the balance pass's
  first question.
- **Chiefdom's camp was renamed Raider Camp**, freeing "War Camp" for Warband's. Card id `war_camp` now
  names the *new* card, so a stale reference resolves silently — all three call sites were re-pointed,
  and the chiefdom fixtures name the board (not the card), so their rows are unaffected.
- No `defeat` hook: like Horse taming and Wheel, the drain runs the pool down to the universal collapse
  (bankruptcy here), and `checkEndIf` checks victory **before** collapse, so sacking the last stronghold
  on the bankruptcy turn still wins.
- **Tests:** none new. The seeded-completion goal, the played/unplayed event split, the per-instance
  counter and the `CardCost.resolve` price are each already covered. `sim/zoneOrderInvariance.test.ts`
  was considered and **deliberately** left alone: the stronghold's upkeep reads and writes only its *own*
  counters and a scalar pool, so unlike Horse taming's threat (which read a filtered count of `removed`
  while a self-exiling card mutated that zone in the same batch) it introduces no cross-sibling read.

## Balance ⬜ — watch items

1. **Runaway / softlock spiral.** If a stronghold fortifies faster than the ⚔️ economy (City Walls /
   Bow / Hunting / Conquest / War Horse) can catch up, it can climb out of reach *while* its money upkeep
   bleeds — an unrecoverable death spiral. Deliberately shipped with **no cap** on `walls`: capping it
   before the sweep would hide the failure mode. Decide then whether it needs a hard cap, a gentler
   increment, or nothing.
2. **The knife-edge: ⚔️-crack-cost + escalation rate vs. ⚔️-economy growth.** As with Horse taming,
   difficulty rides on how fast the player *can* raise ⚔️ relative to how fast costs escalate and money
   drains. Needs an especially careful sweep. Note escalation is diluted by deck size — a stronghold only
   hardens on a turn it is *held at end of turn*, then files to discard and recurs, so it ticks roughly
   once per deck cycle.
3. **The 🪙 half may be inert at these numbers — check it first.** A stronghold drains only on a turn it
   is *held at end of turn*, and the hand recycles each round, so with 4 targets in a ~29-card deck at
   ~5 drawn per turn each one surfaces roughly every 6 turns — ~4 ticks over a 25-turn run. That is
   ~8🪙 drained per uncracked stronghold (≤32🪙 across all four) against 24🪙 of plunder for sacking
   them, and against a **Trader** alone paying 3🪙 per play — well over 100🪙 across the same run. On
   that arithmetic bankruptcy cannot fire, plunder more than refunds the retaliation, and the only live
   pressure is the ⚔️ escalation. If the sweep confirms it, the lever is to make the retaliation
   *escalate too* (drain scaled by the same `walls` counter) rather than to raise a flat −2🪙 — or the
   answer is that retaliation doesn't belong on money at all, which is the question this mission opened
   with.
4. **Warband inherits Chiefdom's measurement debt.** [`../BACKLOG.md`](../BACKLOG.md) records that the
   ten `<mission>_chiefdom` cells "rate the pairing, not the board" until a **Chiefdom-native deck**
   exists. None does, so Warband's cells won't be readable either until one is built — a prerequisite of
   this mission's balance pass, not a finding of it.
5. **`sim/enablers.ts` prices the crack cost at its declarative floor (8⚔️)** — the deliberate
   static-derivation-over-`CARDS` exception CLAUDE.md names, since there is no instance to price against.
   Expected, not a bug: the sim's leaf heuristic under-rates a fortified stronghold, the real gate does not.

## Polish ⬜

Not started — card text, art (🏰 / ⛺ provisional), lore.

- **Name collision:** the previous mission's reward card is *Raiding* and so is this mission. A card and
  a mission sharing a name is a readability smell; rename one at Polish.
