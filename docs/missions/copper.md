# Finding Copper — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the age's opening mission.
**Placement:** `prereqs: ['first_temple']`, bronze col 5.
**Reward influence:** standard Bronze node.

## Design ✅ (converged)

- **Goal:** mine all 3 copper-vein events (2🔨+5🔬 each, played → `removed`).
- **Pressure:** the **Failing Stone Tools** threat — −1🔨 per round per worker staffed *in a building*;
  work cards exempt.
- **Reward:** unlocks the **Forge** (building, 4🔨, 2🔨/worker — deliberately obsoletes Toolmaking).

## Implement ✅ (shipped)

Threat drain counts workers staffed in buildings only, so a works-only deck sidesteps it (intended —
see Balance).

## Balance ✅ (settled)

Confirmed by simulation + hand-play. The works-are-exempt trade (a works-only deck can dodge the
drain) is **intended, not a leak**.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
