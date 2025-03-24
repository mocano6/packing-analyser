// src/hooks/useActionsState.ts
"use client";

import { useState, useEffect } from "react";
import { Action, Player, TeamInfo } from "@/types"; // Zaktualizowana ścieżka importu

export function useActionsState(players: Player[]) {
  // Inicjalizacja stanu z localStorage z zabezpieczeniem przed SSR
  const [actions, setActions] = useState<Action[]>(() => {
    if (typeof window !== "undefined") {
      const savedActions = localStorage.getItem("actions");
      return savedActions ? JSON.parse(savedActions) : [];
    }
    return [];
  });

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(
    null
  );
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [actionMinute, setActionMinute] = useState<number>(0);
  const [actionType, setActionType] = useState<"pass" | "dribble">("pass");
  const [isP3Active, setIsP3Active] = useState(false);
  const [isShot, setIsShot] = useState(false);
  const [isGoal, setIsGoal] = useState(false);
  const [clickValue1, setClickValue1] = useState<number | null>(null);
  const [clickValue2, setClickValue2] = useState<number | null>(null);

  // Zapisz dane akcji do localStorage z zabezpieczeniem przed SSR
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("actions", JSON.stringify(actions));
    }
  }, [actions]);

  const handleZoneSelect = (
    zone: number | null,
    xT?: number,
    value1?: number,
    value2?: number
  ) => {
    setSelectedZone(zone);
    if (value1 !== undefined) setClickValue1(value1);
    if (value2 !== undefined) setClickValue2(value2);
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
  };

  const handleDeleteAction = (actionId: string) => {
    if (window.confirm("Czy na pewno chcesz usunąć tę akcję?")) {
      setActions((prev) => prev.filter((action) => action.id !== actionId));
    }
  };

  const handleDeleteAllActions = () => {
    if (
      window.confirm(
        "Czy na pewno chcesz usunąć wszystkie akcje? Tej operacji nie można cofnąć."
      )
    ) {
      setActions([]);
      return true; // Jeśli akcje zostały usunięte
    }
    return false;
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

    const multiplier = (clickValue2 ?? 0) - (clickValue1 ?? 0);

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
      timestamp: new Date().toISOString(),
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
      basePoints: currentPoints,
      multiplier: multiplier,
      totalPoints: currentPoints * multiplier,
      actionType: actionType,
      packingPoints: currentPoints,
      xTValue: currentPoints * multiplier,
      isP3: isP3Active,
      isShot: isShot,
      isGoal: isGoal,
      matchInfo: matchInfo,
    };

    setActions((prev) => [...prev, newAction]);
    resetActionState();
    return true;
  };

  return {
    actions,
    selectedPlayerId,
    selectedReceiverId,
    selectedZone,
    currentPoints,
    actionMinute,
    actionType,
    isP3Active,
    isShot,
    isGoal,
    setSelectedPlayerId,
    setSelectedReceiverId,
    setSelectedZone,
    setCurrentPoints,
    setActionMinute,
    setActionType,
    setIsP3Active,
    setIsShot,
    setIsGoal,
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
  };
}
