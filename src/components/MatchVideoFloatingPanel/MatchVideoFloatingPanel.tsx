'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import YouTubeVideo, { YouTubeVideoRef } from '@/components/YouTubeVideo/YouTubeVideo';
import { useProfileHeatmapVideoPanelLayout } from '@/hooks/useProfileHeatmapVideoPanelLayout';
import type { TeamInfo } from '@/types';
import styles from './MatchVideoFloatingPanel.module.css';

type Props = {
  matchInfo: TeamInfo;
  title: string;
  isOpen: boolean;
  seekTargetSeconds: number | null;
  /** Inkrementowany przy każdym żądaniu seek — wymusza ponowienie nawet przy tej samej sekundzie. */
  seekRequestId: number;
  onSeekTargetConsumed: () => void;
  onClose: () => void;
};

function postSeekToExternalWindow(seconds: number) {
  const external = (window as unknown as { externalVideoWindow?: Window | null }).externalVideoWindow;
  if (!external || external.closed) return;
  try {
    external.postMessage({ type: 'SEEK_TO_TIME', time: seconds }, '*');
  } catch {
    /* ignore */
  }
}

export default function MatchVideoFloatingPanel({
  matchInfo,
  title,
  isOpen,
  seekTargetSeconds,
  seekRequestId,
  onSeekTargetConsumed,
  onClose,
}: Props) {
  const youtubeVideoRef = useRef<YouTubeVideoRef>(null);
  const onSeekConsumedRef = useRef(onSeekTargetConsumed);
  onSeekConsumedRef.current = onSeekTargetConsumed;

  const {
    panelRef,
    panelStyle,
    resetLayout,
    onHeaderPointerDown,
    onResizePointerDown,
    onDragPointerMove,
    onDragPointerUp,
    layout,
  } = useProfileHeatmapVideoPanelLayout();

  useEffect(() => {
    if (!isOpen || seekTargetSeconds === null || !Number.isFinite(seekTargetSeconds)) return;

    let cancelled = false;
    const target = seekTargetSeconds;

    postSeekToExternalWindow(target);

    const attemptSeek = async () => {
      for (let i = 0; i < 20; i += 1) {
        if (cancelled) return;
        const player = youtubeVideoRef.current;
        if (player) {
          try {
            await player.seekTo(target);
            onSeekConsumedRef.current();
            postSeekToExternalWindow(target);
            return;
          } catch {
            /* player jeszcze niegotowy */
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
    };

    void attemptSeek();

    return () => {
      cancelled = true;
    };
  }, [isOpen, seekTargetSeconds, seekRequestId]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`${styles.panel}${layout ? ` ${styles.panelCustom}` : ''}${isOpen ? '' : ` ${styles.panelHidden}`}`}
      style={panelStyle}
      role="complementary"
      aria-label="Odtwarzacz wideo meczu"
      aria-hidden={!isOpen}
    >
      <div
        className={`${styles.header} ${styles.headerDraggable}`}
        title="Przeciągnij panel — zachowaj układ w tej przeglądarce"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <span>Wideo — {title}</span>
        <span className={styles.headerActions}>
          <button
            type="button"
            className={styles.resetLayout}
            onClick={(e) => {
              e.stopPropagation();
              resetLayout();
            }}
          >
            Układ domyślny
          </button>
          <button
            type="button"
            className={styles.hideButton}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            Ukryj wideo
          </button>
        </span>
      </div>
      <div className={styles.playerShell}>
        <YouTubeVideo
          ref={youtubeVideoRef}
          matchInfo={matchInfo}
          isVisible
          isFullscreen={false}
          seekTargetSeconds={seekTargetSeconds}
        />
      </div>
      <button
        type="button"
        className={styles.resizeHandle}
        title="Przeciągnij lewy górny róg panelu, aby zmienić rozmiar"
        aria-label="Zmiana rozmiaru panelu wideo — uchwyt w lewym górnym rogu panelu"
        onPointerDown={onResizePointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      />
    </div>,
    document.body,
  );
}
