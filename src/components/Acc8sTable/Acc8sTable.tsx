"use client";

import React from "react";
import styles from "./Acc8sTable.module.css";
import { Acc8sEntry } from "@/types";
import { YouTubeVideoRef } from "@/components/YouTubeVideo/YouTubeVideo";

export interface Acc8sTableProps {
  entries: Acc8sEntry[];
  onDeleteEntry: (entryId: string) => void;
  onEditEntry: (entry: Acc8sEntry) => void;
  youtubeVideoRef?: React.RefObject<YouTubeVideoRef>;
}

const Acc8sTable: React.FC<Acc8sTableProps> = ({
  entries,
  onDeleteEntry,
  onEditEntry,
  youtubeVideoRef,
}) => {
  // Funkcja formatująca czas wideo (sekundy -> mm:ss)
  const formatVideoTime = (seconds?: number): string => {
    if (!seconds) return '-';
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

  // Funkcja do obsługi kliknięcia na czas wideo
  const handleVideoTimeClick = async (videoTimestamp?: number) => {
    if (!videoTimestamp) return;
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo
    const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
    const externalWindow = (window as any).externalVideoWindow;
    
    if (isExternalWindowOpen && externalWindow && !externalWindow.closed) {
      // Wyślij wiadomość do zewnętrznego okna
      externalWindow.postMessage({
        type: 'SEEK_TO_TIME',
        time: videoTimestamp
      }, '*');
    } else if (youtubeVideoRef?.current) {
      // Fallback do lokalnego playera
      try {
        await youtubeVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć wideo do czasu:', videoTimestamp, error);
      }
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

