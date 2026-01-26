"use client";

import React, { useState, useMemo } from "react";
import styles from "./Acc8sTable.module.css";
import sharedStyles from "@/styles/sharedTableStyles.module.css";
import pitchHeaderStyles from "@/components/PitchHeader/PitchHeader.module.css";
import pageStyles from "@/app/page.module.css";
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
  onBulkUpdateEntries?: (updates: Array<{ id: string; isShotUnder8s: boolean; isPKEntryUnder8s: boolean }>) => Promise<void>;
  allPKEntries?: any[];
  allShots?: any[];
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
  onBulkUpdateEntries,
  allPKEntries = [],
  allShots = [],
}) => {
  // State dla filtra kontrowersyjnego
  const [showOnlyControversial, setShowOnlyControversial] = useState(false);
  
  // State dla modalu z podglądem zmian automatycznych flag
  const [showAutoFlagsModal, setShowAutoFlagsModal] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Array<{ 
    entry: Acc8sEntry; 
    isShotUnder8s: boolean; 
    isPKEntryUnder8s: boolean;
    shotTime?: string;
    pkTime?: string;
    shotTimeDiff?: number;
    pkTimeDiff?: number;
  }>>([]);
  const [selectedAcc8sUpdates, setSelectedAcc8sUpdates] = useState<Set<string>>(new Set());

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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onBulkUpdateEntries && entries.length > 0 && (
            <button
              onClick={() => {
                // Oblicz flagi dla wszystkich akcji 8s ACC
                const updates: Array<{ 
                  entry: Acc8sEntry; 
                  isShotUnder8s: boolean; 
                  isPKEntryUnder8s: boolean;
                  shotTime?: string;
                  pkTime?: string;
                  shotTimeDiff?: number;
                  pkTimeDiff?: number;
                }> = [];
                
                entries.forEach((entry) => {
                  const acc8sTimeRaw = entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null
                    ? entry.videoTimestampRaw
                    : (entry.videoTimestamp !== undefined && entry.videoTimestamp !== null ? entry.videoTimestamp + 10 : null);
                  
                  if (acc8sTimeRaw === null) return;
                  
                  const timeWindowEnd = acc8sTimeRaw + 8;
                  
                  // Znajdź najbliższe wejście w PK (nawet poza przedziałem 8s, aby pokazać różnicę czasu)
                  let hasPK = false;
                  let pkTime: string | undefined;
                  let pkTimeDiff: number | undefined;
                  let closestPKTimeRaw: number | null = null;
                  let closestPKTimeDiff: number | null = null;
                  
                  for (const pkEntry of allPKEntries) {
                    let pkTimeRaw: number | null = null;
                    if (pkEntry.videoTimestampRaw !== undefined && pkEntry.videoTimestampRaw !== null) {
                      pkTimeRaw = pkEntry.videoTimestampRaw;
                    } else if (pkEntry.videoTimestamp !== undefined && pkEntry.videoTimestamp !== null) {
                      pkTimeRaw = pkEntry.videoTimestamp + 10;
                    }
                    if (pkTimeRaw === null) continue;
                    
                    // Tylko zdarzenia po akcji 8s ACC (nie przed)
                    if (pkTimeRaw < acc8sTimeRaw) continue;
                    
                    const timeDiff = pkTimeRaw - acc8sTimeRaw;
                    
                    // Sprawdź czy jest w przedziale 8s
                    if (pkTimeRaw >= acc8sTimeRaw && pkTimeRaw <= timeWindowEnd) {
                      if (closestPKTimeRaw === null || timeDiff < closestPKTimeDiff!) {
                        closestPKTimeRaw = pkTimeRaw;
                        closestPKTimeDiff = timeDiff;
                        hasPK = true;
                        const pkMinutes = Math.floor(pkTimeRaw / 60);
                        const pkSeconds = Math.floor(pkTimeRaw % 60);
                        pkTime = `${pkMinutes}:${pkSeconds.toString().padStart(2, '0')}`;
                        pkTimeDiff = timeDiff;
                      }
                    } else {
                      // Jeśli jest poza przedziałem 8s, ale jest najbliższe, zapisz dla informacji
                      if (closestPKTimeRaw === null || timeDiff < closestPKTimeDiff!) {
                        closestPKTimeRaw = pkTimeRaw;
                        closestPKTimeDiff = timeDiff;
                        const pkMinutes = Math.floor(pkTimeRaw / 60);
                        const pkSeconds = Math.floor(pkTimeRaw % 60);
                        pkTime = `${pkMinutes}:${pkSeconds.toString().padStart(2, '0')}`;
                        pkTimeDiff = timeDiff;
                      }
                    }
                  }
                  
                  // Znajdź najbliższy strzał (nawet poza przedziałem 8s, aby pokazać różnicę czasu)
                  let hasShot = false;
                  let shotTime: string | undefined;
                  let shotTimeDiff: number | undefined;
                  let closestShotTimeRaw: number | null = null;
                  let closestShotTimeDiff: number | null = null;
                  
                  for (const shot of allShots) {
                    let shotTimeRaw: number | null = null;
                    if (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null) {
                      shotTimeRaw = shot.videoTimestampRaw;
                    } else if (shot.videoTimestamp !== undefined && shot.videoTimestamp !== null) {
                      shotTimeRaw = shot.videoTimestamp + 10;
                    }
                    if (shotTimeRaw === null) continue;
                    
                    // Tylko zdarzenia po akcji 8s ACC (nie przed)
                    if (shotTimeRaw < acc8sTimeRaw) continue;
                    
                    const timeDiff = shotTimeRaw - acc8sTimeRaw;
                    
                    // Sprawdź czy jest w przedziale 8s
                    if (shotTimeRaw >= acc8sTimeRaw && shotTimeRaw <= timeWindowEnd) {
                      if (closestShotTimeRaw === null || timeDiff < closestShotTimeDiff!) {
                        closestShotTimeRaw = shotTimeRaw;
                        closestShotTimeDiff = timeDiff;
                        hasShot = true;
                        const shotMinutes = Math.floor(shotTimeRaw / 60);
                        const shotSeconds = Math.floor(shotTimeRaw % 60);
                        shotTime = `${shotMinutes}:${shotSeconds.toString().padStart(2, '0')}`;
                        shotTimeDiff = timeDiff;
                      }
                    } else {
                      // Jeśli jest poza przedziałem 8s, ale jest najbliższe, zapisz dla informacji
                      if (closestShotTimeRaw === null || timeDiff < closestShotTimeDiff!) {
                        closestShotTimeRaw = shotTimeRaw;
                        closestShotTimeDiff = timeDiff;
                        const shotMinutes = Math.floor(shotTimeRaw / 60);
                        const shotSeconds = Math.floor(shotTimeRaw % 60);
                        shotTime = `${shotMinutes}:${shotSeconds.toString().padStart(2, '0')}`;
                        shotTimeDiff = timeDiff;
                      }
                    }
                  }
                  
                  // Dodaj do listy tylko jeśli flagi się zmienią
                  if (hasPK !== entry.isPKEntryUnder8s || hasShot !== entry.isShotUnder8s) {
                    updates.push({
                      entry,
                      isShotUnder8s: hasShot,
                      isPKEntryUnder8s: hasPK,
                      shotTime,
                      pkTime,
                      shotTimeDiff,
                      pkTimeDiff,
                    });
                  }
                });
                
                if (updates.length === 0) {
                  alert('Nie znaleziono żadnych zmian do zastosowania.');
                  return;
                }
                
                setPendingUpdates(updates);
                // Zaznacz wszystkie domyślnie
                const allIds = new Set(updates.map(u => u.entry.id || `acc8s-${updates.indexOf(u)}`).filter(Boolean));
                setSelectedAcc8sUpdates(allIds);
                setShowAutoFlagsModal(true);
              }}
              className={pitchHeaderStyles.headerButton}
              title="Automatycznie ustaw flagi na podstawie wejść w PK i strzałów w 8s"
            >
              ✓ Weryfikuj
            </button>
          )}
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
      
      {/* Modal z podglądem zmian automatycznych flag */}
      {showAutoFlagsModal && (
        <div className={pageStyles.pkVerifyOverlay} onClick={() => setShowAutoFlagsModal(false)}>
          <div className={pageStyles.pkVerifyModal} onClick={(e) => e.stopPropagation()}>
            <div className={pageStyles.pkVerifyHeader}>
              <h3>Podgląd zmian automatycznych flag</h3>
              <button className={pageStyles.pkVerifyClose} onClick={() => setShowAutoFlagsModal(false)}>×</button>
            </div>
            <div className={pageStyles.pkVerifyBody}>
              <p>Znaleziono <strong>{pendingUpdates.length}</strong> akcji 8s ACC do zaktualizowania:</p>
              <div className={pageStyles.pkVerifyList}>
                {pendingUpdates.map((update, index) => {
                  const acc8sTimeRaw = update.entry.videoTimestampRaw !== undefined && update.entry.videoTimestampRaw !== null
                    ? update.entry.videoTimestampRaw
                    : (update.entry.videoTimestamp !== undefined && update.entry.videoTimestamp !== null ? update.entry.videoTimestamp + 10 : null);
                  const acc8sMinutes = acc8sTimeRaw ? Math.floor(acc8sTimeRaw / 60) : 0;
                  const acc8sSeconds = acc8sTimeRaw ? Math.floor(acc8sTimeRaw % 60) : 0;
                  const acc8sTimeString = `${acc8sMinutes}:${acc8sSeconds.toString().padStart(2, '0')}`;
                  
                  const entryId = update.entry.id || `acc8s-${index}`;
                  const isSelected = selectedAcc8sUpdates.has(entryId);
                  
                  return (
                    <div key={entryId} className={pageStyles.pkVerifyItem}>
                      <div className={pageStyles.pkVerifyItemHeader}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedAcc8sUpdates);
                            if (e.target.checked) {
                              newSelected.add(entryId);
                            } else {
                              newSelected.delete(entryId);
                            }
                            setSelectedAcc8sUpdates(newSelected);
                          }}
                          style={{ marginRight: '8px', cursor: 'pointer' }}
                        />
                        <span className={pageStyles.pkVerifyTime}>{acc8sTimeString}</span>
                        <span className={pageStyles.pkVerifyMinute}>Minuta {update.entry.minute}'</span>
                      </div>
                      <div className={pageStyles.pkVerifyFlags}>
                        {update.entry.isShotUnder8s !== update.isShotUnder8s && (
                          <>
                            <span className={pageStyles.pkVerifyLabel}>Strzał 8s:</span>
                            <span className={pageStyles.pkVerifyChange}>
                              <span className={pageStyles.pkVerifyIcon}>{update.entry.isShotUnder8s ? '✓' : '✗'}</span>
                              <span>→</span>
                              <span className={pageStyles.pkVerifyIcon}>{update.isShotUnder8s ? '✓' : '✗'}</span>
                              {update.shotTime && update.shotTimeDiff !== undefined && (
                                <span className={pageStyles.pkVerifyTimeHint}>
                                  (Strzał: {update.shotTime}, różnica: {update.shotTimeDiff.toFixed(1)}s)
                                </span>
                              )}
                              {update.shotTime && update.shotTimeDiff === undefined && (
                                <span className={pageStyles.pkVerifyTimeHint}>({update.shotTime})</span>
                              )}
                            </span>
                          </>
                        )}
                        {update.entry.isPKEntryUnder8s !== update.isPKEntryUnder8s && (
                          <>
                            <span className={pageStyles.pkVerifyLabel}>PK 8s:</span>
                            <span className={pageStyles.pkVerifyChange}>
                              <span className={pageStyles.pkVerifyIcon}>{update.entry.isPKEntryUnder8s ? '✓' : '✗'}</span>
                              <span>→</span>
                              <span className={pageStyles.pkVerifyIcon}>{update.isPKEntryUnder8s ? '✓' : '✗'}</span>
                              {update.pkTime && update.pkTimeDiff !== undefined && (
                                <span className={pageStyles.pkVerifyTimeHint}>
                                  (PK: {update.pkTime}, różnica: {update.pkTimeDiff.toFixed(1)}s)
                                </span>
                              )}
                              {update.pkTime && update.pkTimeDiff === undefined && (
                                <span className={pageStyles.pkVerifyTimeHint}>({update.pkTime})</span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={pageStyles.pkVerifyFooter}>
              <div className={pageStyles.pkVerifySelectAllGroup}>
                <button
                  type="button"
                  className={pageStyles.pkVerifySelectAllButton}
                  onClick={() => {
                    const allIds = new Set(pendingUpdates.map(u => u.entry.id || `acc8s-${pendingUpdates.indexOf(u)}`).filter(Boolean));
                    setSelectedAcc8sUpdates(allIds);
                  }}
                >
                  Zaznacz wszystkie
                </button>
                <button
                  type="button"
                  className={pageStyles.pkVerifySelectAllButton}
                  onClick={() => setSelectedAcc8sUpdates(new Set())}
                >
                  Odznacz wszystkie
                </button>
              </div>
              <div className={pageStyles.pkVerifyFooterActions}>
                <button
                  onClick={() => {
                    setShowAutoFlagsModal(false);
                    setSelectedAcc8sUpdates(new Set());
                  }}
                  className={pageStyles.pkVerifyCancel}
                >
                  Anuluj
                </button>
                <button
                  onClick={async () => {
                    if (selectedAcc8sUpdates.size === 0) {
                      alert("Zaznacz przynajmniej jedną pozycję do zaktualizowania.");
                      return;
                    }
                    
                    if (onBulkUpdateEntries) {
                      await onBulkUpdateEntries(pendingUpdates
                        .filter(u => {
                          const entryId = u.entry.id || `acc8s-${pendingUpdates.indexOf(u)}`;
                          return selectedAcc8sUpdates.has(entryId);
                        })
                        .map(u => ({
                          id: u.entry.id,
                          isShotUnder8s: u.isShotUnder8s,
                          isPKEntryUnder8s: u.isPKEntryUnder8s,
                        })));
                    }
                    setShowAutoFlagsModal(false);
                    setPendingUpdates([]);
                    setSelectedAcc8sUpdates(new Set());
                  }}
                  className={pageStyles.pkVerifySave}
                >
                  Zatwierdź zmiany ({selectedAcc8sUpdates.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Acc8sTable;

