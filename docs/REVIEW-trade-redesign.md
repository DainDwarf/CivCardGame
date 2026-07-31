# Code review — `trade-redesign`

Untracked working file. 8 finder angles over `main...trade-redesign` (116 files,
+5206/−2653), deduped to 16 candidates, each put through one recall-biased verifier:
**12 CONFIRMED · 4 PLAUSIBLE · 0 REFUTED**. Two save-compatibility findings were
dropped on the pre-alpha rule; the two `sim/enablers.ts` findings, the replay-bounds
finding, the cost-schema finding, the per-copy cost merge, the Codex territory
contradiction, the orphaned docstring, the territory-weight rationale, the trade
face's dropped play-time effect, the `placedCards` bypass, the twice-encoded durable
producer and the re-implemented `canonicalPlay` have been fixed and removed; the 2 below
are open.

---

## Cleanup / altitude

### 1. Five copy-pasted card-kind sections, in two files

- `src/meta/Collection.tsx:59-147` — five ~17-line blocks differing only in the
  guard/list identifier and the `<h2>` text; every `CardFace` prop list is
  character-identical, and no block has a special case.
- `src/meta/DeckEditor.tsx:237-266` — the same five sections at 6 lines each.
- The heading↔kind table is duplicated *across* the files: `Collection.tsx:49-53` and
  `DeckEditor.tsx:95-99` are the same five filter+sort lines, rendering the same five
  headings in the same order (Buildings / Wonders / Work / Actions / Trade routes).

One shared table beside `compareCards`/`isDeckable` in `content/cards.ts` plus a `map`
in each file. As it stands, a sixth card kind needs four more edit sites across two
files.

### 2. Hot-path cost re-resolution — `src/rules/cost.ts:80` / `:92`

Repeated cost re-resolution on a hot path, plus `canAfford`'s new `Object.entries`
allocation. One drop-in fast path at those two sites covers most of it.
