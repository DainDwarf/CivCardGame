import { useState } from 'react';
import { FOOD_PER_POP } from '../rules/population';
import { cultureStep } from '../rules/culture';
import {
  CODEX_CORE_RESOURCES,
  CODEX_STRATEGIC,
  CODEX_CARD_KINDS,
  CODEX_GLOSSARY,
} from '../content/codex';
import { RESOURCE_ICON } from './CardFace';
import styles from './Codex.module.css';

type SubjectId = 'resources' | 'cardTypes' | 'playATurn' | 'glossary';

const SUBJECTS: { id: SubjectId; label: string }[] = [
  { id: 'resources', label: 'Resources' },
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
 * — the four subjects are Resources, Card types, Play a turn, and Glossary.
 * The list-shaped pages come from `content/codex.ts`; the narrative pages are authored
 * here. Rule *numbers* are pulled live from `rules/` (food upkeep, culture bands) so
 * they can't drift from the real mechanics when balance is retuned.
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
            <p className={styles.lead}>Five core resources you spend, and three strategic gauges that shape your civilization.</p>

            <h5 className={styles.subTitle}>Core</h5>
            <p className={`${styles.callout} ${styles.calloutWarning}`}>If any core resource drops below zero, the run ends immediately — whatever the mission.</p>
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
            <p className={styles.callout}>
              Culture climbs through levels — each level adds one card to your hand size. Reaching level&nbsp;1 takes {cultureStep(0)} culture, and every level after costs twice as much as the one before.
            </p>
          </section>
        )}

        {subject === 'cardTypes' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Card types</h4>
            <p className={styles.lead}>Four kinds you build decks with, and three a mission brings to the table.</p>
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
          <>
            <section className={styles.topic}>
              <h4 className={styles.topicTitle}>Population &amp; staffing</h4>
              <p className={styles.lead}>Buildings don&rsquo;t run themselves — your people staff them.</p>
              <ul className={styles.bullets}>
                <li>Your population is a pool of workers. Assign them to buildings to make those buildings operate; an unstaffed building produces nothing.</li>
                <li>Each building has a worker capacity — the most it can hold. A single worker is enough to make it operate, and its output scales with every worker you add on top, up to that capacity. A building with a capacity of zero is self-sufficient and always operates.</li>
                <li>Every unit of population eats {FOOD_PER_POP} food each round, whether working or idle — so a bigger workforce needs a bigger food supply.</li>
                <li>Work cards stick onto the board as staffable boxes, just like buildings. Staff one to collect its output at end of round; an unstaffed Work card simply does nothing.</li>
              </ul>
            </section>

            <section className={styles.topic}>
              <h4 className={styles.topicTitle}>Turn structure</h4>
              <p className={styles.lead}>Each round runs through four phases.</p>
              <ol className={styles.phases}>
                <li><span className={styles.phaseName}>Draw</span> — refill your hand up to its size (raised by your culture level).</li>
                <li><span className={styles.phaseName}>Action</span> — play your cards and assign your workers.</li>
                <li><span className={styles.phaseName}>Upkeep</span> — staffed buildings and Work cards produce, the mission&rsquo;s pressure ticks, and your population eats its food.</li>
                <li><span className={styles.phaseName}>End</span> — any events left in your hand strike, your hand and the turn&rsquo;s Work cards file to the discard, and the round advances.</li>
              </ol>
              <p className={styles.callout}>
                Upkeep and End both fire when you end the round, so anything you played this turn is collected before the round closes. Your mission&rsquo;s win and lose conditions are checked continuously — not only at the round&rsquo;s end.
              </p>
            </section>
          </>
        )}

        {subject === 'glossary' && (
          <section className={styles.topic}>
            <h4 className={styles.topicTitle}>Glossary</h4>
            <p className={styles.lead}>The small print that appears on cards.</p>
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
