// src/components/SummarySection/SummarySection.tsx
"use client";

import React, { useState, useMemo, useCallback, memo } from "react";
import { SummarySectionProps } from "@/types";
import PlayerStats from "@/components/PlayerStats/PlayerStats";
import styles from "./SummarySection.module.css";

// Korzystamy z typu Player z propsów
type Player = SummarySectionProps["players"][0];

// Interfejs dla zagregowanych statystyk zawodnika
interface PlayerSummary {
  player: Player;
  xtAsSender: number;
  xtAsReceiver: number;
  xtPerActionAsSender: number;
  xtPerActionAsReceiver: number;
  pxtValue: number;
  actionsAsSenderCount: number;
  actionsAsReceiverCount: number;
}

// Wydzielone funkcje pomocnicze
const getValueFromAction = (
  action: any,
  propertyPrefixes: string[],
  defaultValue: number
): number => {
  try {
    // Sprawdź bezpośrednie właściwości
    for (const prefix of propertyPrefixes) {
      if (typeof action[prefix] === "number") return action[prefix];

      // Sprawdź zagnieżdżone obiekty
      if (action.data?.[prefix] !== undefined) return action.data[prefix];
      if (action.metrics?.[prefix] !== undefined) return action.metrics[prefix];

      // Sprawdź metody
      const methodName = `get${
        prefix.charAt(0).toUpperCase() + prefix.slice(1)
      }`;
      if (typeof action[methodName] === "function") return action[methodName]();
    }

    // Szukaj podobnych nazw właściwości
    const keys = Object.keys(action);
    for (const key of keys) {
      if (
        typeof action[key] === "number" &&
        propertyPrefixes.some((prefix) =>
          key.toLowerCase().includes(prefix.toLowerCase())
        )
      ) {
        return action[key];
      }
    }

    return defaultValue;
  } catch (e) {
    console.error(`Error getting value: ${e}`);
    return defaultValue;
  }
};

const getXT = (action: any): number =>
  getValueFromAction(
    action,
    ["expectedThreat", "xT", "value", "points", "threat"],
    0
  );

const getPacking = (action: any): number =>
  getValueFromAction(
    action,
    ["packing", "packingValue", "packingFactor", "bypass"],
    1
  );

// Memoizowany komponent ikony sortowania
const SortIcon = memo(
  ({
    column,
    sortBy,
    sortDirection,
  }: {
    column: string;
    sortBy: string;
    sortDirection: "asc" | "desc";
  }) => (sortBy === column ? (sortDirection === "asc" ? " ↑" : " ↓") : "")
);

SortIcon.displayName = "SortIcon";

// Memoizowany komponent nagłówka tabeli
const TableHeader = memo(
  ({
    sortBy,
    sortDirection,
    onSort,
  }: {
    sortBy: string;
    sortDirection: "asc" | "desc";
    onSort: (column: any) => void;
  }) => {
    // Funkcja mapująca nasz wewnętrzny format sortowania na format ARIA
    const getAriaSortValue = (
      column: string
    ): "ascending" | "descending" | undefined => {
      if (sortBy !== column) return undefined;
      return sortDirection === "asc" ? "ascending" : "descending";
    };

    return (
      <thead>
        <tr>
          <th
            onClick={() => onSort("player.number")}
            role="columnheader"
            aria-sort={getAriaSortValue("player.number")}
          >
            #{" "}
            <SortIcon
              column="player.number"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("player.name")}
            role="columnheader"
            aria-sort={getAriaSortValue("player.name")}
          >
            Zawodnik{" "}
            <SortIcon
              column="player.name"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("actionsAsSenderCount")}
            role="columnheader"
            aria-sort={getAriaSortValue("actionsAsSenderCount")}
          >
            Podający{" "}
            <SortIcon
              column="actionsAsSenderCount"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("actionsAsReceiverCount")}
            role="columnheader"
            aria-sort={getAriaSortValue("actionsAsReceiverCount")}
          >
            Przyjmujący{" "}
            <SortIcon
              column="actionsAsReceiverCount"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("xtAsSender")}
            role="columnheader"
            aria-sort={getAriaSortValue("xtAsSender")}
          >
            xT podający{" "}
            <SortIcon
              column="xtAsSender"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("xtAsReceiver")}
            role="columnheader"
            aria-sort={getAriaSortValue("xtAsReceiver")}
          >
            xT przyjmujący{" "}
            <SortIcon
              column="xtAsReceiver"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("xtPerActionAsSender")}
            role="columnheader"
            aria-sort={getAriaSortValue("xtPerActionAsSender")}
          >
            xT/akcję podający{" "}
            <SortIcon
              column="xtPerActionAsSender"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("xtPerActionAsReceiver")}
            role="columnheader"
            aria-sort={getAriaSortValue("xtPerActionAsReceiver")}
          >
            xT/akcję przyjmujący{" "}
            <SortIcon
              column="xtPerActionAsReceiver"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
          <th
            onClick={() => onSort("pxtValue")}
            role="columnheader"
            aria-sort={getAriaSortValue("pxtValue")}
          >
            PxT{" "}
            <SortIcon
              column="pxtValue"
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </th>
        </tr>
      </thead>
    );
  }
);

TableHeader.displayName = "TableHeader";

const SummarySection: React.FC<SummarySectionProps> = ({
  selectedPlayerId,
  players,
  actions,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<
    keyof PlayerSummary | "player.name" | "player.number"
  >("xtAsSender");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Obsługa wyszukiwania - zoptymalizowana z useCallback
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    []
  );

  // Wyświetl surowe dane przykładowej akcji
  const sampleAction = actions.length > 0 ? actions[0] : null;

  // Obliczenie statystyk dla każdego zawodnika
  const playerStats = useMemo(
    () =>
      players.map((player) => {
        const actionsAsSender = actions.filter((a) => a.senderId === player.id);
        const actionsAsReceiver = actions.filter(
          (a) => a.receiverId === player.id
        );

        // Agregacja wartości
        const { totalXtAsSender, totalPxt } = actionsAsSender.reduce(
          (acc, action) => {
            const xt = getXT(action);
            const packing = getPacking(action);
            return {
              totalXtAsSender: acc.totalXtAsSender + xt,
              totalPxt: acc.totalPxt + packing * xt,
            };
          },
          { totalXtAsSender: 0, totalPxt: 0 }
        );

        const totalXtAsReceiver = actionsAsReceiver.reduce(
          (sum, action) => sum + getXT(action),
          0
        );

        return {
          player,
          xtAsSender: totalXtAsSender,
          xtAsReceiver: totalXtAsReceiver,
          xtPerActionAsSender: actionsAsSender.length
            ? totalXtAsSender / actionsAsSender.length
            : 0,
          xtPerActionAsReceiver: actionsAsReceiver.length
            ? totalXtAsReceiver / actionsAsReceiver.length
            : 0,
          pxtValue: totalPxt,
          actionsAsSenderCount: actionsAsSender.length,
          actionsAsReceiverCount: actionsAsReceiver.length,
        };
      }),
    [players, actions]
  );

  // Funkcja pomocnicza do pobierania wartości - zoptymalizowana z useCallback
  const getCompareValue = useCallback((obj: any, path: string) => {
    if (path.includes(".")) {
      const [first, second] = path.split(".");
      return obj[first][second];
    }
    return obj[path];
  }, []);

  // Filtrowanie i sortowanie
  const filteredAndSortedStats = useMemo(() => {
    const filtered = playerStats.filter((stat) =>
      stat.player.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      const valueA = getCompareValue(a, sortBy);
      const valueB = getCompareValue(b, sortBy);

      if (typeof valueA === "string" && typeof valueB === "string") {
        return sortDirection === "asc"
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      return sortDirection === "asc"
        ? (valueA as number) - (valueB as number)
        : (valueB as number) - (valueA as number);
    });
  }, [playerStats, searchTerm, sortBy, sortDirection, getCompareValue]);

  // Obsługa kliknięcia nagłówka kolumny - zoptymalizowana z useCallback
  const handleSort = useCallback(
    (column: keyof PlayerSummary | "player.name" | "player.number") => {
      setSortDirection(
        sortBy === column ? (sortDirection === "asc" ? "desc" : "asc") : "desc"
      );
      setSortBy(column);
    },
    [sortBy, sortDirection]
  );

  // Obsługa wyboru zawodnika - zoptymalizowana z useCallback
  const handlePlayerSelect = useCallback((playerId: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("selectPlayer", { detail: playerId })
      );
    }
  }, []);

  // Obsługa naciśnięcia klawisza dla wiersza tabeli
  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, playerId: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handlePlayerSelect(playerId);
      }
    },
    [handlePlayerSelect]
  );

  return (
    <div className={styles.summaryContainer}>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Szukaj zawodnika..."
          value={searchTerm}
          onChange={handleSearchChange}
          className={styles.searchInput}
          aria-label="Szukaj zawodnika"
        />
      </div>

      <div className={styles.debugInfo}>
        <p>
          Dane: {players.length} zawodników, {actions.length} akcji
        </p>
        {sampleAction && (
          <details>
            <summary>Przykładowa akcja (rozwiń)</summary>
            <pre>{JSON.stringify(sampleAction, null, 2)}</pre>
          </details>
        )}
      </div>

      <div className={styles.statsTableContainer}>
        <table className={styles.statsTable} role="grid">
          <TableHeader
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <tbody>
            {filteredAndSortedStats.map(({ player, ...stats }) => (
              <tr
                key={player.id}
                className={
                  selectedPlayerId === player.id ? styles.selectedRow : ""
                }
                onClick={() => handlePlayerSelect(player.id)}
                onKeyDown={(e) => handleRowKeyDown(e, player.id)}
                tabIndex={0}
                role="row"
                aria-selected={selectedPlayerId === player.id}
              >
                <td role="cell">{player.number || "-"}</td>
                <td role="cell">{player.name}</td>
                <td role="cell">{stats.actionsAsSenderCount}</td>
                <td role="cell">{stats.actionsAsReceiverCount}</td>
                <td role="cell">{stats.xtAsSender.toFixed(2)}</td>
                <td role="cell">{stats.xtAsReceiver.toFixed(2)}</td>
                <td role="cell">{stats.xtPerActionAsSender.toFixed(3)}</td>
                <td role="cell">{stats.xtPerActionAsReceiver.toFixed(3)}</td>
                <td role="cell">{stats.pxtValue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPlayerId && (
        <div className={styles.playerDetails}>
          <PlayerStats
            player={players.find((p) => p.id === selectedPlayerId)!}
            actions={actions.filter(
              (a) =>
                a.senderId === selectedPlayerId ||
                a.receiverId === selectedPlayerId
            )}
          />
        </div>
      )}
    </div>
  );
};

export default SummarySection;
