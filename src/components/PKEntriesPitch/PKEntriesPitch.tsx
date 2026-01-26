"use client";

import React, { memo, useEffect, useRef, useState, useCallback } from "react";
import { PKEntry } from "@/types";
import styles from "./PKEntriesPitch.module.css";
import PitchHeader from "../PitchHeader/PitchHeader";
import pitchHeaderStyles from "../PitchHeader/PitchHeader.module.css";

export interface PKEntriesPitchProps {
  pkEntries?: PKEntry[];
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

  // Funkcja rysowania strzałki jako SVG
  const renderArrow = (entry: PKEntry) => {
    if (!pitchSize) return null;

    const start = convertCoordinates(entry.startX, entry.startY);
    const end = convertCoordinates(entry.endX, entry.endY);
    
    const isSelected = selectedEntryId === entry.id;
    const arrowColor = getArrowColor(entry, isSelected);
    const isShot = entry.isShot || false;
    const isGoal = entry.isGoal || false;
    const isRegain = entry.isRegain || false;

    // Mapowanie % boiska -> px (bez zniekształceń kółek/markerów)
    const startPx = { x: (start.x / 100) * pitchSize.width, y: (start.y / 100) * pitchSize.height };
    const endPx = { x: (end.x / 100) * pitchSize.width, y: (end.y / 100) * pitchSize.height };

    // Hierarchia kolorów kropki: gol (najważniejszy) > strzał > regain
    // Gol: zielony wypełnienie
    // Strzał (bez gola): czarne wypełnienie
    // Regain: pomarańczowe obramowanie (zawsze, gdy jest regain)
    let dotFillColor = "white";
    let dotStrokeColor = "white";
    let dotStrokeWidth = 1.4;
    
    if (isGoal) {
      // Gol ma najwyższy priorytet - zawsze zielone wypełnienie
      dotFillColor = "#86efac"; // jasnozielony
      // Jeśli jest też regain, obramowanie pomarańczowe i pogrubione
      if (isRegain) {
        dotStrokeColor = "#f59e0b"; // pomarańczowy
        dotStrokeWidth = 2.0; // pogrubione
      } else {
        dotStrokeColor = "white";
      }
    } else if (isShot) {
      // Strzał ma drugi priorytet
      dotFillColor = "#111827"; // czarny
      // Jeśli jest też regain, obramowanie pomarańczowe
      if (isRegain) {
        dotStrokeColor = "#f59e0b"; // pomarańczowy
      } else {
        dotStrokeColor = "white";
      }
    } else if (isRegain) {
      // Regain (bez strzału i gola): białe wypełnienie, pomarańczowe obramowanie
      dotFillColor = "white";
      dotStrokeColor = "#f59e0b"; // pomarańczowy
    }

    // Parametry UI (px) - wszystkie strzałki mają jednakowe parametry
    const lineWidth = 1.5;
    const dotR = 5; // trochę większa kropka dla strzał/gol
    const arrowheadSize = 10; // jednakowy rozmiar grota dla wszystkich strzałek
    
    return (
      <svg
        key={entry.id}
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
          zIndex: isSelected ? 30 : 20,
        }}
      >
        <defs>
          <marker
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
        </defs>
        {/* Linia podstawowa */}
        <line
          x1={startPx.x}
          y1={startPx.y}
          x2={endPx.x}
          y2={endPx.y}
          stroke={arrowColor}
          strokeWidth={lineWidth}
          markerEnd={`url(#arrowhead-${entry.id})`}
          pointerEvents="stroke"
          style={{ cursor: 'pointer' }}
          // round cap powoduje "wystawanie" linii poza punkt końcowy i optycznie wygląda,
          // jakby grot był bliżej środka. Butt daje czysty styk linia -> grot.
          strokeLinecap="butt"
          strokeLinejoin="round"
          data-pk-entry-arrow="true"
          onClick={(e) => handleEntryClick(e, entry)}
        />
        {/* Kropka na początku strzałki, jeśli był strzał, gol lub regain */}
        {(isShot || isGoal || isRegain) && (
          <circle
            cx={startPx.x}
            cy={startPx.y}
            r={dotR}
            fill={dotFillColor}
            stroke={dotStrokeColor}
            strokeWidth={dotStrokeWidth}
            pointerEvents="none"
          />
        )}
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
        </div>

        {/* Renderowanie strzałek */}
        {showArrows && pkEntries.map(entry => renderArrow(entry))}
        
        {/* Tymczasowa strzałka podczas rysowania */}
        {renderTemporaryArrow()}
        </div>
      </div>
    </div>
  );
});

PKEntriesPitch.displayName = "PKEntriesPitch";

export default PKEntriesPitch;

