# Horse taming — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ (form converged; numbers provisional) · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the **military** branch's first node (Horse taming → [Raiding](raiding.md)), a `×2`
branch parallel to Wheel+roads (expansion) and Naval (trade). Prereq **Writing**; the branch converges
into **Bronze**.
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Identity (agreed)

Opens the arc's **predatory money faucet** (military → money by raiding — Naval's aggressive twin, both
feeding the tin-money sink). Bonus: thickens the thin ⚔️ economy — the **War Horse** reward is the first
recurring ⚔️ producer from a work box (alongside City Walls, Bow, Dogs, Conquest). Theme: Bronze-Age
steppe (Yamnaya / Sintashta); horses as war-mounts, **no mounted cavalry** (Iron Age).

## Agreed (settled at design)

- **Reward — War Horse:** a **work card**, staffed → **+⚔️/round** (numbers TBD).
- **Reward — Raiding:** an **action**, spend **⚔️ → gain 🪙** (numbers TBD).

## Goal + pressure ✅ (converged; numbers provisional)

The **goal is its own pressure**: every horse you tame is +1 toward the win *and* +1 permanent food
mouth. Capture with military, then sustain with food — a horse costs you across two resources over its
whole life, and the last horse is tamed under the heaviest drain (the Wheel "heaviest pressure at the
final push" shape, here emergent from the goal rather than a parallel threat).

- **Goal:** tame all **N Wild Horse** cards (N provisional). Each is a seeded `event`; **taming** = *play*
  it, paying its **big ⚔️** cost → exiled to `removed`, which the goal counts (the Copper/Roads seeded-
  completion pattern).
- **Let-pass cost:** a Wild Horse left *unplayed* in hand fires its `upkeep` (a small **prod** drain) and
  recurs — the existing unplayed-event mechanic *is* the "few to let it pass" cost, no separate
  mechanism. This is the counter-pressure against turtling (see watch item 1 below).
- **Pressure — the "Tamed Horses" threat:** drains **−X 🌾 per round**, where **X = the number of
  already-tamed horses** (Wild Horse copies in `removed`) — reads the pile the way Wheel reads
  territory. The more you've tamed, the more mouths to feed.
- **No time pressure, by design (for now).** No deadline / driven defeat: the mission is deliberately the
  arc's *relaxed* one — fits the taming theme, and varied pacing across missions is good for player
  engagement. Revisit only if balance + feel-play show it needs re-drawing.

**Implementable as-is with existing mechanics** — event play-cost + unplayed-event upkeep + a threat
whose upkeep counts a pile. No new verbs.

## Balance ⬜ — watch items (recorded at design)

1. **Urgency to tame promptly.** Without the let-pass prod drain, the optimal line is to turtle (tame one,
   grow the Farm economy for many turns until X-food is affordable, tame the next — never letting X outrun
   food income), which is a tensionless grind. The unplayed-event prod upkeep is what forbids it; keep it
   unless feel-play says otherwise.
2. **The knife-edge: ⚔️-tame-cost vs. food-economy growth.** Difficulty rides entirely on how fast the
   player *can* tame (gated by the thin incoming ⚔️ economy — City Walls / Bow / Dogs / Conquest) relative
   to how fast the X-food drain grows. Too-cheap taming → tame fast and starve; too-expensive → the food
   drain never bites. Needs an especially careful sweep. (Reward cards War Horse / Raiding are **not**
   available in-mission — granted on clear — so the goal must be reachable on the owned thin ⚔️ economy.)

## Implement ⬜ / Polish ⬜

Not started.
