"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Action } from "@/types";
import styles from "../PKEntriesPitch/PKEntriesPitch.module.css";
import PitchHeader from "../PitchHeader/PitchHeader";
import pitchHeaderStyles from "../PitchHeader/PitchHeader.module.css";
import { buildPlayersIndex, getPlayerLabel, type PlayersIndex } from "@/utils/playerUtils";
import type { Player } from "@/types";
import { actionToPitchCoordinates } from "@/utils/packingActionZonePitchPercent";
import { getVideoTimestampSeconds } from "@/utils/actionVideoSeekSeconds";

const HOVER_TOOLTIP_DELAY_MS = 1500;
const VIDEO_RING_COLOR = "#22c55e";

type RenderableAction = {
  action: Action;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  hasVideo: boolean;
};

export interface PackingActionsPitchProps {
  actions?: Action[];
  players?: Player[];
  playersIndex?: PlayersIndex;
  onActionClick?: (action: Action) => void;
  selectedActionId?: string | null;
  matchInfo?: {
    team?: string;
    opponent?: string;
    teamName?: string;
    opponentName?: string;
    opponentLogo?: string;
  };
  allTeams?: Array<{ id: string; name: string; logo?: string }>;
  hideTeamLogos?: boolean;
  hideFlipButton?: boolean;
}

const PackingActionsPitch = memo(function PackingActionsPitch({
  actions = [],
  players = [],
  playersIndex,
  onActionClick,
  selectedActionId,
  matchInfo,
  allTeams = [],
  hideTeamLogos = false,
  hideFlipButton = false,
}: PackingActionsPitchProps) {
  const localPlayersIndex = useMemo(
    () => playersIndex ?? buildPlayersIndex(players),
    [playersIndex, players],
  );

  const [isFlipped, setIsFlipped] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pitchOrientation") === "true";
    }
    return false;
  });
  const [showArrows, setShowArrows] = useState(true);

  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [pitchSize, setPitchSize] = useState<{ width: number; height: number } | null>(null);

  const [hoveredAction, setHoveredAction] = useState<Action | null>(null);
  const [showHoverTooltip, setShowHoverTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderableActions = useMemo((): RenderableAction[] => {
    const rows: RenderableAction[] = [];
    for (const action of actions) {
      const coords = actionToPitchCoordinates(action);
      if (!coords) continue;
      rows.push({
        action,
        ...coords,
        hasVideo: getVideoTimestampSeconds(action) !== null,
      });
    }
    return rows;
  }, [actions]);

  const handleActionMouseEnter = useCallback((e: React.MouseEvent<SVGElement>, action: Action) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setHoveredAction(action);
    setShowHoverTooltip(false);
    hoverTimeoutRef.current = setTimeout(() => setShowHoverTooltip(true), HOVER_TOOLTIP_DELAY_MS);
  }, []);

  const handleActionMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setTooltipPosition(null);
    setHoveredAction(null);
    setShowHoverTooltip(false);
  }, []);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("pitchOrientation", String(isFlipped));
    window.dispatchEvent(new CustomEvent("pitchOrientationChanged", { detail: { isFlipped } }));
  }, [isFlipped]);

  useEffect(() => {
    const handleOrientationChange = (event: CustomEvent) => {
      setIsFlipped(event.detail.isFlipped);
    };
    window.addEventListener("pitchOrientationChanged", handleOrientationChange as EventListener);
    return () => window.removeEventListener("pitchOrientationChanged", handleOrientationChange as EventListener);
  }, []);

  const convertCoordinates = useCallback((x: number, y: number) => {
    if (isFlipped) return { x: 100 - x, y: 100 - y };
    return { x, y };
  }, [isFlipped]);

  const handleActionClick = (event: React.MouseEvent, action: Action) => {
    event.stopPropagation();
    onActionClick?.(action);
  };

  const getArrowColor = (action: Action, isSelected: boolean) => {
    if (isSelected) return "#3b82f6";
    return action.actionType === "dribble" ? "#1e40af" : "#ef4444";
  };

  useEffect(() => {
    if (!pitchRef.current) return;
    const el = pitchRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPitchSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderArrowsSvg = () => {
    if (!pitchSize || !showArrows) return null;

    const lineWidth = 1.5;
    const dotR = 5;
    const arrowheadSize = 10;

    return (
      <svg
        className={styles.arrowSvgAbsolute}
        viewBox={`0 0 ${pitchSize.width} ${pitchSize.height}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "auto",
          zIndex: 20,
        }}
      >
        <defs>
          {renderableActions.map(({ action }) => {
            const isSelected = selectedActionId === action.id;
            const arrowColor = getArrowColor(action, isSelected);
            return (
              <marker
                key={`marker-${action.id}`}
                id={`packing-arrowhead-${action.id}`}
                markerWidth={arrowheadSize}
                markerHeight={arrowheadSize}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill={arrowColor} />
              </marker>
            );
          })}
        </defs>
        {[...renderableActions]
          .sort((a, b) => (selectedActionId === a.action.id ? 1 : 0) - (selectedActionId === b.action.id ? 1 : 0))
          .map(({ action, startX, startY, endX, endY, hasVideo }) => {
            const start = convertCoordinates(startX, startY);
            const end = convertCoordinates(endX, endY);
            const startPx = { x: (start.x / 100) * pitchSize.width, y: (start.y / 100) * pitchSize.height };
            const endPx = { x: (end.x / 100) * pitchSize.width, y: (end.y / 100) * pitchSize.height };
            const isSelected = selectedActionId === action.id;
            const arrowColor = getArrowColor(action, isSelected);
            const isDribble = action.actionType === "dribble";
            const isShot = action.isShot || false;
            const isGoal = action.isGoal || false;

            return (
              <g key={action.id}>
                <line
                  x1={startPx.x}
                  y1={startPx.y}
                  x2={endPx.x}
                  y2={endPx.y}
                  stroke={arrowColor}
                  strokeWidth={hasVideo ? lineWidth + 0.5 : lineWidth}
                  markerEnd={isDribble && startPx.x === endPx.x && startPx.y === endPx.y ? undefined : `url(#packing-arrowhead-${action.id})`}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  data-packing-action-arrow="true"
                  pointerEvents="stroke"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => handleActionClick(e, action)}
                  onMouseEnter={(e) => handleActionMouseEnter(e, action)}
                  onMouseLeave={handleActionMouseLeave}
                />
                {hasVideo ? (
                  <circle
                    cx={startPx.x}
                    cy={startPx.y}
                    r={dotR + 2}
                    fill="none"
                    stroke={VIDEO_RING_COLOR}
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                ) : null}
                {(isShot || isGoal) && (
                  <circle
                    cx={startPx.x}
                    cy={startPx.y}
                    r={dotR}
                    fill={isGoal ? "#86efac" : "#111827"}
                    stroke="white"
                    strokeWidth={1.4}
                    pointerEvents="none"
                  />
                )}
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
        hideTeamLogos={hideTeamLogos}
        rightContent={
          <>
            <button
              className={`${pitchHeaderStyles.headerButton} ${showArrows ? pitchHeaderStyles.headerButtonActive : ""}`}
              onClick={() => setShowArrows((v) => !v)}
              type="button"
              aria-pressed={showArrows}
              title="Pokaż/ukryj strzałki"
            >
              Strzałki: {showArrows ? "ON" : "OFF"}
            </button>
            {!hideFlipButton ? (
              <button
                className={pitchHeaderStyles.headerButton}
                onClick={() => setIsFlipped((v) => !v)}
                title="Obróć boisko"
                type="button"
              >
                Obróć
              </button>
            ) : null}
          </>
        }
      />

      <div className={styles.pitchWrapper}>
        <div
          className={`${styles.pitch} ${isFlipped ? styles.flipped : ""}`}
          role="img"
          aria-label="Boisko piłkarskie z akcjami packing"
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
          {renderArrowsSvg()}
          {showHoverTooltip && hoveredAction && tooltipPosition && (() => {
            const typeLabel = hoveredAction.actionType === "dribble" ? "Drybling" : "Podanie";
            const sender = getPlayerLabel(hoveredAction.senderId, localPlayersIndex);
            const receiver = hoveredAction.receiverId
              ? getPlayerLabel(hoveredAction.receiverId, localPlayersIndex)
              : null;
            const hasVideo = getVideoTimestampSeconds(hoveredAction) !== null;
            const tooltipContent = (
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
                  {hoveredAction.isGoal ? <span className={`${styles.pkEntryHoverTooltipBadge} ${styles.pkEntryHoverTooltipGoal}`}>Gol</span> : null}
                  {hoveredAction.isShot && !hoveredAction.isGoal ? <span className={styles.pkEntryHoverTooltipBadge}>Strzał</span> : null}
                  {hasVideo ? <span className={styles.pkEntryHoverTooltipBadge}>Wideo</span> : null}
                  <strong>{receiver ? `${sender} → ${receiver}` : sender}</strong>
                  <span>{hoveredAction.minute}&#8242; · {typeLabel}</span>
                </div>
              </div>
            );
            return createPortal(tooltipContent, document.body);
          })()}
        </div>
      </div>
    </div>
  );
});

PackingActionsPitch.displayName = "PackingActionsPitch";

export default PackingActionsPitch;
