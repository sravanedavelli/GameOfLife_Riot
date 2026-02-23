import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as api from '../services/api';
import type { Cell } from '../services/api';
import { logger } from '../services/logger';

export const LONG_MIN = -9223372036854775808n;
export const LONG_MAX = 9223372036854775807n;

// Validates a Life 1.06 file on the client before sending to the backend.
// Returns an error message if any coordinate line has out-of-range or non-integer values,
// or null if the file looks valid.
export function validateLife106(content: string): string | null {
  let invalidCount = 0;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length !== 2) continue;
    try {
      const x = BigInt(parts[0]);
      const y = BigInt(parts[1]);
      if (x < LONG_MIN || x > LONG_MAX || y < LONG_MIN || y > LONG_MAX) invalidCount++;
    } catch {
      invalidCount++;
    }
  }
  return invalidCount > 0
    ? `File contains ${invalidCount} line(s) with invalid or out-of-range coordinates.`
    : null;
}

export function useGameOfLife() {
  // Internal state: Map for O(1) lookup by "x,y" key.
  const [cellMap, setCellMap] = useState<Map<string, Cell>>(new Map());
  const [generation, setGeneration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null); // timer ID for auto-play
  // Sync ref guards against concurrent API calls without needing to recreate the interval.
  const loadingRef = useRef(false);
  // Ref to the latest stepForward so the interval never holds a stale closure.
  const stepForwardRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Monotonically increasing ID. Incremented on reset/load to invalidate any
  // in-flight API call, preventing stale results from overwriting fresh state.
  const requestIdRef = useRef(0);

  // Derived array for API calls and Grid rendering — stable reference unless cellMap changes.
  const cells = useMemo(() => Array.from(cellMap.values()), [cellMap]);

  const setCellsFromArray = useCallback((arr: Cell[]) => {
    const m = new Map<string, Cell>();
    for (const cell of arr) m.set(`${cell[0]},${cell[1]}`, cell);
    setCellMap(m);
  }, []);

  // Synchronously stop the play interval and return whether it was running.
  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return true;
    }
    return false;
  }, []);

  const stepForward = useCallback(async () => {
    if (cellMap.size === 0) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const myId = ++requestIdRef.current;
    try {
      const result = await api.tick(Array.from(cellMap.values()));
      if (myId !== requestIdRef.current) return; // cancelled by reset or load
      logger.debug('Tick completed', { inputCells: cellMap.size, outputCells: result.cells.length }, result.correlationId);
      setCellsFromArray(result.cells);
      setGeneration((g) => g + 1);
    } catch (e) {
      if (myId !== requestIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Tick failed', { error: msg, cellCount: cellMap.size });
      setError(
        `Step failed: ${msg}. Auto-play has been stopped; try Reset or Load File if the backend was restarted.`
      );
      // Stop auto-play so we don't keep hammering a backend that is down.
      stopInterval();
      setIsPlaying(false);
    } finally {
      if (myId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [cellMap, setCellsFromArray]);

  useEffect(() => {
    stepForwardRef.current = stepForward;
  }, [stepForward]);

  const simulateN = useCallback(async (n: number) => {
    if (cells.length === 0) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const myId = ++requestIdRef.current;
    logger.info('Simulate requested', { generations: n, inputCells: cells.length });
    try {
      const result = await api.simulate(cells, n);
      if (myId !== requestIdRef.current) return;
      logger.info('Simulate completed', { generations: n, inputCells: cells.length, outputCells: result.cells.length }, result.correlationId);
      setCellsFromArray(result.cells);
      setGeneration((g) => g + n);
    } catch (e) {
      if (myId !== requestIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Simulate failed', { error: msg, generations: n, cellCount: cells.length });
      setError(
        `Simulate failed: ${msg}. Try again or Reset if the backend was restarted.`
      );
    } finally {
      if (myId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [cells, setCellsFromArray]);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  // Interval only restarts when isPlaying or speed changes — NOT on every tick.
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        stepForwardRef.current();
      }, speed);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed]);

  const reset = useCallback(() => {
    logger.info('Grid reset');
    // Synchronously kill the interval — don't wait for the next render cycle
    stopInterval();
    // Invalidate any in-flight request so its result is discarded on arrival
    requestIdRef.current++;
    loadingRef.current = false;
    setIsPlaying(false);
    setCellMap(new Map());
    setGeneration(0);
    setError(null);
    setLoading(false);
  }, [stopInterval]);

  // O(1) toggle: Map lookup instead of O(n) array scan
  //Looks up the coordinate in the Map — if it exists, remove it; if not, add it.
  const toggleCell = useCallback((x: bigint, y: bigint) => {
    if (x < LONG_MIN || x > LONG_MAX || y < LONG_MIN || y > LONG_MAX) return;
    const key = `${x},${y}`;
    setCellMap((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, [x, y]);
      return next;
    });
  }, []);

  const loadLife106 = useCallback(async (content: string): Promise<boolean> => {
    // Cancel any in-flight tick/simulate so their results don't overwrite the new load.
    // Also reset loadingRef so this load can proceed even if a previous call was mid-flight.
    requestIdRef.current++;
    loadingRef.current = false;
    // Stop any running play before loading new content.
    stopInterval();
    setIsPlaying(false);

    const validationError = validateLife106(content);
    if (validationError) {
      logger.warn('Life106 file rejected by client validation', { reason: validationError });
      setError(`Load failed: ${validationError}`);
      return false;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const myId = ++requestIdRef.current;
    logger.info('Loading Life106 file', { contentLength: content.length });
    try {
      const result = await api.parseLife106(content);
      if (myId !== requestIdRef.current) return false;
      logger.info('Life106 file loaded', { cellCount: result.cells.length }, result.correlationId);
      setCellsFromArray(result.cells);
      setGeneration(0);
      return true;
    } catch (e) {
      if (myId !== requestIdRef.current) return false;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Life106 load failed', { error: msg });
      setError(`Load failed: ${msg}`);
      return false;
    } finally {
      if (myId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [setCellsFromArray, stopInterval]);

  const exportCells = useCallback(async (): Promise<string> => {
    setError(null);
    logger.info('Exporting cells', { cellCount: cells.length });
    try {
      const output = await api.exportLife106(cells);
      logger.info('Export completed', { cellCount: cells.length, outputLength: output.length });
      return output;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Export failed', { error: msg, cellCount: cells.length });
      setError(`Export failed: ${msg}`);
      return '';
    }
  }, [cells]);

  const clearError = useCallback(() => setError(null), []);

  return {
    cells,
    generation,
    isPlaying,
    speed,
    loading,
    error,
    liveCellCount: cellMap.size,
    stepForward,
    simulateN,
    togglePlay,
    reset,
    toggleCell,
    setSpeed,
    loadLife106,
    exportCells,
    clearError,
  };
}
