import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { logger } from './services/logger.ts'

// Global safety net — catch any uncaught JS error or unhandled promise rejection
// and send it to the backend log so it appears alongside backend traces.
window.addEventListener('error', (e) => {
  logger.error('Uncaught error', {
    message: e.message,
    source:  e.filename,
    line:    e.lineno,
    col:     e.colno,
  });
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
  logger.error('Unhandled promise rejection', { reason });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
