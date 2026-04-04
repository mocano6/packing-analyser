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
  selectedZone?: string | null; // Nazwa wybranej strefy do podświetlenia (pojedyncza)
  /** Wiele stref do obramowania (np. zaznaczenie z tabeli). Klucze jak nazwy stref (D6). */
  highlightedZones?: Set<string> | null;
  /** Gdy są highlightedZones — przygas komórki poza zbiorem (wartości nadal widoczne). */
  dimUnhighlighted?: boolean;
  /** Nadpisanie liczby miejsc po przecinku w komórce i legendzie; null = domyślnie z trybu (count: 0, pxt: 2). */
  valueFractionDigits?: number | null;
  /** Krótki opis metryki w tooltipie (np. „PK po 20 s”). */
  valueLabel?: string;
}

function normalizeZoneKey(s: string): string {
  return s.toUpperCase().replace(/\s+/g, "");
}

const PlayerHeatmapPitch = memo(function PlayerHeatmapPitch({
  heatmapData,
  category,
  mode = "pxt",
  onZoneClick,
  mirrored = false,
  selectedZone = null,
  highlightedZones = null,
  dimUnhighlighted = false,
  valueFractionDigits = null,
  valueLabel,
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

  const formatCellValue = useCallback(
    (v: number): string => {
      const d =
        valueFractionDigits !== null && valueFractionDigits !== undefined
          ? valueFractionDigits
          : mode === "pxt"
            ? 2
            : 0;
      if (d <= 0) return Math.round(v).toString();
      return v.toFixed(d);
    },
    [mode, valueFractionDigits],
  );

  // Memoizujemy tablicę komórek z heatmapą
  const cells = useMemo(
    () => {
      // Oblicz maksymalną wartość dla normalizacji
      const heatmapValues = Array.from(heatmapData.values());
      const maxValue = heatmapValues.length > 0 ? Math.max(...heatmapValues, 0.001) : 0.001;
      const hasMultiHighlight = highlightedZones != null && highlightedZones.size > 0;
      
      return Array.from({ length: 96 }, (_, visualIndex) => {
        const row = Math.floor(visualIndex / 12);
        const col = visualIndex % 12;
        
        // Pobierz wartości xT dla tej pozycji
        const baseXTValue = getXTValueForPosition(row, col);
        
        // Pobierz nazwę strefy
        const zoneNameStr = getZoneNameForPosition(row, col);
        
        // Pobierz wartość z heatmapy - obsługa różnych formatów kluczy (A1, a1, A 1)
        const normalizedForLookup = zoneNameStr ? zoneNameStr.toUpperCase().replace(/\s+/g, '') : '';
        let heatmapXTValue = heatmapData.get(zoneNameStr) ?? heatmapData.get(zoneNameStr?.toLowerCase() ?? '') ?? heatmapData.get(normalizedForLookup) ?? 0;
        // Fallback: szukaj po znormalizowanym kluczu wśród wszystkich kluczy mapy
        if (heatmapXTValue === 0 && normalizedForLookup) {
          for (const [key, val] of heatmapData) {
            if (key.toUpperCase().replace(/\s+/g, '') === normalizedForLookup) {
              heatmapXTValue = val;
              break;
            }
          }
        }
        
        const handleZoneClick = () => {
          if (onZoneClick && zoneNameStr) {
            // Wywołaj onZoneClick nawet jeśli wartość jest 0, aby można było wyświetlić informacje
            onZoneClick(zoneNameStr);
          }
        };

        // Sprawdź, czy strefa jest wybrana (pojedynczo lub w zbiorze)
        const normalizedZoneName = zoneNameStr ? normalizeZoneKey(zoneNameStr) : '';
        const normalizedSelectedZone = selectedZone ? normalizeZoneKey(selectedZone) : '';
        const isSingleSelected = normalizedZoneName !== '' && normalizedZoneName === normalizedSelectedZone;
        const isMultiHighlighted =
          hasMultiHighlight &&
          normalizedZoneName !== '' &&
          [...highlightedZones!].some((z) => normalizeZoneKey(z) === normalizedZoneName);
        const isHighlighted = isSingleSelected || isMultiHighlighted;
        const dimThis =
          Boolean(dimUnhighlighted && hasMultiHighlight && normalizedZoneName !== '' && !isMultiHighlighted);

        const metricHint = valueLabel ? `${valueLabel}: ` : mode === "pxt" ? "PxT = " : "";
        const titleVal = formatCellValue(heatmapXTValue);
        const titleText =
          heatmapXTValue > 0
            ? `${zoneNameStr}: ${metricHint}${titleVal}`
            : valueLabel
              ? `${zoneNameStr}: Brak danych`
              : mode === "count"
                ? `${zoneNameStr}: Brak akcji`
                : `${zoneNameStr}: Brak danych`;

        return (
          <div
            key={visualIndex}
            className={`${styles.zoneCell} ${heatmapXTValue > 0 ? styles.hasData : ''} ${isHighlighted ? styles.selected : ''} ${dimThis ? styles.dimmed : ''}`}
            style={{
              backgroundColor: heatmapXTValue > 0 
                ? getHeatmapColor(heatmapXTValue, maxValue)
                : getXTColor(baseXTValue),
            }}
            title={titleText}
            onClick={handleZoneClick}
          >
            {heatmapXTValue > 0 && (
              <div className={styles.cellContent}>
                <span className={styles.heatmapValue}>
                  {formatCellValue(heatmapXTValue)}
                </span>
              </div>
            )}
          </div>
        );
      });
    },
    [
      heatmapData,
      getXTValueForPosition,
      getZoneNameForPosition,
      getHeatmapColor,
      category,
      mode,
      onZoneClick,
      selectedZone,
      highlightedZones,
      dimUnhighlighted,
      formatCellValue,
      valueLabel,
    ]
  );

  // Oblicz statystyki dla legendy
  const heatmapStats = useMemo(() => {
    const values = Array.from(heatmapData.values());
    if (values.length === 0) return null;
    const positiveValues = values.filter(v => v > 0);
    if (positiveValues.length === 0) return null;
    const max = Math.max(...values);
    const min = Math.min(...positiveValues);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { max, min, avg };
  }, [heatmapData]);

  // Formatuj wartość dla legendy w zależności od trybu
  const formatLegendValue = useCallback(
    (value: number) => {
      return formatCellValue(value);
    },
    [formatCellValue],
  );

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

