---
name: visual-check
description: Verify a UI change in the browser after making it — layout, overlap, contrast, console errors, interaction states. Use after any change to a component, a CSS module, or a theme token, before calling that change done.
---

# Visual check: browser verification of a UI change

Two passes, and they are not interchangeable:

- The **mechanical** pass — does it render, does anything overlap or clip, does the
  console throw — runs through the Chrome DevTools MCP, delegated to the `ui-check`
  subagent.
- The **judgment** pass — does it feel right to play — is the user's, always. A PASS from
  the subagent means "nothing is broken", never "this is done". Don't call a UI task
  finished on the subagent's report alone; hand the URL over and let the user look.

## Never drive devtools from this session

Every `mcp__chrome-devtools__*` call belongs to the `ui-check` subagent. Screenshots and
DOM snapshots are bulky, and keeping them out of the main session's context is most of the
point of delegating. A PreToolUse hook denies these tools outside a subagent, so an inline
call fails rather than silently working.

## Steps

1. **Get a server up** — the `run` skill. It reuses one that's already listening.
2. **Spawn the `ui-check` subagent** with a concrete checklist: what changed, what
   "correct" looks like, the exact click path to reach it, what to capture. Brief the
   *check*, not the implementation — it doesn't need the diff or the design rationale.
3. **Relay its report** — the per-step PASS/FAIL and anything it flagged.
4. **Hand the URL to the user** for the feel-check.

## Scope: what fits, and what doesn't

The check has to be reachable in **a few clicks from a fresh page load**. Three cases:

- **Reachable from a fresh profile** → just brief the click path.
- **Needs prior progress** (Influence to spend, owned copies, unlocked stickers, cleared
  missions) → tell the subagent to **seed `localStorage` under the
  `civcardgame:player-store` key** directly, then reload. Never have it play or clear a
  mission to earn the state — that's a playthrough wearing a disguise.
- **Only observable by finishing a run** (a mission win/loss, the gameover overlay, upkeep
  behaviour over many rounds) → **don't automate it at all.** Driving a full run through
  devtools is a long stateful grind, not a mechanical check. Instead write the user precise
  manual instructions: which mission and board to pick, what to watch, what the expected
  result looks like.

## Colour work needs a CVD pass

When the change touches colour — a new theme token, a new signal, a palette shift — the
subagent's normal screenshots aren't enough: the theme *is* the adapted palette, so
screenshotting it only proves it looks fine to normal vision. Ask `ui-check` for the CVD
pass as well (it carries the simulation matrices). Prioritise **colour-only signals** —
anything with no text, icon, or sign backing it up — over redundant ones.

Two standing results, not to be re-litigated:

- The run loop's **operating-vs-idle building tint** is the one real colour-only signal in
  the app. It survives mainly on the worker token's grayscale/opacity dimming rather than
  the background tint — re-check it if that token's styling changes.
- The **culture gauge**'s tube/ghost/fill stack is a *luminance* ramp, not a hue signal. It
  is CVD-invariant by construction and a linear sim matrix cannot speak to it.

A CONCERN verdict from a crude sim matrix is a prompt to look closer, not an automatic bug
— it can flag validated CVD-safe hues as confusable.

## The save is never at risk

`chrome-devtools-mcp` drives its own dedicated Chrome profile — a different `localStorage`
origin from the user's real browser. Nothing the subagent does there can reach the user's
`PlayerStore`, storage clearing included. So **don't report to the user that the check
touched, modified, or could affect their save.** If the subagent's report includes that
caveat, strip it rather than passing it through. This is settled, not a per-task risk to
assess.

That profile *does* persist across spawns, so the agent clears it at the start of every
check — you don't need to brief that.
