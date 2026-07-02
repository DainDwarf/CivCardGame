import { MISSIONS } from '../content/missions';
import type { RunResult } from '../contract';
import styles from './Stats.module.css';

/**
 * The Stats screen — the run history that used to sit inline on Mission Select
 * (Phase 2 build plan step 6 pulled it out into its own nav entry). Purely a
 * display of `RunResult[]`; `App.tsx` still owns loading/persisting the history.
 */
export function Stats({ runHistory }: { runHistory: RunResult[] }) {
  return (
    <div className={styles.stats}>
      <h1 className={styles.title}>Stats</h1>
      <p className={styles.subtitle}>
        Your last {runHistory.length} run{runHistory.length === 1 ? '' : 's'}, most recent first.
      </p>

      {runHistory.length === 0 ? (
        <p className={styles.empty}>No runs yet — launch one from Mission.</p>
      ) : (
        <ul className={styles.list}>
          {runHistory.map((result, i) => (
            <li key={i} className={styles.row}>
              <span className={result.outcome === 'victory' ? styles.victory : styles.defeat}>
                {result.outcome === 'victory' ? '🏛️ Victory' : '💀 Defeat'}
              </span>
              <span className={styles.mission}>{MISSIONS[result.missionId].name}</span>
              <span className={styles.detail}>round {result.stats.turnsTaken}</span>
              <span className={styles.detail}>
                🧍{result.stats.strategicResources.population} · {result.stats.strategicResources.territory} territory · 🎭
                {result.stats.strategicResources.culture}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
