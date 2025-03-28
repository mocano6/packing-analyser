// src/hooks/useActionsState.ts
"use client";

import { useState, useEffect, useMemo } from "react";
import { Action, Player, TeamInfo, Zone } from "@/types"; // Zaktualizowana ścieżka importu
import { getXTValueForZone } from "@/constants/xtValues"; // Importujemy funkcję do pobrania wartości XT
import { XT_VALUES } from "@/constants/xtValues"; // Importujemy XT_VALUES

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
  const [receiverZoneValue, setReceiverZoneValue] = useState<Zone | null>(null);
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
    // Jeśli zone jest null, nie kontynuujemy
    if (zone === null) {
      return;
    }

    // Jeśli value2 jest określone, oznacza to drugi klik (strefa odbiorcy) lub drybling (gdy value1 == value2)
    const isDribble = value1 !== undefined && value2 !== undefined && value1 === value2;
    
    if (isDribble) {
      console.log("handleZoneSelect: Wykryto DRYBLING (obie wartości identyczne)");
      // W przypadku dryblingu ustawiamy strefę nadawcy
      setSelectedZone(zone);
      // Dla dryblingu USTAWIAMY receiverZoneValue na inną strefę niż selectedZone
      // Tymczasowo używamy strefy przesuniętej o 1 w prawo
      // Zwiększamy indeks o 1, aby przesunąć się o jedną strefę w prawo (następna kolumna)
      const newZone = Math.min(zone + 1, 95); // Upewniamy się, że nie wyjdziemy poza zakres 96 stref
      console.log("Drybling - ustawiam receiverZoneValue na:", newZone, "(przesunięcie w prawo od", zone, ")");
      setReceiverZoneValue(newZone);
      setActionType("dribble");
    } else if (value2 !== undefined) {
      console.log("handleZoneSelect: Wykryto PODANIE z odbiorcą (druga wartość)");
      // Zapisujemy strefę odbiorcy dla podania
      setReceiverZoneValue(zone);
    } else {
      console.log("handleZoneSelect: Wykryto PODANIE początkowe (tylko pierwsza wartość)");
      // Zapisujemy strefę nadawcy 
      setSelectedZone(zone);
    }
    
    // Ustawiamy wartości clickValue na podstawie strefy 
    if (zone !== null) {
      // Obliczamy wartość XT na podstawie naszego schematu
      const xtValue = getXTValueForZone(zone);
      
      // Ustawiamy wartości clickValue dla nadawcy
      if (value1 !== undefined) {
        setClickValue1(value1);
      } else {
        setClickValue1(xtValue);
      }
      
      // Ustawiamy wartości clickValue dla odbiorcy
      if (value2 !== undefined) {
        setClickValue2(value2);
      } else if (isDribble) {
        // Dla dryblingu wartość odbiorcy jest taka sama jak nadawcy
        setClickValue2(value1 !== undefined ? value1 : xtValue);
      } else {
        setClickValue2(null);
      }
    } else {
      setClickValue1(null);
      setClickValue2(null);
    }
    
    // Zawsze ustawiamy punkty na 0 - punkty za miniętych przeciwników będą dodawane ręcznie przez użytkownika
    setCurrentPoints(0);
  };

  const resetActionState = () => {
    setSelectedReceiverId(null);
    setSelectedZone(null);
    setReceiverZoneValue(null);
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
    
    // Obliczamy wartość XT na podstawie strefy
    const xtValue = getXTValueForZone(selectedZone);

    // Użyj bezpiecznej implementacji UUID z zabezpieczeniem przed środowiskiem SSR
    const generateUUID = () => {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      // Fallback dla starszych przeglądarek lub środowisk SSR
      return "id-" + Date.now() + "-" + Math.random().toString(36).substring(2);
    };

    // Znajdź kluczową wartość ze strefy (name z XT_VALUES)
    const getZoneName = (zone: number): string => {
      // Obliczanie wiersza i kolumny na podstawie zone
      const row = Math.floor(zone / 12);
      const col = zone % 12;
      
      // Mapujemy indeksy wierszy na litery
      const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      
      // Sprawdzamy czy indeksy są w zakresie
      if (row >= 0 && row < 8 && col >= 0 && col < 12) {
        const rowLetter = rowLetters[row];
        const colNumber = col + 1;
        
        // Tworzymy klucz w formacie a1, b2, c3 itd.
        const key = `${rowLetter}${colNumber}` as keyof typeof XT_VALUES;
        
        // Zwracamy wartość name dla danej pozycji (np. "A1", "B2", "C3" itp.)
        return XT_VALUES[key]?.name || `zone${zone}`;
      }
      
      return `zone${zone}`;
    };

    // Określamy wartość dla pola senderZone - zawsze jest to strefa nadawcy
    const senderZoneName = getZoneName(selectedZone);
    
    // Logowanie stanu przed utworzeniem akcji
    console.log("Przygotowanie do zapisania akcji:", {
      actionType,
      selectedZone,
      receiverZoneValue,
      isDrybling: actionType === "dribble"
    });
    
    // Określamy wartość dla pola receiverZone
    let receiverZoneName: string | null = null;
    
    if (receiverZoneValue !== null) {
      // Używamy receiverZoneValue niezależnie od typu akcji
      // Dla dryblingu będzie to strefa przesunięta w prawo
      // Dla podania będzie to strefa drugiego kliknięcia
      receiverZoneName = getZoneName(receiverZoneValue);
    }
    
    // Logowanie obliczonych wartości dla stref
    console.log("Obliczone wartości stref:", {
      senderZoneName,
      receiverZoneName,
      isDrybling: actionType === "dribble"
    });

    const newAction: Action = {
      id: generateUUID(),
      minute: actionMinute,
      senderId: sender.id,
      senderName: sender.name,
      senderNumber: sender.number,
      senderClickValue: clickValue1 || 0,
      receiverId: receiver.id,
      receiverName: receiver.name,
      receiverNumber: receiver.number,
      receiverClickValue: clickValue2 || 0,
      // Używamy wcześniej obliczonych wartości
      senderZone: senderZoneName, // Strefa początkowa (start)
      receiverZone: receiverZoneName, // Strefa końcowa (end) - null dla dryblingu
      packingPoints: currentPoints,
      actionType,
      xTValue: xtValue,
      isP3: isP3Active,
      isShot,
      isGoal,
      isPenaltyAreaEntry,
      matchId: matchInfo.matchId,
    };

    console.log("Zapisuję akcję:", { 
      actionType,
      senderZone: newAction.senderZone, 
      receiverZone: newAction.receiverZone,
      isDrybling: actionType === "dribble"
    });

    try {
      setIsLoading(true);
      setError(null);
      
      // Logowanie bezpośrednio przed wysłaniem danych do API
      console.log("Wysyłanie do API:", {
        actionType: newAction.actionType,
        senderZone: newAction.senderZone,
        receiverZone: newAction.receiverZone
      });
      
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
    receiverZoneValue,
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
    setReceiverZoneValue,
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
