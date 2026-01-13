"use client";

import React, { memo, useState, useCallback } from "react";
import { PKEntry } from "@/types";
import styles from "./PKEntriesPitch.module.css";

export interface PKEntriesPitchProps {
  pkEntries?: PKEntry[];
  onEntryAdd?: (startX: number, startY: number, endX: number, endY: number) => void;
  onEntryClick?: (entry: PKEntry) => void;
  selectedEntryId?: string;
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
  matchInfo,
  allTeams = [],
}: PKEntriesPitchProps) {
  // Stan przełącznika orientacji boiska
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Stan dla rysowania nowej strzałki
  const [drawingState, setDrawingState] = useState<{
    isDrawing: boolean;
    startX?: number;
    startY?: number;
    currentX?: number;
    currentY?: number;
  }>({ isDrawing: false });

  // Obsługa przełączania orientacji
  const handleFlipToggle = () => {
    setIsFlipped(!isFlipped);
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
    if (target.closest(`.${styles.arrowContainer}`) || target.closest(`.${styles.arrowPoint}`)) {
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

  // Funkcja rysowania strzałki jako SVG
  const renderArrow = (entry: PKEntry) => {
    const start = convertCoordinates(entry.startX, entry.startY);
    const end = convertCoordinates(entry.endX, entry.endY);
    
    const isSelected = selectedEntryId === entry.id;
    const arrowColor = getArrowColor(entry, isSelected);
    const isShot = entry.isShot || false;
    const isGoal = entry.isGoal || false;
    const isRegain = entry.isRegain || false;
    
    // Oblicz środek linii dla pomarańczowej kropki przy regain
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Kolor grota: jasnozielony jeśli był strzał, w przeciwnym razie kolor strzałki
    const arrowheadColor = isShot ? '#86efac' : arrowColor;
    // Rozmiar grota: większy jeśli był gol, średni jeśli strzał, standardowy w przeciwnym razie
    const arrowheadSize = isGoal ? 3 : (isShot ? 2.5 : 1.2);
    // refX ustawiony tak, aby grot kończył się dokładnie na końcu linii
    // refX określa przesunięcie punktu odniesienia markera od jego początku
    // Większa wartość refX przesuwa grot w prawo (w kierunku końca linii)
    // Dla strzału potrzebujemy znacznie większego refX, aby grot był na końcu linii
    // refX powinien być bliski rozmiarowi grota, aby czubek grota był na końcu linii
    const refX = isGoal ? "2.5" : (isShot ? "3.2" : "0.9");
    
    return (
      <svg
        key={entry.id}
        className={styles.arrowSvgAbsolute}
        viewBox="0 0 100 100"
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
        onClick={(e) => {
          e.stopPropagation();
          handleEntryClick(e as any, entry);
        }}
      >
        <defs>
          <marker
            id={`arrowhead-${entry.id}`}
            markerWidth={arrowheadSize}
            markerHeight={arrowheadSize}
            refX={refX}
            refY="0.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon
              points="0 0, 1 0.5, 0 1"
              fill={arrowheadColor}
            />
          </marker>
        </defs>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={arrowColor}
          strokeWidth="0.3"
          markerEnd={`url(#arrowhead-${entry.id})`}
          pointerEvents="stroke"
          style={{ cursor: 'pointer' }}
        />
        {/* Emoji piłki na początku strzałki, jeśli był gol */}
        {isGoal && (
          <foreignObject
            x={start.x - 1.5}
            y={start.y - 1.5}
            width="3"
            height="3"
            pointerEvents="none"
            style={{
              overflow: 'visible',
            }}
          >
            <div
              style={{
                width: '3px',
                height: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3px',
                lineHeight: '1',
                userSelect: 'none',
                aspectRatio: '1',
              }}
            >
              ⚽
            </div>
          </foreignObject>
        )}
        {/* Pomarańczowa kropka na środku linii, jeśli był regain */}
        {isRegain && (
          <circle
            cx={midX}
            cy={midY}
            r="1.2"
            fill="#f59e0b"
            stroke="white"
            strokeWidth="0.15"
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
    
    const start = convertCoordinates(drawingState.startX, drawingState.startY);
    const end = convertCoordinates(drawingState.currentX, drawingState.currentY);
    
    return (
      <svg
        className={styles.arrowSvgAbsolute}
        viewBox="0 0 100 100"
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
            markerWidth="1"
            markerHeight="1"
            refX="0.9"
            refY="0.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon
              points="0 0, 1 0.5, 0 1"
              fill="#3b82f6"
              opacity="0.6"
            />
          </marker>
        </defs>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#3b82f6"
          strokeWidth="0.3"
          strokeDasharray="0.5,0.5"
          opacity="0.6"
          markerEnd="url(#temporary-arrowhead)"
        />
        <circle
          cx={start.x}
          cy={start.y}
          r="0.8"
          fill="#3b82f6"
          stroke="white"
          strokeWidth="0.2"
          opacity="0.8"
        />
        <circle
          cx={end.x}
          cy={end.y}
          r="0.8"
          fill="#3b82f6"
          stroke="white"
          strokeWidth="0.2"
          opacity="0.8"
        />
      </svg>
    );
  };

  return (
    <div className={styles.pitchContainer}>
      {/* Loga zespołów - zamieniają się miejscami gdy boisko jest odwrócone */}
      <div className={styles.teamLogos}>
        {isFlipped ? (
          <>
            <div className={styles.teamLogo}>
              {(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.logo ? (
                  <img 
                    src={teamData.logo} 
                    alt="Logo zespołu" 
                    className={styles.teamLogoImage}
                  />
                ) : null;
              })()}
              <span className={styles.teamName}>{(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.name || matchInfo?.team || 'Nasz zespół';
              })()}</span>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.teamLogo}>
              {matchInfo?.opponentLogo && (
                <img 
                  src={matchInfo.opponentLogo} 
                  alt="Logo przeciwnika" 
                  className={styles.teamLogoImage}
                />
              )}
              <span className={styles.teamName}>{matchInfo?.opponent || 'Przeciwnik'}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.teamLogo}>
              {matchInfo?.opponentLogo && (
                <img 
                  src={matchInfo.opponentLogo} 
                  alt="Logo przeciwnika" 
                  className={styles.teamLogoImage}
                />
              )}
              <span className={styles.teamName}>{matchInfo?.opponent || 'Przeciwnik'}</span>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.teamLogo}>
              {(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.logo ? (
                  <img 
                    src={teamData.logo} 
                    alt="Logo zespołu" 
                    className={styles.teamLogoImage}
                  />
                ) : null;
              })()}
              <span className={styles.teamName}>{(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.name || matchInfo?.team || 'Nasz zespół';
              })()}</span>
            </div>
          </>
        )}
      </div>

      {/* Przycisk przełączania orientacji */}
      <button
        className={styles.flipButton}
        onClick={handleFlipToggle}
        title="Obróć boisko"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12h-4M3 12h4M12 3v4M12 17v4M7 7l10 10M7 17l10-10" />
        </svg>
      </button>

      {/* Instrukcja */}
      {drawingState.isDrawing && (
        <div className={styles.instruction}>
          Kliknij punkt końcowy strzałki
        </div>
      )}
      {!drawingState.isDrawing && (
        <div className={styles.instruction}>
          Kliknij, aby rozpocząć rysowanie strzałki (punkt startu)
        </div>
      )}

      <div
        className={`${styles.pitch} ${isFlipped ? styles.flipped : ''}`}
        role="grid"
        aria-label="Boisko piłkarskie do analizy wejść w pole karne"
        onClick={handlePitchClick}
        onMouseMove={handlePitchMouseMove}
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
        {pkEntries.map(entry => renderArrow(entry))}
        
        {/* Tymczasowa strzałka podczas rysowania */}
        {renderTemporaryArrow()}
      </div>
    </div>
  );
});

PKEntriesPitch.displayName = "PKEntriesPitch";

export default PKEntriesPitch;

