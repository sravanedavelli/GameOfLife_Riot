import { describe, it, expect } from 'vitest';
import { parseCells, serializeCells } from '../services/api';

const LONG_MAX = 9223372036854775807n;
const LONG_MIN = -9223372036854775808n;

describe('parseCells', () => {
  it('converts string pairs to BigInt pairs', () => {
    const result = parseCells([['0', '1'], ['2', '3']]);
    expect(result).toEqual([[0n, 1n], [2n, 3n]]);
  });

  it('handles negative coordinates', () => {
    const result = parseCells([['-5', '-10']]);
    expect(result).toEqual([[-5n, -10n]]);
  });

  it('handles long.MaxValue without precision loss', () => {
    const result = parseCells([['9223372036854775807', '0']]);
    expect(result[0][0]).toBe(LONG_MAX);
  });

  it('handles long.MinValue without precision loss', () => {
    const result = parseCells([['-9223372036854775808', '0']]);
    expect(result[0][0]).toBe(LONG_MIN);
  });

  it('returns empty array for empty input', () => {
    expect(parseCells([])).toEqual([]);
  });
});

describe('serializeCells', () => {
  it('converts BigInt pairs to string pairs', () => {
    const result = serializeCells([[0n, 1n], [2n, 3n]]);
    expect(result).toEqual([['0', '1'], ['2', '3']]);
  });

  it('handles negative coordinates', () => {
    const result = serializeCells([[-5n, -10n]]);
    expect(result).toEqual([['-5', '-10']]);
  });

  it('serializes long.MaxValue exactly', () => {
    const result = serializeCells([[LONG_MAX, 0n]]);
    expect(result[0][0]).toBe('9223372036854775807');
  });

  it('serializes long.MinValue exactly', () => {
    const result = serializeCells([[LONG_MIN, 0n]]);
    expect(result[0][0]).toBe('-9223372036854775808');
  });

  it('returns empty array for empty input', () => {
    expect(serializeCells([])).toEqual([]);
  });
});

describe('parseCells / serializeCells round-trip', () => {
  it('round-trips normal coordinates', () => {
    const original: [bigint, bigint][] = [[0n, 1n], [-100n, 200n]];
    expect(parseCells(serializeCells(original))).toEqual(original);
  });

  it('round-trips long.MaxValue and long.MinValue', () => {
    const original: [bigint, bigint][] = [[LONG_MAX, LONG_MIN]];
    expect(parseCells(serializeCells(original))).toEqual(original);
  });
});
