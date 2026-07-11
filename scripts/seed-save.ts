/**
 * Dev tool — generate a populated `.civsave` file for testing the meta screens.
 *
 * The meta screens (Stats, Collection, Board, Decks) only get interesting once a player has some
 * progress, but grinding runs to reach that state is slow. This folds a list of finished runs
 * through the **real** `applyRunResult` — so the resulting save is always valid and can never drift
 * from production logic (the same reason tests share prod code paths) — then writes it as an
 * importable save file.
 *
 * Usage:
 *   npm run seed-save                    # writes ./seed.civsave
 *   npm run seed-save -- my-save.civsave # custom output path
 *
 * Then in-game: burger menu → Save → Load, and pick the file. (Loading replaces your current save,
 * so export a backup first if you care about it.)
 *
 * To change what the seed contains, edit `SEED_RUNS` below — each entry is one finished run, folded
 * in order. Influence, unlocked cards, mission progress, lifetime counters and infinite best scores
 * all fall out of that automatically; there's no separate state to keep in sync.
 */
import { writeFileSync } from 'node:fs';
import { emptyStore, applyRunResult, exportSave, type PlayerStore } from '../src/meta/store';
import { MISSIONS } from '../src/content/missions';
import type { RunResult } from '../src/contract';

/** One finished run to fold into the seed. `rounds` is `turnsTaken` (an infinite mission pays that
 *  much Influence and records it as a best score). */
interface SeedRun {
  missionId: string;
  outcome: RunResult['outcome'];
  rounds: number;
}

const SEED_RUNS: SeedRun[] = [
  // The opening Stone Age chain, cleared in order — each victory pays its Influence and grants its
  // unlocks through the real `applyRunResult`: First Settlement (farm/toolmaker/hut/conquest),
  // Growing Numbers (+6⭐, Irrigation card sticker + Territory board sticker), Rites & Rituals
  // (+8⭐, the Göbekli Tepe wonder). Result: 3/4 standard missions cleared, "Raiders at the Border"
  // now available (its Chiefdom board reward still locked until it's cleared too).
  { missionId: 'first_settlement', outcome: 'victory', rounds: 8 },
  { missionId: 'growing_numbers', outcome: 'victory', rounds: 11 },
  { missionId: 'rites_rituals', outcome: 'victory', rounds: 14 },
];

function runResult(run: SeedRun): RunResult {
  return {
    outcome: run.outcome,
    missionId: run.missionId,
    stats: {
      turnsTaken: run.rounds,
      finalResources: { food: 3, production: 5, money: 4, science: 8, military: 2 },
      strategicResources: { population: 6, territory: 4, culture: 3 },
    },
  };
}

const outPath = process.argv[2] ?? 'seed.civsave';

let store: PlayerStore = emptyStore();
for (const run of SEED_RUNS) {
  const mission = MISSIONS[run.missionId];
  if (!mission) throw new Error(`Unknown mission id '${run.missionId}' in SEED_RUNS — check content/missions.ts.`);
  store = applyRunResult(store, runResult(run), mission);
}

writeFileSync(outPath, exportSave(store));

console.log(`Wrote ${outPath} (${SEED_RUNS.length} runs folded in)`);
console.log('  influence balance :', store.influence);
console.log('  lifetime          :', store.lifetime);
console.log('  bestInfinite      :', store.bestInfinite);
console.log('  missions cleared  :', Object.keys(store.mapProgress).join(', ') || '(none)');
