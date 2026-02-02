"use client";

import React, { useState, useMemo } from "react";
import { PKEntry, Player } from "@/types";
import { buildPlayersIndex, getPlayerLabel, PlayersIndex } from "@/utils/playerUtils";
import { useAuth } from "@/hooks/useAuth";
import styles from "./PKEntriesTable.module.css";
import sharedStyles from "@/styles/sharedTableStyles.module.css";

interface PKEntriesTableProps {
  pkEntries: PKEntry[];
  players: Player[];
  onDeleteEntry?: (entryId: string) => void;
  onEditEntry?: (entry: PKEntry) => void;
  onUpdateEntry?: (entryId: string, entryData: Partial<PKEntry>) => Promise<boolean>;
  onVideoTimeClick?: (timestamp: number) => void;
  youtubeVideoRef?: React.RefObject<YouTubeVideoRef>;
  customVideoRef?: React.RefObject<CustomVideoPlayerRef>;
}

interface SortConfig {
  key: keyof PKEntry | 'senderName' | 'receiverName' | 'entryTypeLabel';
  direction: 'asc' | 'desc';
}

const formatVideoTime = (seconds?: number): string => {
  if (seconds === undefined || seconds === null) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
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

const getEntryTypeLabel = (entryType?: string): string => {
  const labels: { [key: string]: string } = {
    'pass': 'Podanie',
    'dribble': 'Drybling',
    'sfg': 'SFG',
    'regain': 'Regain',
  };
  return labels[entryType || 'pass'] || 'Podanie';
};

const getEntryTypeColor = (entryType?: string): string => {
  const colors: { [key: string]: string } = {
    'pass': '#ef4444', // Czerwona
    'dribble': '#1e40af', // Ciemnoniebieska
    'sfg': '#10b981', // Zielona
    'regain': '#f59e0b', // Pomarańczowa
  };
  return colors[entryType || 'pass'] || '#ef4444';
};

const getTeamContextLabel = (teamContext?: string): string => {
  return teamContext === 'attack' ? 'Atak' : 'Obrona';
};

// Komponent wiersza wejścia PK
const PKEntryRow = ({
  entry,
  playersIndex,
  onDelete,
  onEdit,
  onUpdateEntry,
  onVideoTimeClick,
}: {
  entry: PKEntry;
  playersIndex: PlayersIndex;
  onDelete?: (entryId: string) => void;
  onEdit?: (entry: PKEntry) => void;
  onUpdateEntry?: (entryId: string, entryData: Partial<PKEntry>) => Promise<boolean>;
  onVideoTimeClick?: (timestamp: number) => void;
}) => {
  const { isAdmin } = useAuth();
  const isSecondHalf = entry.isSecondHalf;

  const senderDisplay = getPlayerLabel(entry.senderId, playersIndex);
  const receiverDisplay = entry.receiverId ? getPlayerLabel(entry.receiverId, playersIndex) : "-";

  // Funkcja do zamiany strony wejścia (odbicie współrzędnych)
  const handleFlipSide = async () => {
    if (!isAdmin || !onUpdateEntry) return;
    
    if (confirm("Czy na pewno chcesz zamienić stronę tego wejścia PK? (z prawej na lewą lub odwrotnie)")) {
      const flippedEntry = {
        startX: 100 - entry.startX,
        startY: 100 - entry.startY,
        endX: 100 - entry.endX,
        endY: 100 - entry.endY,
      };
      
      await onUpdateEntry(entry.id, flippedEntry);
    }
  };

  // Określ klasę CSS dla typu akcji
  const getEntryTypeClass = (entryType?: string) => {
    switch (entryType) {
      case 'pass':
        return sharedStyles.pass;
      case 'dribble':
        return sharedStyles.dribble;
      case 'sfg':
        return sharedStyles.sfg;
      case 'regain':
        return sharedStyles.regain;
      default:
        return sharedStyles.pass;
    }
  };

  return (
    <div className={`${sharedStyles.actionRow} ${styles.actionRow} ${isSecondHalf ? sharedStyles.secondHalfRow : sharedStyles.firstHalfRow}`}>
      <div className={sharedStyles.cell}>
        <span className={isSecondHalf ? sharedStyles.secondHalf : sharedStyles.firstHalf}>
          {isSecondHalf ? 'P2' : 'P1'}
        </span>
        &nbsp;{entry.minute}'
      </div>
      <div className={sharedStyles.cell}>
        {entry.videoTimestamp !== undefined && entry.videoTimestamp !== null ? (
          <VideoTimeCell
            videoTimestamp={
              typeof entry.videoTimestamp === 'number' 
                ? (entry.videoTimestamp > 1000000 ? entry.videoTimestamp / 1000 : entry.videoTimestamp)
                : 0
            }
            videoTimestampRaw={
              entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null
                ? (typeof entry.videoTimestampRaw === 'number' 
                    ? (entry.videoTimestampRaw > 1000000 ? entry.videoTimestampRaw / 1000 : entry.videoTimestampRaw)
                    : 0)
                : undefined
            }
            onVideoTimeClick={(timestamp) => {
              onVideoTimeClick?.(timestamp);
            }}
          />
        ) : (
          <span>-</span>
        )}
      </div>
      <div className={sharedStyles.cell}>
        {senderDisplay}
      </div>
      <div className={sharedStyles.cell}>
        {receiverDisplay}
      </div>
      <div className={sharedStyles.cell}>
        <span className={entry.teamContext === 'attack' ? sharedStyles.attack : sharedStyles.defense}>
          {getTeamContextLabel(entry.teamContext)}
        </span>
      </div>
      <div className={sharedStyles.cell}>
        <span className={getEntryTypeClass(entry.entryType)}>
          {getEntryTypeLabel(entry.entryType)}
        </span>
      </div>
      <div className={`${sharedStyles.cellActions} ${styles.cellActions}`}>
        {entry.isControversial && entry.controversyNote && (
          <span
            className={sharedStyles.controversyIcon}
            title={entry.controversyNote}
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
              onEdit(entry);
            }}
            title="Edytuj wejście PK"
          >
            ✎
          </button>
        )}
        {onDelete && (
          <button
            className={sharedStyles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Czy na pewno chcesz usunąć to wejście PK?")) {
                onDelete(entry.id);
              }
            }}
            title="Usuń wejście PK"
          >
            ✕
          </button>
        )}
        {isAdmin && onUpdateEntry && (
          <button
            className={styles.flipBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleFlipSide();
            }}
            title="Zamień stronę wejścia (z prawej na lewą lub odwrotnie)"
          >
            ⇄
          </button>
        )}
      </div>
    </div>
  );
};

// Komponent główny
const PKEntriesTable: React.FC<PKEntriesTableProps> = ({
  pkEntries,
  players,
  onDeleteEntry,
  onEditEntry,
  onUpdateEntry,
  onVideoTimeClick,
  youtubeVideoRef,
  customVideoRef,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'minute',
    direction: 'asc',
  });
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);

  // State dla filtra kontrowersyjnego
  const [showOnlyControversial, setShowOnlyControversial] = useState(false);
  
  // State dla filtra atak/obrona
  const [teamContextFilter, setTeamContextFilter] = useState<'all' | 'attack' | 'defense'>('all');

  // Liczba akcji kontrowersyjnych
  const controversialCount = useMemo(() => {
    return pkEntries.filter(entry => entry.isControversial).length;
  }, [pkEntries]);

  const handleSort = (key: keyof PKEntry | 'senderName' | 'receiverName' | 'entryTypeLabel') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedEntries = useMemo(() => {
    // Filtruj po kontrowersyjności jeśli jest włączony filtr
    let filteredEntries = showOnlyControversial 
      ? pkEntries.filter(entry => entry.isControversial)
      : pkEntries;
    
    // Filtruj po kontekście zespołu (atak/obrona)
    if (teamContextFilter !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.teamContext === teamContextFilter);
    }

    return [...filteredEntries].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'senderName':
          aValue = getPlayerLabel(a.senderId, playersIndex);
          bValue = getPlayerLabel(b.senderId, playersIndex);
          break;
        case 'receiverName':
          aValue = a.receiverId ? getPlayerLabel(a.receiverId, playersIndex) : "";
          bValue = b.receiverId ? getPlayerLabel(b.receiverId, playersIndex) : "";
          break;
        case 'entryTypeLabel':
          aValue = getEntryTypeLabel(a.entryType);
          bValue = getEntryTypeLabel(b.entryType);
          break;
        default:
          aValue = a[sortConfig.key as keyof PKEntry];
          bValue = b[sortConfig.key as keyof PKEntry];
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [pkEntries, sortConfig, showOnlyControversial, teamContextFilter]);

  const getSortIcon = (key: keyof PKEntry | 'senderName' | 'receiverName' | 'entryTypeLabel') => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Funkcja do obsługi kliknięcia na czas wideo (dokładnie tak jak w ActionsTable)
  const handleVideoTimeClick = async (videoTimestamp?: number) => {
    if (!videoTimestamp && videoTimestamp !== 0) return;
    
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo (sprawdzamy bezpośrednio externalWindow, a nie localStorage)
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    if (isExternalWindowOpen) {
      // Wyślij wiadomość do zewnętrznego okna
      try {
        externalWindow.postMessage({
          type: 'SEEK_TO_TIME',
          time: videoTimestamp
        }, '*');
      } catch (error) {
        console.error('PKEntriesTable handleVideoTimeClick - błąd podczas wysyłania wiadomości:', error);
      }
    } else if (youtubeVideoRef?.current) {
      try {
        await youtubeVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć wideo do czasu:', videoTimestamp, error);
        // Spróbuj ponownie po krótkim czasie
        setTimeout(async () => {
          if (youtubeVideoRef?.current) {
            try {
              await youtubeVideoRef.current.seekTo(videoTimestamp);
            } catch (retryError) {
              console.warn('Nie udało się przewinąć wideo do czasu (retry):', videoTimestamp, retryError);
            }
          }
        }, 500);
      }
    } else if (customVideoRef?.current) {
      try {
        await customVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć własnego odtwarzacza do czasu:', videoTimestamp, error);
      }
    } else if (onVideoTimeClick) {
      // Fallback do przekazanej funkcji
      try {
        await onVideoTimeClick(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć wideo przez onVideoTimeClick:', error);
      }
    } else {
      console.warn('PKEntriesTable handleVideoTimeClick - brak dostępnego playera (youtubeVideoRef:', youtubeVideoRef, ', customVideoRef:', customVideoRef, ')');
    }
  };

  return (
    <div className={sharedStyles.tableContainer}>
      <div className={sharedStyles.headerControls}>
        <div className={sharedStyles.headerTitle}>
          <h3>Lista wejść PK ({sortedEntries.length})</h3>
          <div className={styles.filtersGroup}>
            <div className={styles.filterButtons}>
              <button
                type="button"
                className={`${styles.filterButton} ${teamContextFilter === 'all' ? styles.filterButtonActive : ''}`}
                onClick={() => setTeamContextFilter('all')}
                title="Pokaż wszystkie"
              >
                Wszystkie
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${teamContextFilter === 'attack' ? styles.filterButtonActive : ''}`}
                onClick={() => setTeamContextFilter('attack')}
                title="Pokaż tylko atak"
              >
                Atak
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${teamContextFilter === 'defense' ? styles.filterButtonActive : ''}`}
                onClick={() => setTeamContextFilter('defense')}
                title="Pokaż tylko obrona"
              >
                Obrona
              </button>
            </div>
            <button
              type="button"
              className={`${sharedStyles.controversyFilterButton} ${showOnlyControversial ? sharedStyles.controversyFilterActive : ''}`}
              onClick={() => setShowOnlyControversial(!showOnlyControversial)}
              aria-pressed={showOnlyControversial}
              aria-label="Filtruj wejścia PK kontrowersyjne"
              title={`Pokaż tylko kontrowersyjne (${controversialCount})`}
            >
              !
            </button>
          </div>
        </div>
      </div>
      <div className={sharedStyles.matchesTable}>
        <div className={`${sharedStyles.tableHeader} ${styles.tableHeader}`}>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('minute')}>
            Połowa / Min {getSortIcon('minute')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('videoTimestamp')}>
            Czas wideo {getSortIcon('videoTimestamp')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('senderName')}>
            Zawodnik podający {getSortIcon('senderName')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('receiverName')}>
            Zawodnik otrzymujący {getSortIcon('receiverName')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('teamContext')}>
            Kontekst {getSortIcon('teamContext')}
          </div>
          <div className={sharedStyles.headerCell} onClick={() => handleSort('entryTypeLabel')}>
            Typ akcji {getSortIcon('entryTypeLabel')}
          </div>
          <div className={sharedStyles.headerCell}>Akcje</div>
        </div>
        <div className={sharedStyles.tableBody}>
          {sortedEntries.length === 0 ? (
            <div className={sharedStyles.noEntries}>Brak wejść PK</div>
          ) : (
            sortedEntries.map((entry) => (
              <PKEntryRow
                key={entry.id}
                entry={entry}
                playersIndex={playersIndex}
                onDelete={onDeleteEntry}
                onEdit={onEditEntry}
                onUpdateEntry={onUpdateEntry}
                onVideoTimeClick={(timestamp) => {
                  handleVideoTimeClick(timestamp);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PKEntriesTable;

