"use client";

import React, { useState, useMemo } from "react";
import { PKEntry, Player } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./PKEntriesTable.module.css";

interface PKEntriesTableProps {
  pkEntries: PKEntry[];
  players: Player[];
  onDeleteEntry?: (entryId: string) => void;
  onEditEntry?: (entry: PKEntry) => void;
  onVideoTimeClick?: (timestamp: number) => void;
  youtubeVideoRef?: React.RefObject<YouTubeVideoRef>;
  customVideoRef?: React.RefObject<CustomVideoPlayerRef>;
}

interface SortConfig {
  key: keyof PKEntry | 'senderName' | 'receiverName' | 'entryTypeLabel';
  direction: 'asc' | 'desc';
}

const formatVideoTime = (seconds?: number): string => {
  if (!seconds && seconds !== 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  onDelete,
  onEdit,
  onVideoTimeClick,
  players,
}: {
  entry: PKEntry;
  onDelete?: (entryId: string) => void;
  onEdit?: (entry: PKEntry) => void;
  onVideoTimeClick?: (timestamp: number) => void;
  players: Player[];
}) => {
  const isSecondHalf = entry.isSecondHalf;

  // Znajdź zawodników
  const senderPlayer = players.find(p => p.id === entry.senderId);
  const receiverPlayer = entry.receiverId ? players.find(p => p.id === entry.receiverId) : null;

  const senderDisplay = entry.senderName || (senderPlayer ? getPlayerFullName(senderPlayer) : 'Nieznany');
  const receiverDisplay = entry.receiverName || (receiverPlayer ? getPlayerFullName(receiverPlayer) : null) || '-';

  // Określ klasę CSS dla typu akcji
  const getEntryTypeClass = (entryType?: string) => {
    switch (entryType) {
      case 'pass':
        return styles.pass;
      case 'dribble':
        return styles.dribble;
      case 'sfg':
        return styles.sfg;
      case 'regain':
        return styles.regain;
      default:
        return styles.pass;
    }
  };

  return (
    <div className={`${styles.actionRow} ${isSecondHalf ? styles.secondHalfRow : styles.firstHalfRow}`}>
      <div className={styles.cell}>
        <span className={isSecondHalf ? styles.secondHalf : styles.firstHalf}>
          {isSecondHalf ? 'P2' : 'P1'}
        </span>
        &nbsp;{entry.minute}'
      </div>
      <div className={styles.cell}>
        {entry.videoTimestamp !== undefined && entry.videoTimestamp !== null ? (
          <span 
            className={styles.videoTimeLink}
            onClick={(e) => {
              e.stopPropagation();
              // videoTimestamp jest w milisekundach, konwertujemy na sekundy
              const timestampInSeconds = typeof entry.videoTimestamp === 'number' 
                ? (entry.videoTimestamp > 1000000 ? entry.videoTimestamp / 1000 : entry.videoTimestamp)
                : 0;
              onVideoTimeClick?.(timestampInSeconds);
            }}
            title="Kliknij aby przejść do tego momentu w wideo"
          >
            {formatVideoTime(
              typeof entry.videoTimestamp === 'number' 
                ? (entry.videoTimestamp > 1000000 ? entry.videoTimestamp / 1000 : entry.videoTimestamp)
                : 0
            )}
          </span>
        ) : (
          <span>-</span>
        )}
      </div>
      <div className={styles.cell}>
        {senderDisplay}
      </div>
      <div className={styles.cell}>
        {receiverDisplay}
      </div>
      <div className={styles.cell}>
        <span className={entry.teamContext === 'attack' ? styles.attack : styles.defense}>
          {getTeamContextLabel(entry.teamContext)}
        </span>
      </div>
      <div className={styles.cell}>
        <span className={getEntryTypeClass(entry.entryType)}>
          {getEntryTypeLabel(entry.entryType)}
        </span>
      </div>
      <div className={styles.cellActions}>
        {onEdit && (
          <button
            className={styles.editBtn}
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
            className={styles.deleteBtn}
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
  onVideoTimeClick,
  youtubeVideoRef,
  customVideoRef,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'minute',
    direction: 'asc',
  });

  const handleSort = (key: keyof PKEntry | 'senderName' | 'receiverName' | 'entryTypeLabel') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedEntries = useMemo(() => {
    return [...pkEntries].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'senderName':
          aValue = a.senderName || '';
          bValue = b.senderName || '';
          break;
        case 'receiverName':
          aValue = a.receiverName || '';
          bValue = b.receiverName || '';
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
  }, [pkEntries, sortConfig]);

  const getSortIcon = (key: keyof PKEntry | 'senderName' | 'receiverName' | 'entryTypeLabel') => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Funkcja do obsługi kliknięcia na czas wideo (dokładnie tak jak w ActionsTable i Acc8sTable)
  const handleVideoTimeClick = async (videoTimestamp?: number) => {
    if (!videoTimestamp && videoTimestamp !== 0) return;
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo (sprawdzamy bezpośrednio externalWindow, a nie localStorage)
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    if (isExternalWindowOpen) {
      // Wyślij wiadomość do zewnętrznego okna
      externalWindow.postMessage({
        type: 'SEEK_TO_TIME',
        time: videoTimestamp
      }, '*');
    } else if (customVideoRef?.current) {
      try {
        await customVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć własnego odtwarzacza do czasu:', videoTimestamp, error);
      }
    } else if (youtubeVideoRef?.current) {
      try {
        await youtubeVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć wideo do czasu:', videoTimestamp, error);
      }
    } else if (onVideoTimeClick) {
      // Fallback do przekazanej funkcji
      onVideoTimeClick(videoTimestamp);
    }
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.matchesTable}>
        <div className={styles.tableHeader}>
          <div className={styles.headerCell} onClick={() => handleSort('minute')}>
            Połowa / Min {getSortIcon('minute')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('videoTimestamp')}>
            Czas wideo {getSortIcon('videoTimestamp')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('senderName')}>
            Zawodnik podający {getSortIcon('senderName')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('receiverName')}>
            Zawodnik otrzymujący {getSortIcon('receiverName')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('teamContext')}>
            Kontekst {getSortIcon('teamContext')}
          </div>
          <div className={styles.headerCell} onClick={() => handleSort('entryTypeLabel')}>
            Typ akcji {getSortIcon('entryTypeLabel')}
          </div>
          <div className={styles.headerCell}>Akcje</div>
        </div>
        <div className={styles.tableBody}>
          {sortedEntries.length === 0 ? (
            <div className={styles.noEntries}>Brak wejść PK</div>
          ) : (
            sortedEntries.map((entry) => (
              <PKEntryRow
                key={entry.id}
                entry={entry}
                onDelete={onDeleteEntry}
                onEdit={onEditEntry}
                onVideoTimeClick={(timestamp) => {
                  handleVideoTimeClick(timestamp);
                }}
                players={players}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PKEntriesTable;

