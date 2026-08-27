import { MISSIONS, infiniteMissionsInOrder } from '../content/missions';
import { CARDS, isDeckable } from '../content/cards';
import { BOARDS, prebuiltCardIds } from '../content/boards';
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
  const missionProgress = standardMissionProgress(MISSIONS, mapProgress);

  // A board's pre-built structure is deckable by kind but ownable by nobody, so it would raise the
  // denominator to a number the numerator can never reach.
  const prebuilt = prebuiltCardIds();
  const cardsTotal = Object.values(CARDS).filter((c) => isDeckable(c) && !prebuilt.has(c.id)).length;
  const cardsUnlocked = distinctCardIdsOwned(collection).filter((id) => CARDS[id] && isDeckable(CARDS[id])).length;

  const { runsPlayed, victories, influenceEarned } = lifetime;
  const winRate = runsPlayed > 0 ? Math.round((victories / runsPlayed) * 100) : null;

  // Only a mission whose objective declares a `score` measure has a best to compare — an unscored
  // one (the sandbox) records none, so it would sit here reading "not attempted" forever. Derived
  // from the measure itself rather than from `rewardless`, which is a payout fact, not a scoring one.
  const leaderboard = infiniteMissionsInOrder(mapProgress)
    .filter((m) => CARDS[m.objectiveCardId]?.score !== undefined)
    .map((m) => ({
      id: m.id,
      name: m.name,
      best: bestInfinite[m.id] ?? null,
      unit: m.scoreUnit ?? 'rounds',
    }));
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
          <p className={styles.empty}>No scored endless missions yet.</p>
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
                      <small> {row.unit}</small>
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
                {/* The two elastic columns ellipsize, so each carries its own full text as a title. */}
                <span className={styles.mission} title={MISSIONS[result.missionId].name}>
                  {MISSIONS[result.missionId].name}
                </span>
                <span className={styles.loadout} title={loadoutLabel(result)}>
                  {loadoutLabel(result)}
                </span>
                <span className={styles.round}>round {result.stats.turnsTaken}</span>
                <span className={styles.pools}>
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

/** `Board · Deck` for a run-log row, dropping whichever half the record doesn't carry. The board's
 *  name is read live off the catalogue; the deck's was snapshotted at launch (see `RunResult`). */
function loadoutLabel(result: RunResult): string {
  return [BOARDS[result.boardId]?.name, result.deckName].filter(Boolean).join(' · ');
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
