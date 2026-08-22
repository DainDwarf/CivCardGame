# CivCardGame — 0.1 Publish Plan

> The **execution plan for shipping 0.1**, the final scope cut (decided 2026-08-17): finish Bronze
> under a time-box, keep everything else as it stands, polish, publish. Like
> [`TODO.md`](TODO.md)/[`BACKLOG.md`](BACKLOG.md) this is a **transient** scratchpad — the decided
> scope lives in [`DESIGN.md`](DESIGN.md) → *Demo scope*, and when 0.1 ships this file collapses
> into [`CHANGELOG.md`](../CHANGELOG.md) entries and is deleted.

## The cut

0.1 is this project's **last planned version**: the goal is a *publishable* build to show off and
gather feedback on, not a perfect one — the lessons feed a successor game designed from scratch.
Relative to the old demo scope, the cuts:

- **Iron Age** — cut entirely. The campaign ends at the Bronze collapse, which already reads as an
  ending.
- **Culture rework** — cancelled; the gauge ships **as-is**, jank accepted. **Hammurabi's Code** is
  cut with it — the leaf was held back as the rework's vehicle, and with no rework there is nothing
  for it to carry.
- **Endless rework** — cancelled; `ice_age`/`sandbox` keep their current shape, receiving only the
  small polish pass in step 2.
- **Tutorial layer** — cut. Onboarding is the in-game Codex plus a how-to-play blurb on the itch
  page.
- **Meta economy retune** — cut; at most a sanity glance over `npm run economy`'s ledger.

**0.1 ends pre-alpha:** from 0.1 on, a changed store shape owes a save migration. This being the
last version, the obligation likely never fires — but the boundary is future-proof either way.

## Steps

### 1 — Finish Bronze *(time-boxed: this week, closes Sunday 2026-08-23)*

Author in order, each through Design → Implement → Balance (dossier + baseline fixture per the
normal pipeline):

1. **Setting Sail** — close the open balance pass.
2. **Sea Lanes**
3. **Bronze** (convergence)
4. **Sword & chariot**
5. **The Sea Peoples** (capstone)
6. **Fall of the Bronze Age** (infinite)

**The time-box is the scope.** When the week closes, whatever is unbuilt is cut and the arc ends at
the last balanced node — the order above runs trunk-first, so any prefix leaves a coherent arc. (If
the infinite is the casualty, The Sea Peoples' reward simply drops the unlock.)

### 2 — Transversal fixes

- ~~**Defeat on population ≤ 0**~~ ✅ — 0🧍 is the `extinction` collapse, checked beside the core pools.
- **Endless small polish** — a look at `ice_age`/`sandbox` with 0.1 eyes: rough edges only, no
  redesign. ~~One named item: **re-score `ice_age`** off the objective-card `score` seam — its
  rounds-survived payout is a no-brain "launch, skip every turn, collect ⭐" grind, which defeats the
  purpose of a scored survival mission.~~ ✅ — it pays 1⭐ per ❄️ cold snap endured, on the Fall of
  the Bronze Age mechanism: the Long Winter spawns snaps, you burn 🔨 to answer each or it burns 🌾.

### 3 — Polish

- **Victory/gameover screens + the hand-back-to-meta flow** (TODO → *UI*) — the strong item: every
  session ends on it, and a 0.1 run should end by showing what it earned.
- **Per-mission Polish stage** — card text, art, lore across Stone + Bronze (the ⬜ column in
  BACKLOG's status boards). A light pass: readable and consistent beats exhaustive.

### 4 — Publish surface

- **itch.io page** — description, screenshots, the how-to-play blurb; desktop-only and mouse-only
  stated plainly on the page.
- **Feedback funnel** — itch comments at minimum; Discord/GitHub/contact links as wanted.
- **Version bump to 0.1** — CHANGELOG cut from the dossiers + TODO's *Done / shipped*; this file
  deleted.

### 5 — Release + feedback round

Publish, hand it to friends and the close community, collect. What comes back lands as 0.1.x
patches, not new scope.
