"use client";

import React, { memo, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { PKEntry } from "@/types";
import styles from "./PKEntriesPitch.module.css";
import PitchHeader from "../PitchHeader/PitchHeader";
import pitchHeaderStyles from "../PitchHeader/PitchHeader.module.css";
import { buildPlayersIndex, getPlayerLabel, PlayersIndex } from "@/utils/playerUtils";
import { Player } from "@/types";

const HOVER_TOOLTIP_DELAY_MS = 1500;

export interface PKEntriesPitchProps {
  pkEntries?: PKEntry[];
  players?: Player[];
  playersIndex?: PlayersIndex;
  onEntryAdd?: (startX: number, startY: number, endX: number, endY: number) => void;
  onEntryClick?: (entry: PKEntry) => void;
  selectedEntryId?: string;
  rightExtraContent?: React.ReactNode;
  hideTeamLogos?: boolean;
  hideFlipButton?: boolean;
  hideInstructions?: boolean;
  matchInfo?: {
    team?: string;
    opponent?: string;
    teamName?: string;
    opponentName?: string;
    opponentLogo?: string;
  };
  allTeams?: Array<{
    id: string;
    name: string;
    logo?: string;
  }>;
}

const PKEntriesPitch = memo(function PKEntriesPitch({
  pkEntries = [],
  players = [],
  playersIndex,
  onEntryAdd,
  onEntryClick,
  selectedEntryId,
  rightExtraContent,
  hideTeamLogos = false,
  hideFlipButton = false,
  hideInstructions = false,
  matchInfo,
  allTeams = [],
}: PKEntriesPitchProps) {
  const localPlayersIndex = useMemo(
    () => playersIndex ?? buildPlayersIndex(players),
    [playersIndex, players]
  );
  // Stan przełącznika orientacji boiska - przywróć z localStorage (wspólny dla wszystkich zakładek)
  const [isFlipped, setIsFlipped] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pitchOrientation');
      return saved === 'true';
    }
    return false;
  });
  // Stan przełącznika widoczności strzałek
  const [showArrows, setShowArrows] = useState(true);

  // Rozmiar boiska w pikselach (do rysowania SVG bez zniekształceń)
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [pitchSize, setPitchSize] = useState<{ width: number; height: number } | null>(null);
  
  // Stan dla rysowania nowej strzałki
  const [drawingState, setDrawingState] = useState<{
    isDrawing: boolean;
    startX?: number;
    startY?: number;
    currentX?: number;
    currentY?: number;
  }>({ isDrawing: false });

  // Tooltip po najechaniu (jak w XGPitch)
  const [hoveredEntry, setHoveredEntry] = useState<PKEntry | null>(null);
  const [showHoverTooltip, setShowHoverTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEntryMouseEnter = useCallback((e: React.MouseEvent<SVGElement>, entry: PKEntry) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    setTooltipPosition({ x: centerX, y: centerY });
    setHoveredEntry(entry);
    setShowHoverTooltip(false);
    hoverTimeoutRef.current = setTimeout(() => setShowHoverTooltip(true), HOVER_TOOLTIP_DELAY_MS);
  }, []);

  const handleEntryMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setTooltipPosition(null);
    setHoveredEntry(null);
    setShowHoverTooltip(false);
  }, []);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  // Zapisz orientację do localStorage przy zmianie (wspólny dla wszystkich zakładek)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pitchOrientation', String(isFlipped));
      // Wyślij event, aby inne komponenty mogły zaktualizować swój stan
      window.dispatchEvent(new CustomEvent('pitchOrientationChanged', { detail: { isFlipped } }));
    }
  }, [isFlipped]);

  // Nasłuchuj zmian orientacji z innych komponentów
  useEffect(() => {
    const handleOrientationChange = (event: CustomEvent) => {
      setIsFlipped(event.detail.isFlipped);
    };
    
    window.addEventListener('pitchOrientationChanged', handleOrientationChange as EventListener);
    return () => {
      window.removeEventListener('pitchOrientationChanged', handleOrientationChange as EventListener);
    };
  }, []);

  // Obsługa przełączania orientacji
  const handleFlipToggle = () => {
    setIsFlipped(!isFlipped);
  };

  // Obsługa przełączania widoczności strzałek
  const handleToggleArrows = () => {
    setShowArrows(!showArrows);
  };

  // Funkcja konwersji współrzędnych dla orientacji odbitej
  const convertCoordinates = useCallback((x: number, y: number) => {
    if (isFlipped) {
      return { x: 100 - x, y: 100 - y };
    }
    return { x, y };
  }, [isFlipped]);

  // Obsługa ruchu myszy podczas rysowania
  const handlePitchMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingState.isDrawing || !onEntryAdd) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    let x = ((event.clientX - rect.left) / rect.width) * 100;
    let y = ((event.clientY - rect.top) / rect.height) * 100;
    
    // Dostosuj pozycję dla orientacji odbitej
    if (isFlipped) {
      x = 100 - x;
      y = 100 - y;
    }
    
    setDrawingState(prev => ({ ...prev, currentX: x, currentY: y }));
  }, [drawingState.isDrawing, onEntryAdd, isFlipped]);

  // Obsługa kliknięcia na boisko
  const handlePitchClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Sprawdź czy kliknięto na istniejącą strzałkę
    const target = event.target as HTMLElement;
    if (
      target.closest('[data-pk-entry-arrow="true"]') ||
      target.closest(`.${styles.arrowContainer}`) ||
      target.closest(`.${styles.arrowPoint}`)
    ) {
      return; // Nie dodawaj nowej strzałki, jeśli kliknięto na istniejącą
    }
    
    if (!onEntryAdd) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    let x = ((event.clientX - rect.left) / rect.width) * 100;
    let y = ((event.clientY - rect.top) / rect.height) * 100;
    
    // Dostosuj pozycję dla orientacji odbitej
    if (isFlipped) {
      x = 100 - x;
      y = 100 - y;
    }
    
    if (!drawingState.isDrawing) {
      // Rozpocznij rysowanie - ustaw punkt startu
      setDrawingState({ isDrawing: true, startX: x, startY: y, currentX: x, currentY: y });
    } else {
      // Zakończ rysowanie - ustaw punkt końca i zapisz
      if (drawingState.startX !== undefined && drawingState.startY !== undefined) {
        onEntryAdd(drawingState.startX, drawingState.startY, x, y);
        setDrawingState({ isDrawing: false });
      }
    }
  };

  // Obsługa kliknięcia na strzałkę
  const handleEntryClick = (event: React.MouseEvent, entry: PKEntry) => {
    event.stopPropagation();
    // Anuluj rysowanie jeśli kliknięto na istniejącą strzałkę
    if (drawingState.isDrawing) {
      setDrawingState({ isDrawing: false });
    }
    onEntryClick?.(entry);
  };

  // Funkcja określająca kolor strzałki na podstawie typu akcji
  const getArrowColor = (entry: PKEntry, isSelected: boolean) => {
    if (isSelected) {
      return '#3b82f6'; // Niebieski dla zaznaczonej strzałki
    }
    
    switch (entry.entryType) {
      case "pass":
        return '#ef4444'; // Czerwona - Podanie
      case "dribble":
        return '#1e40af'; // Ciemnoniebieska - Drybling
      case "sfg":
        return '#10b981'; // Zielona - SFG
      case "regain":
        return '#f59e0b'; // Pomarańczowa - Regain
      default:
        return '#ef4444'; // Domyślnie czerwona
    }
  };

  useEffect(() => {
    if (!pitchRef.current) return;

    const el = pitchRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      // Zabezpieczenie przed 0x0 (np. w trakcie animacji/layoutu)
      if (rect.width > 0 && rect.height > 0) {
        setPitchSize({ width: rect.width, height: rect.height });
      }
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Jedno wspólne SVG dla wszystkich strzałek – każda strzałka ma osobny SVG blokujący pozostałe
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
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          zIndex: 20,
        }}
      >
        <defs>
          {pkEntries.map((entry) => {
            const isSelected = selectedEntryId === entry.id;
            const arrowColor = getArrowColor(entry, isSelected);
            return (
              <marker
                key={`marker-${entry.id}`}
                id={`arrowhead-${entry.id}`}
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
        {[...pkEntries]
          .sort((a, b) => (selectedEntryId === a.id ? 1 : 0) - (selectedEntryId === b.id ? 1 : 0))
          .map((entry) => {
          const start = convertCoordinates(entry.startX, entry.startY);
          const end = convertCoordinates(entry.endX, entry.endY);
          const startPx = { x: (start.x / 100) * pitchSize.width, y: (start.y / 100) * pitchSize.height };
          const endPx = { x: (end.x / 100) * pitchSize.width, y: (end.y / 100) * pitchSize.height };
          const isSelected = selectedEntryId === entry.id;
          const arrowColor = getArrowColor(entry, isSelected);
          const isShot = entry.isShot || false;
          const isGoal = entry.isGoal || false;
          const isRegain = entry.isRegain || false;

          let dotFillColor = "white";
          let dotStrokeColor = "white";
          let dotStrokeWidth = 1.4;
          if (isGoal) {
            dotFillColor = "#86efac";
            dotStrokeColor = isRegain ? "#f59e0b" : "white";
            dotStrokeWidth = isRegain ? 2.0 : 1.4;
          } else if (isShot) {
            dotFillColor = "#111827";
            dotStrokeColor = isRegain ? "#f59e0b" : "white";
          } else if (isRegain) {
            dotFillColor = "white";
            dotStrokeColor = "#f59e0b";
          }

          return (
            <g key={entry.id}>
              <line
                x1={startPx.x}
                y1={startPx.y}
                x2={endPx.x}
                y2={endPx.y}
                stroke={arrowColor}
                strokeWidth={lineWidth}
                markerEnd={`url(#arrowhead-${entry.id})`}
                strokeLinecap="butt"
                strokeLinejoin="round"
                data-pk-entry-arrow="true"
                pointerEvents="stroke"
                style={{ cursor: 'pointer' }}
                onClick={(e) => handleEntryClick(e, entry)}
                onMouseEnter={(e) => handleEntryMouseEnter(e, entry)}
                onMouseLeave={handleEntryMouseLeave}
              />
              {(isShot || isGoal || isRegain) && (
                <circle
                  cx={startPx.x}
                  cy={startPx.y}
                  r={dotR}
                  fill={dotFillColor}
                  stroke={dotStrokeColor}
                  strokeWidth={dotStrokeWidth}
                />
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // Renderowanie tymczasowej strzałki podczas rysowania
  const renderTemporaryArrow = () => {
    if (!drawingState.isDrawing || 
        drawingState.startX === undefined || 
        drawingState.startY === undefined ||
        drawingState.currentX === undefined ||
        drawingState.currentY === undefined) {
      return null;
    }

    if (!pitchSize) return null;
    
    const start = convertCoordinates(drawingState.startX, drawingState.startY);
    const end = convertCoordinates(drawingState.currentX, drawingState.currentY);

    const startPx = { x: (start.x / 100) * pitchSize.width, y: (start.y / 100) * pitchSize.height };
    const endPx = { x: (end.x / 100) * pitchSize.width, y: (end.y / 100) * pitchSize.height };
    
    return (
      <svg
        className={styles.arrowSvgAbsolute}
        viewBox={`0 0 ${pitchSize.width} ${pitchSize.height}`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 22,
        }}
      >
        <defs>
          <marker
            id="temporary-arrowhead"
            markerWidth="9"
            markerHeight="9"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="#3b82f6" opacity="0.6" />
          </marker>
        </defs>
        <line
          x1={startPx.x}
          y1={startPx.y}
          x2={endPx.x}
          y2={endPx.y}
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="4,4"
          opacity="0.6"
          markerEnd="url(#temporary-arrowhead)"
          strokeLinecap="round"
        />
        <circle
          cx={startPx.x}
          cy={startPx.y}
          r="3.5"
          fill="#3b82f6"
          stroke="white"
          strokeWidth="1"
          opacity="0.8"
        />
        <circle
          cx={endPx.x}
          cy={endPx.y}
          r="3.5"
          fill="#3b82f6"
          stroke="white"
          strokeWidth="1"
          opacity="0.8"
        />
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
            {rightExtraContent}
            {!!onEntryAdd && (
              <button
                className={`${pitchHeaderStyles.headerButton} ${showArrows ? pitchHeaderStyles.headerButtonActive : ""}`}
                onClick={handleToggleArrows}
                type="button"
                aria-pressed={showArrows}
                title="Pokaż/ukryj strzałki"
              >
                Strzałki: {showArrows ? "ON" : "OFF"}
              </button>
            )}

            {!hideFlipButton && (
              <button
                className={pitchHeaderStyles.headerButton}
                onClick={handleFlipToggle}
                title="Obróć boisko"
                type="button"
              >
                Obróć
              </button>
            )}
          </>
        }
      />

      {/* Instrukcja */}
      {!hideInstructions && !!onEntryAdd && (
        <>
        </>
      )}

      <div className={styles.pitchWrapper}>
        <div
          className={`${styles.pitch} ${isFlipped ? styles.flipped : ''}`}
          role="grid"
          aria-label="Boisko piłkarskie do analizy wejść w pole karne"
          onClick={handlePitchClick}
          onMouseMove={handlePitchMouseMove}
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

        {/* Jedno SVG ze wszystkimi strzałkami – każda ma swój obszar najechania */}
        {renderArrowsSvg()}
        
        {/* Tymczasowa strzałka podczas rysowania */}
        {renderTemporaryArrow()}

        {/* Tooltip po najechaniu (dokładnie jak w XGPitch) */}
        {showHoverTooltip && hoveredEntry && tooltipPosition && (() => {
          const entryTypeLabel = hoveredEntry.entryType === 'pass' ? 'Podanie' : hoveredEntry.entryType === 'dribble' ? 'Drybling' : hoveredEntry.entryType === 'sfg' ? 'SFG' : hoveredEntry.entryType === 'regain' ? 'Regain' : hoveredEntry.entryType || 'Wejście';
          const playerLabel = hoveredEntry.senderId
            ? getPlayerLabel(hoveredEntry.senderId, localPlayersIndex)
            : null;
          const receiverLabel = hoveredEntry.receiverId
            ? getPlayerLabel(hoveredEntry.receiverId, localPlayersIndex)
            : null;
          const tooltipContent = (
            <div
              className={styles.pkEntryHoverTooltip}
              style={{
                position: 'fixed',
                left: tooltipPosition.x,
                top: tooltipPosition.y,
                transform: 'translate(-50%, calc(-100% - 8px))',
                zIndex: 999999,
              }}
              role="tooltip"
            >
              <div className={styles.pkEntryHoverTooltipInner}>
                {hoveredEntry.isGoal && <span className={`${styles.pkEntryHoverTooltipBadge} ${styles.pkEntryHoverTooltipGoal}`}>Gol</span>}
                {hoveredEntry.isShot && !hoveredEntry.isGoal && <span className={styles.pkEntryHoverTooltipBadge}>Strzał</span>}
                {hoveredEntry.isRegain && <span className={styles.pkEntryHoverTooltipBadge}>Regain</span>}
                {playerLabel && (
                  <strong>
                    {playerLabel}
                    {receiverLabel ? ` → ${receiverLabel}` : ''}
                  </strong>
                )}
                {!playerLabel && <strong>Wejście w PK</strong>}
                <span>{hoveredEntry.minute}&#8242; · {entryTypeLabel}</span>
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

PKEntriesPitch.displayName = "PKEntriesPitch";

export default PKEntriesPitch;

