import { describe, it, expect } from 'vitest';
import { validateLife106, LONG_MIN, LONG_MAX } from '../hooks/useGameOfLife';

describe('validateLife106', () => {
  it('returns null for a valid file', () => {
    const input = '#Life 1.06\n0 1\n1 2\n2 0\n';
    expect(validateLife106(input)).toBeNull();
  });

  it('returns null for an empty file', () => {
    expect(validateLife106('')).toBeNull();
  });

  it('returns null for header-only file', () => {
    expect(validateLife106('#Life 1.06\n')).toBeNull();
  });

  it('returns null when comment lines and blank lines are present', () => {
    const input = '#Life 1.06\n# this is a comment\n\n0 0\n';
    expect(validateLife106(input)).toBeNull();
  });

  it('returns null for lines with wrong token count — not counted as invalid', () => {
    const input = '#Life 1.06\nnot a cell\n0 0\n1 2 3\n';
    expect(validateLife106(input)).toBeNull();
  });

  it('returns error for coordinate exceeding long.MaxValue', () => {
    const input = `#Life 1.06\n0 1\n${LONG_MAX + 1n} 0\n`;
    expect(validateLife106(input)).toContain('1 line(s)');
  });

  it('returns error for coordinate below long.MinValue', () => {
    const input = `#Life 1.06\n${LONG_MIN - 1n} 0\n`;
    expect(validateLife106(input)).toContain('1 line(s)');
  });

  it('returns null for coordinate exactly at long.MaxValue', () => {
    const input = `#Life 1.06\n${LONG_MAX} 0\n`;
    expect(validateLife106(input)).toBeNull();
  });

  it('returns null for coordinate exactly at long.MinValue', () => {
    const input = `#Life 1.06\n${LONG_MIN} 0\n`;
    expect(validateLife106(input)).toBeNull();
  });

  it('returns error for non-integer coordinate string', () => {
    const input = '#Life 1.06\nabc def\n';
    expect(validateLife106(input)).toContain('1 line(s)');
  });

  it('counts multiple invalid lines correctly', () => {
    const input = `#Life 1.06\n${LONG_MAX + 1n} 0\nabc def\n0 0\n`;
    expect(validateLife106(input)).toContain('2 line(s)');
  });

  it('handles Windows CRLF line endings', () => {
    const input = '#Life 1.06\r\n0 1\r\n1 2\r\n';
    expect(validateLife106(input)).toBeNull();
  });

  it('returns null for large but valid negative coordinates', () => {
    const input = '#Life 1.06\n-2000000000000 -2000000000000\n';
    expect(validateLife106(input)).toBeNull();
  });
});
