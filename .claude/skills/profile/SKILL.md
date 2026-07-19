---
name: profile
description: CPU-profile a Node entry point (the simulator, the economy tool, a future meta-explorer, any script) to find where runtime actually goes. Use whenever asked why something is slow, to speed up a policy or tool, to find a hotspot or bottleneck, or before optimizing anything.
---

# Profile: finding where the time goes

`npm run sim:profile` runs the simulator under [`@platformatic/flame`](https://github.com/platformatic/flame),
which writes a **markdown** hotspot report (annotated call tree + per-function callers/callees)
beside an HTML flamegraph. Markdown so the report is readable without a browser.

**Never hand-roll a profile parser.** The markdown report answers the question directly. If it
genuinely doesn't, say what's missing and ask — a bespoke script produces numbers nobody can check.

## Measure before optimizing — always

A profile is cheap and intuitions about hot code are usually wrong. Before touching anything for
performance, profile it. In this repo the planner's cost turned out to be ~62% `structuredClone`,
which no reading of the search code would have predicted.

## The run must be long enough — the one rule that invalidates everything

`tsx` compiles TypeScript on every start. That's a **fixed multi-second cost** that lands inside
the profile and inflates every startup frame at the expense of the real work.

Measured on the same code, same tool, same hotspot:

| Sweep length | Reported `structuredClone` share |
|---|---|
| 4 seeds (~3s) | **23.0%** |
| 12 seeds (~12s) | **61.7%** |

Neither number is a bug — the short run is just mostly startup. **A too-short capture doesn't fail
loudly, it silently lies.**

So:

1. **Aim for ≥30s of captured runtime.** For the sim that's `--seeds 20` or more; scale up for a
   cheap scenario, and remember a slow policy (`planner`, `oracle`) needs fewer seeds to get there.
2. **Read the report header first, every time:**
   ```
   **Duration:** 11.6s | **Samples:** 720 | **Sample Rate:** 62Hz
   ```
   Under ~10s or under ~500 samples, **re-run bigger before reporting anything.** State the duration
   and sample count when you report findings, so the reader can judge them.
3. **If the target is inherently short** (`npm run economy` finishes in under a second), you cannot
   fix the dilution afterward — increase the workload itself: raise the seed/iteration count, or
   wrap the call in a repeat loop, until it runs long enough to dominate startup.

## The sim

```
npm run sim:profile -- --scenario <ids> --deck <file> --board <id|file> --policies <p> --seeds 20
```

Takes every `npm run sim` flag (see the `sim` skill). Only the `--seeds` guidance differs: profiling
wants a **long** run, where a balance sweep wants a *statistically* large one — often the same
number, but for different reasons.

## Profiling anything else

The `sim:profile` script is just `npm run sim` under flame. Any other Node entry point profiles the
same way — the pattern, for a future meta-explorer, a new script, or an ad-hoc harness:

```
npx -y @platformatic/flame@1.7.0 run --delay=none --md-format=detailed \
  --node-options="--import tsx" scripts/<entry>.ts -- <the script's own args>
```

Four load-bearing pieces — omit one and you get a silently useless profile:

- **`--delay=none`** — flame otherwise defers arming until after the first event-loop tick. Our
  scripts are **fully synchronous**, so they finish before that and the profile captures nothing but
  flame's own shutdown (a 2-sample, 0.0s report). If a report looks absurd, check this first.
- **`--node-options="--import tsx"`** — the loader must run in the *same* process. Invoking `tsx`
  directly can put the work in a child the profiler never samples.
- **`--`** before the script's own args — flame parses argv itself and will reject unknown flags.
- **the pinned version** — flame floats its own dependencies. A profiler that breaks when you need
  it is worse than none.

**Node only.** For the *browser* game (React shell, render/interaction cost) flame does not apply —
that's a Chrome DevTools performance trace, which runs through the `visual-check` / `ui-check` path,
not this skill.

## Reading the markdown report

Four sections, in `cpu-profile-<timestamp>.md`:

1. **Header** — duration, samples, rate. Validate it (above) before reading further.
2. **Call Tree** — the flame graph as text, each frame `[self% | cum%]`.
3. **Function Details** — per function: samples, self %, cumulative %, `Callers:`, `Callees:`.
4. **Hotspot Analysis** — ranked list. Its "investigation hints" are generic filler; ignore them.

**Self vs. cumulative is the whole skill.** *Self* = time in that function's own frame. *Cumulative*
= that plus everything it called. A native leaf like `structuredClone` shows enormous **self** time,
but the code to change is at its **callers** — the leaf itself is not the bug. Conversely a frame
with high cum% and ~0 self% is just a passthrough.

**Known limitations — state these rather than working around them:**

- **No line numbers.** Frames report `value.ts:1` regardless of the real line, because tsx doesn't
  emit line info flame can use. You get **function-level** attribution only; never quote a line
  number off a profile.
- **Caller lists are truncated** — `Callers: endTurn, beginTurn, applyMove (+3 more)`, with no
  per-caller percentages. To apportion one hot leaf across its callers, read the **Call Tree** and
  sum its paths. Say plainly that the split was summed by hand from the tree.
- A **heap** profile (`heap-profile-*.md`) is written alongside, for allocation questions.

## Reporting

**Offer the analysis by default.** Naming the likely cause and the candidate fixes is part of the
deliverable — don't stop at the table and wait to be asked.

- Lead with the header numbers (duration, samples) so the reader can weigh the rest.
- Give self% for the hotspots and, when it matters, the caller apportionment — labelled as summed
  from the tree.
- **Then interpret**: what the shape of the profile implies, and the candidate optimizations ranked
  by expected impact against the cost and risk of each.
- **Keep measured and inferred visibly separate.** "62% is `structuredClone`" is measured. "Caching
  `scoreState` would cut that roughly in half" is a hypothesis — say which is which, in those terms.
  The analysis is welcome; passing off a guess as a reading of the profile is not.
- Name the **next measurement** that would confirm or kill each hypothesis, so a wrong theory is
  cheap to discard rather than something the work chases.
- When a finding rests on a single capture, say so. Re-running with a different seed count (or a
  second tool) is cheap corroboration.
- Flag anything the profile **can't** settle — a sampler shows where time goes, never how much of it
  was avoidable. "How many of those clones were thrown away?" needs a counter, not a profile.

**Before proposing any fix, check where it lands.** `src/sim/` is a *consumer* of the core — the
core never bends for it. An optimization inside `sim/` is free to propose freely; one that changes
`src/rules/` or `src/run/` to speed up the simulator carries two extra obligations:

- **Justify it as game code.** It has to stand on its own merits — clearer, or faster where the
  player actually feels it. Raise it as that tradeoff explicitly; never slip a core change in as a
  perf fix for a dev tool.
- **Verify it, don't assume it.** Re-profile after the change and report the before/after, and run
  `npm test` — the core is what the run loop and the whole test suite sit on. A predicted speedup
  that wasn't measured doesn't count, and an optimization that quietly changes behaviour is a bug.

## Artifacts

flame writes six files into the **current working directory** — `cpu-profile-*` and `heap-profile-*`
in `.md`, `.html`, and `.pb`. All are gitignored. Delete them when done (`rm -f cpu-profile-*
heap-profile-*`); keep the `.md` in the scratchpad if the numbers are still in play. Never commit
them, and never leave `.pb`/`.html` littering the repo root.
