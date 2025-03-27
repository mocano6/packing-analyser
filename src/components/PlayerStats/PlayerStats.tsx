/* components/PlayerStats/PlayerStats.tsx */
"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./PlayerStats.module.css";
import { PlayerStats as Stats, PlayerStatsProps } from "@/types";

// Dodajemy typy dla połączeń i danych używanych w komponentach
interface Connection {
  playerName: string;
  count: number;
  totalPoints: number;
  totalXT: number;
}

interface ConnectionWithId extends Connection {
  id: string;
}

type SortKey = "playerName" | "count" | "totalPoints" | "totalXT";
type SortDirection = "ascending" | "descending";
type ConnectionType = "sender" | "receiver";

interface StatTileProps {
  label: string;
  value: number;
  type: string;
  decimal?: number;
}

interface ConnectionsTableProps {
  data: ConnectionWithId[];
  title: string;
  type: ConnectionType;
  emptyMessage: string;
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ player, actions }) => {
  // Inicjalizacja stanu ze statystykami
  const [stats, setStats] = useState<Stats>({
    totalActions: 0,
    totalPoints: 0,
    totalXT: 0,
    packingAsSender: 0,
    packingAsReceiver: 0,
    xtAsSender: 0,
    xtAsReceiver: 0,
    averagePoints: 0,
    averageXT: 0,
    totalP3: 0,
    totalShots: 0,
    totalGoals: 0,
    connections: {},
    connectionsAsSender: {},
    connectionsAsReceiver: {},
  });

  // Stan dla sortowania
  const [sortConfig, setSortConfig] = useState({
    sender: {
      key: "count" as SortKey,
      direction: "descending" as SortDirection,
    },
    receiver: {
      key: "count" as SortKey,
      direction: "descending" as SortDirection,
    },
  });

  // Funkcja dla wyświetlania ikony sortowania
  const getSortIcon = (key: SortKey, configType: ConnectionType) => {
    const config = sortConfig[configType];
    if (key !== config.key) return null;
    return config.direction === "ascending" ? "▲" : "▼";
  };

  // Obliczanie statystyk - przebudowane, aby uniknąć zależności od stats
  useEffect(() => {
    // Tworzymy nowy obiekt statystyk zamiast modyfikować istniejący
    const newStats: Stats = {
      totalActions: 0,
      totalPoints: 0,
      totalXT: 0,
      packingAsSender: 0,
      packingAsReceiver: 0,
      xtAsSender: 0,
      xtAsReceiver: 0,
      averagePoints: 0,
      averageXT: 0,
      totalP3: 0,
      totalShots: 0,
      totalGoals: 0,
      connections: {},
      connectionsAsSender: {},
      connectionsAsReceiver: {},
    };

    actions.forEach((action) => {
      // Aktualizacja podstawowych statystyk
      newStats.totalActions++;
      newStats.totalPoints += action.packingPoints ?? 0;
      newStats.totalXT += action.totalPoints;

      // Statystyki specjalne
      if (action.isP3) newStats.totalP3++;
      if (action.senderId === player.id) {
        if (action.isShot) newStats.totalShots++;
        if (action.isGoal) newStats.totalGoals++;

        // Statystyki jako nadawca
        newStats.packingAsSender += action.packingPoints ?? 0;
        newStats.xtAsSender += action.totalPoints;

        // Aktualizacja połączeń jako nadawca
        if (action.receiverId) {
          const connectionId = action.receiverId;
          const connectionName = `${action.receiverNumber || ""}-${
            action.receiverName || ""
          }`;

          // Inicjalizacja obiektu połączenia jeśli nie istnieje
          if (!newStats.connectionsAsSender[connectionId]) {
            newStats.connectionsAsSender[connectionId] = {
              playerName: connectionName,
              count: 0,
              totalPoints: 0,
              totalXT: 0,
            };
            newStats.connections[connectionId] = {
              ...newStats.connectionsAsSender[connectionId],
            };
          }

          // Aktualizacja statystyk połączenia
          newStats.connectionsAsSender[connectionId].count++;
          newStats.connectionsAsSender[connectionId].totalPoints +=
            action.packingPoints ?? 0;
          newStats.connectionsAsSender[connectionId].totalXT +=
            action.totalPoints;

          // Aktualizacja dla kompatybilności wstecznej
          newStats.connections[connectionId] = {
            ...newStats.connectionsAsSender[connectionId],
          };
        }
      }

      // Statystyki jako odbiorca
      if (action.receiverId === player.id) {
        newStats.packingAsReceiver += action.packingPoints ?? 0;
        newStats.xtAsReceiver += action.totalPoints;

        if (action.senderId) {
          const connectionId = action.senderId;
          const connectionName = `${action.senderNumber || ""}-${
            action.senderName || ""
          }`;

          // Inicjalizacja obiektu połączenia jeśli nie istnieje
          if (!newStats.connectionsAsReceiver[connectionId]) {
            newStats.connectionsAsReceiver[connectionId] = {
              playerName: connectionName,
              count: 0,
              totalPoints: 0,
              totalXT: 0,
            };
          }

          // Aktualizacja statystyk połączenia
          newStats.connectionsAsReceiver[connectionId].count++;
          newStats.connectionsAsReceiver[connectionId].totalPoints +=
            action.packingPoints ?? 0;
          newStats.connectionsAsReceiver[connectionId].totalXT +=
            action.totalPoints;
        }
      }
    });

    // Obliczanie średnich
    if (newStats.totalActions > 0) {
      newStats.averagePoints = newStats.totalPoints / newStats.totalActions;
      newStats.averageXT = newStats.totalXT / newStats.totalActions;
    }

    setStats(newStats);
  }, [player, actions]); // Nie potrzebujemy stats jako zależności

  // Funkcja sortująca
  const requestSort = (key: SortKey, type: ConnectionType) => {
    setSortConfig((prev) => ({
      ...prev,
      [type]: {
        key,
        direction:
          prev[type].key === key && prev[type].direction === "descending"
            ? "ascending"
            : "descending",
      },
    }));
  };

  // Przygotowanie danych do tabel - przeniesione do useCallback
  const prepareTableData = useCallback(
    (
      connections: Record<string, Connection>,
      configType: ConnectionType
    ): ConnectionWithId[] => {
      const config = sortConfig[configType];
      return Object.entries(connections)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => {
          if (config.key === "playerName") {
            return config.direction === "ascending"
              ? a.playerName.localeCompare(b.playerName)
              : b.playerName.localeCompare(a.playerName);
          }

          const aVal = a[config.key];
          const bVal = b[config.key];

          if (typeof aVal === "number" && typeof bVal === "number") {
            return config.direction === "ascending" ? aVal - bVal : bVal - aVal;
          }
          return 0;
        });
    },
    [sortConfig]
  );

  // Przygotowanie posortowanych danych
  const senderConnections = prepareTableData(
    stats.connectionsAsSender,
    "sender"
  );
  const receiverConnections = prepareTableData(
    stats.connectionsAsReceiver,
    "receiver"
  );

  // Komponent tabeli
  const ConnectionsTable: React.FC<ConnectionsTableProps> = ({
    data,
    title,
    type,
    emptyMessage,
  }) => (
    <>
      <h3 className={styles.connectionsTitle}>{title}</h3>
      {data.length > 0 ? (
        <table className={styles.connectionsTable}>
          <thead>
            <tr>
              <th
                onClick={() => requestSort("playerName", type)}
                className={styles.sortableHeader}
              >
                Zawodnik {getSortIcon("playerName", type)}
              </th>
              <th
                onClick={() => requestSort("count", type)}
                className={styles.sortableHeader}
              >
                Liczba {getSortIcon("count", type)}
              </th>
              <th
                onClick={() => requestSort("totalPoints", type)}
                className={styles.sortableHeader}
              >
                Packing {getSortIcon("totalPoints", type)}
              </th>
              <th
                onClick={() => requestSort("totalXT", type)}
                className={styles.sortableHeader}
              >
                xT {getSortIcon("totalXT", type)}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td>{item.playerName}</td>
                <td>{item.count}</td>
                <td>{item.totalPoints.toFixed(2)}</td>
                <td>{item.totalXT.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.noConnections}>{emptyMessage}</p>
      )}
    </>
  );

  // Komponent kafelka statystyki
  const StatTile: React.FC<StatTileProps> = ({
    label,
    value,
    type,
    decimal = 0,
  }) => (
    <div className={`${styles.statItem} ${styles[type]}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>
        {typeof value === "number" && decimal > 0
          ? value.toFixed(decimal)
          : value}
      </div>
    </div>
  );

  return (
    <div className={styles.statsContainer}>
      <h2 className={styles.playerName}>
        {player.number}-{player.name}
      </h2>

      <div className={styles.statsGrid}>
        <StatTile
          label="Liczba akcji"
          value={stats.totalActions}
          type="basicStat"
        />
        <StatTile
          label="Średni Packing"
          value={stats.averagePoints}
          type="basicStat"
          decimal={2}
        />
        <StatTile
          label="Średni xT"
          value={stats.averageXT}
          type="xtStat"
          decimal={4}
        />
        <StatTile label="Liczba podań P3" value={stats.totalP3} type="p3Stat" />
        <StatTile
          label="Liczba strzałów"
          value={stats.totalShots}
          type="shotStat"
        />
        <StatTile
          label="Liczba bramek"
          value={stats.totalGoals}
          type="goalStat"
        />
        <StatTile
          label="Packing jako nadawca"
          value={stats.packingAsSender}
          type="senderStat"
        />
        <StatTile
          label="xT jako nadawca"
          value={stats.xtAsSender}
          type="senderStat"
          decimal={4}
        />
        <StatTile
          label="Packing jako odbiorca"
          value={stats.packingAsReceiver}
          type="receiverStat"
        />
        <StatTile
          label="xT jako odbiorca"
          value={stats.xtAsReceiver}
          type="receiverStat"
          decimal={4}
        />
      </div>

      <ConnectionsTable
        data={senderConnections}
        title="Połączenia, jako podający"
        type="sender"
        emptyMessage="Brak podań do innych zawodników"
      />

      <ConnectionsTable
        data={receiverConnections}
        title="Połączenia, jako przyjmujący"
        type="receiver"
        emptyMessage="Brak podań od innych zawodników"
      />
    </div>
  );
};

export default PlayerStats;
