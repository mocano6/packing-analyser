// src/hooks/useMatchInfo.ts
"use client";

import { useState, useEffect } from "react";
import { TeamInfo } from "@/types";

// Funkcja do generowania unikalnych ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function useMatchInfo() {
  const [matchInfo, setMatchInfo] = useState<TeamInfo | null>(null);
  const [allMatches, setAllMatches] = useState<TeamInfo[]>([]);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);

  // Ładowanie meczów z localStorage
  useEffect(() => {
    try {
      const savedMatches = localStorage.getItem("matches");
      if (savedMatches) {
        const parsedMatches = JSON.parse(savedMatches);
        setAllMatches(parsedMatches);
        
        const lastSelectedMatchId = localStorage.getItem("selectedMatchId");
        if (lastSelectedMatchId) {
          const selectedMatch = parsedMatches.find(
            (m: TeamInfo) => m.matchId === lastSelectedMatchId
          );
          if (selectedMatch) {
            setMatchInfo(selectedMatch);
          }
        }
      }
    } catch (error) {
      console.error("Błąd podczas ładowania meczów:", error);
    }
  }, []);

  // Zapisywanie meczów do localStorage
  useEffect(() => {
    if (allMatches.length > 0) {
      localStorage.setItem("matches", JSON.stringify(allMatches));
    }
  }, [allMatches]);

  // Zapisywanie ID wybranego meczu
  useEffect(() => {
    if (matchInfo) {
      localStorage.setItem("selectedMatchId", matchInfo.matchId);
    } else {
      localStorage.removeItem("selectedMatchId");
    }
  }, [matchInfo]);

  // Funkcja do zapisywania informacji o meczu
  const handleSaveMatchInfo = (info: Omit<TeamInfo, "matchId"> & { matchId?: string }) => {
    const infoToSave = { ...info } as TeamInfo;
    
    if (!infoToSave.matchId) {
      // Nowy mecz - generujemy ID
      infoToSave.matchId = generateId();
      setAllMatches(prev => [...prev, infoToSave]);
    } else {
      // Aktualizacja istniejącego meczu
      setAllMatches(prev => 
        prev.map(match => 
          match.matchId === infoToSave.matchId ? infoToSave : match
        )
      );
    }
    
    setMatchInfo(infoToSave);
    setIsMatchModalOpen(false);
  };

  const handleSelectMatch = (match: TeamInfo | null) => {
    setMatchInfo(match);
  };

  const handleDeleteMatch = (matchId: string) => {
    setAllMatches(prev => prev.filter(match => match.matchId !== matchId));
    
    if (matchInfo?.matchId === matchId) {
      setMatchInfo(null);
    }
  };

  return {
    matchInfo,
    allMatches,
    isMatchModalOpen,
    setIsMatchModalOpen,
    handleSaveMatchInfo,
    handleSelectMatch,
    handleDeleteMatch
  };
}
