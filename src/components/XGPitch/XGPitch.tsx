"use client";

import React, { memo, useState } from "react";
import { Shot } from "@/types";
import styles from "./XGPitch.module.css";

export interface XGPitchProps {
  shots?: Shot[];
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
  onShotAdd,
  onShotClick,
  selectedShotId,
  matchInfo,
  allTeams = [],
}: XGPitchProps) {
  // Stan przełącznika orientacji boiska
  const [isFlipped, setIsFlipped] = useState(false);

  // Obsługa przełączania orientacji
  const handleFlipToggle = () => {
    setIsFlipped(!isFlipped);
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
    
    // Dostosuj pozycję dla orientacji odbitej
    if (isFlipped) {
      x = 100 - x;
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
      {/* Loga zespołów */}
      <div className={styles.teamLogos}>
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
      </div>
      

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
        </div>

        {/* Renderowanie strzałów */}
        {shots.map((shot) => {
          let displayX = shot.x;
          let displayY = shot.y;
          
          // Dostosuj pozycję dla orientacji odbitej
          if (isFlipped) {
            displayX = 100 - shot.x;
          }
          
          // Oblicz rozmiar kropki na podstawie xG (min 8px, max 24px)
          const dotSize = Math.max(8, Math.min(24, 8 + (shot.xG * 16)));
          
          // Określ kolor na podstawie typu akcji
          const getActionTypeColor = (actionType?: string) => {
            switch (actionType) {
              case 'open_play': return '#3b82f6'; // Niebieski - budowanie
              case 'counter': return '#ef4444'; // Czerwony - kontra
              case 'regain': return '#10b981'; // Zielony - regain
              case 'corner': return '#f59e0b'; // Pomarańczowy - rożny
              case 'free_kick': return '#8b5cf6'; // Fioletowy - wolny
              case 'direct_free_kick': return '#ec4899'; // Różowy - bezpośredni wolny
              case 'penalty': return '#dc2626'; // Ciemnoczerwony - karny
              case 'throw_in': return '#06b6d4'; // Cyjan - rzut za autu
              default: return '#6b7280'; // Szary - domyślny
            }
          };
          
          const actionColor = getActionTypeColor(shot.actionType);
          
          return (
            <div
              key={shot.id}
              className={`${styles.shotMarker} ${shot.isGoal ? styles.goalMarker : styles.missMarker} ${selectedShotId === shot.id ? styles.selected : ''}`}
              style={{
                left: `${displayX}%`,
                top: `${displayY}%`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                backgroundColor: actionColor,
                opacity: 0.8,
                border: shot.isGoal ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.3)',
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => handleShotClick(e, shot)}
              title={`${shot.playerName || 'Nieznany'} - ${shot.minute}' - xG: ${shot.xG.toFixed(2)} ${shot.isGoal ? '⚽' : ''} - ${shot.actionType || 'open_play'}`}
            >
              <div className={styles.shotInner}>
                <span className={styles.xgValue} style={{ fontSize: `${Math.max(5, dotSize - 8)}px` }}>
                  {shot.xG.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
XGPitch.displayName = "XGPitch";

export default XGPitch; 