// src/components/ActionsTable/ActionsTable.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./ActionsTable.module.css";
import { ActionsTableProps, ActionsTableAction } from "./ActionsTable.types";

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
  | "events";

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
  players = [],
}: {
  action: ActionsTableAction;
  onDelete: (id: string) => void;
  players: ActionsTableProps["players"];
}) => {
  // Wyraźne logowanie dla każdego wiersza
  console.log(`🔍 ActionRow dla akcji ID=${action.id}:`, {
    senderId: action.senderId,
    ilośćZawodników: players?.length,
    daneZawodników: players?.slice(0, 3).map(p => `${p.id}:${p.number}-${p.name}`),
  });
  
  // Znajdujemy zawodników na podstawie ID - z pełnym logowaniem
  const sender = players?.find(p => p.id === action.senderId);
  console.log(`Zawodnik startowy dla akcji ${action.id}:`, 
    sender ? `✅ Znaleziono: ${sender.number}-${sender.name}` : `❌ Nie znaleziono zawodnika o ID: ${action.senderId}`);
  
  const receiver = action.receiverId ? players?.find(p => p.id === action.receiverId) : null;
  if (action.receiverId) {
    console.log(`Zawodnik końcowy dla akcji ${action.id}:`, 
      receiver ? `✅ Znaleziono: ${receiver.number}-${receiver.name}` : `❌ Nie znaleziono zawodnika o ID: ${action.receiverId}`);
  }
  
  // TYMCZASOWE ROZWIĄZANIE: Jeśli lista zawodników jest pusta lub nie znaleziono zawodników,
  // sprawdzamy czy istnieją dane w samej akcji i priorytetowo je wyświetlamy
  
  // Pełna logika z wieloma fallbackami na wypadek braku danych
  let senderDisplay;
  if (sender) {
    // 1. Priorytet: Dane z listy players
    senderDisplay = `${sender.number ? sender.number + '-' : ''}${sender.name}`;
  } else if (action.senderName) {
    // 2. Fallback: Dane bezpośrednio z akcji
    senderDisplay = action.senderNumber 
      ? `${action.senderNumber}-${action.senderName}` 
      : action.senderName;
  } else {
    // 3. Ostateczny fallback: ID z czerwonym ostrzeżeniem
    senderDisplay = `⚠️ ${action.senderId || "-"}`;
  }
  
  // Podobna logika dla odbiorcy
  let receiverDisplay;
  if (action.actionType === "pass") {
    if (receiver) {
      // 1. Priorytet: Dane z listy players
      receiverDisplay = `${receiver.number ? receiver.number + '-' : ''}${receiver.name}`;
    } else if (action.receiverName) {
      // 2. Fallback: Dane bezpośrednio z akcji
      receiverDisplay = action.receiverNumber 
        ? `${action.receiverNumber}-${action.receiverName}` 
        : action.receiverName;
    } else {
      // 3. Ostateczny fallback: ID z czerwonym ostrzeżeniem
      receiverDisplay = `⚠️ ${action.receiverId || "-"}`;
    }
  } else {
    // Dla dryblingu to ten sam zawodnik
    receiverDisplay = senderDisplay;
  }
  
  const getEvents = () => {
    const events = [];
    if (action.isP3) events.push("P3");
    if (action.isPenaltyAreaEntry) events.push("PK");
    if (action.isShot) {
      events.push(action.isGoal ? "S+G" : "S");
    } else if (action.isGoal) {
      events.push("G");
    }
    
    return events.length > 0 ? events.join(", ") : "-";
  };
  
  // Określamy, czy akcja jest w drugiej połowie
  const isSecondHalf = action.isSecondHalf === true;

  return (
    <div className={`${styles.actionRow} ${isSecondHalf ? styles.secondHalfRow : styles.firstHalfRow}`}>
      <div className={styles.cell}>
        <span className={isSecondHalf ? styles.secondHalf : styles.firstHalf}>
          {isSecondHalf ? 'P2' : 'P1'}
        </span>
        &nbsp;{action.minute}'
      </div>
      <div className={styles.cell}>{senderDisplay}</div>
      <div className={styles.cell}>{typeof action.xTValueStart === 'number' ? action.xTValueStart.toFixed(3) : '0.000'}</div>
      <div className={styles.cell}>{receiverDisplay}</div>
      <div className={styles.cell}>{typeof action.xTValueEnd === 'number' ? action.xTValueEnd.toFixed(3) : '0.000'}</div>
      <div className={styles.cell}>
        <span className={action.actionType === "pass" ? styles.pass : styles.dribble}>
          {action.actionType === "pass" ? "Podanie" : "Drybling"}
        </span>
      </div>
      <div className={styles.cell}>{action.packingPoints ? Math.round(action.packingPoints) : "-"}</div>
      <div className={styles.cell}>{getEvents()}</div>
      <div className={styles.cellActions}>
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
  players = [],
  onDeleteAction,
  onDeleteAllActions,
}) => {
  // Szczegółowe logowanie dla diagnostyki problemu z listą zawodników
  useEffect(() => {
    // Sprawdzamy dokładnie, co otrzymujemy jako dane wejściowe
    console.log(`🔄 ActionsTable otrzymał: ${actions.length} akcji, ${players?.length || 0} zawodników`);
    
    if (!players || players.length === 0) {
      console.warn("⚠️ ActionsTable otrzymał pustą listę zawodników. Nazwy zawodników mogą nie być wyświetlane poprawnie.");
    } else {
      console.log("✅ Lista zawodników:", players.map(p => `${p.id}: ${p.number}-${p.name}`));
      
      // Sprawdźmy zgodność ID między akcjami a listą zawodników
      if (actions.length > 0) {
        const actionPlayerIds = new Set();
        actions.forEach(a => {
          if (a.senderId) actionPlayerIds.add(a.senderId);
          if (a.receiverId) actionPlayerIds.add(a.receiverId);
        });
        
        const playerIds = new Set(players.map(p => p.id));
        
        // Sprawdzamy, czy wszystkie ID zawodników z akcji są w liście zawodników
        const missingIds = [...actionPlayerIds].filter(id => !playerIds.has(id as string));
        
        if (missingIds.length > 0) {
          console.warn(`⚠️ ${missingIds.length} ID zawodników z akcji nie ma w liście zawodników`);
          console.warn("Brakujące ID:", missingIds);
        } else {
          console.log("✅ Wszystkie ID zawodników z akcji znaleziono w liście zawodników");
        }
      }
    }
  }, [actions, players]);

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({
    key: "minute",
    direction: "asc",
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((prevSort) => ({
      key,
      direction:
        prevSort.key === key && prevSort.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Posortowane akcje z wykorzystaniem useMemo dla optymalizacji wydajności
  const sortedActions = useMemo(() => {
    const result = [...actions];
    
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
          // Sortowanie po nazwie zawodnika (z uwzględnieniem listy players)
          const aSender = players?.find(p => p.id === a.senderId)?.name || a.senderName || a.senderId || "";
          const bSender = players?.find(p => p.id === b.senderId)?.name || b.senderName || b.senderId || "";
          comparison = aSender.localeCompare(bSender);
          break;
        case "senderXT":
          comparison = (a.xTValueStart || 0) - (b.xTValueStart || 0);
          break;
        case "startZone":
          comparison = (a.fromZone || "").localeCompare(b.fromZone || "");
          break;
        case "receiver":
          // Analogicznie dla odbiorcy
          const aReceiver = players?.find(p => p.id === a.receiverId)?.name || a.receiverName || a.receiverId || "";
          const bReceiver = players?.find(p => p.id === b.receiverId)?.name || b.receiverName || b.receiverId || "";
          comparison = aReceiver.localeCompare(bReceiver);
          break;
        case "receiverXT":
          comparison = (a.xTValueEnd || 0) - (b.xTValueEnd || 0);
          break;
        case "endZone":
          comparison = (a.toZone || "").localeCompare(b.toZone || "");
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
      }

      return comparison * multiplier;
    });
  }, [actions, sortConfig, players]);

  return (
    <div className={styles.tableContainer}>
      {players?.length === 0 && (
        <div style={{ 
          backgroundColor: '#ffcccc', 
          padding: '10px', 
          marginBottom: '10px', 
          borderRadius: '4px',
          color: '#cc0000',
          fontWeight: 'bold'
        }}>
          Uwaga: Brak danych zawodników! Wyświetlane są tylko ID zamiast nazwisk.
        </div>
      )}
      
      <div className={styles.headerControls}>
        <h3>Lista akcji ({actions.length})</h3>
        <button
          className={styles.deleteAllButton}
          onClick={onDeleteAllActions}
          disabled={actions.length === 0}
        >
          <span>✕</span> Usuń wszystko
        </button>
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
            label="Zawodnik start"
            sortKey="sender"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label="xT start"
            sortKey="senderXT"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label="Zawodnik koniec"
            sortKey="receiver"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label="xT koniec"
            sortKey="receiverXT"
            currentSortKey={sortConfig.key}
            sortDirection={sortConfig.direction}
            onSort={handleSort}
          />
          <HeaderCell
            label="Typ"
            sortKey="type"
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
          <div className={styles.headerCell}>Wydarzenia</div>
          <div className={styles.headerCell}>Usuń</div>
        </div>

        <div className={styles.tableBody}>
          {sortedActions.length > 0 ? (
            sortedActions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                onDelete={onDeleteAction || (() => {})}
                players={players}
              />
            ))
          ) : (
            <div className={styles.noMatches}>
              Brak akcji do wyświetlenia
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionsTable;
