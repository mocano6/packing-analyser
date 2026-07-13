"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Action } from "@/types";
import styles from "../PKEntriesPitch/PKEntriesPitch.module.css";
import PitchHeader from "../PitchHeader/PitchHeader";
import pitchHeaderStyles from "../PitchHeader/PitchHeader.module.css";
import { buildPlayersIndex, getPlayerLabel, type PlayersIndex } from "@/utils/playerUtils";
import type { Player } from "@/types";
import { getVideoTimestampSeconds } from "@/utils/actionVideoSeekSeconds";

const HOVER_TOOLTIP_DELAY_MS = 1500;
const VIDEO_RING_COLOR = "#22c55e";

type RenderablePoint = {
  action: Action;
  x: number;
  y: number;
  hasVideo: boolean;
};

export type RegainLosesActionsPitchProps = {
  actions?: Action[];
  players?: Player[];
  playersIndex?: PlayersIndex;
  variant: "regain" | "lose";
  zonePercentForAction: (action: Action) => { x: number; y: number } | null;
  onActionClick?: (action: Action) => void;
  selectedActionId?: string | null;
  matchInfo?: {
    team?: string;
    opponent?: string;
    teamName?: string;
    opponentName?: string;
  };
  allTeams?: Array<{ id: string; name: string; logo?: string }>;
};

const RegainLosesActionsPitch = memo(function RegainLosesActionsPitch({
  actions = [],
  players = [],
  playersIndex,
  variant,
  zonePercentForAction,
  onActionClick,
  selectedActionId,
  matchInfo,
  allTeams = [],
}: RegainLosesActionsPitchProps) {
  const localPlayersIndex = useMemo(
    () => playersIndex ?? buildPlayersIndex(players),
    [playersIndex, players],
  );
  const [isFlipped, setIsFlipped] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pitchOrientation") === "true" : false,
  );
  const [showMarkers, setShowMarkers] = useState(true);
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [pitchSize, setPitchSize] = useState<{ width: number; height: number } | null>(null);
  const [hoveredAction, setHoveredAction] = useState<Action | null>(null);
  const [showHoverTooltip, setShowHoverTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const points = useMemo((): RenderablePoint[] => {
    const rows: RenderablePoint[] = [];
    for (const action of actions) {
      const pos = zonePercentForAction(action);
      if (!pos) continue;
      rows.push({ action, x: pos.x, y: pos.y, hasVideo: getVideoTimestampSeconds(action) !== null });
    }
    return rows;
  }, [actions, zonePercentForAction]);

  const markerColor = variant === "regain" ? "#3b82f6" : "#dc2626";
  const selectedColor = "#2563eb";

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("pitchOrientation", String(isFlipped));
    window.dispatchEvent(new CustomEvent("pitchOrientationChanged", { detail: { isFlipped } }));
  }, [isFlipped]);

  useEffect(() => {
    const handler = (event: CustomEvent) => setIsFlipped(event.detail.isFlipped);
    window.addEventListener("pitchOrientationChanged", handler as EventListener);
    return () => window.removeEventListener("pitchOrientationChanged", handler as EventListener);
  }, []);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!pitchRef.current) return;
    const el = pitchRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setPitchSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const convertCoordinates = useCallback((x: number, y: number) => {
    if (isFlipped) return { x: 100 - x, y: 100 - y };
    return { x, y };
  }, [isFlipped]);

  const renderMarkers = () => {
    if (!pitchSize || !showMarkers) return null;
    const dotR = 6;
    return (
      <svg
        className={styles.arrowSvgAbsolute}
        viewBox={`0 0 ${pitchSize.width} ${pitchSize.height}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "auto", zIndex: 20 }}
      >
        {[...points]
          .sort((a, b) => (selectedActionId === a.action.id ? 1 : 0) - (selectedActionId === b.action.id ? 1 : 0))
          .map(({ action, x, y, hasVideo }) => {
            const pos = convertCoordinates(x, y);
            const px = { x: (pos.x / 100) * pitchSize.width, y: (pos.y / 100) * pitchSize.height };
            const isSelected = selectedActionId === action.id;
            const fill = isSelected ? selectedColor : markerColor;
            return (
              <g key={action.id}>
                <circle
                  cx={px.x}
                  cy={px.y}
                  r={dotR}
                  fill={fill}
                  stroke="white"
                  strokeWidth={1.5}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onActionClick?.(action);
                  }}
                  onMouseEnter={(e) => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                    const rect = (e.currentTarget as SVGCircleElement).getBoundingClientRect();
                    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    setHoveredAction(action);
                    setShowHoverTooltip(false);
                    hoverTimeoutRef.current = setTimeout(() => setShowHoverTooltip(true), HOVER_TOOLTIP_DELAY_MS);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                    setTooltipPosition(null);
                    setHoveredAction(null);
                    setShowHoverTooltip(false);
                  }}
                />
                {hasVideo ? (
                  <circle cx={px.x} cy={px.y} r={dotR + 3} fill="none" stroke={VIDEO_RING_COLOR} strokeWidth={2} pointerEvents="none" />
                ) : null}
              </g>
            );
          })}
      </svg>
    );
  };

  return (
    <div className={styles.pitchContainer}>
      <PitchHeader
        matchInfo={matchInfo}
        allTeams={allTeams}
        isFlipped={isFlipped}
        rightContent={
          <>
            <button
              type="button"
              className={`${pitchHeaderStyles.headerButton} ${showMarkers ? pitchHeaderStyles.headerButtonActive : ""}`}
              onClick={() => setShowMarkers((v) => !v)}
              aria-pressed={showMarkers}
            >
              Markery: {showMarkers ? "ON" : "OFF"}
            </button>
            <button type="button" className={pitchHeaderStyles.headerButton} onClick={() => setIsFlipped((v) => !v)}>
              Obróć
            </button>
          </>
        }
      />
      <div className={styles.pitchWrapper}>
        <div
          className={`${styles.pitch} ${isFlipped ? styles.flipped : ""}`}
          role="img"
          aria-label={variant === "regain" ? "Mapa przechwytów" : "Mapa strat"}
          ref={pitchRef}
        >
          <div className={styles.pitchLines} aria-hidden="true">
            <div className={styles.centerLine} />
            <div className={styles.centerCircle} />
            <div className={styles.centerSpot} />
            <div className={styles.penaltyAreaLeft} />
            <div className={styles.goalAreaLeft} />
            <div className={styles.penaltyAreaRight} />
            <div className={styles.goalAreaRight} />
            <div className={styles.penaltyArcLeft} />
            <div className={styles.penaltyArcRight} />
            <div className={styles.penaltySpotLeft} />
            <div className={styles.penaltySpotRight} />
            <div className={styles.goalLeft} />
            <div className={styles.goalRight} />
            <div className={`${styles.attackRectangle} ${isFlipped ? styles.attackRectangleLeft : styles.attackRectangleRight}`} />
          </div>
          {renderMarkers()}
          {showHoverTooltip && hoveredAction && tooltipPosition && createPortal(
            <div
              className={styles.pkEntryHoverTooltip}
              style={{
                position: "fixed",
                left: tooltipPosition.x,
                top: tooltipPosition.y,
                transform: "translate(-50%, calc(-100% - 8px))",
                zIndex: 999999,
              }}
              role="tooltip"
            >
              <div className={styles.pkEntryHoverTooltipInner}>
                {getVideoTimestampSeconds(hoveredAction) !== null ? (
                  <span className={styles.pkEntryHoverTooltipBadge}>Wideo</span>
                ) : null}
                <strong>{getPlayerLabel(hoveredAction.senderId, localPlayersIndex)}</strong>
                <span>{hoveredAction.minute}&#8242;</span>
              </div>
            </div>,
            document.body,
          )}
        </div>
      </div>
    </div>
  );
});

RegainLosesActionsPitch.displayName = "RegainLosesActionsPitch";
export default RegainLosesActionsPitch;
