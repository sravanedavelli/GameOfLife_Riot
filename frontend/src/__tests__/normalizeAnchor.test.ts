import { describe, it, expect } from 'vitest';
import { normalizeAnchor } from '../components/Grid';

const CELL_SIZE = 20;

describe('normalizeAnchor', () => {
  it('leaves pixel unchanged when already near zero', () => {
    const result = normalizeAnchor({
      cell: { x: 0n, y: 0n },
      pixel: { x: 5, y: 3 },
    });
    expect(result.pixel.x).toBe(5);
    expect(result.pixel.y).toBe(3);
    expect(result.cell.x).toBe(0n);
    expect(result.cell.y).toBe(0n);
  });

  it('absorbs whole cells from positive pixel offset into cell coordinate', () => {
    // pixel.x = 63 → shiftX = round(63/20) = 3
    const result = normalizeAnchor({
      cell: { x: 100n, y: 50n },
      pixel: { x: 63, y: 0 },
    });
    expect(result.cell.x).toBe(97n);   // 100 - 3
    expect(result.pixel.x).toBe(3);    // 63 - 3*20
  });

  it('absorbs whole cells from negative pixel offset into cell coordinate', () => {
    // pixel.y = -42 → shiftY = round(-42/20) = -2
    const result = normalizeAnchor({
      cell: { x: 0n, y: 50n },
      pixel: { x: 0, y: -42 },
    });
    expect(result.cell.y).toBe(52n);   // 50 - (-2)
    expect(result.pixel.y).toBe(-2);   // -42 - (-2)*20
  });

  it('keeps pixel within half a cell size of zero after normalize', () => {
    const result = normalizeAnchor({
      cell: { x: 0n, y: 0n },
      pixel: { x: 999, y: -888 },
    });
    expect(Math.abs(result.pixel.x)).toBeLessThanOrEqual(CELL_SIZE / 2);
    expect(Math.abs(result.pixel.y)).toBeLessThanOrEqual(CELL_SIZE / 2);
  });

  it('works correctly at large BigInt cell coordinates', () => {
    const LARGE = 9223372036854775000n;
    const result = normalizeAnchor({
      cell: { x: LARGE, y: LARGE },
      pixel: { x: 60, y: 0 },
    });
    // shiftX = round(60/20) = 3
    expect(result.cell.x).toBe(LARGE - 3n);
    expect(result.pixel.x).toBe(0);   // 60 - 3*20
  });

  it('does not change position — pixel + cell describe the same point before and after', () => {
    const before = { cell: { x: 10n, y: 20n }, pixel: { x: 45, y: -35 } };
    const after = normalizeAnchor(before);
    // The screen position of cell (0,0) relative to anchor should be equivalent
    const beforeScreenX = Number(-before.cell.x) * CELL_SIZE + before.pixel.x;
    const afterScreenX  = Number(-after.cell.x)  * CELL_SIZE + after.pixel.x;
    expect(Math.abs(afterScreenX - beforeScreenX)).toBeLessThan(1);
  });
});
