// src/hooks/useActionsState.ts
"use client";

import { useState, useEffect, useMemo } from "react";
import { Action, Player, TeamInfo, Zone } from "@/types"; // Zaktualizowana ścieżka importu

export function useActionsState(players: Player[], currentMatch: any) {
  // Inicjalizacja stanu z localStorage z zabezpieczeniem przed SSR
  const [actions, setActions] = useState<Action[]>(() => {
    if (typeof window !== "undefined") {
      const savedActions = localStorage.getItem("actions");
      return savedActions ? JSON.parse(savedActions) : [];
    }
    return [];
  });

  const [currentMatchId, setCurrentMatchId] = useState<string | undefined>(undefined);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [actionMinute, setActionMinute] = useState<number>(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(
    null
  );
  const [actionType, setActionType] = useState<"pass" | "dribble">("pass");
  const [isP3Active, setIsP3Active] = useState(false);
  const [isShot, setIsShot] = useState(false);
  const [isGoal, setIsGoal] = useState(false);
  const [isPenaltyAreaEntry, setIsPenaltyAreaEntry] = useState(false);
  const [clickValue1, setClickValue1] = useState<number | null>(null);
  const [clickValue2, setClickValue2] = useState<number | null>(null);

  // Monitoruj zmiany meczu i aktualizuj currentMatchId
  useEffect(() => {
    if (currentMatch && currentMatch.matchId) {
      setCurrentMatchId(currentMatch.matchId);
    } else {
      setCurrentMatchId(undefined);
    }
  }, [currentMatch]);

  // Nasłuchuj zmian w localStorage dla selectedMatchId
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selectedMatchId") {
        setCurrentMatchId(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Zapisz dane akcji do localStorage z zabezpieczeniem przed SSR
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("actions", JSON.stringify(actions));
    }
  }, [actions]);

  // Filtrowanie akcji na podstawie wybranego meczu
  const filteredActions = useMemo(() => {
    if (!currentMatchId) return actions;
    return actions.filter(action => 
      !action.matchId || action.matchId === currentMatchId
    );
  }, [actions, currentMatchId]);

  const handleZoneSelect = (
    zone: Zone | null,
    xT?: number,
    value1?: number,
    value2?: number
  ) => {
    setSelectedZone(zone);
    if (value1 !== undefined) {
      setClickValue1(value1);
    }
    if (value2 !== undefined) {
      setClickValue2(value2);
    }
    
    // Zawsze ustawiamy punkty na 0 - punkty za miniętych przeciwników będą dodawane ręcznie przez użytkownika
    setCurrentPoints(0);
  };

  const resetActionState = () => {
    setSelectedReceiverId(null);
    setSelectedZone(null);
    setCurrentPoints(0);
    setClickValue1(null);
    setClickValue2(null);
    setActionType("pass");
    setIsP3Active(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
  };

  const handleDeleteAction = (actionId: string) => {
    if (window.confirm("Czy na pewno chcesz usunąć tę akcję?")) {
      setActions((prev) => prev.filter((action) => action.id !== actionId));
    }
  };

  const handleDeleteAllActions = () => {
    if (currentMatchId) {
      // Usuń tylko akcje dla bieżącego meczu
      setActions(prev => prev.filter(action => action.matchId !== currentMatchId));
    } else {
      // Usuń wszystkie akcje bez przypisanego meczu
      setActions(prev => prev.filter(action => action.matchId));
    }
  };

  const handleSaveAction = (matchInfo: TeamInfo | null) => {
    if (
      !selectedPlayerId ||
      selectedZone === null ||
      (actionType === "pass" && !selectedReceiverId)
    ) {
      alert(
        actionType === "pass"
          ? "Wybierz nadawcę, odbiorcę i strefę boiska!"
          : "Wybierz zawodnika i strefę boiska!"
      );
      return false;
    }

    // Wymagaj informacji o meczu
    if (!matchInfo) {
      return false;
    }

    const sender = players.find((p) => p.id === selectedPlayerId)!;
    const receiver =
      actionType === "pass"
        ? players.find((p) => p.id === selectedReceiverId)!
        : sender;

    const basePoints = currentPoints;
    const multiplier = isP3Active ? 3 : 1;
    const totalPoints = basePoints * multiplier;

    // Użyj bezpiecznej implementacji UUID z zabezpieczeniem przed środowiskiem SSR
    const generateUUID = () => {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      // Fallback dla starszych przeglądarek lub środowisk SSR
      return "id-" + Date.now() + "-" + Math.random().toString(36).substring(2);
    };

    const newAction: Action = {
      id: generateUUID(),
      minute: actionMinute,
      senderId: selectedPlayerId,
      senderName: sender.name,
      senderNumber: sender.number,
      senderClickValue: clickValue1 ?? 0,
      receiverId:
        actionType === "pass" ? selectedReceiverId! : selectedPlayerId,
      receiverName: receiver.name,
      receiverNumber: receiver.number,
      receiverClickValue: clickValue2 ?? 0,
      zone: selectedZone,
      basePoints,
      multiplier,
      totalPoints,
      actionType: actionType,
      packingPoints: totalPoints,
      xTValue: totalPoints,
      isP3: isP3Active,
      isShot: isShot,
      isGoal: isGoal,
      isPenaltyAreaEntry: isPenaltyAreaEntry,
      matchId: currentMatchId,
    };

    setActions((prev) => [...prev, newAction]);
    resetActionState();
    return true;
  };

  return {
    actions: filteredActions, // Zwracaj przefiltrowane akcje
    allActions: actions, // Dodajemy dostęp do wszystkich akcji w razie potrzeby
    selectedPlayerId,
    selectedReceiverId,
    selectedZone,
    currentPoints,
    actionMinute,
    actionType,
    isP3Active,
    isShot,
    isGoal,
    isPenaltyAreaEntry,
    setSelectedPlayerId,
    setSelectedReceiverId,
    setSelectedZone,
    setCurrentPoints,
    setActionMinute,
    setActionType,
    setIsP3Active,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
  };
}
