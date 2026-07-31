# Code review — `trade-redesign`

Untracked working file. 8 finder angles over `main...trade-redesign` (116 files,
+5206/−2653), deduped to 16 candidates, each put through one recall-biased verifier:
**12 CONFIRMED · 4 PLAUSIBLE · 0 REFUTED**. Two save-compatibility findings were
dropped on the pre-alpha rule; the two `sim/enablers.ts` findings, the replay-bounds
finding, the cost-schema finding, the per-copy cost merge, the Codex territory
contradiction, the orphaned docstring, the territory-weight rationale, the trade
face's dropped play-time effect, the `placedCards` bypass, the twice-encoded durable
producer, the re-implemented `canonicalPlay` and the five copy-pasted card-kind sections
have been fixed and removed; the 1 below is open.

---

## Cleanup / altitude

### 1. Hot-path cost re-resolution — `src/rules/cost.ts:80` / `:92`

Repeated cost re-resolution on a hot path, plus `canAfford`'s new `Object.entries`
allocation. One drop-in fast path at those two sites covers most of it.
