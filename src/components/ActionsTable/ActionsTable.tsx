// src/components/ActionsTable/ActionsTable.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./ActionsTable.module.css";
import { ActionsTableProps } from "@/components/ActionsTable/ActionsTable.types";
import { Player } from "@/types";
import { getOppositeXTValueForZone, zoneNameToIndex } from "@/constants/xtValues";

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
          // Dla regain i loses wyświetlamy wartość xT ze strefy (xTValueStart), nie różnicę
          if (actionCategory === "regain" || actionCategory === "loses") {
            const xTValue = action.xTValueStart || 0;
            return typeof xTValue === 'number' ? xTValue.toFixed(3) : "-";
          }
          // Dla packing obliczamy xT różnicę: xTEnd - xTStart
          const xTStart = action.xTValueStart || 0;
          const xTEnd = action.xTValueEnd || 0;
          const xTDifference = xTEnd - xTStart;
          
          return typeof xTDifference === 'number' ? xTDifference.toFixed(3) : "-";
        })()}
      </div>
      {/* Dla regain i loses dodajemy kolumnę "Atak xT" */}
      {(actionCategory === "regain" || actionCategory === "loses") && (
        <div className={styles.cell}>
          {(() => {
            // Obliczamy wartość xT z przeciwległej strony boiska
            const zoneName = action.startZone || action.fromZone;
            if (!zoneName) return "-";
            
            const zoneIndex = zoneNameToIndex(zoneName);
            if (zoneIndex === null) return "-";
            
            const oppositeXT = getOppositeXTValueForZone(zoneIndex);
            return typeof oppositeXT === 'number' ? oppositeXT.toFixed(3) : "-";
          })()}
        </div>
      )}
      <div className={styles.cell}>
        {/* Dla regain i loses wyświetlamy "przed/za piłką" zamiast packingPoints */}
        {actionCategory === "regain" || actionCategory === "loses" ? (
          (() => {
            const opponentsBefore = action.opponentsBeforeBall ?? 0;
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
  const [actionModeFilter, setActionModeFilter] = useState<'attack' | 'defense' | 'regain' | 'loses'>(
    actionCategory === "regain" || actionCategory === "loses" ? actionCategory : 'attack'
  );

  // Synchronizuj actionModeFilter z actionCategory
  useEffect(() => {
    if (actionCategory === "regain" || actionCategory === "loses") {
      setActionModeFilter(actionCategory);
    } else {
      setActionModeFilter('attack');
    }
  }, [actionCategory]);

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
        // Dla regain/loses filtrujemy po kategorii akcji
        if (actionModeFilter === "regain") {
          // Regain: ma playersBehindBall lub opponentsBeforeBall, ale NIE ma isReaction5s
          const hasRegainFields = action.playersBehindBall !== undefined || 
                                  action.opponentsBeforeBall !== undefined ||
                                  action.totalPlayersOnField !== undefined ||
                                  action.totalOpponentsOnField !== undefined ||
                                  action.playersLeftField !== undefined ||
                                  action.opponentsLeftField !== undefined;
          const hasLosesFields = action.isReaction5s !== undefined || 
                                 action.isAut !== undefined || 
                                 action.isReaction5sNotApplicable !== undefined;
          return hasRegainFields && !hasLosesFields;
        } else if (actionModeFilter === "loses") {
          // Loses: ma isReaction5s, isAut lub isReaction5sNotApplicable (którekolwiek z tych pól zdefiniowane)
          // Uwaga: akcje loses mogą mieć również playersBehindBall, opponentsBeforeBall itd.
          // Główny wskaźnik to obecność pól charakterystycznych dla loses
          // Sprawdzamy zarówno undefined (niezdefiniowane) jak i false (zdefiniowane jako false)
          const hasReaction5s = action.isReaction5s !== undefined;
          const hasAut = action.isAut !== undefined;
          const hasNotApplicable = action.isReaction5sNotApplicable !== undefined;
          
          // Jeśli którekolwiek z tych pól jest zdefiniowane (nawet jako false), to jest to akcja loses
          return hasReaction5s || hasAut || hasNotApplicable;
        }
        return false;
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
