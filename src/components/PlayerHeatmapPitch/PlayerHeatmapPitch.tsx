// components/PlayerHeatmapPitch/PlayerHeatmapPitch.tsx
"use client";

import React, { useCallback, memo, useMemo } from "react";
import styles from "./PlayerHeatmapPitch.module.css";
import { getXTValueFromMatrix, getZoneName, zoneNameToString, zoneNameToIndex } from "@/constants/xtValues";
import { getXTColor } from "@/components/FootballPitch/utils";

export interface PlayerHeatmapPitchProps {
  heatmapData: Map<string, number>; // Map<zoneName, xTValue or count>
  category: "sender" | "receiver" | "dribbler" | "regains" | "loses";
  mode?: "pxt" | "count"; // Tryb wyświetlania: PxT lub liczba akcji
  onZoneClick?: (zoneName: string) => void; // Callback przy kliknięciu na strefę
  mirrored?: boolean; // Czy mapa ma być odwrócona (lustrzane odbicie)
}

const PlayerHeatmapPitch = memo(function PlayerHeatmapPitch({
  heatmapData,
  category,
  mode = "pxt",
  onZoneClick,
  mirrored = false,
}: PlayerHeatmapPitchProps) {
  // Funkcja do pobierania wartości xT dla pozycji z uwzględnieniem odwrócenia
  const getXTValueForPosition = useCallback((visualRow: number, visualCol: number): number => {
    if (mirrored) {
      // Odbita orientacja - wartości rosną w lewo, A1-A12 na dole
      const sourceRow = 7 - visualRow;  // Odbicie wierszy
      const sourceCol = 11 - visualCol; // Odbicie kolumn
      return getXTValueFromMatrix(sourceRow, sourceCol);
    } else {
      // Standardowa orientacja - wartości rosną w prawo, A1-A12 na górze
      return getXTValueFromMatrix(visualRow, visualCol);
    }
  }, [mirrored]);

  // Funkcja do pobierania nazwy strefy z uwzględnieniem odwrócenia
  const getZoneNameForPosition = useCallback((visualRow: number, visualCol: number): string => {
    if (mirrored) {
      // Odbita orientacja - oblicz opposite strefę
      const visualIndex = visualRow * 12 + visualCol;
      const sourceRow = 7 - visualRow;
      const sourceCol = 11 - visualCol;
      const sourceIndex = sourceRow * 12 + sourceCol;
      const zoneName = getZoneName(sourceIndex);
      return zoneName ? zoneNameToString(zoneName) : '';
    } else {
      // Standardowa orientacja
      const visualIndex = visualRow * 12 + visualCol;
      const zoneName = getZoneName(visualIndex);
      return zoneName ? zoneNameToString(zoneName) : '';
    }
  }, [mirrored]);

  // Funkcja do obliczania koloru heatmapy - profesjonalny gradient od niebieskiego do czerwonego
  const getHeatmapColor = useCallback((value: number, maxValue: number): string => {
    if (value <= 0 || maxValue <= 0) {
      const baseXT = getXTValueFromMatrix(0, 0);
      return getXTColor(baseXT);
    }
    
    const normalizedValue = Math.min(value / maxValue, 1);
    
    // Profesjonalny gradient: niebieski -> cyjan -> żółty -> pomarańczowy -> czerwony
    // Płynne przejścia z użyciem interpolacji
    if (normalizedValue < 0.2) {
      // Niebieski (niskie wartości) - subtelny
      const t = normalizedValue / 0.2;
      const r = Math.round(59 + (100 - 59) * t);
      const g = Math.round(130 + (200 - 130) * t);
      const b = Math.round(246);
      return `rgba(${r}, ${g}, ${b}, ${0.4 + t * 0.2})`;
    } else if (normalizedValue < 0.4) {
      // Niebieski -> cyjan
      const t = (normalizedValue - 0.2) / 0.2;
      const r = Math.round(100 + (0 - 100) * t);
      const g = Math.round(200 + (255 - 200) * t);
      const b = Math.round(246 + (255 - 246) * t);
      return `rgba(${r}, ${g}, ${b}, ${0.6 + t * 0.15})`;
    } else if (normalizedValue < 0.6) {
      // Cyjan -> żółty
      const t = (normalizedValue - 0.4) / 0.2;
      const r = Math.round(0 + (255 - 0) * t);
      const g = 255;
      const b = Math.round(255 + (0 - 255) * t);
      return `rgba(${r}, ${g}, ${b}, ${0.75 + t * 0.1})`;
    } else if (normalizedValue < 0.8) {
      // Żółty -> pomarańczowy
      const t = (normalizedValue - 0.6) / 0.2;
      const r = 255;
      const g = Math.round(255 + (165 - 255) * t);
      const b = 0;
      return `rgba(${r}, ${g}, ${b}, ${0.85 + t * 0.1})`;
    } else {
      // Pomarańczowy -> czerwony (najgorętsze)
      const t = (normalizedValue - 0.8) / 0.2;
      const r = 255;
      const g = Math.round(165 + (0 - 165) * t);
      const b = 0;
      return `rgba(${r}, ${g}, ${b}, ${0.95 + t * 0.05})`;
    }
  }, []);

  // Memoizujemy tablicę komórek z heatmapą
  const cells = useMemo(
    () => {
      // Oblicz maksymalną wartość dla normalizacji
      const heatmapValues = Array.from(heatmapData.values());
      const maxValue = heatmapValues.length > 0 ? Math.max(...heatmapValues, 0.001) : 0.001;
      
      return Array.from({ length: 96 }, (_, visualIndex) => {
        const row = Math.floor(visualIndex / 12);
        const col = visualIndex % 12;
        
        // Pobierz wartości xT dla tej pozycji
        const baseXTValue = getXTValueForPosition(row, col);
        
        // Pobierz nazwę strefy
        const zoneNameStr = getZoneNameForPosition(row, col);
        
        // Gdy mapa jest odwrócona, heatmapa już ma klucze jako opposite strefy
        // Więc używamy zoneNameStr bezpośrednio (który już jest opposite dla odwróconej mapy)
        // Gdy mapa nie jest odwrócona, używamy zoneNameStr normalnie
        let heatmapXTValue = heatmapData.get(zoneNameStr) || 0;
        // Jeśli nie znaleziono, spróbuj z małą literą
        if (heatmapXTValue === 0 && zoneNameStr) {
          heatmapXTValue = heatmapData.get(zoneNameStr.toLowerCase()) || 0;
        }
        // Jeśli nadal nie znaleziono, spróbuj z wielką literą
        if (heatmapXTValue === 0 && zoneNameStr) {
          heatmapXTValue = heatmapData.get(zoneNameStr.toUpperCase()) || 0;
        }
        
        const handleZoneClick = () => {
          if (heatmapXTValue > 0 && onZoneClick && zoneNameStr) {
            onZoneClick(zoneNameStr);
          }
        };

        return (
          <div
            key={visualIndex}
            className={`${styles.zoneCell} ${heatmapXTValue > 0 ? styles.hasData : ''}`}
            style={{
              backgroundColor: heatmapXTValue > 0 
                ? getHeatmapColor(heatmapXTValue, maxValue)
                : getXTColor(baseXTValue),
            }}
            title={heatmapXTValue > 0 
              ? mode === "pxt"
                ? `${zoneNameStr}: PxT = ${heatmapXTValue.toFixed(2)}`
                : `${zoneNameStr}: ${Math.round(heatmapXTValue)} ${Math.round(heatmapXTValue) === 1 ? 'akcja' : 'akcji'}`
              : `${zoneNameStr}: Brak akcji`
            }
            onClick={handleZoneClick}
          >
            {heatmapXTValue > 0 && (
              <div className={styles.cellContent}>
                <span className={styles.heatmapValue}>
                  {mode === "pxt" 
                    ? heatmapXTValue.toFixed(2)
                    : Math.round(heatmapXTValue).toString()
                  }
                </span>
              </div>
            )}
          </div>
        );
      });
    },
    [heatmapData, getXTValueForPosition, getZoneNameForPosition, getHeatmapColor, category, mode, onZoneClick]
  );

  // Oblicz statystyki dla legendy
  const heatmapStats = useMemo(() => {
    const values = Array.from(heatmapData.values());
    if (values.length === 0) return null;
    const max = Math.max(...values);
    const min = Math.min(...values.filter(v => v > 0));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { max, min, avg };
  }, [heatmapData]);

  // Formatuj wartość dla legendy w zależności od trybu
  const formatLegendValue = useCallback((value: number) => {
    return mode === "pxt" ? value.toFixed(2) : Math.round(value).toString();
  }, [mode]);

  return (
    <div className={styles.pitchContainer}>
      {heatmapStats && (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendLabel}>Min:</span>
            <span className={styles.legendValue}>{formatLegendValue(heatmapStats.min)}</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendLabel}>Max:</span>
            <span className={styles.legendValue}>{formatLegendValue(heatmapStats.max)}</span>
          </div>
        </div>
      )}
      <div
        className={`${styles.pitch} ${mirrored ? styles.flipped : ''}`}
        role="grid"
        aria-label={`Heatmapa ${category === 'sender' ? 'podania' : category === 'receiver' ? 'przyjęcia' : category === 'dribbler' ? 'dryblingu' : 'regainów'}`}
      >
        <div className={styles.grid}>{cells}</div>
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
      </div>
    </div>
  );
});

PlayerHeatmapPitch.displayName = "PlayerHeatmapPitch";

export default PlayerHeatmapPitch;

