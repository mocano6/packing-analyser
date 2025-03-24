// src/hooks/useMatchInfo.ts
"use client";

import { useState, useEffect } from "react";
import { TeamInfo } from "@/types"; // Zaktualizowana ścieżka importu

export function useMatchInfo() {
  // Inicjalizacja stanu z localStorage z zabezpieczeniem przed SSR
  const [matchInfo, setMatchInfo] = useState<TeamInfo | null>(() => {
    if (typeof window !== "undefined") {
      const savedMatchInfo = localStorage.getItem("matchInfo");
      if (savedMatchInfo) {
        const parsedInfo = JSON.parse(savedMatchInfo);
        // Upewnij się, że istnieje ID meczu
        if (!parsedInfo.matchId) {
          // Bezpieczne generowanie UUID kompatybilne z SSR
          parsedInfo.matchId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : "id-" +
                Date.now() +
                "-" +
                Math.random().toString(36).substring(2);
        }
        return parsedInfo;
      }
    }
    return null;
  });

  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);

  // Zapisz dane meczu do localStorage z zabezpieczeniem przed SSR
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (matchInfo) {
        localStorage.setItem("matchInfo", JSON.stringify(matchInfo));
      } else {
        localStorage.removeItem("matchInfo");
      }
    }
  }, [matchInfo]);

  const handleSaveMatchInfo = (info: TeamInfo) => {
    setMatchInfo(info);
    setIsMatchModalOpen(false);
  };

  return {
    matchInfo,
    setMatchInfo,
    isMatchModalOpen,
    setIsMatchModalOpen,
    handleSaveMatchInfo,
  };
}
