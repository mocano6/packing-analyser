// src/components/MatchInfoHeader/MatchInfoHeader.tsx
"use client";

import React from "react";
import { TeamInfo } from "@/types";
import styles from "./MatchInfoHeader.module.css";

interface MatchInfoHeaderProps {
  matchInfo: TeamInfo | null;
  onChangeMatch: () => void;
}

const MatchInfoHeader: React.FC<MatchInfoHeaderProps> = ({
  matchInfo,
  onChangeMatch,
}) => {
  if (!matchInfo) {
    return (
      <div className={styles.noMatchInfo}>
        <button className={styles.addMatchButton} onClick={onChangeMatch}>
          Dodaj informacje o meczu
        </button>
      </div>
    );
  }

  return (
    <div className={styles.matchInfoHeader}>
      <h2>
        {matchInfo.team} {matchInfo.isHome ? "vs" : "@"} {matchInfo.opponent}
      </h2>
      <p>
        {matchInfo.competition} | {matchInfo.date} {matchInfo.time} |
        {matchInfo.isHome ? " dom" : " wyjazd"}
      </p>
      <button className={styles.changeMatchButton} onClick={onChangeMatch}>
        Zmień mecz
      </button>
    </div>
  );
};

export default MatchInfoHeader;
