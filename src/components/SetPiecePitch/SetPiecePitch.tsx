"use client";

import React, { useCallback, useRef } from "react";
import type { SetPieceMarker, SetPieceZone, SetPieceZoneKind } from "@/types/setPieces";
import {
  buildZoneRectFromStorage,
  clampPlayerStoragePercent,
  clientPointToStoragePercent,
} from "@/utils/setPiecePitchCoords";
import styles from "./SetPiecePitch.module.css";

export type SetPiecePitchTool = "move" | "drawZone";

export interface SetPiecePitchPlayerView {
  playerId: string;
  number: number;
  label: string;
  imageUrl?: string;
  side?: "own" | "opponent";
}

interface SetPiecePitchProps {
  markers: SetPieceMarker[];
  zones: SetPieceZone[];
  playersById: Record<string, SetPiecePitchPlayerView>;
  selectedPlayerId: string | null;
  activeTool: SetPiecePitchTool;
  draftZone: { x: number; y: number; width: number; height: number } | null;
  onSelectPlayer: (playerId: string | null) => void;
  onMoveMarker: (playerId: string, x: number, y: number) => void;
  onDraftZoneChange: (zone: { x: number; y: number; width: number; height: number } | null) => void;
  onZoneDrawComplete: (zone: { x: number; y: number; width: number; height: number }) => void;
  /** Podgląd animacji — bez edycji pozycji i stref. */
  readOnly?: boolean;
}

const MIN_ZONE_SIZE_PERCENT = 2;

const SetPiecePitch: React.FC<SetPiecePitchProps> = ({
  markers,
  zones,
  playersById,
  selectedPlayerId,
  activeTool,
  draftZone,
  onSelectPlayer,
  onMoveMarker,
  onDraftZoneChange,
  onZoneDrawComplete,
  readOnly = false,
}) => {
  const pitchViewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ playerId: string } | null>(null);
  const zoneDrawRef = useRef<{ startX: number; startY: number } | null>(null);

  const handlePitchPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly || activeTool !== "drawZone" || !pitchViewportRef.current) return;
      if ((event.target as HTMLElement).closest(`.${styles.playerMarker}`)) return;
      const rect = pitchViewportRef.current.getBoundingClientRect();
      const point = clientPointToStoragePercent(event.clientX, event.clientY, rect);
      zoneDrawRef.current = { startX: point.x, startY: point.y };
      onDraftZoneChange(buildZoneRectFromStorage(point.x, point.y, point.x, point.y));
      pitchViewportRef.current.setPointerCapture(event.pointerId);
    },
    [activeTool, onDraftZoneChange, readOnly],
  );

  const handlePitchPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pitchViewportRef.current) return;

      if (dragStateRef.current) {
        const rect = pitchViewportRef.current.getBoundingClientRect();
        const point = clientPointToStoragePercent(event.clientX, event.clientY, rect);
        const clamped = clampPlayerStoragePercent(point.x, point.y);
        onMoveMarker(dragStateRef.current.playerId, clamped.x, clamped.y);
        return;
      }

      if (!zoneDrawRef.current) return;
      const rect = pitchViewportRef.current.getBoundingClientRect();
      const point = clientPointToStoragePercent(event.clientX, event.clientY, rect);
      const start = zoneDrawRef.current;
      onDraftZoneChange(buildZoneRectFromStorage(start.startX, start.startY, point.x, point.y));
    },
    [onDraftZoneChange, onMoveMarker],
  );

  const finishPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (pitchViewportRef.current?.hasPointerCapture(event.pointerId)) {
        pitchViewportRef.current.releasePointerCapture(event.pointerId);
      }
      if (
        zoneDrawRef.current &&
        draftZone &&
        draftZone.width >= MIN_ZONE_SIZE_PERCENT &&
        draftZone.height >= MIN_ZONE_SIZE_PERCENT
      ) {
        onZoneDrawComplete(draftZone);
      }
      zoneDrawRef.current = null;
      onDraftZoneChange(null);
      dragStateRef.current = null;
    },
    [draftZone, onDraftZoneChange, onZoneDrawComplete],
  );

  const zoneClass = (kind: SetPieceZoneKind) =>
    kind === "target" ? styles.zoneTarget : styles.zoneMovement;

  return (
    <div className={styles.pitchWrapper}>
      <p className={styles.pitchCaption}>Połowa boiska — atak w prawo</p>
      <PitchSurface
        pitchViewportRef={pitchViewportRef}
        activeTool={activeTool}
        onPointerDown={handlePitchPointerDown}
        onPointerMove={handlePitchPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        zones={zones}
        zoneClass={zoneClass}
        draftZone={draftZone}
        markers={markers}
        playersById={playersById}
        selectedPlayerId={selectedPlayerId}
        dragStateRef={dragStateRef}
        onSelectPlayer={onSelectPlayer}
        onMoveMarker={onMoveMarker}
        readOnly={readOnly}
      />
    </div>
  );
};

function PitchSurface(props: {
  pitchViewportRef: React.RefObject<HTMLDivElement>;
  activeTool: SetPiecePitchTool;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  zones: SetPieceZone[];
  zoneClass: (kind: SetPieceZoneKind) => string;
  draftZone: { x: number; y: number; width: number; height: number } | null;
  markers: SetPieceMarker[];
  playersById: Record<string, SetPiecePitchPlayerView>;
  selectedPlayerId: string | null;
  dragStateRef: React.MutableRefObject<{ playerId: string } | null>;
  onSelectPlayer: (playerId: string | null) => void;
  onMoveMarker: (playerId: string, x: number, y: number) => void;
  readOnly: boolean;
}) {
  const {
    pitchViewportRef,
    activeTool,
    readOnly,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    zones,
    zoneClass,
    draftZone,
    markers,
    playersById,
    selectedPlayerId,
    dragStateRef,
    onSelectPlayer,
    onMoveMarker,
  } = props;

  return (
    <div
      ref={pitchViewportRef}
      className={`${styles.pitchViewport} ${!readOnly && activeTool === "drawZone" ? styles.pitchDrawMode : ""} ${readOnly ? styles.pitchReadOnly : ""}`}
      role="application"
      aria-label="Połowa boiska — stałe fragmenty w ataku"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className={styles.pitchHalf}>
        <div className={styles.pitch}>
          <div className={styles.pitchLines} aria-hidden="true">
            <div className={styles.centerLine} />
            <div className={styles.centerCircle} />
            <div className={styles.centerSpot} />
            <div className={styles.penaltyAreaLeft} />
            <div className={styles.penaltyAreaRight} />
            <div className={styles.goalAreaLeft} />
            <div className={styles.goalAreaRight} />
            <div className={styles.penaltyArcLeft} />
            <div className={styles.penaltyArcRight} />
            <div className={styles.penaltySpotLeft} />
            <div className={styles.penaltySpotRight} />
            <div className={styles.goalLeft} />
            <div className={styles.goalRight} />
          </div>

          <div className={styles.zonesLayer}>
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`${styles.zoneRect} ${zoneClass(zone.kind)}`}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                }}
                title={[zone.label, zone.task?.trim()].filter(Boolean).join(" — ")}
              >
                <span className={styles.zoneLabel}>{zone.label.trim() || "Strefa"}</span>
                {zone.task?.trim() ? <span className={styles.zoneTaskHint}>{zone.task.trim()}</span> : null}
              </div>
            ))}
            {draftZone && draftZone.width > 0 && draftZone.height > 0 && (
              <div
                className={styles.draftZone}
                style={{
                  left: `${draftZone.x}%`,
                  top: `${draftZone.y}%`,
                  width: `${draftZone.width}%`,
                  height: `${draftZone.height}%`,
                }}
              />
            )}
          </div>

          <div className={styles.markersLayer}>
            {markers.map((marker) => (
              <SetPiecePlayerMarker
                key={marker.playerId}
                marker={marker}
                view={playersById[marker.playerId]}
                isSelected={selectedPlayerId === marker.playerId}
                pitchViewportRef={pitchViewportRef}
                dragStateRef={dragStateRef}
                onSelectPlayer={onSelectPlayer}
                onMoveMarker={onMoveMarker}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetPiecePlayerMarker({
  marker,
  view,
  isSelected,
  pitchViewportRef,
  dragStateRef,
  onSelectPlayer,
  onMoveMarker,
  readOnly,
}: {
  marker: SetPieceMarker;
  view?: SetPiecePitchPlayerView;
  isSelected: boolean;
  pitchViewportRef: React.RefObject<HTMLDivElement>;
  dragStateRef: React.MutableRefObject<{ playerId: string } | null>;
  onSelectPlayer: (playerId: string | null) => void;
  onMoveMarker: (playerId: string, x: number, y: number) => void;
  readOnly: boolean;
}) {
  if (!view) return null;

  return (
    <div
      className={`${styles.playerMarker} ${view.side === "opponent" ? styles.playerMarkerOpponent : ""} ${isSelected ? styles.playerMarkerSelected : ""} ${readOnly ? styles.playerMarkerReadOnly : ""}`}
      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
      title={view.label}
      onPointerDown={(event) => {
        if (readOnly) return;
        event.stopPropagation();
        onSelectPlayer(marker.playerId);
        dragStateRef.current = { playerId: marker.playerId };
        (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (readOnly) return;
        if (!dragStateRef.current || dragStateRef.current.playerId !== marker.playerId) return;
        if (!pitchViewportRef.current) return;
        const rect = pitchViewportRef.current.getBoundingClientRect();
        const point = clientPointToStoragePercent(event.clientX, event.clientY, rect);
        const clamped = clampPlayerStoragePercent(point.x, point.y);
        onMoveMarker(marker.playerId, clamped.x, clamped.y);
      }}
      onPointerUp={(event) => {
        if (readOnly) return;
        (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
        dragStateRef.current = null;
      }}
      role={readOnly ? "img" : "button"}
      tabIndex={readOnly ? -1 : 0}
      aria-label={`Zawodnik ${view.label}`}
      aria-pressed={readOnly ? undefined : isSelected}
    >
      <div className={styles.avatarRing}>
        {view.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.imageUrl} alt="" className={styles.avatarImage} />
        ) : (
          <span className={styles.avatarFallback}>{view.number || "?"}</span>
        )}
      </div>
      <span className={styles.markerBadge}>{view.number}</span>
      <span className={styles.markerName}>{view.label}</span>
    </div>
  );
}

export default SetPiecePitch;
