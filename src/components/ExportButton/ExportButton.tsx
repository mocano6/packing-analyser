// src/components/ExportButton/ExportButton.tsx
"use client";

import React from "react";
import { Action, TeamInfo } from "@/types";
import styles from "./ExportButton.module.css";
import { getMatchDocumentFromCache } from "@/lib/matchDocumentCache";
import { buildMatchExportData } from "@/lib/matchExportPayload";

interface ExportButtonProps {
  actions: Action[];
  matchInfo: TeamInfo | null;
  /** Pełny dokument meczu (cache); jeśli brak — próba getMatchDocumentFromCache(matchId) */
  matchDocumentForExport?: TeamInfo | null;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  actions,
  matchInfo,
  matchDocumentForExport = null,
}) => {
  const handleExport = () => {
    const data = buildMatchExportData(
      actions,
      matchInfo,
      matchDocumentForExport,
      getMatchDocumentFromCache,
    );

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
      <span className={styles.icon} aria-hidden>
        {"\uD83D\uDCE4"}
      </span>
      Eksportuj dane
    </button>
  );
};

export default ExportButton;
