'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { ROI, SpaceResult, Tool } from '@/types';

// ── Drawing constants ──────────────────────────────────────────────────────────
const DRAFT_STROKE = '#3b82f6';
const DRAFT_FILL = 'rgba(59,130,246,0.15)';
const FREE_STROKE = '#22c55e';
const FREE_FILL = 'rgba(34,197,94,0.30)';
const OCCUPIED_STROKE = '#ef4444';
const OCCUPIED_FILL = 'rgba(239,68,68,0.30)';
const VERTEX_RADIUS = 5;
const DRAG_THRESHOLD = 10;
const MIN_ROI_SIZE = 8;
const DELETE_BTN_R = 10;

// ── Geometry helpers ───────────────────────────────────────────────────────────
function euclidean(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function centroid(points: [number, number][]): [number, number] {
  const x = points.reduce((s, [px]) => s + px, 0) / points.length;
  const y = points.reduce((s, [, py]) => s + py, 0) / points.length;
  return [x, y];
}

function pointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (
      (yi > pt[1]) !== (yj > pt[1]) &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function getCanvasPoint(
  e: React.MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
}

/** Position of the delete button: top-right corner, floating above the bounding box. */
function getDeleteBtnPos(points: [number, number][]): [number, number] {
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  return [maxX - DELETE_BTN_R, minY - DELETE_BTN_R - 4];
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────
function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  fill: string,
  stroke: string,
  lineWidth = 2,
  close = true,
) {
  if (points.length < 2) return;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawDeleteButton(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Red circle
  ctx.beginPath();
  ctx.arc(cx, cy, DELETE_BTN_R, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // White X
  const arm = DELETE_BTN_R * 0.45;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx + arm, cy - arm);
  ctx.lineTo(cx - arm, cy + arm);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  subLabel: string,
  bgColor: string,
) {
  const fontSize = 9;
  ctx.font = `bold ${fontSize}px Inter, ui-sans-serif, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const tw = ctx.measureText(label).width;
  const pad = 5;
  const boxW = tw + pad * 2;
  const boxH = 14;
  const hasSubLabel = subLabel.length > 0;
  const topY = cy - (hasSubLabel ? boxH / 2 + 5 : boxH / 2);

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, topY, boxW, boxH, 3);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, cx, topY + boxH / 2);

  if (hasSubLabel) {
    ctx.font = `${fontSize}px Inter, ui-sans-serif, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(subLabel, cx, topY + boxH + 7);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  imageUrl: string;
  rois: ROI[];
  onRoisChange?: (rois: ROI[]) => void;
  activeTool?: Tool;
  results?: SpaceResult[];
  readOnly?: boolean;
  onCanvasSizeChange?: (w: number, h: number) => void;
}

export default function ROICanvas({
  imageUrl,
  rois,
  onRoisChange,
  activeTool = 'draw',
  results,
  readOnly = false,
  onCanvasSizeChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragEnd, setDragEnd] = useState<[number, number] | null>(null);
  const [editDrag, setEditDrag] = useState<{ roiIdx: number; ptIdx: number } | null>(null);
  const [hoveredRoiIdx, setHoveredRoiIdx] = useState<number | null>(null);
  const [overDeleteBtn, setOverDeleteBtn] = useState(false);
  const [canvasVer, setCanvasVer] = useState(0);

  // ── Load image ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ── Resize observer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      onCanvasSizeChange?.(canvas.width, canvas.height);
      setCanvasVer((v) => v + 1);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [onCanvasSizeChange]);

  // ── Redraw ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded || canvas.width === 0 || canvas.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);

    for (let i = 0; i < rois.length; i++) {
      const roi = rois[i];
      const result = results?.find((r) => r.id === roi.id);
      const isOccupied = result?.status === 'ocupado';
      const isHovered = !readOnly && hoveredRoiIdx === i;

      let fill: string;
      let stroke: string;

      if (results) {
        fill = isOccupied ? OCCUPIED_FILL : FREE_FILL;
        stroke = isOccupied ? OCCUPIED_STROKE : FREE_STROKE;
      } else {
        fill = DRAFT_FILL;
        stroke = isHovered ? '#1d4ed8' : DRAFT_STROKE;
      }

      drawPolygon(ctx, roi.points, fill, stroke, isHovered ? 2.5 : 2);

      if (results && result) {
        const [cx, cy] = centroid(roi.points);
        const label = isOccupied ? 'OCUPADO' : 'LIBRE';
        const sub = isOccupied && result.confidence > 0 ? result.confidence.toFixed(2) : '';
        drawLabel(ctx, cx, cy, label, sub, isOccupied ? OCCUPIED_STROKE : FREE_STROKE);
      } else if (!results) {
        const [cx, cy] = centroid(roi.points);
        ctx.font = 'bold 11px Inter, ui-sans-serif, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(59,130,246,0.95)';
        ctx.fillText(roi.id, cx, cy);
      }

      // Delete button on hovered ROI
      if (isHovered) {
        const [bx, by] = getDeleteBtnPos(roi.points);
        drawDeleteButton(ctx, bx, by);
      }
    }

    // drag preview rectangle
    if (!readOnly && dragStart && dragEnd) {
      const [x1, y1] = dragStart;
      const [x2, y2] = dragEnd;
      const rectPoints: [number, number][] = [
        [x1, y1], [x2, y1], [x2, y2], [x1, y2],
      ];
      ctx.setLineDash([5, 4]);
      drawPolygon(ctx, rectPoints, DRAFT_FILL, DRAFT_STROKE, 2);
      ctx.setLineDash([]);

      for (const [cx, cy] of rectPoints) {
        ctx.beginPath();
        ctx.arc(cx, cy, VERTEX_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = DRAFT_STROKE;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // info text
    if (!readOnly) {
      const label = `${W}×${H}${dragStart ? ' · trazando...' : ''}`;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(label, 8, 8);
    }
  }, [imageLoaded, rois, dragStart, dragEnd, results, readOnly, hoveredRoiIdx, canvasVer]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragStart(null);
        setDragEnd(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setDragStart(null);
    setDragEnd(null);
  }, [activeTool]);

  // ── Mouse handlers ────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = getCanvasPoint(e, canvas);

      if (activeTool === 'draw' && dragStart) {
        setDragEnd(pos);
        setHoveredRoiIdx(null);
        setOverDeleteBtn(false);
        return;
      }

      if (activeTool === 'edit' && editDrag && onRoisChange) {
        const updated = rois.map((roi, ri) => {
          if (ri !== editDrag.roiIdx) return roi;
          const newPoints = roi.points.map((p, pi) =>
            pi === editDrag.ptIdx ? pos : p,
          ) as [number, number][];
          return { ...roi, points: newPoints };
        });
        onRoisChange(updated);
        return;
      }

      // Update hover
      let foundIdx: number | null = null;
      for (let i = rois.length - 1; i >= 0; i--) {
        if (pointInPolygon(pos, rois[i].points)) {
          foundIdx = i;
          break;
        }
      }
      setHoveredRoiIdx(foundIdx);

      if (foundIdx !== null) {
        const [bx, by] = getDeleteBtnPos(rois[foundIdx].points);
        setOverDeleteBtn(euclidean(pos, [bx, by]) <= DELETE_BTN_R);
      } else {
        setOverDeleteBtn(false);
      }
    },
    [readOnly, activeTool, dragStart, editDrag, rois, onRoisChange],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = getCanvasPoint(e, canvas);

      // Delete button takes priority regardless of active tool
      if (hoveredRoiIdx !== null && onRoisChange) {
        const [bx, by] = getDeleteBtnPos(rois[hoveredRoiIdx].points);
        if (euclidean(pos, [bx, by]) <= DELETE_BTN_R) {
          onRoisChange(rois.filter((_, i) => i !== hoveredRoiIdx));
          setHoveredRoiIdx(null);
          setOverDeleteBtn(false);
          return;
        }
      }

      if (activeTool === 'draw') {
        setDragStart(pos);
        setDragEnd(pos);
      } else if (activeTool === 'edit') {
        let best: { roiIdx: number; ptIdx: number } | null = null;
        let bestDist = DRAG_THRESHOLD;
        rois.forEach((roi, ri) => {
          roi.points.forEach((p, pi) => {
            const d = euclidean(pos, p);
            if (d < bestDist) {
              bestDist = d;
              best = { roiIdx: ri, ptIdx: pi };
            }
          });
        });
        if (best) setEditDrag(best);
      } else if (activeTool === 'delete') {
        const idx = rois.findIndex((roi) => pointInPolygon(pos, roi.points));
        if (idx >= 0) {
          onRoisChange?.(rois.filter((_, i) => i !== idx));
          setHoveredRoiIdx(null);
        }
      }
    },
    [readOnly, activeTool, hoveredRoiIdx, rois, onRoisChange],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      if (activeTool === 'draw' && dragStart) {
        const canvas = canvasRef.current;
        if (canvas) {
          const pos = getCanvasPoint(e, canvas);
          const w = Math.abs(pos[0] - dragStart[0]);
          const h = Math.abs(pos[1] - dragStart[1]);

          if (w >= MIN_ROI_SIZE && h >= MIN_ROI_SIZE) {
            const x1 = Math.min(dragStart[0], pos[0]);
            const y1 = Math.min(dragStart[1], pos[1]);
            const x2 = Math.max(dragStart[0], pos[0]);
            const y2 = Math.max(dragStart[1], pos[1]);

            const newRoi: ROI = {
              id: `P-${String(rois.length + 1).padStart(2, '0')}`,
              points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
            };
            onRoisChange?.([...rois, newRoi]);
          }
        }
        setDragStart(null);
        setDragEnd(null);
      }

      setEditDrag(null);
    },
    [readOnly, activeTool, dragStart, rois, onRoisChange],
  );

  const handleMouseLeave = useCallback(() => {
    if (activeTool === 'draw') {
      setDragStart(null);
      setDragEnd(null);
    }
    setEditDrag(null);
    setHoveredRoiIdx(null);
    setOverDeleteBtn(false);
  }, [activeTool]);

  const cursor = readOnly
    ? 'default'
    : overDeleteBtn
    ? 'pointer'
    : activeTool === 'edit'
    ? editDrag
      ? 'grabbing'
      : 'grab'
    : 'crosshair';

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
