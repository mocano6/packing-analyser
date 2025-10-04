// src/components/ActionsTable/ActionsTable.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./ActionsTable.module.css";
import { ActionsTableProps } from "@/components/ActionsTable/ActionsTable.types";
import { Player } from "@/types";

type SortKey =
  | "minute"
  | "sender"
  | "senderXT"
  | "receiver"
  | "receiverXT"
  | "startZone"
  | "endZone"
  | "type"
  | "packing"
  | "pxt"
  | "xt"
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
}: {
  action: ActionsTableProps["actions"][0];
  onDelete: (id: string) => void;
  onEdit?: (action: ActionsTableProps["actions"][0]) => void;
  onVideoTimeClick?: (videoTimestamp?: number) => void;
  selectedMetric: 'packing' | 'pxt' | 'xt';
  actionModeFilter: 'attack' | 'defense';
  players: Player[];
}) => {
  const getEvents = () => {
    const events = [];
    if (action.isP1) events.push("P1");
    if (action.isP2) events.push("P2");
    if (action.isP3) events.push("P3");
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

  return (
    <div className={`${styles.actionRow} ${isSecondHalf ? styles.secondHalfRow : styles.firstHalfRow}`}>
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
      {actionModeFilter === 'attack' && (
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
          console.log('🔍 PxT Debug:', { 
            actionId: action.id, 
            PxT: action.PxT, 
            type: typeof action.PxT,
            xTStart: action.xTValueStart,
            xTEnd: action.xTValueEnd,
            packingPoints: action.packingPoints
          });
          return typeof action.PxT === 'number' ? action.PxT.toFixed(3) : "-";
        })()}
      </div>
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
  youtubeVideoRef
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
  
  // State dla filtrowania trybu akcji
  const [actionModeFilter, setActionModeFilter] = useState<'attack' | 'defense'>('attack');

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
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo
    const externalWindow = window.open('', 'youtube-video');
    if (externalWindow && !externalWindow.closed) {
      // Wyślij wiadomość do zewnętrznego okna
      externalWindow.postMessage({
        type: 'SEEK_TO_TIME',
        time: videoTimestamp
      }, '*');
    } else if (youtubeVideoRef?.current) {
      // Fallback do lokalnego wideo
      try {
        await youtubeVideoRef.current.seekTo(videoTimestamp);
      } catch (error) {
        console.warn('Nie udało się przewinąć wideo do czasu:', videoTimestamp, error);
      }
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
    // Filtrujemy akcje według trybu
    const filteredActions = actions.filter(action => {
      const actionMode = action.mode || 'attack';
      return actionMode === actionModeFilter;
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
        case "packing":
          comparison = (a.packingPoints || 0) - (b.packingPoints || 0);
          break;
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
  }, [actions, sortConfig, actionModeFilter]);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.headerControls}>
        <h3>Lista akcji ({actions.length})</h3>
        <div className={styles.headerButtons}>
          
          {/* Przełącznik trybu akcji */}
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
        <div className={styles.tableHeader}>
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
          {actionModeFilter === 'attack' && (
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
            label="PxT"
            sortKey="pxt"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
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
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionsTable;
