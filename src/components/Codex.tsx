import { useState } from 'react';
import {
  CODEX_CORE_RESOURCES,
  CODEX_STRATEGIC,
  CODEX_CARD_KINDS,
  CODEX_GLOSSARY,
} from '../content/codex';
import { bannerHue, RESOURCE_ICON } from './CardFace';
import styles from './Codex.module.css';

type SubjectId = 'resources' | 'cardTypes' | 'playATurn' | 'influence' | 'glossary';

const SUBJECTS: { id: SubjectId; label: string }[] = [
  { id: 'resources', label: 'Resources' },
  { id: 'influence', label: 'Influence' },
  { id: 'cardTypes', label: 'Card types' },
  { id: 'playATurn', label: 'Play a turn' },
  { id: 'glossary', label: 'Glossary' },
];

/**
 * The Codex: the game's in-menu rules reference, rendered inside `GameMenu`'s codex
 * submenu. Deliberately **pure and static** — it takes no props and never reads run
 * state (`useGame`), so it renders identically on the meta menu and mid-run.
 *
 * A left-nav subject list over a scrolling content pane (rather than one long scroll)
 * — the subjects are Resources, Card types, Play a turn, Influence, and Glossary.
 * The list-shaped pages come from `content/codex.ts`; the narrative pages are authored
 * here.
 */
export function Codex() {
  const [subject, setSubject] = useState<SubjectId>('resources');

  return (
    <div className={styles.codex}>
      <nav className={styles.nav}>
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={subject === s.id ? `${styles.navBtn} ${styles.navBtnActive}` : styles.navBtn}
            onClick={() => setSubject(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className={styles.page}>
        {subject === 'resources' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Resources</h4>
            <p className={styles.lead}>Resources come in two families: the five core resources, which pay for cards, and the three strategic resources, each setting a capacity of its own.</p>
            <p className={`${styles.callout} ${styles.calloutWarning}`}>If any core resource drops below zero, the run ends immediately.</p>

            <h5 className={styles.subTitle}>Core</h5>
            <dl className={styles.defList}>
              {CODEX_CORE_RESOURCES.map((r) => (
                <div className={styles.defRow} key={r.key}>
                  <dt className={styles.defTerm}>
                    <span aria-hidden="true">{RESOURCE_ICON[r.key]}</span> {r.name}
                  </dt>
                  <dd className={styles.defDesc}>{r.role}</dd>
                </div>
              ))}
            </dl>

            <h5 className={styles.subTitle}>Strategic</h5>
            <dl className={styles.defList}>
              {CODEX_STRATEGIC.map((s) => (
                <div className={styles.defRow} key={s.key}>
                  <dt className={styles.defTerm}>
                    <span aria-hidden="true">{RESOURCE_ICON[s.key]}</span> {s.name}
                  </dt>
                  <dd className={styles.defDesc}>{s.role}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {subject === 'cardTypes' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Card types</h4>
            <dl className={styles.defList}>
              {CODEX_CARD_KINDS.map((c) => (
                // The hue rides in as a custom property built from the kind, the way CampaignMap's
                // age backdrop builds its own — one rule below styles all eight rows.
                <div
                  className={`${styles.defRow} ${styles.kindRow}`}
                  key={c.kind}
                  style={{ '--kind-hue': `var(--card-${bannerHue(c.kind)}-banner)` } as React.CSSProperties}
                >
                  <dt className={`${styles.defTerm} ${styles.kindBanner}`}>{c.name}</dt>
                  <dd className={styles.defDesc}>{c.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {subject === 'playATurn' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Play a turn</h4>

            <h5 className={styles.subTitle}>Your deck</h5>
            <p className={styles.lead}>You build your deck before the run, and you cannot change it once the run has started.</p>
            <ul className={styles.bullets}>
              <li>When your deck runs out, the discard pile is shuffled back into a new draw.</li>
              <li>A removed card does not go to the discard pile. It is out of the run for good.</li>
              <li>A mission shuffles its own event cards into your deck at the start, and some missions can even add more while you play.</li>
            </ul>

            <h5 className={styles.subTitle}>Turn structure</h5>
            <p className={styles.lead}>Each round runs through four phases.</p>
            <ol className={styles.phases}>
              <li><span className={styles.phaseName}>Draw</span> — refill your hand.</li>
              <li><span className={styles.phaseName}>Action</span> — play your cards and assign your workers.</li>
              <li><span className={styles.phaseName}>Upkeep</span> — staffed buildings and work cards produce and threats take their upkeep, then any unplayed event strikes, and finally your population eats its food.</li>
              <li><span className={styles.phaseName}>End</span> — your hand and all your work cards go to the discard pile.</li>
            </ol>

            <h5 className={styles.subTitle}>Workers</h5>
            <p className={styles.lead}>Your population is your workforce — every {RESOURCE_ICON.population} is one worker.</p>
            <ul className={styles.bullets}>
              <li>Every building and work card shows how many workers it can take. It produces nothing until at least one worker stands on it, and from there its output scales: two workers produce twice what one does.</li>
              <li>Some cards take no workers at all. Those always produce their output.</li>
              <li>Workers are never spent. They stay where you put them, and you can move them between cards freely on your own turn.</li>
              <li>Playing a building or work card staffs it straight away from your idle workers.</li>
              <li>A work card hands its workers back when it goes to the discard at end of turn; a building keeps its workers until you move them.</li>
            </ul>
          </section>
        )}

        {subject === 'influence' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}><span aria-hidden="true">⭐</span> Influence</h4>
            <p className={styles.lead}>Influence is the currency you carry between runs — earned by playing missions, spent to strengthen your collection.</p>

            <h5 className={styles.subTitle}>Earning it</h5>
            <ul className={styles.bullets}>
              <li>Clear a mission for the first time to earn its Influence reward. Replaying it pays nothing.</li>
              <li>An endless mission has no victory — it runs until your civilization collapses, and you can attempt it as often as you like. It pays Influence for what its objective card counts, and the card tracks that live as you play.</li>
            </ul>

            <h5 className={styles.subTitle}>Spending it</h5>
            <ul className={styles.bullets}>
              <li>Buy extra copies of cards you already own, so you can field more of them in a deck.</li>
              <li>Attach <strong>stickers</strong> — permanent upgrades that make a card copy or a government board stronger.</li>
            </ul>
          </section>
        )}

        {subject === 'glossary' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Glossary</h4>
            <dl className={styles.defList}>
              {CODEX_GLOSSARY.map((g) => (
                <div className={styles.defRow} key={g.term}>
                  <dt className={styles.defTerm}>{g.term}</dt>
                  <dd className={styles.defDesc}>{g.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
