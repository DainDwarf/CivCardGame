import { Client } from 'boardgame.io/react';
import { CivGame } from './run';
import { Board } from './components/Board';

// Single-player, local, no server. The boardgame.io Debug panel is enabled so you
// can inspect G/ctx, fire moves, and time-travel during development.
export const CivClient = Client({
  game: CivGame,
  board: Board,
  numPlayers: 1,
  debug: true,
});
