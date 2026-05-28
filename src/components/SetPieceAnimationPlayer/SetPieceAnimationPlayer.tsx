"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SetPieceFrame } from "@/types/setPieces";
import SetPiecePitch, { type SetPiecePitchPlayerView } from "@/components/SetPiecePitch/SetPiecePitch";
import {
  computePlaybackElapsed,
  getFramePairAtPlayback,
  interpolateFrames,
} from "@/utils/setPieceFrames";
import styles from "./SetPieceAnimationPlayer.module.css";

const SPEED_OPTIONS = [
  { id: "slow", label: "Wolno", msPerSegment: 1400 },
  { id: "normal", label: "Normalnie", msPerSegment: 900 },
  { id: "fast", label: "Szybko", msPerSegment: 500 },
] as const;

interface SetPieceAnimationPlayerProps {
  frames: SetPieceFrame[];
  playersById: Record<string, SetPiecePitchPlayerView>;
  activePlayerIds: string[];
}

function filterMarkersToSquad<T extends { playerId: string }>(items: T[], selectedPlayerIds: string[]): T[] {
  const set = new Set(selectedPlayerIds);
  return items.filter((item) => set.has(item.playerId));
}

const SetPieceAnimationPlayer: React.FC<SetPieceAnimationPlayerProps> = ({
  frames,
  playersById,
  activePlayerIds,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speedId, setSpeedId] = useState<(typeof SPEED_OPTIONS)[number]["id"]>("normal");
  const [manualSegment, setManualSegment] = useState(0);
  const [manualProgress, setManualProgress] = useState(0);
  const [playbackSegment, setPlaybackSegment] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const rafRef = useRef<number | null>(null);
  const startMsRef = useRef<number>(0);

  const msPerSegment = SPEED_OPTIONS.find((option) => option.id === speedId)?.msPerSegment ?? 900;
  const canAnimate = frames.length >= 2 && activePlayerIds.length > 0;

  const displaySegment = isPlaying ? playbackSegment : manualSegment;
  const displayProgress = isPlaying ? playbackProgress : manualProgress;

  const { frameA, frameB } = useMemo(
    () => getFramePairAtPlayback(frames, displaySegment, loop || frames.length > 2),
    [displaySegment, frames, loop],
  );

  const snapshot = useMemo(() => {
    const interpolated = interpolateFrames(frameA, frameB, displayProgress);
    return {
      markers: filterMarkersToSquad(interpolated.markers, activePlayerIds),
      zones: interpolated.zones,
    };
  }, [activePlayerIds, displayProgress, frameA, frameB]);

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const { segmentIndex, segmentProgress, isFinished } = computePlaybackElapsed(
      startMsRef.current,
      now,
      msPerSegment,
      frames.length,
      loop,
    );
    setPlaybackSegment(segmentIndex);
    setPlaybackProgress(segmentProgress);

    if (isFinished) {
      setManualSegment(segmentIndex);
      setManualProgress(segmentProgress);
      stopPlayback();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [frames.length, loop, msPerSegment, stopPlayback]);

  useEffect(() => {
    if (!isPlaying) return;
    startMsRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  useEffect(() => {
    if (manualSegment >= Math.max(0, frames.length - 1)) {
      setManualSegment(Math.max(0, frames.length - 2));
    }
  }, [frames.length, manualSegment]);

  const segmentCount = loop ? frames.length : Math.max(1, frames.length - 1);
  const scrubValue = displaySegment + displayProgress;
  const statusText = canAnimate
    ? isPlaying
      ? `Odtwarzanie: ${frameA.label} → ${frameB.label}`
      : `Podgląd: ${frameA.label} → ${frameB.label} (${Math.round(displayProgress * 100)}%)`
    : "Dodaj co najmniej 2 klatki i zawodników, aby odtworzyć animację.";

  return (
    <section className={styles.player} aria-label="Odtwarzacz animacji stałego fragmentu">
      <div className={styles.header}>
        <h3 className={styles.title}>Animacja klatka po klatce</h3>
        <p className={styles.status}>{statusText}</p>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.controlButton} ${styles.controlButtonPrimary}`}
          disabled={!canAnimate}
          onClick={() => (isPlaying ? stopPlayback() : setIsPlaying(true))}
        >
          {isPlaying ? "Pauza" : "Odtwórz"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          disabled={!canAnimate || frames.length < 2}
          onClick={() => {
            stopPlayback();
            setManualSegment(0);
            setManualProgress(0);
            setPlaybackSegment(0);
            setPlaybackProgress(0);
          }}
        >
          Od początku
        </button>
        <label className={styles.speedLabel}>
          Tempo
          <select
            className={styles.speedSelect}
            value={speedId}
            onChange={(event) => setSpeedId(event.target.value as (typeof SPEED_OPTIONS)[number]["id"])}
            disabled={isPlaying}
          >
            {SPEED_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.speedLabel}>
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => setLoop(event.target.checked)}
            disabled={isPlaying}
          />
          Zapętlaj
        </label>
      </div>

      {canAnimate && (
        <div className={styles.scrubber}>
          <input
            type="range"
            className={styles.scrubberInput}
            min={0}
            max={segmentCount * 100}
            value={Math.round(scrubValue * 100)}
            disabled={isPlaying}
            onChange={(event) => {
              const value = Number(event.target.value) / 100;
              const segment = Math.min(segmentCount - 0.001, Math.max(0, value));
              setManualSegment(Math.floor(segment));
              setManualProgress(segment - Math.floor(segment));
            }}
            aria-label="Przewiń animację"
          />
        </div>
      )}

      <div className={styles.previewFrame}>
        <SetPiecePitch
          markers={snapshot.markers}
          zones={snapshot.zones}
          playersById={playersById}
          selectedPlayerId={null}
          activeTool="move"
          draftZone={null}
          onSelectPlayer={() => undefined}
          onMoveMarker={() => undefined}
          onDraftZoneChange={() => undefined}
          onZoneDrawComplete={() => undefined}
          readOnly
        />
      </div>

      {!canAnimate && (
        <p className={styles.hint}>
          W edytorze dodaj kolejną klatkę (np. „Klatka 2”), ustaw nowe pozycje zawodników i wróć tutaj, aby zobaczyć
          płynne przejście.
        </p>
      )}
    </section>
  );
};

export default SetPieceAnimationPlayer;
