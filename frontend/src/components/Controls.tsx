import { useState } from 'react';

export interface Cluster {
  label: string;
  x: bigint;
  y: bigint;
}

interface ControlsProps {
  generation: number;
  liveCellCount: number;
  isPlaying: boolean;
  speed: number;
  loading: boolean;
  error: string | null;
  clusters: Cluster[];
  onStep: () => void;
  onSimulateN: (n: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onClearError: () => void;
  onJumpTo: (x: bigint, y: bigint) => void;
}

export function Controls({
  generation,
  liveCellCount,
  isPlaying,
  speed,
  loading,
  error,
  clusters,
  onStep,
  onSimulateN,
  onTogglePlay,
  onReset,
  onSpeedChange,
  onClearError,
  onJumpTo,
}: ControlsProps) {
  const [jumpX, setJumpX] = useState('');
  const [jumpY, setJumpY] = useState('');

  const handleJump = () => {
    if (jumpX.trim() === '' || jumpY.trim() === '') return;
    try {
      // BigInt() throws on non-integer strings — caught silently below.
      onJumpTo(BigInt(jumpX.trim()), BigInt(jumpY.trim()));
    } catch {
      // Input is not a valid integer — ignore.
    }
  };

  const handleJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleJump();
  };

  return (
    <>
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button style={styles.errorDismiss} onClick={onClearError}>✕</button>
        </div>
      )}
      <div style={styles.container}>

        {/* Stats */}
        <div style={styles.stats}>
          <span style={styles.stat}>Gen <strong style={styles.statValue}>{generation}</strong></span>
          <span style={styles.stat}>Cells <strong style={styles.statValue}>{liveCellCount}</strong></span>
        </div>

        <div style={styles.divider} />

        {/* Playback — Step and Play/Pause together */}
        <div style={styles.group}>
          <button style={styles.btn} onClick={onStep} disabled={loading}>
            Step
          </button>
          <button
            style={{ ...styles.btn, ...(isPlaying ? styles.btnActive : styles.btnPlay) }}
            onClick={onTogglePlay}
            disabled={loading}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>

        <div style={styles.divider} />

        {/* Simulation — bulk generation jumps */}
        <div style={styles.group}>
          <button style={styles.btn} onClick={() => onSimulateN(10)} disabled={loading}>
            +10
          </button>
          <button style={styles.btn} onClick={() => onSimulateN(100)} disabled={loading}>
            +100
          </button>
        </div>

        <div style={styles.divider} />

        {/* Speed slider — Fast on left, Slow on right */}
        <div style={styles.speedControl}>
          <span>Fast</span>
          <input
            type="range"
            min={50}
            max={1000}
            step={50}
            value={speed}
            title={`${speed}ms`}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            style={styles.slider}
          />
          <span>Slow</span>
        </div>

        {/* Navigation pushed to right, Reset isolated at far end */}
        <div style={styles.nav}>
          {clusters.map((c, i) => (
            <button
              key={i}
              style={{ ...styles.btn, ...styles.btnCluster }}
              onClick={() => onJumpTo(c.x, c.y)}
              title={`Center viewport on (${c.x}, ${c.y})`}
            >
              {c.label}
            </button>
          ))}
          <div style={styles.jumpGroup}>
            <input
              style={styles.jumpInput}
              type="text"
              placeholder="X"
              value={jumpX}
              onChange={(e) => setJumpX(e.target.value)}
              onKeyDown={handleJumpKeyDown}
            />
            <input
              style={styles.jumpInput}
              type="text"
              placeholder="Y"
              value={jumpY}
              onChange={(e) => setJumpY(e.target.value)}
              onKeyDown={handleJumpKeyDown}
            />
            <button style={styles.btn} onClick={handleJump}>
              Go
            </button>
          </div>
          <div style={styles.divider} />
          <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={onReset}>
            Reset
          </button>
        </div>

      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  errorBanner: {
    padding: '7px 20px',
    background: '#1a0a08',
    borderBottom: '1px solid #4a1a18',
    color: '#e07060',
    fontSize: '11px',
    letterSpacing: '0.5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#e07060',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0 4px',
    opacity: 0.7,
  },
  container: {
    padding: '9px 20px',
    background: '#0d0b08',
    borderBottom: '1px solid #2a2218',
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
  },
  stats: {
    display: 'flex',
    gap: '8px',
  },
  stat: {
    color: '#b09a6a',
    fontSize: '11px',
    background: '#120f0a',
    border: '1px solid #2a2218',
    borderRadius: '2px',
    padding: '4px 10px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  statValue: {
    color: '#c4a25b',
    fontWeight: 700,
  },
  divider: {
    width: '1px',
    height: '20px',
    background: '#2a2218',
    flexShrink: 0,
  },
  group: {
    display: 'flex',
    gap: '6px',
  },
  buttons: {
    display: 'flex',
    gap: '6px',
  },
  btn: {
    padding: '6px 14px',
    background: '#1a1510',
    color: '#c8b896',
    border: '1px solid #3a3020',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  btnPlay: {
    borderColor: '#5a4a20',
    color: '#c4a25b',
  },
  btnActive: {
    background: '#c4a25b',
    borderColor: '#c4a25b',
    color: '#0a0907',
    fontWeight: 700,
  },
  btnDanger: {
    background: 'transparent',
    borderColor: '#5a1f1f',
    color: '#c04040',
  },
  btnCluster: {
    background: '#0f1218',
    borderColor: '#2a3040',
    color: '#7a9aba',
    fontSize: '10px',
    letterSpacing: '0.5px',
  },
  speedControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#b09a6a',
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  slider: {
    width: '90px',
    accentColor: '#c4a25b',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginLeft: 'auto',
  },
  jumpGroup: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  jumpInput: {
    width: '76px',
    padding: '5px 8px',
    background: '#120f0a',
    color: '#c8b896',
    border: '1px solid #3a3020',
    borderRadius: '2px',
    fontSize: '11px',
  },
};
