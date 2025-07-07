// src/components/ExportButton/ExportButton.tsx
"use client";

import React from "react";
import { Player, Action } from "@/types";
import styles from "./ExportButton.module.css";

interface TeamInfo {
  matchId?: string;
  team: string;
  opponent: string;
  isHome: boolean;
  competition: string;
  date: string;
  time?: string;
}

interface ExportButtonProps {
  players: Player[];
  actions: Action[];
  matchInfo: TeamInfo | null;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  players,
  actions,
  matchInfo,
}) => {
  const handleExport = () => {
    // Jeśli nie ma informacji o meczu, tworzymy obiekt z ID
    const matchData = matchInfo || {
      matchId: crypto.randomUUID(),
      note: "Brak szczegółowych informacji o meczu",
    };

    const data = {
      exportDate: new Date().toISOString(),
      formatVersion: "2.0",
      exportType: "match_data",
      appInfo: {
        name: "Packing Analyzer",
        version: "1.0.0",
      },
      matchInfo: matchData,
      players,
      actions,
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = matchInfo
      ? `packing_${matchInfo.team}_vs_${matchInfo.opponent}_${matchInfo.date.replace(/\//g, "-")}.json`
      : "packing_data.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  return (
    <button className={`${styles.exportButton} export-button`} onClick={handleExport} title="Eksportuj dane do pliku JSON">
      <span className={styles.icon}>📤</span>
      Eksportuj dane
    </button>
  );
};

export default ExportButton;
