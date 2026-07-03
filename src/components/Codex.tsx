import { FOOD_PER_POP } from '../rules/population';
import { cultureStep } from '../rules/culture';
import {
  CODEX_CORE_RESOURCES,
  CODEX_STRATEGIC,
  CODEX_GLOSSARY,
} from '../content/codex';
import { COST_ICON } from './CardFace';
import styles from './Codex.module.css';

/**
 * The Codex: the game's in-menu rules reference, rendered inside `GameMenu`'s codex
 * submenu. Deliberately **pure and static** — it takes no props and never reads run
 * state (`useGame`), so it renders identically on the meta menu and mid-run. `Collection`
 * already catalogues the cards; this fills the other gap — *how the game works*.
 *
 * A single scrollable page (its container caps height + scrolls) rather than nested
 * navigation — five short topics read fine top-to-bottom when pulled up mid-turn. The
 * list-shaped pages come from `content/codex.ts`; the narrative pages are authored here.
 * Rule *numbers* are pulled live from `rules/` (food upkeep, culture bands) so they can't
 * drift from the real mechanics when balance is retuned.
 */
export function Codex() {
  return (
    <div className={styles.codex}>
      {/* --- Resources --- */}
      <section className={styles.topic}>
        <h4 className={styles.topicTitle}>Resources</h4>
        <p className={styles.lead}>Five core resources you spend, and three strategic gauges that shape your civilization.</p>

        <h5 className={styles.subTitle}>Core</h5>
        <dl className={styles.defList}>
          {CODEX_CORE_RESOURCES.map((r) => (
            <div className={styles.defRow} key={r.key}>
              <dt className={styles.defTerm}>
                <span aria-hidden="true">{COST_ICON[r.key]}</span> {r.name}
              </dt>
              <dd className={styles.defDesc}>
                {r.role} <span className={styles.collapse}>Goes negative → {r.collapse}.</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className={styles.callout}>If any core resource drops below zero, the run ends immediately — whatever the mission.</p>

        <h5 className={styles.subTitle}>Strategic</h5>
        <dl className={styles.defList}>
          {CODEX_STRATEGIC.map((s) => (
            <div className={styles.defRow} key={s.name}>
              <dt className={styles.defTerm}>
                <span aria-hidden="true">{s.icon}</span> {s.name}
              </dt>
              <dd className={styles.defDesc}>{s.role}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --- Card kinds --- */}
      <section className={styles.topic}>
        <h4 className={styles.topicTitle}>Card kinds</h4>
        <p className={styles.lead}>A card&rsquo;s kind is about how it leaves your hand, not what it does.</p>
        <dl className={styles.defList}>
          <div className={styles.defRow}>
            <dt className={styles.defTerm}>Permanent</dt>
            <dd className={styles.defDesc}>Buildings and Wonders. Pay their cost to raise a building in your tableau; the card is then removed from the deck, thinning it. The building produces every round for the rest of the run.</dd>
          </div>
          <div className={styles.defRow}>
            <dt className={styles.defTerm}>Recurring</dt>
            <dd className={styles.defDesc}>Actions. Resolve their effect, then return to the discard pile — reshuffled back into the deck when it runs dry. Repeatable tactics.</dd>
          </div>
          <div className={styles.defRow}>
            <dt className={styles.defTerm}>Event</dt>
            <dd className={styles.defDesc}>Disasters injected into your deck by a mission. You cannot play them. An event left in your hand at the end of the round resolves its effect on you, then is destroyed for good.</dd>
          </div>
        </dl>
      </section>

      {/* --- Population & staffing --- */}
      <section className={styles.topic}>
        <h4 className={styles.topicTitle}>Population &amp; staffing</h4>
        <p className={styles.lead}>Buildings don&rsquo;t run themselves — your people staff them.</p>
        <ul className={styles.bullets}>
          <li>Your population is a pool of workers. Assign them to buildings to make those buildings operate; an unstaffed building produces nothing.</li>
          <li>Each building needs a set number of workers to run. A building requiring zero workers is self-sufficient and always operates.</li>
          <li>Every unit of population eats {FOOD_PER_POP} food each round, whether working or idle — so a bigger workforce needs a bigger food supply.</li>
          <li>Some action cards reserve idle workers as a cost: they&rsquo;re locked for the rest of the turn and freed at the start of the next round.</li>
        </ul>
      </section>

      {/* --- Turn structure --- */}
      <section className={styles.topic}>
        <h4 className={styles.topicTitle}>Turn structure</h4>
        <p className={styles.lead}>Each round runs through four phases.</p>
        <ol className={styles.phases}>
          <li><span className={styles.phaseName}>Upkeep</span> — staffed buildings produce, the mission&rsquo;s pressure ticks, and your population eats its food.</li>
          <li><span className={styles.phaseName}>Draw</span> — refill your hand up to its size (raised by your culture level).</li>
          <li><span className={styles.phaseName}>Action</span> — play permanents and recurring cards, and assign your workers.</li>
          <li><span className={styles.phaseName}>End</span> — check the mission&rsquo;s win and lose conditions, resolve any events left in hand, discard, and advance the round.</li>
        </ol>
      </section>

      {/* --- Keyword glossary --- */}
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
        <p className={styles.callout}>
          Culture climbs through levels — each level adds one card to your hand size. Reaching level&nbsp;1 takes {cultureStep(0)} culture, and every level after costs twice as much as the one before.
        </p>
      </section>
    </div>
  );
}
