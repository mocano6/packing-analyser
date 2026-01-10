"use client";

import React from "react";
import styles from "./Acc8sTable.module.css";
import { Acc8sEntry } from "@/types";
import { YouTubeVideoRef } from "@/components/YouTubeVideo/YouTubeVideo";
import { CustomVideoPlayerRef } from "@/components/CustomVideoPlayer/CustomVideoPlayer";

export interface Acc8sTableProps {
  entries: Acc8sEntry[];
  onDeleteEntry: (entryId: string) => void;
  onEditEntry: (entry: Acc8sEntry) => void;
  onVideoTimeClick?: (timestamp: number) => void;
  youtubeVideoRef?: React.RefObject<YouTubeVideoRef>;
  customVideoRef?: React.RefObject<CustomVideoPlayerRef>;
}

const Acc8sTable: React.FC<Acc8sTableProps> = ({
  entries,
  onDeleteEntry,
  onEditEntry,
  onVideoTimeClick,
  youtubeVideoRef,
  customVideoRef,
}) => {
  // Funkcja formatująca czas wideo (sekundy -> mm:ss) - tak jak w ActionsTable
  const formatVideoTime = (seconds?: number): string => {
    if (!seconds && seconds !== 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    
    console.log('Acc8sTable handleVideoTimeClick - timestamp:', videoTimestamp);
    console.log('Acc8sTable handleVideoTimeClick - customVideoRef?.current:', customVideoRef?.current);
    console.log('Acc8sTable handleVideoTimeClick - youtubeVideoRef?.current:', youtubeVideoRef?.current);
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo (sprawdzamy bezpośrednio externalWindow, a nie localStorage)
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    console.log('Acc8sTable handleVideoTimeClick - externalWindow:', externalWindow);
    console.log('Acc8sTable handleVideoTimeClick - externalWindow?.closed:', externalWindow?.closed);
    console.log('Acc8sTable handleVideoTimeClick - isExternalWindowOpen:', isExternalWindowOpen);
    
    if (isExternalWindowOpen) {
      console.log('Acc8sTable - wysyłam SEEK_TO_TIME do zewnętrznego okna, timestamp:', videoTimestamp);
      try {
        // Wyślij wiadomość do zewnętrznego okna (używamy window.location.origin dla bezpieczeństwa)
        const targetOrigin = window.location.origin;
        externalWindow.postMessage({
          type: 'SEEK_TO_TIME',
          time: videoTimestamp
        }, targetOrigin);
        console.log('Acc8sTable - wiadomość wysłana pomyślnie do origin:', targetOrigin);
      } catch (error) {
        console.error('Acc8sTable - błąd podczas wysyłania wiadomości do zewnętrznego okna:', error);
        // Fallback - spróbuj z '*' jako origin
        try {
          externalWindow.postMessage({
            type: 'SEEK_TO_TIME',
            time: videoTimestamp
          }, '*');
          console.log('Acc8sTable - wiadomość wysłana z fallback origin "*"');
        } catch (fallbackError) {
          console.error('Acc8sTable - błąd również przy fallback:', fallbackError);
        }
      }
    } else if (youtubeVideoRef?.current) {
      console.log('Acc8sTable - używam youtubeVideoRef');
      try {
        await youtubeVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć YouTube do czasu:', videoTimestamp, error);
      }
    } else if (customVideoRef?.current) {
      console.log('Acc8sTable - używam customVideoRef');
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
      <div className={styles.emptyMessage}>
        Brak akcji 8s ACC. Kliknij "+", aby dodać pierwszą akcję.
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <div className={styles.headerCell}>Połowa</div>
        <div className={styles.headerCell}>Minuta</div>
        <div className={styles.headerCell}>Czas wideo</div>
        <div className={styles.headerCell}>Liczba podań</div>
        <div className={styles.headerCell}>Wydarzenia</div>
        <div className={styles.headerCell}>Akcje</div>
      </div>
      <div className={styles.tableBody}>
        {entries.map((entry) => (
          <div 
            key={entry.id} 
            className={`${styles.tableRow} ${entry.isSecondHalf ? styles.secondHalfRow : styles.firstHalfRow}`}
          >
            <div className={styles.cell}>
              <span className={entry.isSecondHalf ? styles.secondHalf : styles.firstHalf}>
                {entry.isSecondHalf ? 'P2' : 'P1'}
              </span>
            </div>
            <div className={styles.cell}>
              {entry.minute}'
            </div>
            <div className={styles.cell}>
              {entry.videoTimestamp ? (
                <span 
                  className={styles.videoTimeLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVideoTimeClick(entry.videoTimestamp);
                  }}
                  title="Kliknij aby przejść do tego momentu w wideo"
                >
                  {formatVideoTime(entry.videoTimestamp)}
                </span>
              ) : (
                <span>-</span>
              )}
            </div>
                <div className={styles.cell}>
                  {entry.passingPlayerIds?.length || 0}
                </div>
            <div className={styles.cell}>{getEvents(entry)}</div>
            <div className={styles.cellActions}>
              <button 
                onClick={() => onEditEntry(entry)} 
                className={styles.editBtn} 
                title="Edytuj akcję"
              >
                ✎
              </button>
              <button 
                onClick={() => onDeleteEntry(entry.id)} 
                className={styles.deleteBtn} 
                title="Usuń akcję"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Acc8sTable;

