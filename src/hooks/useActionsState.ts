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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monitoruj zmiany meczu i aktualizuj currentMatchId
  useEffect(() => {
    if (currentMatch && currentMatch.matchId) {
      setCurrentMatchId(currentMatch.matchId);

      // Pobierz akcje dla bieżącego meczu z serwera
      fetchActionsForMatch(currentMatch.matchId);
    } else {
      setCurrentMatchId(undefined);
    }
  }, [currentMatch]);

  // Nasłuchuj zmian w localStorage dla selectedMatchId
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selectedMatchId") {
        // Bezpieczne ustawienie currentMatchId - przekształć null na undefined
        setCurrentMatchId(e.newValue || undefined);
        if (e.newValue) {
          fetchActionsForMatch(e.newValue);
        }
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

  // Funkcja do pobierania akcji z serwera
  const fetchActionsForMatch = async (matchId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/actions?matchId=${matchId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const actionsData = await response.json();
      
      setActions(actionsData);
    } catch (err) {
      console.error("Błąd podczas pobierania akcji:", err);
      setError(`Błąd podczas pobierania akcji: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleDeleteAction = async (actionId: string) => {
    if (window.confirm("Czy na pewno chcesz usunąć tę akcję?")) {
      try {
        setIsLoading(true);
        setError(null);
        
        // Usuń akcję z serwera
        const response = await fetch(`/api/actions?id=${actionId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Usuń akcję ze stanu lokalnego
        setActions((prev) => prev.filter((action) => action.id !== actionId));
      } catch (err) {
        console.error("Błąd podczas usuwania akcji:", err);
        setError(`Błąd podczas usuwania akcji: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteAllActions = async () => {
    if (currentMatchId) {
      if (window.confirm(`Czy na pewno chcesz usunąć wszystkie akcje dla bieżącego meczu?`)) {
        try {
          setIsLoading(true);
          setError(null);
          
          // Pobierz wszystkie akcje dla bieżącego meczu
          const actionsToDelete = actions.filter(action => action.matchId === currentMatchId);
          
          // Usuń każdą akcję z serwera
          for (const action of actionsToDelete) {
            const response = await fetch(`/api/actions?id=${action.id}`, {
              method: 'DELETE',
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
          }
          
          // Usuń akcje ze stanu lokalnego
          setActions(prev => prev.filter(action => action.matchId !== currentMatchId));
        } catch (err) {
          console.error("Błąd podczas usuwania wszystkich akcji:", err);
          setError(`Błąd podczas usuwania wszystkich akcji: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      // Usuń wszystkie akcje bez przypisanego meczu
      setActions(prev => prev.filter(action => action.matchId));
    }
  };

  const handleSaveAction = async (matchInfo: TeamInfo | null) => {
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
      alert("Wybierz mecz przed dodaniem akcji!");
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
      matchId: matchInfo.matchId,
    };

    try {
      setIsLoading(true);
      setError(null);
      
      // Wyślij akcję na serwer
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAction),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Dodaj akcję do stanu lokalnego
      setActions((prev) => [...prev, newAction]);
      resetActionState();
      return true;
    } catch (err) {
      console.error("Błąd podczas zapisywania akcji:", err);
      setError(`Błąd podczas zapisywania akcji: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      setIsLoading(false);
    }
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
    isLoading,
    error,
    setSelectedPlayerId,
    setSelectedReceiverId,
    handleZoneSelect,
    setActionMinute,
    setActionType,
    setCurrentPoints,
    setIsP3Active,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
  };
}
