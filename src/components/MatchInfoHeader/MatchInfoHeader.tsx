// src/components/MatchInfoHeader/MatchInfoHeader.tsx
"use client";

import React, { useState, useEffect } from "react";
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
  // Stan do śledzenia, czy jesteśmy na kliencie
  const [mounted, setMounted] = useState(false);

  // Po wyrenderowaniu na kliencie, ustawiamy mounted na true
  useEffect(() => {
    setMounted(true);
  }, []);

  // Zawartość, która będzie spójna przy pierwszym renderze na serwerze i kliencie
  const initialContent = (
    <div className={styles.noMatchInfo}>
      <button className={styles.addMatchButton} onClick={onChangeMatch}>
        Dodaj informacje o meczu
      </button>
    </div>
  );

  // Zwracamy początkową zawartość dla pierwszego renderowania (na serwerze i przed hydratacją)
  if (!mounted) {
    return initialContent;
  }

  // Po hydratacji możemy bezpiecznie renderować właściwą zawartość w zależności od matchInfo
  if (!matchInfo) {
    return initialContent;
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
