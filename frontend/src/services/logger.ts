/**
 * Structured frontend logger.
 *
 * Every page load gets a unique sessionId.
 * Every outgoing API call gets a unique correlationId (generated in api.ts).
 * Both are sent to the backend /api/log endpoint so frontend and backend
 * log lines for the same transaction share a common CorrelationId and SessionId.
 */

// Strip /game from the end so LOG_BASE inherits the same version as VITE_API_BASE.
// e.g. http://localhost:5290/api/v1/game → http://localhost:5290/api/v1
const LOG_BASE = (import.meta.env.VITE_API_BASE as string | undefined)
  ?.replace(/\/game$/, '')
  ?? 'http://localhost:5290/api/v1';

/** One UUID per browser tab/session — stable for the lifetime of the page. */
export const sessionId: string = crypto.randomUUID();

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  correlationId?: string;
  properties?: Record<string, unknown>;
}

//This Typically can be a seperate loggin API service in enterprise.
async function sendToBackend(payload: LogPayload): Promise<void> {
  try {
    await fetch(`${LOG_BASE}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, sessionId }),
      // keepalive lets the browser complete the request even if the page unloads
      keepalive: true,
    });
  } catch {
    // Never throw from the logger — a logging failure must not break the app.
  }
}

function write(
  level: LogLevel,
  message: string,
  properties?: Record<string, unknown>,
  correlationId?: string,
): void {
  const entry = { level, message, properties, correlationId, sessionId };

  // Always log to the browser console with full structure.
  const fn =
    level === 'error' ? console.error :
    level === 'warn'  ? console.warn  :
    level === 'debug' ? console.debug :
                        console.info;
  fn(`[${level.toUpperCase()}]`, message, properties ?? '');

  // Send to backend (fire-and-forget) — skip debug to avoid noise.
  if (level !== 'debug') {
    void sendToBackend(entry);
  }
}

export const logger = {
  debug: (message: string, properties?: Record<string, unknown>, correlationId?: string) =>
    write('debug', message, properties, correlationId),

  info: (message: string, properties?: Record<string, unknown>, correlationId?: string) =>
    write('info', message, properties, correlationId),

  warn: (message: string, properties?: Record<string, unknown>, correlationId?: string) =>
    write('warn', message, properties, correlationId),

  error: (message: string, properties?: Record<string, unknown>, correlationId?: string) =>
    write('error', message, properties, correlationId),
};
