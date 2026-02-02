"use client";

import React, { useState, useMemo } from "react";
import { Shot, Player } from "@/types";
import { buildPlayersIndex, getPlayerLabel, PlayersIndex } from "@/utils/playerUtils";
import { useAuth } from "@/hooks/useAuth";
import styles from "./ShotsTable.module.css";
import sharedStyles from "@/styles/sharedTableStyles.module.css";

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

const formatVideoTime = (seconds?: number): string => {
  if (seconds === undefined || seconds === null) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Komponent do wyświetlania czasu wideo z surowym czasem dla admina
const VideoTimeCell: React.FC<{
  videoTimestamp: number;
  videoTimestampRaw?: number;
  onVideoTimeClick: (timestamp: number) => void;
}> = ({ videoTimestamp, videoTimestampRaw, onVideoTimeClick }) => {
  const { isAdmin } = useAuth();
  
  return (
    <div className={sharedStyles.videoTimeContainer}>
      <span 
        className={sharedStyles.videoTimeLink}
        onClick={(e) => {
          e.stopPropagation();
          onVideoTimeClick(videoTimestamp);
        }}
        title="Kliknij aby przejść do tego momentu w wideo"
      >
        {formatVideoTime(videoTimestamp)}
      </span>
      {isAdmin && videoTimestampRaw !== undefined && videoTimestampRaw !== null && (
        <span className={sharedStyles.rawTimestamp}>{formatVideoTime(videoTimestampRaw)}</span>
      )}
    </div>
  );
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
  playersIndex,
  onDelete,
  onEdit,
  onVideoTimeClick,
}: {
  shot: Shot;
  playersIndex: PlayersIndex;
  onDelete?: (shotId: string) => void;
  onEdit?: (shot: Shot) => void;
  onVideoTimeClick?: (timestamp: number) => void;
}) => {
  const isSecondHalf = shot.minute > 45;

  return (
    <div className={`${sharedStyles.shotRow} ${styles.shotRow} ${isSecondHalf ? sharedStyles.secondHalfRow : sharedStyles.firstHalfRow}`}>
      <div className={sharedStyles.cell}>
        <span className={isSecondHalf ? sharedStyles.secondHalf : sharedStyles.firstHalf}>
          {isSecondHalf ? 'P2' : 'P1'}
        </span>
        &nbsp;{shot.minute}'
      </div>
      <div className={sharedStyles.cell}>
        {shot.videoTimestamp !== undefined && shot.videoTimestamp !== null ? (
          <VideoTimeCell
            videoTimestamp={shot.videoTimestamp}
            videoTimestampRaw={shot.videoTimestampRaw}
            onVideoTimeClick={(timestamp) => {
              onVideoTimeClick?.(timestamp);
            }}
          />
        ) : (
          <span className={styles.noVideoTime}>-</span>
        )}
      </div>
      <div className={sharedStyles.cell}>
        {getPlayerLabel(shot.playerId, playersIndex)}
      </div>
      <div className={sharedStyles.cell}>
        <span className={shot.teamContext === 'attack' ? sharedStyles.attack : sharedStyles.defense}>
          {getTeamContextLabel(shot.teamContext)}
        </span>
      </div>
      <div className={sharedStyles.cell}>
        <span className={styles.actionType}>
          {getActionTypeLabel(shot.actionType, (shot as any)?.sfgSubtype, (shot as any)?.actionPhase)}
        </span>
      </div>
      <div className={sharedStyles.cell}>
        <span className={styles.xgValue}>
          {(shot.xG * 100).toFixed(0)}%
        </span>
      </div>
      <div className={sharedStyles.cell}>
        <span className={shot.isGoal ? styles.goal : styles.shot}>
          {getShotTypeLabel(shot.shotType, shot.isGoal)}
        </span>
      </div>
      <div className={sharedStyles.cell}>
        {shot.bodyPart === 'foot' ? 'Noga' : shot.bodyPart === 'head' ? 'Głowa' : 'Inne'}
      </div>
      <div className={sharedStyles.cell}>
        {shot.blockingPlayers && shot.blockingPlayers.length > 0 
          ? `${shot.blockingPlayers.length} zawodnik(ów)`
          : '-'
        }
      </div>
      <div className={`${sharedStyles.cellActions} ${styles.cellActions}`}>
        {shot.isControversial && shot.controversyNote && (
          <span
            className={sharedStyles.controversyIcon}
            title={shot.controversyNote}
            style={{ cursor: 'help' }}
          >
            !
          </span>
        )}
        {onEdit && (
          <button
            className={sharedStyles.editBtn}
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
            className={sharedStyles.deleteBtn}
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
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);

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
          aValue = getPlayerLabel(a.playerId, playersIndex);
          bValue = getPlayerLabel(b.playerId, playersIndex);
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
    <div className={sharedStyles.tableContainer}>
      <div className={sharedStyles.headerControls}>
        <div className={sharedStyles.headerTitle}>
          <h3>Lista strzałów ({showOnlyControversial ? controversialCount : shots.length})</h3>
          <button
            type="button"
            className={`${sharedStyles.controversyFilterButton} ${showOnlyControversial ? sharedStyles.controversyFilterActive : ''}`}
            onClick={() => setShowOnlyControversial(!showOnlyControversial)}
            aria-pressed={showOnlyControversial}
            aria-label="Filtruj strzały kontrowersyjne"
            title={`Pokaż tylko kontrowersyjne (${controversialCount})`}
          >
            !
          </button>
        </div>
      </div>
      <div className={sharedStyles.matchesTable}>
        <div className={`${sharedStyles.tableHeader} ${styles.tableHeader}`}>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('minute')}>
            Połowa / Min {getSortIcon('minute')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('timestamp')}>
            Czas wideo {getSortIcon('timestamp')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('playerName')}>
            Zawodnik {getSortIcon('playerName')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('teamContext')}>
            Kontekst {getSortIcon('teamContext')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('actionTypeLabel')}>
            Rodzaj akcji {getSortIcon('actionTypeLabel')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('xG')}>
            xG {getSortIcon('xG')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('shotType')}>
            Typ strzału {getSortIcon('shotType')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('bodyPart')}>
            Część ciała {getSortIcon('bodyPart')}
          </div>
          <div className={sharedStyles.headerCell}>
            Blokujący
          </div>
          <div className={sharedStyles.headerCell}>Akcje</div>
        </div>
        <div className={sharedStyles.tableBody}>
          {sortedShots.length === 0 ? (
            <div className={sharedStyles.noEntries}>Brak strzałów</div>
          ) : (
            sortedShots.map((shot) => (
              <ShotRow
                key={shot.id}
                shot={shot}
                playersIndex={playersIndex}
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
