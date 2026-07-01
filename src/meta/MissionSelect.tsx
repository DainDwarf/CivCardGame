import { useState } from 'react';
import { MISSIONS } from '../content/missions';
import { BOARDS, type BoardId } from '../content/boards';
import { DECKS, type DeckId } from '../content/decks';
import type { Resources } from '../rules/resources';
import styles from './MissionSelect.module.css';

/**
 * The provisional selection a player builds up on this screen. Step 3 (`contract.ts`)
 * promotes this exact shape into the real `RunConfig`; step 4 wires it to actually
 * launch a run. Until then this menu is the whole meta loop — picking here has no
 * effect beyond what's shown on screen.
 */
export interface RunSelection {
  missionId: string;
  boardId: BoardId;
  deckId: DeckId;
}

const MISSION_IDS = Object.keys(MISSIONS);
const BOARD_IDS = Object.keys(BOARDS) as BoardId[];
const DECK_IDS = Object.keys(DECKS) as DeckId[];

const RESOURCE_ICON: Record<keyof Resources, string> = {
  food: '🌾',
  production: '🔨',
  science: '🔬',
  military: '⚔️',
  money: '🪙',
};

/** Presentation-only summary of a board's starting profile — all 8 starting values. */
function describeBoard(board: (typeof BOARDS)[BoardId]): string {
  const parts = (Object.entries(board.resources) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}${RESOURCE_ICON[k]}`);
  parts.push(`${board.population}🧍`, `${board.territory} territory`);
  if (board.culture) parts.push(`${board.culture}🎭`);
  return parts.join(' · ');
}

/** A selectable option card — shared shape for the mission/board/deck rows below. */
function OptionCard({
  name,
  description,
  detail,
  selected,
  onSelect,
}: {
  name: string;
  description: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.optionCard}${selected ? ` ${styles.selected}` : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.optionName}>{name}</span>
      <span className={styles.optionDesc}>{description}</span>
      {detail && <span className={styles.optionDetail}>{detail}</span>}
    </button>
  );
}

/**
 * The first meta screen — mission-select. Replaces the old direct-to-run mount in
 * `main.tsx`. Picks mission / board / deck into a provisional selection; does not
 * launch a run — that lands with Phase 2 step 4, once `contract.ts` (step 3) exists
 * to carry the selection into `createInitialState`.
 */
export function MissionSelect() {
  const [selection, setSelection] = useState<RunSelection>({
    missionId: MISSION_IDS[0],
    boardId: BOARD_IDS[0],
    deckId: DECK_IDS[0],
  });

  const mission = MISSIONS[selection.missionId];
  const board = BOARDS[selection.boardId];
  const deck = DECKS[selection.deckId];

  return (
    <div className={styles.menu}>
      <h1 className={styles.title}>CivCardGame</h1>
      <p className={styles.subtitle}>Choose a mission, a government, and a deck.</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mission</h2>
        <div className={styles.cardRow}>
          {MISSION_IDS.map((id) => (
            <OptionCard
              key={id}
              name={MISSIONS[id].name}
              description={MISSIONS[id].description}
              selected={selection.missionId === id}
              onSelect={() => setSelection((s) => ({ ...s, missionId: id }))}
            />
          ))}
        </div>
        <p className={styles.detail}>
          🏆 {mission.victoryHint}
          {mission.failureHint && <> · 💀 {mission.failureHint}</>}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Government</h2>
        <div className={styles.cardRow}>
          {BOARD_IDS.map((id) => (
            <OptionCard
              key={id}
              name={BOARDS[id].name}
              description={BOARDS[id].description}
              selected={selection.boardId === id}
              onSelect={() => setSelection((s) => ({ ...s, boardId: id }))}
            />
          ))}
        </div>
        <p className={styles.detail}>{describeBoard(board)}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Deck</h2>
        <div className={styles.cardRow}>
          {DECK_IDS.map((id) => (
            <OptionCard
              key={id}
              name={DECKS[id].name}
              description={DECKS[id].description}
              selected={selection.deckId === id}
              onSelect={() => setSelection((s) => ({ ...s, deckId: id }))}
            />
          ))}
        </div>
        <p className={styles.detail}>{deck.cards.length} cards</p>
      </section>

      <button
        type="button"
        className={styles.startBtn}
        disabled
        title="Launching a run lands later in Phase 2, once the loop is wired closed"
      >
        Start Run
      </button>
    </div>
  );
}
