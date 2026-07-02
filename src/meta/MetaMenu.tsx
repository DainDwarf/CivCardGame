import { useState } from 'react';
import { MissionSelect } from './MissionSelect';
import { Collection } from './Collection';
import { Decks } from './Decks';
import { Stats } from './Stats';
import type { RunConfig, RunResult } from '../contract';
import styles from './MetaMenu.module.css';

type Screen = 'mission' | 'collection' | 'decks' | 'stats';

const NAV: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'mission', icon: '🗺️', label: 'Mission' },
  { screen: 'collection', icon: '📚', label: 'Collection' },
  { screen: 'decks', icon: '🃏', label: 'Decks' },
  { screen: 'stats', icon: '📊', label: 'Stats' },
];

/**
 * The meta menu's shell (Phase 2 build plan step 6, "extend the meta menu"): a left
 * column of big nav buttons switches between the meta screens. Mission is the
 * mission/board/deck picker that launches a run (`MissionSelect.tsx`); Collection and
 * Decks are read-only shells — construction/editing lands in step 7; Stats is the run
 * history, split out of Mission Select so that screen stays focused on launching.
 * `App.tsx` mounts this in place of the run view whenever `screen === 'menu'`.
 */
export function MetaMenu({
  runHistory,
  onLaunch,
}: {
  runHistory: RunResult[];
  onLaunch: (config: RunConfig) => void;
}) {
  const [screen, setScreen] = useState<Screen>('mission');

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <h1 className={styles.gameTitle}>CivCardGame</h1>
        {NAV.map((n) => (
          <button
            key={n.screen}
            type="button"
            className={`${styles.navBtn}${screen === n.screen ? ` ${styles.navBtnActive}` : ''}`}
            onClick={() => setScreen(n.screen)}
            aria-pressed={screen === n.screen}
          >
            <span className={styles.navIcon} aria-hidden="true">
              {n.icon}
            </span>
            <span className={styles.navLabel}>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.content}>
        {screen === 'mission' && <MissionSelect onLaunch={onLaunch} />}
        {screen === 'collection' && <Collection />}
        {screen === 'decks' && <Decks />}
        {screen === 'stats' && <Stats runHistory={runHistory} />}
      </div>
    </div>
  );
}
