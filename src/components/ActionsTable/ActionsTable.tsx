// src/components/ActionsTable/ActionsTable.tsx
"use client";

import React, { useMemo, useState } from "react";
import styles from "./ActionsTable.module.css";
import { ActionsTableProps } from "@/components/ActionsTable/ActionsTable.types";

type SortKey =
  | "minute"
  | "sender"
  | "senderXT"
  | "receiver"
  | "receiverXT"
  | "type"
  | "packing"
  | "events";

type SortDirection = "asc" | "desc";

// Komponent nagłówka kolumny z sortowaniem
const SortableHeader = ({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) => {
  const getSortIcon = () => {
    if (currentSortKey !== sortKey) return "↕️";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  return (
    <th onClick={() => onSort(sortKey)} className={styles.sortable}>
      {label} {getSortIcon()}
    </th>
  );
};

// Komponent wiersza akcji
const ActionRow = ({
  action,
  onDelete,
}: {
  action: ActionsTableProps["actions"][0];
  onDelete: (id: string) => void;
}) => {
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

  return (
    <tr>
      <td>{action.minute}&apos;</td>
      <td>
        {action.senderNumber}-{action.senderName}
      </td>
      <td>{action.senderClickValue.toFixed(3)}</td>
      <td>
        {action.receiverNumber}-{action.receiverName}
      </td>
      <td>{action.receiverClickValue.toFixed(3)}</td>
      <td>{action.actionType === "pass" ? "Podanie" : "Drybling"}</td>
      <td>{action.packingPoints ? Math.round(action.packingPoints) : "-"}</td>
      <td>{getEvents()}</td>
      <td className={styles.actionCell}>
        <div onClick={() => onDelete(action.id)} className={styles.x}>
          &times;
        </div>
      </td>
    </tr>
  );
};

// Komponent główny
const ActionsTable: React.FC<ActionsTableProps> = ({
  actions,
  onDeleteAction,
  onDeleteAllActions,
}) => {
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
          comparison = a.minute - b.minute;
          break;
        case "sender":
          comparison = `${a.senderNumber}-${a.senderName}`.localeCompare(
            `${b.senderNumber}-${b.senderName}`
          );
          break;
        case "senderXT":
          comparison = a.senderClickValue - b.senderClickValue;
          break;
        case "receiver":
          comparison = `${a.receiverNumber}-${a.receiverName}`.localeCompare(
            `${b.receiverNumber}-${b.receiverName}`
          );
          break;
        case "receiverXT":
          comparison = a.receiverClickValue - b.receiverClickValue;
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
  }, [actions, sortConfig]);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <h3>Lista akcji ({actions.length})</h3>
        <button
          className={styles.deleteAllButton}
          onClick={onDeleteAllActions}
          disabled={actions.length === 0}
        >
          <span>✕</span> Usuń wszystkie akcje
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <SortableHeader
              label="Minuta"
              sortKey="minute"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <SortableHeader
              label="Podający"
              sortKey="sender"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <SortableHeader
              label="xT Podanie"
              sortKey="senderXT"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <SortableHeader
              label="Przyjmujący"
              sortKey="receiver"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <SortableHeader
              label="xT Przyjęcie"
              sortKey="receiverXT"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <SortableHeader
              label="Typ"
              sortKey="type"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <SortableHeader
              label="Packing"
              sortKey="packing"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <SortableHeader
              label="Wydarzenia"
              sortKey="events"
              currentSortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={handleSort}
            />
            <th>Usuń</th>
          </tr>
        </thead>
        <tbody>
          {sortedActions.length > 0 ? (
            sortedActions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                onDelete={onDeleteAction || (() => {})}
              />
            ))
          ) : (
            <tr>
              <td colSpan={9} style={{ textAlign: "center", padding: "20px" }}>
                Brak akcji do wyświetlenia
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ActionsTable;
