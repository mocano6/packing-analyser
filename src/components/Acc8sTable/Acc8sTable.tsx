"use client";

import React, { useState, useMemo } from "react";
import styles from "./Acc8sTable.module.css";
import sharedStyles from "@/styles/sharedTableStyles.module.css";
import { Acc8sEntry } from "@/types";
import { YouTubeVideoRef } from "@/components/YouTubeVideo/YouTubeVideo";
import { CustomVideoPlayerRef } from "@/components/CustomVideoPlayer/CustomVideoPlayer";
import { useAuth } from "@/hooks/useAuth";

export interface Acc8sTableProps {
  entries: Acc8sEntry[];
  onDeleteEntry: (entryId: string) => void;
  onEditEntry: (entry: Acc8sEntry) => void;
  onAddEntry?: () => void;
  onVideoTimeClick?: (timestamp: number) => void;
  youtubeVideoRef?: React.RefObject<YouTubeVideoRef>;
  customVideoRef?: React.RefObject<CustomVideoPlayerRef>;
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
  hideTeamLogos?: boolean;
}

const Acc8sTable: React.FC<Acc8sTableProps> = ({
  entries,
  onDeleteEntry,
  onEditEntry,
  onAddEntry,
  onVideoTimeClick,
  youtubeVideoRef,
  customVideoRef,
  matchInfo,
  allTeams = [],
  hideTeamLogos = false,
}) => {
  // State dla filtra kontrowersyjnego
  const [showOnlyControversial, setShowOnlyControversial] = useState(false);

  // Liczba akcji kontrowersyjnych
  const controversialCount = useMemo(() => {
    return entries.filter(entry => entry.isControversial).length;
  }, [entries]);

  // Filtrowane wpisy
  const filteredEntries = useMemo(() => {
    return showOnlyControversial 
      ? entries.filter(entry => entry.isControversial)
      : entries;
  }, [entries, showOnlyControversial]);
  // Funkcja formatująca czas wideo (sekundy -> mm:ss) - tak jak w ActionsTable
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

  // Funkcja do generowania wydarzeń (jak w ActionsTable)
  const getEvents = (entry: Acc8sEntry): string => {
    const events = [];
    
    if (entry.isShotUnder8s) events.push("Strzał 8s");
    if (entry.isPKEntryUnder8s) events.push("PK 8s");
    
    return events.length > 0 ? events.join(", ") : "-";
  };

  // Funkcja do obsługi kliknięcia na czas wideo (dokładnie tak jak w ActionsTable)
  const handleVideoTimeClick = async (videoTimestamp?: number) => {
    if (!videoTimestamp) return;
    
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo (sprawdzamy bezpośrednio externalWindow, a nie localStorage)
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    
    if (isExternalWindowOpen) {
      try {
        // Wyślij wiadomość do zewnętrznego okna (używamy window.location.origin dla bezpieczeństwa)
        const targetOrigin = window.location.origin;
        externalWindow.postMessage({
          type: 'SEEK_TO_TIME',
          time: videoTimestamp
        }, targetOrigin);
      } catch (error) {
        console.error('Acc8sTable - błąd podczas wysyłania wiadomości do zewnętrznego okna:', error);
        // Fallback - spróbuj z '*' jako origin
        try {
          externalWindow.postMessage({
            type: 'SEEK_TO_TIME',
            time: videoTimestamp
          }, '*');
        } catch (fallbackError) {
          console.error('Acc8sTable - błąd również przy fallback:', fallbackError);
        }
      }
    } else if (youtubeVideoRef?.current) {
      try {
        await youtubeVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć YouTube do czasu:', videoTimestamp, error);
      }
    } else if (customVideoRef?.current) {
      try {
        await customVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć własnego odtwarzacza do czasu:', videoTimestamp, error);
      }
    } else {
      console.warn('Acc8sTable - brak aktywnego playera');
    }
  };

  if (entries.length === 0) {
    return (
      <div className={sharedStyles.emptyMessage}>
        <p>Brak akcji 8s ACC. Kliknij "+", aby dodać pierwszą akcję.</p>
        {onAddEntry && (
          <button
            onClick={onAddEntry}
            className={styles.addButton}
            title="Dodaj akcję 8s ACC"
          >
            +
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={sharedStyles.tableContainer}>
      <div className={sharedStyles.headerControls}>
        <div className={sharedStyles.headerTitle}>
          <h3>Akcje 8s ACC ({showOnlyControversial ? controversialCount : entries.length})</h3>
          <button
            type="button"
            className={`${sharedStyles.controversyFilterButton} ${showOnlyControversial ? sharedStyles.controversyFilterActive : ''}`}
            onClick={() => setShowOnlyControversial(!showOnlyControversial)}
            aria-pressed={showOnlyControversial}
            aria-label="Filtruj akcje 8s ACC kontrowersyjne"
            title={`Pokaż tylko kontrowersyjne (${controversialCount})`}
          >
            !
          </button>
        </div>
        {onAddEntry && (
          <button
            onClick={onAddEntry}
            className={styles.addButton}
            title="Dodaj akcję 8s ACC"
          >
            +
          </button>
        )}
      </div>
      <div className={sharedStyles.matchesTable}>
        <div className={`${sharedStyles.tableHeader} ${styles.tableHeader}`}>
          <div className={sharedStyles.headerCell}>Połowa</div>
          <div className={sharedStyles.headerCell}>Minuta</div>
          <div className={sharedStyles.headerCell}>Czas wideo</div>
          <div className={sharedStyles.headerCell}>Liczba podań</div>
          <div className={sharedStyles.headerCell}>Wydarzenia</div>
          <div className={sharedStyles.headerCell}>Akcje</div>
        </div>
        <div className={sharedStyles.tableBody}>
          {filteredEntries.map((entry) => (
          <div 
            key={entry.id} 
            className={`${sharedStyles.tableRow} ${styles.tableRow} ${entry.isSecondHalf ? sharedStyles.secondHalfRow : sharedStyles.firstHalfRow}`}
          >
            <div className={sharedStyles.cell}>
              <span className={entry.isSecondHalf ? sharedStyles.secondHalf : sharedStyles.firstHalf}>
                {entry.isSecondHalf ? 'P2' : 'P1'}
              </span>
            </div>
            <div className={sharedStyles.cell}>
              {entry.minute}'
            </div>
            <div className={sharedStyles.cell}>
              {entry.videoTimestamp !== undefined && entry.videoTimestamp !== null ? (
                <VideoTimeCell 
                  videoTimestamp={entry.videoTimestamp}
                  videoTimestampRaw={entry.videoTimestampRaw}
                  onVideoTimeClick={handleVideoTimeClick}
                />
              ) : (
                <span>-</span>
              )}
            </div>
                <div className={sharedStyles.cell}>
                  {entry.passingPlayerIds?.length || 0}
                </div>
            <div className={sharedStyles.cell}>{getEvents(entry)}</div>
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
              <button 
                onClick={() => onEditEntry(entry)} 
                className={sharedStyles.editBtn} 
                title="Edytuj akcję"
              >
                ✎
              </button>
              <button 
                onClick={() => onDeleteEntry(entry.id)} 
                className={sharedStyles.deleteBtn} 
                title="Usuń akcję"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};

export default Acc8sTable;

