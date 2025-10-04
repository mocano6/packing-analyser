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
  | "xt"
  | "packing"
  | "pxt"
  | "p1p2p3"
  | "contacts"
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
          // Obliczamy xT różnicę: xTEnd - xTStart
          const xTStart = action.xTValueStart || 0;
          const xTEnd = action.xTValueEnd || 0;
          const xTDifference = xTEnd - xTStart;
          
          return typeof xTDifference === 'number' ? xTDifference.toFixed(3) : "-";
        })()}
      </div>
      <div className={styles.cell}>
        {action.packingPoints || 0}
      </div>
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
      <div className={styles.cell}>
        {(() => {
          const pButtons = [];
          if (action.isP1) pButtons.push("P1");
          if (action.isP2) pButtons.push("P2");
          if (action.isP3) pButtons.push("P3");
          return pButtons.length > 0 ? pButtons.join(", ") : "-";
        })()}
      </div>
      <div className={styles.cell}>
        {(() => {
          const contactButtons = [];
          if (action.isContact1) contactButtons.push("1T");
          if (action.isContact2) contactButtons.push("2T");
          if (action.isContact3Plus) contactButtons.push("3T+");
          return contactButtons.length > 0 ? contactButtons.join(", ") : "-";
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
        case "p1p2p3": {
          // Sortowanie według P1, P2, P3
          const getPButtonsPriority = (action: any) => {
            let priority = 0;
            if (action.isP1) priority += 1;
            if (action.isP2) priority += 2;
            if (action.isP3) priority += 4;
            return priority;
          };
          comparison = getPButtonsPriority(a) - getPButtonsPriority(b);
          break;
        }
        case "contacts": {
          // Sortowanie według 1T, 2T, 3T+
          const getContactsPriority = (action: any) => {
            let priority = 0;
            if (action.isContact1) priority += 1;
            if (action.isContact2) priority += 2;
            if (action.isContact3Plus) priority += 4;
            return priority;
          };
          comparison = getContactsPriority(a) - getContactsPriority(b);
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
            label="xT"
            sortKey="xt"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label="Packing"
            sortKey="packing"
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
            label="P1/P2/P3"
            sortKey="p1p2p3"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label="1T/2T/3T+"
            sortKey="contacts"
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
