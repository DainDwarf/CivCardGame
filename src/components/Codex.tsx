import { useState } from 'react';
import {
  CODEX_CORE_RESOURCES,
  CODEX_STRATEGIC,
  CODEX_CARD_KINDS,
  CODEX_GLOSSARY,
} from '../content/codex';
import { RESOURCE_ICON } from './CardFace';
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
            <p className={styles.lead}>Your civilization runs on resources, grouped into two families: core resources you spend, and strategic resources that shape how you grow.</p>
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
                <div className={styles.defRow} key={c.kind}>
                  <dt className={styles.defTerm}>{c.name}</dt>
                  <dd className={styles.defDesc}>{c.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {subject === 'playATurn' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Turn structure</h4>
            <p className={styles.lead}>Each round runs through four phases.</p>
            <ol className={styles.phases}>
              <li><span className={styles.phaseName}>Draw</span> — refill your hand.</li>
              <li><span className={styles.phaseName}>Action</span> — play your cards and assign your workers.</li>
              <li><span className={styles.phaseName}>Upkeep</span> — staffed buildings and work cards produce, unplayed events strike, threats take their toll, and your population eats its food.</li>
              <li><span className={styles.phaseName}>End</span> — your hand and all your work cards go to the discard pile.</li>
            </ol>
          </section>
        )}

        {subject === 'influence' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Influence</h4>
            <p className={styles.lead}>Influence is the currency you carry between runs — earned by playing missions, spent to strengthen your collection.</p>

            <h5 className={styles.subTitle}>Earning it</h5>
            <ul className={styles.bullets}>
              <li>Clear a mission for the first time to earn its Influence reward.</li>
              <li>Endless missions pay out for how long you survive, and can be played as many times as you want.</li>
            </ul>

            <h5 className={styles.subTitle}>Spending it</h5>
            <ul className={styles.bullets}>
              <li>Buy extra copies of cards you already own, so you can field more of them in a deck.</li>
              <li>Attach <strong>stickers</strong> — permanent upgrades that make a card copy or a government board stronger. Each copy and each board holds only so many, so choose them with care.</li>
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
