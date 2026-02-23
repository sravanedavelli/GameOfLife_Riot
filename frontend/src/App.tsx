import { useState, useMemo } from 'react';
import { Grid } from './components/Grid';
import { Controls, type Cluster } from './components/Controls';
import { FileUpload } from './components/FileUpload';
import { useGameOfLife } from './hooks/useGameOfLife';
import type { Cell } from './services/api';

// Cells whose bounding boxes overlap within this margin (in cells) are merged
// into the same cluster. Large enough to group typical patterns but small
// enough to separate clusters that are far apart.
const CLUSTER_MARGIN = 100n;

/**
 * Groups cells into spatial clusters using bounding-box expansion.
 * Each cell is assigned to the first existing cluster whose bounding box
 * (expanded by CLUSTER_MARGIN on all sides) contains the cell.
 * If no cluster matches, a new one is created.
 *
 * BigInt arithmetic is used throughout so coordinates near ±long.MaxValue
 * are handled exactly without precision loss.
 */
export function detectClusters(cells: Cell[]): Cluster[] {
  if (cells.length === 0) return [];

  type BBox = {
    minX: bigint; maxX: bigint;
    minY: bigint; maxY: bigint;
    count: number;
  };

  const boxes: BBox[] = [];

  for (const [cx, cy] of cells) {
    const match = boxes.find(
      (b) =>
        cx >= b.minX - CLUSTER_MARGIN &&
        cx <= b.maxX + CLUSTER_MARGIN &&
        cy >= b.minY - CLUSTER_MARGIN &&
        cy <= b.maxY + CLUSTER_MARGIN
    );
    if (match) {
      if (cx < match.minX) match.minX = cx;
      if (cx > match.maxX) match.maxX = cx;
      if (cy < match.minY) match.minY = cy;
      if (cy > match.maxY) match.maxY = cy;
      match.count++;
    } else {
      boxes.push({ minX: cx, maxX: cx, minY: cy, maxY: cy, count: 1 });
    }
  }

  // Safe sort — no subtraction, avoids overflow for large BigInt coordinates.
  boxes.sort((a, b) => (a.minX < b.minX ? -1 : a.minX > b.minX ? 1 : 0));

  return boxes.map((box, i) => {
    const cx = (box.minX + box.maxX) / 2n; // BigInt division truncates — fine for center
    const cy = (box.minY + box.maxY) / 2n;
    const label = boxes.length > 1
      ? `Cluster ${i + 1} (${box.count} cells)`
      : `Fit All (${box.count} cells)`;
    return { label, x: cx, y: cy };
  });
}

function App() {
  const game = useGameOfLife();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // centerOn key increments on every jump so Grid's useEffect always fires,
  // even when jumping to the same coordinate twice.
  const [centerOn, setCenterOn] = useState<{ x: bigint; y: bigint; key: number } | null>(null);

  const clusters = useMemo(() => detectClusters(game.cells), [game.cells]);

  const jumpTo = (x: bigint, y: bigint) => {
    setCenterOn((prev) => ({ x, y, key: (prev?.key ?? 0) + 1 }));
  };

  const handleReset = () => {
    game.reset();
    jumpTo(0n, 0n);
  };

  const handleLoadFile = async (content: string) => {
    const success = await game.loadLife106(content);
    if (success) {
      jumpTo(0n, 0n);
      setStatusMessage('Pattern loaded from file');
      window.setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>Conway's Game of Life</h1>
        <span style={styles.subtitle}>64-bit coordinate space</span>
      </header>
      {statusMessage && (
        <div style={styles.toast}>{statusMessage}</div>
      )}
      <FileUpload onLoad={handleLoadFile} onExport={game.exportCells} />
      <Controls
        generation={game.generation}
        liveCellCount={game.liveCellCount}
        isPlaying={game.isPlaying}
        speed={game.speed}
        loading={game.loading}
        error={game.error}
        clusters={clusters}
        onStep={game.stepForward}
        onSimulateN={game.simulateN}
        onTogglePlay={game.togglePlay}
        onReset={handleReset}
        onSpeedChange={game.setSpeed}
        onClearError={game.clearError}
        onJumpTo={jumpTo}
      />
      <Grid cells={game.cells} onToggleCell={game.toggleCell} centerOn={centerOn} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'relative',
    background: '#0a0907',
    color: '#c8b896',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '10px 20px',
    background: '#06050300',
    borderBottom: '1px solid #2a2218',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundImage: 'linear-gradient(to right, #0d0b08, #0a0907)',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    color: '#e8d48a',
  },
  subtitle: {
    fontSize: '10px',
    color: '#c4a25b',
    background: 'rgba(196,162,91,0.08)',
    padding: '2px 10px',
    borderRadius: '2px',
    border: '1px solid rgba(196,162,91,0.3)',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  toast: {
    position: 'absolute',
    top: 12,
    right: 20,
    padding: '6px 12px',
    background: 'rgba(16,16,10,0.95)',
    border: '1px solid #2a2218',
    borderRadius: 4,
    color: '#c4a25b',
    fontSize: '11px',
    letterSpacing: '0.5px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  },
};

export default App;
