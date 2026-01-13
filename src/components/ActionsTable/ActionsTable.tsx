// src/components/ActionsTable/ActionsTable.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./ActionsTable.module.css";
import { ActionsTableProps } from "@/components/ActionsTable/ActionsTable.types";
import { Player, Action } from "@/types";
import { getOppositeXTValueForZone, zoneNameToIndex, getZoneData, getZoneName, zoneNameToString } from "@/constants/xtValues";

// Funkcja do określenia kategorii akcji (spójna z page.tsx)
const getActionCategory = (action: Action): "packing" | "regain" | "loses" => {
  // Loses: ma isReaction5s, isAut lub isReaction5sNotApplicable (którekolwiek z tych pól zdefiniowane)
  // LUB ma pola specyficzne dla loses (losesAttackZone, losesDefenseZone, losesAttackXT, losesDefenseXT)
  if (action.isReaction5s !== undefined || 
      action.isAut !== undefined || 
      action.isReaction5sNotApplicable !== undefined ||
      action.losesAttackZone !== undefined ||
      action.losesDefenseZone !== undefined ||
      action.losesAttackXT !== undefined ||
      action.losesDefenseXT !== undefined) {
    return "loses";
  }
  // Regain: ma playersBehindBall lub opponentsBehindBall, ale NIE ma isReaction5s
  // LUB ma pola specyficzne dla regain (regainAttackZone, regainDefenseZone, regainAttackXT, regainDefenseXT)
  if (action.regainAttackZone !== undefined ||
      action.regainDefenseZone !== undefined ||
      action.regainAttackXT !== undefined ||
      action.regainDefenseXT !== undefined ||
      (action.playersBehindBall !== undefined || 
       action.opponentsBehindBall !== undefined ||
       action.totalPlayersOnField !== undefined ||
       action.totalOpponentsOnField !== undefined ||
       action.playersLeftField !== undefined ||
       action.opponentsLeftField !== undefined)) {
    return "regain";
  }
  // Packing: domyślnie
  return "packing";
};

type SortKey =
  | "minute"
  | "sender"
  | "senderXT"
  | "receiver"
  | "receiverXT"
  | "startZone"
  | "endZone"
  | "type"
  | "xt"
  | "packing"
  | "pxt"
  | "events"
  | "videoTimestamp";

type SortDirection = "asc" | "desc";

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}

// Komponent HeaderCell 
const HeaderCell: React.FC<SortableHeaderProps> = ({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
}) => {
  const isActive = sortKey === currentSortKey;
  return (
    <div 
      className={styles.headerCell} 
      onClick={() => onSort(sortKey)}
    >
      {label} {isActive && (sortDirection === "asc" ? "↑" : "↓")}
    </div>
  );
};

// Komponent wiersza akcji
const ActionRow = ({
  action,
  onDelete,
  onEdit,
  onVideoTimeClick,
  selectedMetric,
  actionModeFilter,
  players,
  actionCategory,
}: {
  action: ActionsTableProps["actions"][0];
  onDelete: (id: string) => void;
  onEdit?: (action: ActionsTableProps["actions"][0]) => void;
  onVideoTimeClick?: (videoTimestamp?: number) => void;
  selectedMetric: 'packing' | 'pxt' | 'xt';
  actionModeFilter: 'attack' | 'defense';
  players: Player[];
  actionCategory?: "packing" | "regain" | "loses";
}) => {
  const getEvents = () => {
    const events = [];
    
    // Dodaj P1/P2/P3 (tylko jeden może być zaznaczony)
    if (action.isP1) events.push("P1");
    else if (action.isP2) events.push("P2");
    else if (action.isP3) events.push("P3");
    
    // Dodaj 1T/2T/3T+ (tylko jeden może być zaznaczony)
    if (action.isContact1) events.push("1T");
    else if (action.isContact2) events.push("2T");
    else if (action.isContact3Plus) events.push("3T+");
    
    // Dodaj inne wydarzenia
    if (action.isPenaltyAreaEntry) events.push("PK");
    if (action.isShot) {
      events.push(action.isGoal ? "S+G" : "S");
    } else if (action.isGoal) {
      events.push("G");
    }
    
    return events.length > 0 ? events.join(", ") : "-";
  };
  
  // Określamy, czy akcja jest w drugiej połowie - jeśli isSecondHalf jest undefined, uznajemy za false
  const isSecondHalf = action.isSecondHalf === true;

  // Przygotuj dane zawodników w bezpieczny sposób
  let senderDisplay = action.senderName 
    ? `${action.senderNumber || '?'} ${action.senderName}`
    : (action.senderId ? `ID: ${action.senderId.substring(0, 6)}...` : '-');
    
  // W trybie obrony wyświetlaj zawodników miniętych
  if (actionModeFilter === 'defense' && action.defensePlayers && action.defensePlayers.length > 0) {
    const defensePlayerNames = action.defensePlayers.map(playerId => {
      const player = players.find(p => p.id === playerId);
      return player ? `${player.number || '?'} ${player.name}` : `ID: ${playerId.substring(0, 6)}...`;
    });
    senderDisplay = defensePlayerNames.join(', ');
  }
    
  const receiverDisplay = action.receiverName 
    ? `${action.receiverNumber || '?'} ${action.receiverName}`
    : (action.receiverId ? `ID: ${action.receiverId.substring(0, 6)}...` : '-');

  // Funkcja formatująca czas wideo (sekundy -> mm:ss)
  const formatVideoTime = (seconds?: number): string => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Oblicz grid-template-columns w zależności od actionCategory
  const gridColumns = (() => {
    // Dla regain i loses: 10 kolumn (bez "Zawodnik koniec" i "PxT", z "Partnerzy przed piłką" i "Atak xT")
    if (actionCategory === "regain" || actionCategory === "loses") {
      return "1fr 80px 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 80px";
    }
    // Dla packing: 10 kolumn (z "Zawodnik koniec" i "PxT", bez "Partnerzy przed piłką")
    if (actionModeFilter === 'attack') {
      return "1fr 80px 0.8fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 80px";
    }
    // Dla defense: 9 kolumn (bez "Zawodnik koniec")
    return "1fr 80px 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 80px";
  })();

  return (
    <div 
      className={`${styles.actionRow} ${isSecondHalf ? styles.secondHalfRow : styles.firstHalfRow}`}
      style={{ gridTemplateColumns: gridColumns }}
    >
      <div className={styles.cell}>
        <span className={isSecondHalf ? styles.secondHalf : styles.firstHalf}>
          {isSecondHalf ? 'P2' : 'P1'}
        </span>
        &nbsp;{action.minute}'
      </div>
      <div className={styles.cell}>
        {action.videoTimestamp ? (
          <span 
            className={styles.videoTimeLink}
            onClick={(e) => {
              e.stopPropagation();
              onVideoTimeClick?.(action.videoTimestamp);
            }}
            title="Kliknij aby przejść do tego momentu w wideo"
          >
            {formatVideoTime(action.videoTimestamp)}
          </span>
        ) : (
          <span>-</span>
        )}
      </div>
      <div className={styles.cell}>
        {senderDisplay}
      </div>
      {/* Ukryj kolumnę "Zawodnik koniec" dla regain i loses oraz unpacking */}
      {actionCategory === "packing" && actionModeFilter === 'attack' && (
        <div className={styles.cell}>
          {receiverDisplay}
        </div>
      )}
      <div className={styles.cell}>
        <span className={action.actionType === "pass" ? styles.pass : styles.dribble}>
          {action.actionType === "pass" ? "Podanie" : "Drybling"}
        </span>
      </div>
      <div className={styles.cell}>
        {(() => {
          // Określ kategorię akcji dla tej konkretnej akcji
          const currentActionCategory = getActionCategory(action);
          // Dla regain i loses wyświetlamy wartość xT z obrony (regainDefenseXT/losesDefenseXT)
          if (currentActionCategory === "regain" || currentActionCategory === "loses") {
            if (currentActionCategory === "regain") {
              const xTValue = action.regainDefenseXT ?? action.xTValueStart ?? action.xTValueEnd ?? 0;
              if (xTValue === undefined || xTValue === null) {
                return "-";
              }
              const valueStr = typeof xTValue === 'number' ? xTValue.toFixed(3) : "-";
              // Określ nazwę strefy na podstawie źródła wartości
              let zoneName = "";
              if (action.regainDefenseZone) {
                zoneName = action.regainDefenseZone.toUpperCase();
              } else if (action.fromZone) {
                zoneName = action.fromZone.toUpperCase();
              } else if (action.toZone) {
                zoneName = action.toZone.toUpperCase();
              } else if (action.startZone) {
                zoneName = typeof action.startZone === 'string' ? action.startZone.toUpperCase() : String(action.startZone);
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>{valueStr}</span>
                  {zoneName && <span style={{ fontSize: '10px', color: '#666' }}>{zoneName}</span>}
                </div>
              );
            } else {
              // Dla loses: użyj tego samego podejścia co dla regain
              // Najpierw sprawdź nowe pola, potem stare, na końcu oblicz z strefy
              let xTValue: number | undefined = undefined;
              
              // Sprawdź losesDefenseXT - może być 0, więc sprawdzamy typeof
              if (action.losesDefenseXT !== undefined && action.losesDefenseXT !== null) {
                xTValue = typeof action.losesDefenseXT === 'number' ? action.losesDefenseXT : undefined;
              }
              
              // Jeśli nie ma w nowych polach, sprawdź stare pola
              if (xTValue === undefined) {
                if (action.xTValueStart !== undefined && action.xTValueStart !== null) {
                  xTValue = typeof action.xTValueStart === 'number' ? action.xTValueStart : undefined;
                } else if (action.xTValueEnd !== undefined && action.xTValueEnd !== null) {
                  xTValue = typeof action.xTValueEnd === 'number' ? action.xTValueEnd : undefined;
                }
              }
              
              // Określ nazwę strefy PRZED obliczeniem z strefy (aby mieć dostęp do oryginalnej strefy)
              let zoneName = "";
              if (action.losesDefenseZone) {
                zoneName = action.losesDefenseZone.toUpperCase();
              } else if (action.fromZone) {
                zoneName = action.fromZone.toUpperCase();
              } else if (action.toZone) {
                zoneName = action.toZone.toUpperCase();
              } else if (action.startZone) {
                zoneName = typeof action.startZone === 'string' ? action.startZone.toUpperCase() : String(action.startZone);
              }
              
              // Jeśli nadal brakuje, spróbuj obliczyć z strefy
              if (xTValue === undefined) {
                const zoneNameForCalc = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
                if (zoneNameForCalc) {
                  if (!zoneName) {
                    zoneName = typeof zoneNameForCalc === 'string' ? zoneNameForCalc.toUpperCase() : String(zoneNameForCalc);
                  }
                  const zoneIndex = zoneNameToIndex(zoneNameForCalc);
                  if (zoneIndex !== null) {
                    // Dla loses, xT w obronie to wartość ze strefy gdzie nastąpiła strata (bezpośrednio ze strefy, nie opposite)
                    const zoneData = getZoneData(zoneIndex);
                    if (zoneData && typeof zoneData.value === 'number') {
                      xTValue = zoneData.value;
                    }
                  }
                }
              }
              
              // Zwróć wartość lub "-" jeśli nie znaleziono
              // Uwaga: 0 to prawidłowa wartość, więc sprawdzamy tylko undefined
              if (xTValue === undefined || xTValue === null) {
                return "-";
              }
              const valueStr = xTValue.toFixed(3);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>{valueStr}</span>
                  {zoneName && <span style={{ fontSize: '10px', color: '#666' }}>{zoneName}</span>}
                </div>
              );
            }
          }
          // Dla packing obliczamy xT różnicę: xTEnd - xTStart
          const xTStart = action.xTValueStart || 0;
          const xTEnd = action.xTValueEnd || 0;
          const xTDifference = xTEnd - xTStart;
          
          return typeof xTDifference === 'number' ? xTDifference.toFixed(3) : "-";
        })()}
      </div>
      {/* Dla regain i loses dodajemy kolumnę "Atak xT" */}
      {(() => {
        const currentActionCategory = getActionCategory(action);
        return (currentActionCategory === "regain" || currentActionCategory === "loses") && (
        <div className={styles.cell}>
          {(() => {
              if (currentActionCategory === "regain") {
              // Dla regain: użyj nowych pól lub oblicz z strefy
              let attackXT: number | undefined = action.regainAttackXT;
              
              // Określ nazwę strefy PRZED obliczeniem z strefy (aby mieć dostęp do oryginalnej strefy)
              let zoneName = "";
              if (action.regainAttackZone) {
                zoneName = action.regainAttackZone.toUpperCase();
              } else if (action.oppositeZone) {
                zoneName = action.oppositeZone.toUpperCase();
              } else if (action.startZone) {
                zoneName = typeof action.startZone === 'string' ? action.startZone.toUpperCase() : String(action.startZone);
              } else if (action.fromZone) {
                zoneName = action.fromZone.toUpperCase();
              }
              
              if (attackXT === undefined) {
                // Fallback: oblicz z strefy jeśli brakuje
                const zoneNameForCalc = action.regainAttackZone || action.oppositeZone || action.startZone || action.fromZone;
                if (zoneNameForCalc) {
                  if (!zoneName) {
                    zoneName = typeof zoneNameForCalc === 'string' ? zoneNameForCalc.toUpperCase() : String(zoneNameForCalc);
                  }
                  const zoneIndex = zoneNameToIndex(zoneNameForCalc);
                  if (zoneIndex !== null) {
                    attackXT = getOppositeXTValueForZone(zoneIndex);
                  }
                }
              }
              
              if (attackXT === undefined || attackXT === null) {
                return "-";
              }
              const valueStr = typeof attackXT === 'number' ? attackXT.toFixed(3) : "-";
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>{valueStr}</span>
                  {zoneName && <span style={{ fontSize: '10px', color: '#666' }}>{zoneName}</span>}
                </div>
              );
            } else {
              // Dla loses: użyj tego samego podejścia co dla regain
              // Najpierw sprawdź nowe pola, potem stare, na końcu oblicz z strefy
              let attackXT: number | undefined = undefined;
              
              // Określ nazwę strefy PRZED obliczeniem z strefy (aby mieć dostęp do oryginalnej strefy)
              let zoneName = "";
              if (action.losesAttackZone) {
                zoneName = action.losesAttackZone.toUpperCase();
              } else if (action.oppositeZone) {
                zoneName = action.oppositeZone.toUpperCase();
              } else if (action.startZone) {
                zoneName = typeof action.startZone === 'string' ? action.startZone.toUpperCase() : String(action.startZone);
              } else if (action.fromZone) {
                zoneName = action.fromZone.toUpperCase();
              }
              
              // Sprawdź losesAttackXT - może być 0, więc sprawdzamy typeof
              if (action.losesAttackXT !== undefined && action.losesAttackXT !== null) {
                attackXT = typeof action.losesAttackXT === 'number' ? action.losesAttackXT : undefined;
              }
              
              // Jeśli nie ma w nowych polach, sprawdź stare pola
              if (attackXT === undefined && action.oppositeXT !== undefined && action.oppositeXT !== null) {
                attackXT = typeof action.oppositeXT === 'number' ? action.oppositeXT : undefined;
              }
              
              // Jeśli nadal brakuje, oblicz z strefy
              if (attackXT === undefined) {
                const zoneNameForCalc = action.losesAttackZone || action.oppositeZone || action.startZone || action.fromZone;
                if (zoneNameForCalc) {
                  if (!zoneName) {
                    zoneName = typeof zoneNameForCalc === 'string' ? zoneNameForCalc.toUpperCase() : String(zoneNameForCalc);
                  }
                  const zoneIndex = zoneNameToIndex(zoneNameForCalc);
                  if (zoneIndex !== null) {
                    attackXT = getOppositeXTValueForZone(zoneIndex);
                  }
                }
              }
              
              // Jeśli nadal brakuje, spróbuj obliczyć z losesDefenseZone (opposite)
              if (attackXT === undefined) {
                const defenseZoneName = action.losesDefenseZone || action.fromZone || action.toZone;
                if (defenseZoneName) {
                  if (!zoneName) {
                    // Oblicz opposite zone name
                    const defenseZoneIndex = zoneNameToIndex(defenseZoneName);
                    if (defenseZoneIndex !== null) {
                      const row = Math.floor(defenseZoneIndex / 12);
                      const col = defenseZoneIndex % 12;
                      const oppositeRow = 7 - row;
                      const oppositeCol = 11 - col;
                      const oppositeIndex = oppositeRow * 12 + oppositeCol;
                      const oppositeZoneData = getZoneName(oppositeIndex);
                      if (oppositeZoneData) {
                        zoneName = zoneNameToString(oppositeZoneData).toUpperCase();
                      }
                    }
                  }
                  const defenseZoneIndex = zoneNameToIndex(defenseZoneName);
                  if (defenseZoneIndex !== null) {
                    // Oblicz opposite zone i jego xT
                    const row = Math.floor(defenseZoneIndex / 12);
                    const col = defenseZoneIndex % 12;
                    const oppositeRow = 7 - row;
                    const oppositeCol = 11 - col;
                    const oppositeIndex = oppositeRow * 12 + oppositeCol;
                    attackXT = getOppositeXTValueForZone(oppositeIndex);
                  }
                }
              }
              
              // Zwróć wartość lub "-" jeśli nie znaleziono
              // Uwaga: 0 to prawidłowa wartość, więc sprawdzamy tylko undefined
              if (attackXT === undefined || attackXT === null) {
                return "-";
              }
              const valueStr = attackXT.toFixed(3);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>{valueStr}</span>
                  {zoneName && <span style={{ fontSize: '10px', color: '#666' }}>{zoneName}</span>}
                </div>
              );
            }
          })()}
        </div>
        );
      })()}
      <div className={styles.cell}>
        {/* Dla regain i loses wyświetlamy "przed/za piłką" zamiast packingPoints */}
        {actionCategory === "regain" || actionCategory === "loses" ? (
          (() => {
            const opponentsBefore = action.opponentsBehindBall ?? 0;
            const totalOpponents = action.totalOpponentsOnField ?? 11;
            const opponentsBehind = totalOpponents - opponentsBefore;
            return `${opponentsBefore}/${opponentsBehind}`;
          })()
        ) : (
          action.packingPoints || 0
        )}
      </div>
      {/* Dla regain i loses dodajemy kolumnę "Partnerzy przed piłką" */}
      {(actionCategory === "regain" || actionCategory === "loses") && (
        <div className={styles.cell}>
          {(() => {
            const playersBefore = action.playersBehindBall ?? 0;
            const totalPlayers = action.totalPlayersOnField ?? 11;
            const playersBehind = totalPlayers - playersBefore;
            return `${playersBefore}/${playersBehind}`;
          })()}
        </div>
      )}
      {/* Ukryj kolumnę PxT dla regain i loses */}
      {(actionCategory === "packing") && (
        <div className={styles.cell}>
          {(() => {
            // Obliczamy PxT dynamicznie: (xTEnd - xTStart) * packingPoints
            const xTStart = action.xTValueStart || 0;
            const xTEnd = action.xTValueEnd || 0;
            const packingPoints = action.packingPoints || 0;
            const pxtValue = (xTEnd - xTStart) * packingPoints;
            
            return typeof pxtValue === 'number' ? pxtValue.toFixed(3) : "-";
          })()}
        </div>
      )}
      <div className={styles.cell}>{getEvents()}</div>
      <div className={styles.cellActions}>
        {onEdit && (
          <button 
            onClick={() => onEdit(action)} 
            className={styles.editBtn} 
            title="Edytuj akcję"
          >
            ✎
          </button>
        )}
        <button onClick={() => onDelete(action.id)} className={styles.deleteBtn} title="Usuń akcję">
          ✕
        </button>
      </div>
    </div>
  );
};

// Komponent główny
const ActionsTable: React.FC<ActionsTableProps> = ({
  actions,
  players,
  onDeleteAction,
  onEditAction,
  onRefreshPlayersData,
  youtubeVideoRef,
  customVideoRef,
  actionCategory = "packing"
}) => {
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({
    key: "minute",
    direction: "asc",
  });

  // Używamy PxT na stałe
  const selectedMetric = 'pxt';
  
  // State dla filtrowania trybu akcji - dla packing używamy attack/defense, dla regain/loses używamy regain/loses
  // Zapamiętujemy ostatni wybór w localStorage
  const [actionModeFilter, setActionModeFilter] = useState<'attack' | 'defense' | 'regain' | 'loses'>(() => {
    if (actionCategory === "regain" || actionCategory === "loses") {
      // Przywróć ostatni wybór z localStorage lub użyj domyślnej wartości
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`actionModeFilter_${actionCategory}`);
        if (saved === 'regain' || saved === 'loses') {
          return saved;
        }
      }
      return actionCategory;
    } else {
      // Dla packing przywróć ostatni wybór lub użyj 'attack'
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('actionModeFilter_packing');
        if (saved === 'attack' || saved === 'defense') {
          return saved;
        }
      }
      return 'attack';
    }
  });

  // Synchronizuj actionModeFilter z actionCategory i zapisuj wybór w localStorage
  useEffect(() => {
    if (actionCategory === "regain" || actionCategory === "loses") {
      // Jeśli actionModeFilter nie jest zgodny z actionCategory, zsynchronizuj go
      if (actionModeFilter !== 'regain' && actionModeFilter !== 'loses') {
        // Przywróć ostatni wybór z localStorage lub użyj actionCategory
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(`actionModeFilter_${actionCategory}`);
          if (saved === 'regain' || saved === 'loses') {
            setActionModeFilter(saved);
          } else {
            setActionModeFilter(actionCategory);
          }
        } else {
      setActionModeFilter(actionCategory);
        }
      } else {
        // Zapisz wybór w localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(`actionModeFilter_${actionCategory}`, actionModeFilter);
        }
      }
    } else {
      // Dla packing zapisz wybór
      if (typeof window !== 'undefined' && (actionModeFilter === 'attack' || actionModeFilter === 'defense')) {
        localStorage.setItem('actionModeFilter_packing', actionModeFilter);
      }
    }
  }, [actionCategory, actionModeFilter]);

  // Dodajemy state do śledzenia, czy jakieś akcje mają brakujące dane graczy
  const [hasMissingPlayerData, setHasMissingPlayerData] = useState(false);

  // Sprawdzamy czy jakieś akcje mają brakujące dane graczy
  useEffect(() => {
    if (!actions || !actions.length) return;

    const missingData = actions.some(
      action => 
        (!action.senderName && action.senderId) || 
        (action.actionType === "pass" && !action.receiverName && action.receiverId)
    );
    
    setHasMissingPlayerData(missingData);
  }, [actions]);

  // Funkcja do obsługi kliknięcia na czas wideo
  const handleVideoTimeClick = async (videoTimestamp?: number) => {
    if (!videoTimestamp) return;
    
    console.log('handleVideoTimeClick - videoTimestamp:', videoTimestamp);
    console.log('handleVideoTimeClick - youtubeVideoRef:', youtubeVideoRef);
    console.log('handleVideoTimeClick - customVideoRef:', customVideoRef);
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo (sprawdzamy bezpośrednio externalWindow, a nie localStorage)
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    if (isExternalWindowOpen) {
      console.log('handleVideoTimeClick - używam zewnętrznego okna');
      // Wyślij wiadomość do zewnętrznego okna
      try {
        externalWindow.postMessage({
          type: 'SEEK_TO_TIME',
          time: videoTimestamp
        }, '*');
        console.log('handleVideoTimeClick - wiadomość wysłana do zewnętrznego okna');
      } catch (error) {
        console.error('handleVideoTimeClick - błąd podczas wysyłania wiadomości:', error);
      }
    } else if (youtubeVideoRef?.current) {
      console.log('handleVideoTimeClick - używam youtubeVideoRef, current:', youtubeVideoRef.current);
      try {
        await youtubeVideoRef.current.seekTo(videoTimestamp);
        console.log('handleVideoTimeClick - youtubeVideoRef.seekTo zakończone');
      } catch (error) {
        console.warn('Nie udało się przewinąć wideo do czasu:', videoTimestamp, error);
        // Spróbuj ponownie po krótkim czasie
        setTimeout(async () => {
          if (youtubeVideoRef?.current) {
            try {
              await youtubeVideoRef.current.seekTo(videoTimestamp);
              console.log('handleVideoTimeClick - youtubeVideoRef.seekTo (retry) zakończone');
            } catch (retryError) {
              console.warn('Nie udało się przewinąć wideo do czasu (retry):', videoTimestamp, retryError);
            }
          }
        }, 500);
      }
    } else if (customVideoRef?.current) {
      console.log('handleVideoTimeClick - używam customVideoRef');
      try {
        await customVideoRef.current.seekTo(videoTimestamp);
        console.log('handleVideoTimeClick - customVideoRef.seekTo zakończone');
      } catch (error) {
        console.warn('Nie udało się przewinąć własnego odtwarzacza do czasu:', videoTimestamp, error);
      }
    } else {
      console.warn('handleVideoTimeClick - brak dostępnego playera (youtubeVideoRef:', youtubeVideoRef, ', customVideoRef:', customVideoRef, ')');
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prevSort) => ({
      key,
      direction:
        prevSort.key === key && prevSort.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Posortowane akcje z wykorzystaniem useMemo dla optymalizacji wydajności
  const sortedActions = useMemo(() => {
    // Filtrujemy akcje według trybu lub kategorii
    const filteredActions = actions.filter(action => {
      if (actionCategory === "regain" || actionCategory === "loses") {
        // Dla regain/loses używamy funkcji getActionCategory do identyfikacji kategorii akcji
        const actionCat = getActionCategory(action);
        // Sprawdzamy, czy actionModeFilter jest 'regain' lub 'loses' (nie 'attack' lub 'defense')
        if (actionModeFilter === 'regain' || actionModeFilter === 'loses') {
          return actionCat === actionModeFilter;
        }
        // Fallback: jeśli actionModeFilter nie jest poprawny, użyj actionCategory
        return actionCat === actionCategory;
      } else {
        // Dla packing filtrujemy po trybie (attack/defense)
        const actionMode = action.mode || 'attack';
        return actionMode === actionModeFilter;
      }
    });
    
    const result = [...filteredActions];
    const { key, direction } = sortConfig;
    const multiplier = direction === "asc" ? 1 : -1;

    return result.sort((a, b) => {
      let comparison = 0;

      switch (key) {
        case "minute":
          // Najpierw sortujemy po połowie, a potem po minucie
          if ((a.isSecondHalf === true) !== (b.isSecondHalf === true)) {
            return (a.isSecondHalf === true ? 1 : -1) * (direction === "asc" ? 1 : -1);
          }
          comparison = a.minute - b.minute;
          break;
        case "sender":
          comparison = `${a.senderNumber}-${a.senderName}`.localeCompare(
            `${b.senderNumber}-${b.senderName}`
          );
          break;
        case "senderXT":
          comparison = (a.xTValueStart || 0) - (b.xTValueStart || 0);
          break;
        case "startZone":
          comparison = (a.startZone || "").localeCompare(b.startZone || "");
          break;
        case "receiver":
          comparison = `${a.receiverNumber}-${a.receiverName}`.localeCompare(
            `${b.receiverNumber}-${b.receiverName}`
          );
          break;
        case "receiverXT":
          comparison = (a.xTValueEnd || 0) - (b.xTValueEnd || 0);
          break;
        case "endZone":
          comparison = (a.endZone || "").localeCompare(b.endZone || "");
          break;
        case "type":
          comparison = a.actionType.localeCompare(b.actionType);
          break;
        case "xt": {
          // Sortowanie według różnicy xT (xTEnd - xTStart)
          const getXTDifference = (action: any) => {
            const xTStart = action.xTValueStart || 0;
            const xTEnd = action.xTValueEnd || 0;
            return xTEnd - xTStart;
          };
          comparison = getXTDifference(a) - getXTDifference(b);
          break;
        }
        case "packing":
          comparison = (a.packingPoints || 0) - (b.packingPoints || 0);
          break;
        case "pxt": {
          // Sortowanie według obliczonej wartości PxT
          const getPxTValue = (action: any) => {
            const xTStart = action.xTValueStart || 0;
            const xTEnd = action.xTValueEnd || 0;
            const packingPoints = action.packingPoints || 0;
            return (xTEnd - xTStart) * packingPoints;
          };
          comparison = getPxTValue(a) - getPxTValue(b);
          break;
        }
        case "events": {
          // Sortowanie według ważności zdarzeń: Goal > Shot > PK > P3
          const getEventPriority = (action: any) => {
            let priority = 0;
            if (action.isGoal) priority += 8;
            if (action.isShot) priority += 4;
            if (action.isPenaltyAreaEntry) priority += 2;
            if (action.isP3) priority += 1;
            return priority;
          };
          comparison = getEventPriority(a) - getEventPriority(b);
          break;
        }
        case "videoTimestamp":
          comparison = (a.videoTimestamp || 0) - (b.videoTimestamp || 0);
          break;
      }

      return comparison * multiplier;
    });
  }, [actions, sortConfig, actionModeFilter, actionCategory]);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.headerControls}>
        <h3>Lista akcji ({actions.length})</h3>
        <div className={styles.headerButtons}>
          
          {/* Przełącznik trybu akcji */}
          {actionCategory === "regain" || actionCategory === "loses" ? (
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeButton} ${actionModeFilter === 'regain' ? styles.active : ''}`}
                onClick={() => setActionModeFilter('regain')}
              >
                Regain
              </button>
              <button
                className={`${styles.modeButton} ${actionModeFilter === 'loses' ? styles.active : ''}`}
                onClick={() => setActionModeFilter('loses')}
              >
                Loses
              </button>
            </div>
          ) : (
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeButton} ${actionModeFilter === 'attack' ? styles.active : ''}`}
                onClick={() => setActionModeFilter('attack')}
              >
                Packing
              </button>
              <button
                className={`${styles.modeButton} ${actionModeFilter === 'defense' ? styles.active : ''}`}
                onClick={() => setActionModeFilter('defense')}
              >
                Unpacking
              </button>
            </div>
          )}
          
          {hasMissingPlayerData && onRefreshPlayersData && (
            <button
              className={styles.refreshButton}
              onClick={onRefreshPlayersData}
              title="Odśwież dane zawodników w akcjach"
            >
              <span>↻</span> Uzupełnij dane
            </button>
          )}
        </div>
      </div>

      <div className={styles.matchesTable}>
        <div 
          className={styles.tableHeader}
          style={{
            gridTemplateColumns: (() => {
              // Dla regain i loses: 10 kolumn (bez "Zawodnik koniec" i "PxT", z "Partnerzy przed piłką" i "Atak xT")
              if (actionCategory === "regain" || actionCategory === "loses") {
                return "1fr 80px 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 80px";
              }
              // Dla packing: 10 kolumn (z "Zawodnik koniec" i "PxT", bez "Partnerzy przed piłką")
              if (actionModeFilter === 'attack') {
                return "1fr 80px 0.8fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 80px";
              }
              // Dla defense: 9 kolumn (bez "Zawodnik koniec")
              return "1fr 80px 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 80px";
            })()
          }}
        >
          <HeaderCell
            label="Połowa / Min"
            sortKey="minute"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label="Czas wideo"
            sortKey="videoTimestamp"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label={actionModeFilter === 'defense' ? "Zawodnicy minięci" : "Zawodnik start"}
            sortKey="sender"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          {/* Ukryj kolumnę "Zawodnik koniec" dla regain i loses */}
          {actionModeFilter === 'attack' && actionCategory === "packing" && (
            <HeaderCell
              label="Zawodnik koniec"
              sortKey="receiver"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
          )}
          <HeaderCell
            label="Typ"
            sortKey="type"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label={actionCategory === "regain" || actionCategory === "loses" ? "Obrona xT" : "xT"}
            sortKey="xt"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          {/* Dla regain i loses dodajemy kolumnę "Atak xT" */}
          {(actionCategory === "regain" || actionCategory === "loses") && (
            <HeaderCell
              label="Atak xT"
              sortKey="oppositeXT"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
          )}
          <HeaderCell
            label={actionCategory === "regain" || actionCategory === "loses" ? "Liczba zawodników (przed/za) piłką" : "Packing"}
            sortKey="packing"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          {/* Dla regain i loses dodajemy kolumnę "Partnerzy przed piłką" */}
          {(actionCategory === "regain" || actionCategory === "loses") && (
            <HeaderCell
              label="Partnerzy (przed/za) piłką"
              sortKey="playersBehindBall"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
          )}
          {/* Ukryj kolumnę PxT dla regain i loses */}
          {actionCategory === "packing" && (
            <HeaderCell
              label="PxT"
              sortKey="pxt"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
          )}
          <HeaderCell
            label="Wydarzenia"
            sortKey="events"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <div className={styles.headerCell}>Akcje</div>
        </div>
        <div className={styles.tableBody}>
          {sortedActions.length === 0 ? (
            <div className={styles.noActions}>Brak akcji</div>
          ) : (
            sortedActions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                onDelete={onDeleteAction || (() => {})}
                onEdit={onEditAction}
                onVideoTimeClick={handleVideoTimeClick}
                selectedMetric={selectedMetric}
                actionModeFilter={actionModeFilter}
                players={players || []}
                actionCategory={actionCategory}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionsTable;
