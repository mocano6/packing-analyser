"use client";

import React, { memo, useState, useEffect, useMemo } from "react";
import { Player, Shot } from "@/types";
import styles from "./XGPitch.module.css";
import PitchHeader from "../PitchHeader/PitchHeader";
import pitchHeaderStyles from "../PitchHeader/PitchHeader.module.css";
import { buildPlayersIndex, getPlayerLabel, PlayersIndex } from "@/utils/playerUtils";

export interface XGPitchProps {
  shots?: Shot[];
  players?: Player[];
  playersIndex?: PlayersIndex;
  onShotAdd?: (x: number, y: number, xG: number) => void;
  onShotClick?: (shot: Shot) => void;
  selectedShotId?: string;
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
  hideToggleButton?: boolean; // Ukryj przycisk przełączania widoczności tagów
  hideTeamLogos?: boolean; // Ukryj loga zespołów
  rightExtraContent?: React.ReactNode; // Dodatkowa zawartość po prawej stronie nagłówka
}

// Funkcja obliczania xG na podstawie pozycji
const calculateXG = (x: number, y: number): number => {
  // Przekształć pozycję na metryczną względem bramki (zakładamy bramkę po prawej stronie)
  const goalX = 100; // Prawa strona boiska (bramka)
  const goalY = 50;  // Środek bramki
  
  // Dystans od bramki (im bliżej, tym wyższa wartość xG)
  const distanceFromGoal = Math.sqrt(Math.pow(goalX - x, 2) + Math.pow((goalY - y) * 1.544, 2)); // 1.544 to współczynnik proporcji boiska
  
  // Kąt względem bramki (im bardziej centralnie, tym lepiej)
  const angleFromGoal = Math.abs(y - goalY);
  
  // Bazowa wartość xG oparta na dystansie (im bliżej, tym wyżej)
  let xG = Math.max(0.01, Math.min(0.95, 1 - (distanceFromGoal / 100)));
  
  // Redukcja za kąt (strzały z boku są trudniejsze)
  if (angleFromGoal > 20) {
    xG *= 0.6;
  } else if (angleFromGoal > 10) {
    xG *= 0.8;
  }
  
  // Zwiększenie dla strzałów z pola karnego (x > 84.3% to pole karne)
  if (x > 84.3) {
    xG *= 1.3;
  }
  
  // Znaczne zwiększenie dla strzałów z pola bramkowego (x > 94.8%)
  if (x > 94.8) {
    xG *= 1.8;
  }
  
  return Math.max(0.01, Math.min(0.95, xG));
};

const XGPitch = memo(function XGPitch({
  shots = [],
  players = [],
  playersIndex,
  onShotAdd,
  onShotClick,
  selectedShotId,
  matchInfo,
  allTeams = [],
  hideTeamLogos = false,
  hideToggleButton = false,
  rightExtraContent,
}: XGPitchProps) {
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
  // Stan przełącznika widoczności strzałów
  const [showShots, setShowShots] = useState(true);

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

  // Obsługa przełączania widoczności strzałów
  const handleToggleShots = () => {
    setShowShots(prev => !prev);
  };

  // Obsługa kliknięcia na boisko
  const handlePitchClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Sprawdź czy kliknięto na istniejący strzał
    const target = event.target as HTMLElement;
    if (target.closest(`.${styles.shotMarker}`)) {
      return; // Nie dodawaj nowego strzału, jeśli kliknięto na istniejący
    }
    
    if (!onShotAdd) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    let x = ((event.clientX - rect.left) / rect.width) * 100;
    let y = ((event.clientY - rect.top) / rect.height) * 100;
    
    // Dostosuj pozycję dla orientacji obróconej (przeciwległa strona boiska, nie lustro)
    if (isFlipped) {
      x = 100 - x;
      y = 100 - y;
    }
    
    const xG = calculateXG(x, y);
    onShotAdd(x, y, xG);
  };

  // Obsługa kliknięcia na strzał
  const handleShotClick = (event: React.MouseEvent, shot: Shot) => {
    event.stopPropagation();
    onShotClick?.(shot);
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
            {!hideToggleButton && (
              <button
                type="button"
                className={`${pitchHeaderStyles.headerButton} ${showShots ? pitchHeaderStyles.headerButtonActive : ""}`}
                onClick={handleToggleShots}
                aria-pressed={showShots}
              >
                Strzały: {showShots ? "ON" : "OFF"}
              </button>
            )}
            <button
              type="button"
              className={pitchHeaderStyles.headerButton}
              onClick={handleFlipToggle}
            >
              Obróć
            </button>
          </>
        }
      />

      <div className={styles.pitchWrapper}>
        <div
          className={`${styles.pitch} ${isFlipped ? styles.flipped : ''}`}
          role="grid"
          aria-label="Boisko piłkarskie do analizy xG"
          onClick={handlePitchClick}
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
          <div className={`${styles.attackRectangle} ${isFlipped ? styles.attackRectangleRight : styles.attackRectangleLeft} ${styles.opponentRectangle}`} />
        </div>

        {/* Renderowanie strzałów */}
        {showShots && shots.map((shot) => {
          let displayX = shot.x;
          let displayY = shot.y;
          
          // Dostosuj pozycję dla orientacji obróconej (przeciwległa strona boiska, nie lustro)
          if (isFlipped) {
            displayX = 100 - shot.x;
            displayY = 100 - shot.y;
          }
          
          // Sprawdź, czy to strzał z asystą
          const isAssist = !!shot.assistantId;
          // Klasy dla gola i stałego fragmentu (głowa bez zmiany kształtu – kółko)
          const isGoalClass = shot.isGoal ? styles.isGoal : '';
          const setPieceTypes = ['corner', 'free_kick', 'direct_free_kick', 'penalty', 'throw_in'];
          const isSetPiece = !!(shot.actionType && setPieceTypes.includes(shot.actionType));
          const isSetPieceClass = isSetPiece ? styles.isSetPiece : '';
          const isGoalAndSetPiece = shot.isGoal && isSetPiece;
          
          // Oblicz rozmiar kropki na podstawie xG (min 12px, max 36px)
          // Im wyższy xG, tym większa kropka
          const dotSize = Math.max(12, Math.min(36, 12 + (shot.xG * 24)));
          
          // Oblicz kolor na podstawie xG - popularna skala kolorów
          // xG 0.0-0.1: zielony (#10b981)
          // xG 0.1-0.3: żółty (#fbbf24)
          // xG 0.3-0.6: pomarańczowy do czerwonego (#f97316 -> #dc2626)
          // xG 0.6-1.0: maksymalnie czerwony (#dc2626)
          const getXGColor = (xG: number) => {
            // Normalizuj xG do zakresu 0-1
            const normalizedXG = Math.min(1, Math.max(0, xG));
            
            let r, g, b;
            
            if (normalizedXG <= 0.1) {
              // Zielony dla niskich xG (0.0-0.1) - #10b981 = rgb(16, 185, 129)
              const t = normalizedXG / 0.1;
              r = Math.round(16 + (251 - 16) * t); // 16 -> 251 (zielony -> żółty R)
              g = Math.round(185 + (191 - 185) * t); // 185 -> 191 (zielony -> żółty G)
              b = Math.round(129 + (36 - 129) * t); // 129 -> 36 (zielony -> żółty B)
            } else if (normalizedXG <= 0.3) {
              // Żółty do pomarańczowego (0.1-0.3) - #fbbf24 -> #f97316
              const t = (normalizedXG - 0.1) / 0.2;
              r = Math.round(251 + (249 - 251) * t); // 251 -> 249
              g = Math.round(191 + (115 - 191) * t); // 191 -> 115
              b = Math.round(36 + (22 - 36) * t); // 36 -> 22
            } else if (normalizedXG <= 0.6) {
              // Pomarańczowy do czerwonego (0.3-0.6) - #f97316 -> #dc2626
              const t = (normalizedXG - 0.3) / 0.3;
              r = Math.round(249 + (220 - 249) * t); // 249 -> 220
              g = Math.round(115 + (38 - 115) * t); // 115 -> 38
              b = Math.round(22 + (38 - 22) * t); // 22 -> 38
            } else {
              // Maksymalnie czerwony dla xG >= 0.6 - #dc2626 = rgb(220, 38, 38)
              r = 220;
              g = 38;
              b = 38;
            }
            
            return `rgb(${r}, ${g}, ${b})`;
          };
          
          const xGColor = getXGColor(shot.xG);
          
          return (
            <div
              key={shot.id}
              className={`${styles.shotMarker} ${selectedShotId === shot.id ? styles.selected : ''} ${isGoalClass} ${isSetPieceClass}`}
              style={{
                left: `${displayX}%`,
                top: `${displayY}%`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                ...(isGoalAndSetPiece ? {} : { backgroundColor: xGColor, background: xGColor }),
                opacity: 1,
                ...(shot.isGoal && !isSetPiece ? {} : { border: 'none' }),
                borderRadius: isSetPiece ? '0' : '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => handleShotClick(e, shot)}
              title={`${isAssist ? '⚽ Asysta: ' : ''}${getPlayerLabel(shot.playerId, localPlayersIndex)} - ${shot.minute}' - xG: ${shot.xG.toFixed(2)} ${shot.isGoal ? '⚽' : ''} - ${shot.actionType || 'open_play'}`}
            >
              {isGoalAndSetPiece ? (
                <div className={styles.shotMarkerGoalInner} style={{ backgroundColor: xGColor }}>
                  <div className={styles.shotInner}>
                    <span
                      className={styles.xgValue}
                      style={{
                        fontSize: `${Math.max(9, Math.min(14, dotSize * 0.4))}px`,
                        fontWeight: '700',
                        color: '#ffffff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)'
                      }}
                    >
                      {Math.round(shot.xG * 100)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className={styles.shotInner}>
                  <span 
                    className={styles.xgValue} 
                    style={{ 
                      fontSize: `${Math.max(9, Math.min(14, dotSize * 0.4))}px`,
                      fontWeight: '700',
                      color: '#ffffff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {Math.round(shot.xG * 100)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
XGPitch.displayName = "XGPitch";

export default XGPitch; 