// src/components/SummarySection/SummarySection.tsx
"use client";

import React, { useState, useMemo } from "react";
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

// Komponent nagłówka tabeli
const TableHeader = ({
  sortBy,
  sortDirection,
  onSort,
}: {
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (column: any) => void;
}) => {
  const SortIcon = ({ column }: { column: string }) =>
    sortBy === column ? (sortDirection === "asc" ? " ↑" : " ↓") : "";

  return (
    <thead>
      <tr>
        <th onClick={() => onSort("player.number")}>
          # <SortIcon column="player.number" />
        </th>
        <th onClick={() => onSort("player.name")}>
          Zawodnik <SortIcon column="player.name" />
        </th>
        <th onClick={() => onSort("actionsAsSenderCount")}>Podający</th>
        <th onClick={() => onSort("actionsAsReceiverCount")}>Odbierający</th>
        <th onClick={() => onSort("xtAsSender")}>
          xT podający <SortIcon column="xtAsSender" />
        </th>
        <th onClick={() => onSort("xtAsReceiver")}>
          xT przyjmujący <SortIcon column="xtAsReceiver" />
        </th>
        <th onClick={() => onSort("xtPerActionAsSender")}>
          xT/akcję podający <SortIcon column="xtPerActionAsSender" />
        </th>
        <th onClick={() => onSort("xtPerActionAsReceiver")}>
          xT/akcję przyjmujący <SortIcon column="xtPerActionAsReceiver" />
        </th>
        <th onClick={() => onSort("pxtValue")}>
          PxT <SortIcon column="pxtValue" />
        </th>
      </tr>
    </thead>
  );
};

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

  // Filtrowanie i sortowanie
  const filteredAndSortedStats = useMemo(() => {
    const filtered = playerStats.filter((stat) =>
      stat.player.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      const getCompareValue = (obj: any, path: string) => {
        if (path.includes(".")) {
          const [first, second] = path.split(".");
          return obj[first][second];
        }
        return obj[path];
      };

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
  }, [playerStats, searchTerm, sortBy, sortDirection]);

  // Obsługa kliknięcia nagłówka kolumny
  const handleSort = (
    column: keyof PlayerSummary | "player.name" | "player.number"
  ) => {
    setSortDirection(
      sortBy === column ? (sortDirection === "asc" ? "desc" : "asc") : "desc"
    );
    setSortBy(column);
  };

  // Obsługa wyboru zawodnika - bezpieczna dla SSR
  const handlePlayerSelect = (playerId: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("selectPlayer", { detail: playerId })
      );
    }
  };

  return (
    <div className={styles.summaryContainer}>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Szukaj zawodnika..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
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
        <table className={styles.statsTable}>
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
              >
                <td>{player.number || "-"}</td>
                <td>{player.name}</td>
                <td>{stats.actionsAsSenderCount}</td>
                <td>{stats.actionsAsReceiverCount}</td>
                <td>{stats.xtAsSender.toFixed(2)}</td>
                <td>{stats.xtAsReceiver.toFixed(2)}</td>
                <td>{stats.xtPerActionAsSender.toFixed(3)}</td>
                <td>{stats.xtPerActionAsReceiver.toFixed(3)}</td>
                <td>{stats.pxtValue.toFixed(2)}</td>
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
