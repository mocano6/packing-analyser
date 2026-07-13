'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ZoomablePitchViewport.module.css';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const WHEEL_SENSITIVITY = 0.0012;

type Props = {
  children: React.ReactNode;
  className?: string;
};

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export default function ZoomablePitchViewport({ children, className }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const applyZoomAtPoint = useCallback((nextScale: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const clamped = clampScale(nextScale);
    const prevScale = scaleRef.current;
    if (Math.abs(clamped - prevScale) < 1e-6) return;

    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const worldX = (px - offsetRef.current.x) / prevScale;
    const worldY = (py - offsetRef.current.y) / prevScale;
    const nextOffset = {
      x: px - worldX * clamped,
      y: py - worldY * clamped,
    };

    if (clamped <= 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    setScale(clamped);
    setOffset(nextOffset);
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * WHEEL_SENSITIVITY;
      const next = scaleRef.current * (1 + delta);
      applyZoomAtPoint(next, event.clientX, event.clientY);
    },
    [applyZoomAtPoint],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scaleRef.current <= 1) return;
    if ((event.target as HTMLElement).closest('button, [class*="shotMarker"]')) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: offsetRef.current.x,
      baseY: offsetRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setOffset({
      x: pan.baseX + (event.clientX - pan.startX),
      y: pan.baseY + (event.clientY - pan.startY),
    });
  };

  const finishPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      panRef.current = null;
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, [class*="shotMarker"]')) return;
    const next = scaleRef.current >= 2.5 ? 1 : Math.min(MAX_SCALE, scaleRef.current * 1.75);
    applyZoomAtPoint(next, event.clientX, event.clientY);
  };

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    applyZoomAtPoint(scaleRef.current * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const isPannable = scale > 1;

  return (
    <div className={`${styles.viewportWrap} ${className ?? ''}`}>
      <div
        ref={viewportRef}
        className={`${styles.viewport} ${isPannable ? styles.pannable : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onDoubleClick={handleDoubleClick}
        aria-label="Mapa strzałów z powiększeniem"
      >
        <div
          ref={contentRef}
          className={styles.content}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>

      <div className={styles.zoomControls} aria-label="Sterowanie powiększeniem mapy">
        <button type="button" className={styles.zoomBtn} onClick={() => zoomBy(1.25)} aria-label="Powiększ">
          +
        </button>
        <button type="button" className={styles.zoomBtn} onClick={() => zoomBy(0.8)} aria-label="Pomniejsz">
          −
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={resetZoom}
          aria-label="Reset powiększenia"
          title="Reset"
        >
          ⟲
        </button>
        <span className={styles.zoomLevel}>{Math.round(scale * 100)}%</span>
      </div>
      <p className={styles.zoomHint}>Kółko myszy lub pinch — zoom · przeciągnij przy powiększeniu · dwuklik — zbliż/oddal</p>
    </div>
  );
}
