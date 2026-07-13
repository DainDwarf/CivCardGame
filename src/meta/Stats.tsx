import { MISSIONS } from '../content/missions';
import { CARDS, isDeckable } from '../content/cards';
import { RESOURCE_ICON } from '../components/CardFace';
import type { RunResult } from '../contract';
import { distinctCardIdsOwned, type OwnedCards } from '../rules/collection';
import { standardMissionProgress } from '../rules/campaign';
import type { LifetimeStats } from './store';
import styles from './Stats.module.css';

/**
 * The Stats screen — a player profile, not just a log. Three bands:
 *  - a hero row of lifetime headline tiles (missions / cards unlocked / Influence earned / win rate),
 *  - the infinite-mission best-scores board,
 *  - the run history collapsed underneath.
 *
 * Disclosure: `missions X / Y` and `cards X / N` both show a denominator on purpose — the campaign
 * map already reveals the node count, and disclosing the *catalogue size* (not the hidden cards'
 * identities) is a deliberate collectathon hook (overrides the older "bare count" note; see
 * `collection-hides-locked-cards`).
 *
 * Every lifetime number comes from persistent counters, never from `runHistory` — that array is
 * capped at `HISTORY_LIMIT`, so deriving totals from it would silently undercount once trimmed
 * (and a best score set long ago would drop off and *decrease*). The collapsed log is the one thing
 * that is inherently "recent"; everything above it is lifetime.
 */
export function Stats({
  runHistory,
  collection,
  mapProgress,
  lifetime,
  bestInfinite,
}: {
  runHistory: RunResult[];
  collection: OwnedCards;
  mapProgress: Record<string, true>;
  lifetime: LifetimeStats;
  bestInfinite: Record<string, number>;
}) {
  const missions = Object.values(MISSIONS);
  const missionProgress = standardMissionProgress(MISSIONS, mapProgress);

  const cardsTotal = Object.values(CARDS).filter(isDeckable).length;
  const cardsUnlocked = distinctCardIdsOwned(collection).filter((id) => CARDS[id] && isDeckable(CARDS[id])).length;

  const { runsPlayed, victories, influenceEarned } = lifetime;
  const winRate = runsPlayed > 0 ? Math.round((victories / runsPlayed) * 100) : null;

  const leaderboard = missions
    .filter((m) => m.kind === 'infinite')
    .map((m) => ({ id: m.id, name: m.name, best: bestInfinite[m.id] ?? null }))
    .sort((a, b) => (b.best ?? -1) - (a.best ?? -1));
  const topScore = Math.max(1, ...leaderboard.map((row) => row.best ?? 0));

  return (
    <div className={styles.stats}>
      <h1 className={styles.title}>Stats</h1>

      <div className={styles.hero}>
        <Tile label="Missions cleared" value={`${missionProgress.cleared}`} denom={`/ ${missionProgress.total}`} />
        <Tile label="Cards unlocked" value={`${cardsUnlocked}`} denom={`/ ${cardsTotal}`} accent />
        <Tile label="Influence earned" value={`${influenceEarned}`} icon="⭐" />
        <Tile
          label="Win rate"
          value={winRate === null ? '—' : `${winRate}%`}
          sub={runsPlayed === 1 ? '1 run' : `${runsPlayed} runs`}
        />
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelLabel}>Infinite missions · best scores</h2>
        {leaderboard.length === 0 ? (
          <p className={styles.empty}>No endless missions yet.</p>
        ) : (
          <ul className={styles.leaderboard}>
            {leaderboard.map((row) => (
              <li key={row.id} className={styles.leaderRow}>
                <span className={styles.leaderName}>{row.name}</span>
                <span className={styles.leaderScore}>
                  {row.best === null ? (
                    <span className={styles.leaderUnplayed}>not attempted</span>
                  ) : (
                    <>
                      {row.best}
                      <small> rounds</small>
                    </>
                  )}
                </span>
                <span
                  className={styles.leaderBar}
                  style={{ width: `${row.best === null ? 0 : (row.best / topScore) * 100}%` }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className={styles.history}>
        <summary className={styles.historySummary}>
          Run history
          <span className={styles.historyCount}>
            {runHistory.length === 0
              ? 'no runs yet'
              : `last ${runHistory.length} run${runHistory.length === 1 ? '' : 's'}`}
          </span>
        </summary>
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
                  {RESOURCE_ICON.population}{result.stats.finalResources.population} · {RESOURCE_ICON.territory}
                  {result.stats.finalResources.territory} · {RESOURCE_ICON.culture}
                  {result.stats.finalResources.culture}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

/** One hero stat tile. `denom` renders a muted "/ N" beside the value; `accent`/`icon`/`sub` are optional accents. */
function Tile({
  label,
  value,
  denom,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  denom?: string;
  sub?: string;
  icon?: string;
  accent?: boolean;
}) {
  return (
    <div className={styles.tile}>
      <div className={`${styles.tileValue} ${accent ? styles.tileValueAccent : ''}`}>
        {icon && <span className={styles.tileIcon}>{icon}</span>}
        {value}
        {denom && <span className={styles.tileDenom}>{denom}</span>}
      </div>
      <div className={styles.tileLabel}>{label}</div>
      {sub && <div className={styles.tileSub}>{sub}</div>}
    </div>
  );
}
