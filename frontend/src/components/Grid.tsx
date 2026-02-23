import { useRef, useEffect, useCallback, useState } from 'react';
import type { Cell } from '../services/api';

export interface Anchor {
  /** Which grid cell is the reference point. */
  cell: { x: bigint; y: bigint };
  /** Where that cell's top-left corner appears on the canvas (pixels). */
  pixel: { x: number; y: number };
}

interface GridProps {
  cells: Cell[];
  onToggleCell: (x: bigint, y: bigint) => void;
  centerOn?: { x: bigint; y: bigint; key: number } | null;
}

const CELL_SIZE = 20;
const GRID_COLOR = '#253d58';   // clear blue-grey grid lines
const CELL_COLOR = '#d4edff';   // near-white blue — maximum contrast on dark background
const BG_COLOR   = '#0a1220';   // dark navy — slightly lighter so grid lines register
const ORIGIN_CROSSHAIR_COLOR = '#2a4a6a';

// 64-bit grid boundary — matches C# long.MaxValue / long.MinValue.
const BOUNDARY_MAX = 9223372036854775807n;
const BOUNDARY_MIN = -9223372036854775808n;
const BOUNDARY_COLOR = '#c8372d';              // Noxus red — LoL red team
const BOUNDARY_FILL  = 'rgba(200, 55, 45, 0.12)';

/** Visible viewport: canvas size, anchor, and the cell/pixel range on screen. */
export interface ViewState {
  w: number;
  h: number;
  anchor: Anchor;
  startColOff: number;
  endColOff: number;
  startRowOff: number;
  endRowOff: number;
  startCol: bigint;
  endCol: bigint;
  startRow: bigint;
  endRow: bigint;
}

/** Compute the visible cell range from canvas size and anchor. */
export function getViewState(w: number, h: number, anchor: Anchor): ViewState {
  const { cell: anchorCell, pixel: anchorPixel } = anchor;
  const startColOff = Math.floor(-anchorPixel.x / CELL_SIZE) - 1;
  const endColOff   = Math.ceil((w - anchorPixel.x) / CELL_SIZE) + 1;
  const startRowOff = Math.floor(-anchorPixel.y / CELL_SIZE) - 1;
  const endRowOff   = Math.ceil((h - anchorPixel.y) / CELL_SIZE) + 1;
  return {
    w, h, anchor,
    startColOff, endColOff, startRowOff, endRowOff,
    startCol: anchorCell.x + BigInt(startColOff),
    endCol:   anchorCell.x + BigInt(endColOff),
    startRow: anchorCell.y + BigInt(startRowOff),
    endRow:   anchorCell.y + BigInt(endRowOff),
  };
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);
}

function drawGridLines(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const { w, h, anchor } = view;
  const { pixel: anchorPixel } = anchor;
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  for (let col = view.startColOff; col <= view.endColOff; col++) {
    const px = col * CELL_SIZE + anchorPixel.x;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }
  for (let row = view.startRowOff; row <= view.endRowOff; row++) {
    const py = row * CELL_SIZE + anchorPixel.y;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }
}

function drawCells(ctx: CanvasRenderingContext2D, view: ViewState, cells: Cell[]): void {
  const { anchor } = view;
  const { cell: anchorCell, pixel: anchorPixel } = anchor;
  ctx.fillStyle = CELL_COLOR;
  for (const [x, y] of cells) {
    if (x < view.startCol || x > view.endCol || y < view.startRow || y > view.endRow) continue;
    const px = Number(x - anchorCell.x) * CELL_SIZE + anchorPixel.x;
    const py = Number(y - anchorCell.y) * CELL_SIZE + anchorPixel.y;
    ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }
}

function drawOriginCrosshair(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const { w, h, anchor } = view;
  const { cell: anchorCell, pixel: anchorPixel } = anchor;
  const originOffX = -anchorCell.x;
  const originOffY = -anchorCell.y;
  ctx.strokeStyle = ORIGIN_CROSSHAIR_COLOR;
  ctx.lineWidth = 1;
  if (originOffX >= BigInt(view.startColOff) && originOffX <= BigInt(view.endColOff)) {
    const px = Number(originOffX) * CELL_SIZE + anchorPixel.x;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }
  if (originOffY >= BigInt(view.startRowOff) && originOffY <= BigInt(view.endRowOff)) {
    const py = Number(originOffY) * CELL_SIZE + anchorPixel.y;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }
}

/** Hard boundary walls: shade out-of-bounds and draw red line at 64-bit limits. */
function drawBoundaryWalls(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const { w, h, anchor } = view;
  const { cell: anchorCell, pixel: anchorPixel } = anchor;
  ctx.lineWidth = 2;

  // Right wall (x > LONG_MAX)
  if (BOUNDARY_MAX < view.startCol) {
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(0, 0, w, h);
  } else if (BOUNDARY_MAX <= view.endCol) {
    const px = (Number(BOUNDARY_MAX - anchorCell.x) + 1) * CELL_SIZE + anchorPixel.x;
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(px, 0, w - px, h);
    ctx.strokeStyle = BOUNDARY_COLOR;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }

  // Left wall (x < LONG_MIN)
  if (BOUNDARY_MIN > view.endCol) {
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(0, 0, w, h);
  } else if (BOUNDARY_MIN >= view.startCol) {
    const px = Number(BOUNDARY_MIN - anchorCell.x) * CELL_SIZE + anchorPixel.x;
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(0, 0, px, h);
    ctx.strokeStyle = BOUNDARY_COLOR;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }

  // Bottom wall (y > LONG_MAX)
  if (BOUNDARY_MAX < view.startRow) {
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(0, 0, w, h);
  } else if (BOUNDARY_MAX <= view.endRow) {
    const py = (Number(BOUNDARY_MAX - anchorCell.y) + 1) * CELL_SIZE + anchorPixel.y;
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(0, py, w, h - py);
    ctx.strokeStyle = BOUNDARY_COLOR;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }

  // Top wall (y < LONG_MIN)
  if (BOUNDARY_MIN > view.endRow) {
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(0, 0, w, h);
  } else if (BOUNDARY_MIN >= view.startRow) {
    const py = Number(BOUNDARY_MIN - anchorCell.y) * CELL_SIZE + anchorPixel.y;
    ctx.fillStyle = BOUNDARY_FILL;
    ctx.fillRect(0, 0, w, py);
    ctx.strokeStyle = BOUNDARY_COLOR;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }
}

/** Keep anchorPixel close to 0 so it never accumulates into an unsafe float. */
export function normalizeAnchor(a: Anchor): Anchor {
  const shiftX = Math.round(a.pixel.x / CELL_SIZE);
  const shiftY = Math.round(a.pixel.y / CELL_SIZE);
  return {
    cell: { x: a.cell.x - BigInt(shiftX), y: a.cell.y - BigInt(shiftY) },
    pixel: { x: a.pixel.x - shiftX * CELL_SIZE, y: a.pixel.y - shiftY * CELL_SIZE },
  };
}

export function Grid({ cells, onToggleCell, centerOn }: GridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Anchor: which BigInt cell sits at which screen pixel.
  // anchorPixel is kept near (0,0) by normalizeAnchor — safe for float arithmetic.
  const [anchor, setAnchor] = useState<Anchor>({ cell: { x: 0n, y: 0n }, pixel: { x: 0, y: 0 } });
  // Ref mirrors anchor so native event listeners always see the latest value.
  const anchorRef = useRef<Anchor>(anchor);

  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragAnchor = useRef<Anchor>({ cell: { x: 0n, y: 0n }, pixel: { x: 0, y: 0 } });

  // Keep anchorRef in sync with state.
  useEffect(() => { anchorRef.current = anchor; }, [anchor]);

  // When centerOn changes (new key), snap the viewport so the target cell is
  // centered on the canvas. anchorCell = target cell, anchorPixel = canvas center.
  useEffect(() => {
    if (!centerOn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a: Anchor = {
      cell: { x: centerOn.x, y: centerOn.y },
      pixel: { x: canvas.width / 2, y: canvas.height / 2 },
    };
    anchorRef.current = a;
    setAnchor(a);
  }, [centerOn]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const view = getViewState(w, h, anchor);

    drawBackground(ctx, w, h);
    drawGridLines(ctx, view);
    drawCells(ctx, view, cells);
    drawOriginCrosshair(ctx, view);
    drawBoundaryWalls(ctx, view);
  }, [cells, anchor]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.parentElement?.clientWidth  ?? 800;
      canvas.height = canvas.parentElement?.clientHeight ?? 600;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  // Native wheel listener with passive:false so we can call preventDefault(),
  // preventing the page from scrolling while the user pans over the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const cur = anchorRef.current;
      const newPixelX = cur.pixel.x - e.deltaX;
      const newPixelY = cur.pixel.y - e.deltaY;
      // Normalize so anchorPixel stays near 0 — prevents float drift.
      const shiftX = Math.floor(newPixelX / CELL_SIZE);
      const shiftY = Math.floor(newPixelY / CELL_SIZE);
      const next: Anchor = {
        cell: { x: cur.cell.x - BigInt(shiftX), y: cur.cell.y - BigInt(shiftY) },
        pixel: { x: newPixelX - shiftX * CELL_SIZE, y: newPixelY - shiftY * CELL_SIZE },
      };
      anchorRef.current = next;
      setAnchor(next);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // Window-level mouseup so panning ends correctly even when the cursor
  // leaves the canvas mid-drag.
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (draggingRef.current) {
        const normalized = normalizeAnchor(anchorRef.current);
        anchorRef.current = normalized;
        setAnchor(normalized);
        draggingRef.current = false;
        setDragging(false);
      }
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragAnchor.current = anchorRef.current;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const next: Anchor = {
      cell: dragAnchor.current.cell,
      pixel: {
        x: dragAnchor.current.pixel.x + (e.clientX - dragStart.current.x),
        y: dragAnchor.current.pixel.y + (e.clientY - dragStart.current.y),
      },
    };
    anchorRef.current = next;
    setAnchor(next);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggingRef.current) {
      const dx = Math.abs(e.clientX - dragStart.current.x);
      const dy = Math.abs(e.clientY - dragStart.current.y);
      if (dx < 3 && dy < 3) {
        // Treat as a click — convert screen pixel to BigInt grid coordinate.
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const cur = anchorRef.current;
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const cellOffX = Math.floor((screenX - cur.pixel.x) / CELL_SIZE);
          const cellOffY = Math.floor((screenY - cur.pixel.y) / CELL_SIZE);
          onToggleCell(cur.cell.x + BigInt(cellOffX), cur.cell.y + BigInt(cellOffY));
        }
      }
      // Normalize anchor at drag end so pixel stays bounded.
      const normalized = normalizeAnchor(anchorRef.current);
      anchorRef.current = normalized;
      setAnchor(normalized);
      draggingRef.current = false;
      setDragging(false);
    }
  };

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ cursor: dragging ? 'grabbing' : 'crosshair', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {cells.length === 0 && (
        <div style={emptyGridOverlayStyle} aria-live="polite">
          No cells alive — click to add cells or load a file
        </div>
      )}
    </div>
  );
}

const emptyGridOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  color: 'rgba(196, 162, 91, 0.85)',
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textShadow: '0 0 20px rgba(10, 18, 32, 0.9)',
};
