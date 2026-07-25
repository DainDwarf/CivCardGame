# Horse taming — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the **military** branch's first node (Horse taming → [Raiding](raiding.md)), a `×2`
branch parallel to Wheel+roads (expansion) and Naval (trade). Prereq **Writing**; the branch converges
into **Bronze**.
**Placement:** `prereqs: ['writing']`, bronze col 8 row 0 (parallel to Roads at col 8 row −1).
**Reward influence:** 12 (provisional — matches the standard Bronze nodes).

## Identity (agreed)

Opens the arc's **predatory money faucet** (military → money by raiding — Naval's aggressive twin, both
feeding the tin-money sink). Bonus: thickens the thin ⚔️ economy — the **War Horse** reward is the first
recurring ⚔️ producer from a work box (alongside City Walls, Bow, Dogs, Conquest). Theme: Bronze-Age
steppe (Yamnaya / Sintashta); horses as war-mounts, **no mounted cavalry** (Iron Age).

## Agreed (settled at design)

- **Reward — War Horse:** a **work card**, staffed → **+⚔️/round**. Free to play (the Foraging/Trader
  shape), so the worker it occupies is its whole cost — the rate has to beat **Dogs** (1🌾 → 2⚔️, *no*
  worker) or nobody would ever spend a worker on it.
- **Reward — Raiding:** an **action**, spend **⚔️ → gain 🪙**.

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

## Implement ✅ (shipped)

Seeded `wild_horse` events taming to `removed`; a `tamed_horses` threat scaling its 🌾 drain off that
same pile. No new engine verbs — event play-cost, unplayed-event upkeep, and a counting threat upkeep,
all on the existing spine.

- **Numbers (provisional):** 5 horses · **6⚔️** to tame each · **−1🔨** per untamed horse held at end of
  round · **−1🌾 per already-tamed horse** each round.
- **Reward cards:** War Horse (work, free, 1 worker → **+4⚔️/round**) and Raiding (action, **3⚔️ → 6🪙**).
  Neither is available *in* mission — both are granted on clear — so the goal must be reachable on the
  owned ⚔️ economy alone.
- No `defeat` hook: like Wheel, the drain runs food down to the universal `'ruin'` collapse, and
  `checkEndIf` checks victory **before** collapse, so taming the last horse on the starvation turn still wins.
- **Tests:** none new for the content itself (seeded-completion, the played/unplayed event split and
  threat upkeep are all already covered). `sim/zoneOrderInvariance.test.ts` gained a synthetic pair for
  the shape the threat introduces: a threat reading a **filtered count of `removed`** while a
  self-exiling work card mutates that zone inside the same production batch — the existing fixture only
  covered a threat reading a scalar *pool*.

## Balance ⬜ — watch items

1. **Urgency to tame promptly.** Without the let-pass 🔨 drain, the optimal line is to turtle (tame one,
   grow the Farm economy for many turns until X-food is affordable, tame the next — never letting X outrun
   food income), which is a tensionless grind. The unplayed-event upkeep is what forbids it — but it is
   **weaker pressure than design assumed**: it fires only on a turn the copy is *held at end of turn*,
   then files to discard and recurs, so it costs ~1🔨 per horse per deck cycle, diluted by deck size. If
   the sweep shows turtling is still optimal, the levers are a per-instance escalating counter (the
   `clay_tablet` shape) or a soft deadline.
2. **The knife-edge: ⚔️-tame-cost vs. food-economy growth.** Difficulty rides entirely on how fast the
   player *can* tame relative to how fast the X-food drain grows. Too-cheap taming → tame fast and starve;
   too-expensive → the food drain never bites. The in-mission ⚔️ economy is genuinely thin: **City Walls**
   (+1⚔️/round for a tableau slot, 4🔨 and −1🔨/round upkeep) is the only *sustainable* faucet, **Dogs**
   the repeatable one, **Bow** a single-use burst — and **Conquest is a ⚔️ *sink*** (5⚔️ → territory), not
   a source, so it competes with taming for the same pool.
3. **The food double-bind.** Dogs buys its ⚔️ *with food*, and the mission's pressure *is* a food drain —
   so the harvest is squeezed from both ends: the currency that buys taming is the one the tamed herd
   eats. Thematically ideal, and probably the mission's real difficulty; the sweep should look for it
   specifically before any knob is turned.
4. **First levers, in order:** `WILD_HORSES` → the tame ⚔️ cost → the drain coefficient → the let-pass 🔨
   bleed. Peak sustained drain is `(N−1) × coefficient` (the Nth horse wins on the move), so at 5 × 1 the
   heaviest round is −4🌾; if that never bites, raise **N before the coefficient** — a longer ramp is the
   mission's shape, a steeper one is not. If War Horse sweeps as too strong, drop it to +3⚔️ or give it a
   1🌾 cost rather than cutting the worker cap, which would just flatten it back into Dogs' shape.
- **Sweep on:** `scripts/sim/baselines/horse_taming.json`.

## Polish ⬜

Not started — card text, art (🐎 / 🐴 / 🏇 / 🔥 are provisional), lore.
