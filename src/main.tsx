import React from 'react';
import ReactDOM from 'react-dom/client';
import { CivClient } from './client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CivClient />
  </React.StrictMode>,
);
