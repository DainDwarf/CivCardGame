import type { CodexBlock } from './codex';

/**
 * The author's note — shown as the one-time end-of-campaign popup and, permanently, on the ☰ menu's
 * About page (`components/AboutPage.tsx`). `CodexBlock[]` so it draws through the same renderer the
 * tutorial texts do, at the same popup type scale.
 *
 * The two surfaces share the middle and differ at the ends: the popup is read once, with the campaign
 * just finished, while the About page is read at any point of it — so the framing sentence and the
 * tense of the closing line are the surface's, and everything else is authored once.
 */

/** The published name, in its two halves — the nav sets the subtitle on its own line — and joined. */
export const GAME_TITLE = 'Age of Deckbuilder';
export const GAME_SUBTITLE = 'Prelude';
export const GAME_NAME = `${GAME_TITLE}: ${GAME_SUBTITLE}`;

/** Which surface is drawing the note. */
export type AboutSurface = 'end' | 'about';

/** The popup's panel title — the note's own opening line, so it isn't a block. */
export const ABOUT_TITLE = 'Thank you for playing.';

const MADE_THIS_GAME =
  "I'm DainDwarf, and I made this game with the help of Claude, in an intense 2 months of developing and " +
  'learning, to try out my idea of mixing deckbuilders with a civilization-like progression.';

const THE_FUTURE =
  'this is the last planned version. With what I\'ve learned in these two months, my ambitions have grown. ' +
  'Everything it taught me — what worked, what didn\'t — goes into a new game on the same theme, designed ' +
  'from scratch. This is why this game is the Prelude.';

const COME_SAY_HELLO =
  'I want to know. Come say hello on Discord, open an issue on GitHub, and follow either for news of the ' +
  'next game.';

export function aboutNote(surface: AboutSurface): CodexBlock[] {
  const end = surface === 'end';
  return [
    { kind: 'para', spans: [end ? `You have reached the end of the campaign. ${MADE_THIS_GAME}` : MADE_THIS_GAME] },
    { kind: 'para', spans: [`While I ${end ? 'loved' : 'love'} working on this game, ${THE_FUTURE}`] },
    {
      kind: 'para',
      spans: [
        end
          ? `If you enjoyed it, or if something bothered you, ${COME_SAY_HELLO}`
          : `If you enjoy it, or if something bothers you, ${COME_SAY_HELLO}`,
      ],
    },
  ];
}
