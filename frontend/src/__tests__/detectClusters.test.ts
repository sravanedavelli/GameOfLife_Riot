import { describe, it, expect } from 'vitest';
import { detectClusters } from '../App';
import type { Cell } from '../services/api';

describe('detectClusters', () => {
  it('returns empty array for no cells', () => {
    expect(detectClusters([])).toEqual([]);
  });

  it('returns one cluster for a single cell', () => {
    const cells: Cell[] = [[5n, 10n]];
    const result = detectClusters(cells);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(5n);
    expect(result[0].y).toBe(10n);
  });

  it('groups nearby cells into one cluster', () => {
    // All within 100-cell margin of each other
    const cells: Cell[] = [[0n, 0n], [1n, 1n], [2n, 2n]];
    const result = detectClusters(cells);
    expect(result).toHaveLength(1);
  });

  it('separates cells that are far apart into different clusters', () => {
    // 2 trillion cells apart — well beyond the 100-cell CLUSTER_MARGIN
    const cells: Cell[] = [[0n, 0n], [2_000_000_000_000n, 2_000_000_000_000n]];
    const result = detectClusters(cells);
    expect(result).toHaveLength(2);
  });

  it('computes cluster center as midpoint of bounding box', () => {
    const cells: Cell[] = [[0n, 0n], [10n, 20n]];
    const result = detectClusters(cells);
    expect(result[0].x).toBe(5n);   // (0 + 10) / 2
    expect(result[0].y).toBe(10n);  // (0 + 20) / 2
  });

  it('uses "Fit All" label when there is only one cluster', () => {
    const cells: Cell[] = [[0n, 0n], [1n, 1n]];
    const result = detectClusters(cells);
    expect(result[0].label).toContain('Fit All');
    expect(result[0].label).toContain('2 cells');
  });

  it('uses "Cluster N" label when there are multiple clusters', () => {
    const cells: Cell[] = [[0n, 0n], [2_000_000_000_000n, 0n]];
    const result = detectClusters(cells);
    expect(result[0].label).toContain('Cluster 1');
    expect(result[1].label).toContain('Cluster 2');
  });

  it('sorts clusters by minX ascending', () => {
    const cells: Cell[] = [[2_000_000_000_000n, 0n], [0n, 0n]];
    const result = detectClusters(cells);
    expect(result[0].x).toBe(0n);
    expect(result[1].x).toBe(2_000_000_000_000n);
  });

  it('includes correct cell count in label', () => {
    const cells: Cell[] = [
      [0n, 0n], [1n, 0n], [2n, 0n],            // cluster 1: 3 cells
      [2_000_000_000_000n, 0n],                  // cluster 2: 1 cell
    ];
    const result = detectClusters(cells);
    expect(result[0].label).toContain('3 cells');
    expect(result[1].label).toContain('1 cell');
  });

  it('works at large BigInt coordinates near long.MaxValue', () => {
    const LARGE = 9_000_000_000_000_000_000n;
    const cells: Cell[] = [[LARGE, LARGE], [LARGE + 1n, LARGE + 1n]];
    const result = detectClusters(cells);
    expect(result).toHaveLength(1);
  });
});
