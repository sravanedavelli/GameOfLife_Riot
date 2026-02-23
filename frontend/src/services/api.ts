import { sessionId } from './logger';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5290/api/v1/game';

// Public cell type used throughout the app — BigInt for full 64-bit precision.
export type Cell = [bigint, bigint];

export interface SimulationResponse {
  cells: Cell[];
  generationsComputed: number;
  liveCellCount: number;
}

// What the server actually sends: coordinates as strings so that 64-bit long
// values survive JSON transport without IEEE-754 double precision loss.
interface RawSimulationResponse {
  cells: [string, string][];
  generationsComputed: number;
  liveCellCount: number;
}

export function parseCells(raw: [string, string][]): Cell[] {
  return raw.map(([x, y]) => [BigInt(x), BigInt(y)]);
}

/** Reads the response body on error so the server's message is not lost. */
async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}${body ? `: ${body}` : ''}`);
  }
}

async function toSimulationResponse(res: Response): Promise<SimulationResponse> {
  await throwIfNotOk(res);
  const data: RawSimulationResponse = await res.json();
  return { ...data, cells: parseCells(data.cells) };
}

// Serialise BigInt cells to string pairs for the request body.
export function serializeCells(cells: Cell[]): [string, string][] {
  return cells.map(([x, y]) => [x.toString(), y.toString()]);
}

/**
 * Returns headers for every API request.
 * A fresh correlationId per call lets you find all backend log lines
 * for exactly that one request.  SessionId links the whole browser session.
 */
function makeHeaders(correlationId: string): Record<string, string> {
  return {
    'Content-Type':    'application/json',
    'X-Correlation-Id': correlationId,
    'X-Session-Id':    sessionId,
  };
}

export async function tick(cells: Cell[]): Promise<SimulationResponse & { correlationId: string }> {
  const correlationId = crypto.randomUUID();
  const res = await fetch(`${API_BASE}/tick`, {
    method: 'POST',
    headers: makeHeaders(correlationId),
    body: JSON.stringify({ cells: serializeCells(cells) }),
  });
  return { ...(await toSimulationResponse(res)), correlationId };
}

export async function simulate(cells: Cell[], generations: number): Promise<SimulationResponse & { correlationId: string }> {
  const correlationId = crypto.randomUUID();
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: makeHeaders(correlationId),
    body: JSON.stringify({ cells: serializeCells(cells), generations }),
  });
  return { ...(await toSimulationResponse(res)), correlationId };
}

export async function parseLife106(content: string): Promise<SimulationResponse & { correlationId: string }> {
  const correlationId = crypto.randomUUID();
  const res = await fetch(`${API_BASE}/parse`, {
    method: 'POST',
    headers: makeHeaders(correlationId),
    body: JSON.stringify({ content }),
  });
  return { ...(await toSimulationResponse(res)), correlationId };
}

export async function exportLife106(cells: Cell[]): Promise<string> {
  const correlationId = crypto.randomUUID();
  const res = await fetch(`${API_BASE}/export`, {
    method: 'POST',
    headers: makeHeaders(correlationId),
    body: JSON.stringify({ cells: serializeCells(cells) }),
  });
  await throwIfNotOk(res);
  // Server returns Content-Type: text/plain — no JSON wrapping
  return res.text();
}
