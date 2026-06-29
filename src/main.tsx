import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameProvider } from './run/GameContext';
import { Board } from './components/Board';
import { MISSIONS } from './content/missions';

const DEFAULT_MISSION = 'enlightenment';

function resolveMissionId(): string {
  const param = new URLSearchParams(window.location.search).get('mission');
  if (param && MISSIONS[param]) return param;
  return DEFAULT_MISSION;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameProvider missionId={resolveMissionId()}>
      <Board />
    </GameProvider>
  </React.StrictMode>,
);
