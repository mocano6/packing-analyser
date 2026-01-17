"use client";

import React, { useState, useMemo } from "react";
import { Shot, Player } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./ShotsTable.module.css";

interface ShotsTableProps {
  shots: Shot[];
  players: Player[];
  onDeleteShot?: (shotId: string) => void;
  onEditShot?: (shot: Shot) => void;
  onVideoTimeClick?: (timestamp: number) => void;
}

interface SortConfig {
  key: keyof Shot | 'playerName' | 'actionTypeLabel';
  direction: 'asc' | 'desc';
}

const formatVideoTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getActionTypeLabel = (actionType?: string, sfgSubtype?: string, actionPhase?: string): string => {
  const labels: { [key: string]: string } = {
    'open_play': 'Budowanie',
    'counter': 'Kontra',
    'corner': 'Rożny',
    'free_kick': 'Wolny',
    'direct_free_kick': 'Bezpośredni wolny',
    'penalty': 'Karny',
    'throw_in': 'Rzut za autu',
    'regain': 'Regain',
  };
  
  let baseLabel = labels[actionType || 'open_play'] || 'Budowanie';
  
  // Dodaj podrodzaj SFG (tylko dla SFG, nie dla karnego)
  if (actionType && ['corner', 'free_kick', 'direct_free_kick', 'throw_in'].includes(actionType) && sfgSubtype) {
    const subtypeLabel = sfgSubtype === 'direct' ? 'B' : 'K';
    baseLabel += ` (${subtypeLabel})`;
  }
  
  // Dodaj fazę akcji (tylko jeśli nie jest to karny)
  if (actionType !== 'penalty' && actionPhase) {
    let phaseLabel = '';
    if (actionPhase === 'phase1') phaseLabel = 'I';
    else if (actionPhase === 'phase2') phaseLabel = 'II';
    else if (actionPhase === 'under8s') phaseLabel = '≤8s';
    else if (actionPhase === 'over8s') phaseLabel = '>8s';
    
    if (phaseLabel) {
      baseLabel += ` - ${phaseLabel}`;
    }
  }
  
  return baseLabel;
};

const getShotTypeLabel = (shotType: string, isGoal: boolean): string => {
  if (isGoal) return 'Gol ⚽';
  const labels: { [key: string]: string } = {
    'on_target': 'Celny',
    'off_target': 'Niecelny',
    'blocked': 'Zablokowany',
  };
  return labels[shotType] || 'Celny';
};

const getTeamContextLabel = (teamContext: string): string => {
  return teamContext === 'attack' ? 'Atak' : 'Obrona';
};

// Komponent wiersza strzału
const ShotRow = ({
  shot,
  onDelete,
  onEdit,
  onVideoTimeClick,
}: {
  shot: Shot;
  onDelete?: (shotId: string) => void;
  onEdit?: (shot: Shot) => void;
  onVideoTimeClick?: (timestamp: number) => void;
}) => {
  const isSecondHalf = shot.minute > 45;

  return (
    <div className={`${styles.shotRow} ${isSecondHalf ? styles.secondHalfRow : styles.firstHalfRow}`}>
      <div className={styles.cell}>
        <span className={isSecondHalf ? styles.secondHalf : styles.firstHalf}>
          {isSecondHalf ? 'P2' : 'P1'}
        </span>
        &nbsp;{shot.minute}'
      </div>
      <div className={styles.cell}>
        {(() => {
          // Sprawdź czy strzał ma videoTimestamp
          const hasVideoTimestamp = shot.videoTimestamp !== undefined && 
                                   shot.videoTimestamp !== null && 
                                   shot.videoTimestamp > 0;
          
          if (hasVideoTimestamp) {
            return (
              <span 
                className={styles.videoTimeLink}
                onClick={(e) => {
                  e.stopPropagation();
                  // videoTimestamp jest w sekundach, przekazujemy bezpośrednio
                  onVideoTimeClick?.(shot.videoTimestamp!);
                }}
                title="Kliknij aby przejść do tego momentu w wideo"
              >
                {formatVideoTime(shot.videoTimestamp)}
              </span>
            );
          }
          
          return <span className={styles.noVideoTime}>-</span>;
        })()}
      </div>
      <div className={styles.cell}>
        {shot.playerName || 'Nieznany zawodnik'}
      </div>
      <div className={styles.cell}>
        <span className={shot.teamContext === 'attack' ? styles.attack : styles.defense}>
          {getTeamContextLabel(shot.teamContext)}
        </span>
      </div>
      <div className={styles.cell}>
        <span className={styles.actionType}>
          {getActionTypeLabel(shot.actionType, (shot as any)?.sfgSubtype, (shot as any)?.actionPhase)}
        </span>
      </div>
      <div className={styles.cell}>
        <span className={styles.xgValue}>
          {(shot.xG * 100).toFixed(0)}%
        </span>
      </div>
      <div className={styles.cell}>
        <span className={shot.isGoal ? styles.goal : styles.shot}>
          {getShotTypeLabel(shot.shotType, shot.isGoal)}
        </span>
      </div>
      <div className={styles.cell}>
        {shot.bodyPart === 'foot' ? 'Noga' : shot.bodyPart === 'head' ? 'Głowa' : 'Inne'}
      </div>
      <div className={styles.cell}>
        {shot.blockingPlayers && shot.blockingPlayers.length > 0 
          ? `${shot.blockingPlayers.length} zawodnik(ów)`
          : '-'
        }
      </div>
      <div className={styles.cellActions}>
        {onEdit && (
          <button
            className={styles.editBtn}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(shot);
            }}
            title="Edytuj strzał"
          >
            ✎
          </button>
        )}
        {onDelete && (
          <button
            className={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Czy na pewno chcesz usunąć ten strzał?")) {
                onDelete(shot.id);
              }
            }}
            title="Usuń strzał"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

// Komponent główny
const ShotsTable: React.FC<ShotsTableProps> = ({
  shots,
  players,
  onDeleteShot,
  onEditShot,
  onVideoTimeClick,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'minute',
    direction: 'asc',
  });

  // State dla filtra kontrowersyjnego
  const [showOnlyControversial, setShowOnlyControversial] = useState(false);

  // Liczba akcji kontrowersyjnych
  const controversialCount = useMemo(() => {
    return shots.filter(shot => shot.isControversial).length;
  }, [shots]);

  const handleSort = (key: keyof Shot | 'playerName' | 'actionTypeLabel') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedShots = useMemo(() => {
    // Filtruj po kontrowersyjności jeśli jest włączony filtr
    let filteredShots = showOnlyControversial 
      ? shots.filter(shot => shot.isControversial)
      : shots;

    return [...filteredShots].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'playerName':
          aValue = a.playerName || '';
          bValue = b.playerName || '';
          break;
        case 'actionTypeLabel':
          aValue = getActionTypeLabel(a.actionType, (a as any)?.sfgSubtype, (a as any)?.actionPhase);
          bValue = getActionTypeLabel(b.actionType, (b as any)?.sfgSubtype, (b as any)?.actionPhase);
          break;
        default:
          aValue = a[sortConfig.key as keyof Shot];
          bValue = b[sortConfig.key as keyof Shot];
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [shots, sortConfig, showOnlyControversial]);

  const getSortIcon = (key: keyof Shot | 'playerName' | 'actionTypeLabel') => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.headerControls}>
        <div className={styles.headerTitle}>
          <h3>Lista strzałów ({showOnlyControversial ? controversialCount : shots.length})</h3>
          <button
            type="button"
            className={`${styles.controversyFilterButton} ${showOnlyControversial ? styles.controversyFilterActive : ''}`}
            onClick={() => setShowOnlyControversial(!showOnlyControversial)}
            aria-pressed={showOnlyControversial}
            aria-label="Filtruj strzały kontrowersyjne"
            title={`Pokaż tylko kontrowersyjne (${controversialCount})`}
          >
            !
          </button>
        </div>
      </div>
      <div className={styles.matchesTable}>
        <div className={styles.tableHeader}>
          <div className={styles.headerCell} onClick={() => handleSort('minute')}>
            Minuta {getSortIcon('minute')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('timestamp')}>
            Czas wideo {getSortIcon('timestamp')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('playerName')}>
            Zawodnik {getSortIcon('playerName')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('teamContext')}>
            Kontekst {getSortIcon('teamContext')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('actionTypeLabel')}>
            Rodzaj akcji {getSortIcon('actionTypeLabel')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('xG')}>
            xG {getSortIcon('xG')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('shotType')}>
            Typ strzału {getSortIcon('shotType')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('bodyPart')}>
            Część ciała {getSortIcon('bodyPart')}
          </div>
          <div className={styles.headerCell}>
            Blokujący
          </div>
          <div className={styles.headerCell}>Akcje</div>
        </div>
        <div className={styles.tableBody}>
          {sortedShots.length === 0 ? (
            <div className={styles.noShots}>Brak strzałów</div>
          ) : (
            sortedShots.map((shot) => (
              <ShotRow
                key={shot.id}
                shot={shot}
                onDelete={onDeleteShot}
                onEdit={onEditShot}
                onVideoTimeClick={onVideoTimeClick}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ShotsTable;
