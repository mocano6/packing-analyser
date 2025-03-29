// src/hooks/useActionsState.ts
"use client";

import React from 'react';
import { useState, useEffect, useMemo } from "react";
import { Action, Player, TeamInfo, Zone } from "@/types"; // Zaktualizowana ścieżka importu
import { getXTValueForZone, getZoneData } from "@/constants/xtValues"; // Importujemy funkcję do pobrania wartości XT
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
  const [actionMinute, setActionMinute] = useState<number>(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(
    null
  );
  const [actionType, setActionType] = useState<"pass" | "dribble">("pass");
  const [isP3Active, setIsP3Active] = useState(false);
  const [isShot, setIsShot] = useState(false);
  const [isGoal, setIsGoal] = useState(false);
  const [isPenaltyAreaEntry, setIsPenaltyAreaEntry] = useState(false);
  const [isSecondHalf, setIsSecondHalf] = useState(false); // false = P1 (pierwsza połowa), true = P2 (druga połowa)
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

    // Wyświetl dodatkowy log dla diagnostyki
    console.log("handleZoneSelect - przekazane wartości:", {
      zone,
      xT,
      value1,
      value2,
      isDribble: value1 !== undefined && value2 !== undefined && value1 === value2
    });

    // Obliczamy wartość XT na podstawie strefy
    const row = Math.floor(zone / 12);
    const col = zone % 12;
    const calculatedXT = getXTValueForZone(zone);

    console.log("Obliczona wartość xT dla strefy", zone, ":", calculatedXT);

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
      // Używamy przekazanej wartości xT (preferowana) lub obliczonej wartości
      const xtValue = xT !== undefined ? xT : calculatedXT;
      console.log("Ustawiam wartości clickValue - xtValue:", xtValue);
      
      // Ustawiamy wartości clickValue dla nadawcy
      if (value1 !== undefined) {
        console.log("Ustawiam clickValue1 z przekazanej wartości:", value1);
        setClickValue1(value1);
      } else {
        console.log("Ustawiam clickValue1 z obliczonej wartości XT:", xtValue);
        setClickValue1(xtValue);
      }
      
      // Ustawiamy wartości clickValue dla odbiorcy
      if (value2 !== undefined) {
        console.log("Ustawiam clickValue2 z przekazanej wartości:", value2);
        setClickValue2(value2);
      } else if (isDribble && value1 !== undefined) {
        // Dla dryblingu wartość odbiorcy jest taka sama jak nadawcy
        console.log("Ustawiam clickValue2 dla dryblingu:", value1);
        setClickValue2(value1);
      } else {
        console.log("Nie ustawiam clickValue2 na tym etapie");
        setClickValue2(null);
      }
    } else {
      console.log("Zone jest null - resetuję wartości clickValue");
      setClickValue1(null);
      setClickValue2(null);
    }
    
    // Zawsze ustawiamy punkty na 0 - punkty za miniętych przeciwników będą dodawane ręcznie przez użytkownika
    setCurrentPoints(0);
  };

  const resetActionState = () => {
    // Resetujemy tylko wartości formularza, nie resetujemy:
    // - selectedPlayerId
    // - selectedReceiverId
    // - selectedZone
    // - receiverZoneValue
    // - isSecondHalf
    // - clickValue1
    // - clickValue2
    
    // Resetujemy:
    setCurrentPoints(0);
    setActionType("pass");
    setIsP3Active(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
    
    // Nie resetujemy minuty, żeby nie utrudniać wprowadzania wielu akcji z tego samego momentu
    console.log("Zresetowano formularz akcji - zachowano wybrane strefy, zawodników i wartości xT");
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

  // Sprawdza aktualną wartość połowy z różnych źródeł dla maksymalnej niezawodności
  const getCurrentHalfValue = (): boolean => {
    // Najpierw sprawdzamy localStorage jako najbardziej aktualne źródło
    if (typeof window !== 'undefined') {
      const savedHalf = localStorage.getItem('currentHalf');
      if (savedHalf) {
        const isP2 = savedHalf === 'P2';
        console.log(`getCurrentHalfValue - z localStorage: ${savedHalf} (${isP2})`);
        return isP2;
      }
    }
    
    // Jeżeli brak wartości w localStorage, używamy stanu
    console.log(`getCurrentHalfValue - ze stanu aplikacji: ${isSecondHalf ? 'P2' : 'P1'} (${isSecondHalf})`);
    return isSecondHalf;
  };

  const handleSaveAction = async (matchInfo: TeamInfo | null, customStartZone?: number | null, customEndZone?: number | null) => {
    // Pobierz aktualną wartość połowy używając naszej funkcji pomocniczej
    const currentHalfValue = getCurrentHalfValue();
    
    console.log("handleSaveAction - Aktualna połowa:", currentHalfValue ? "P2" : "P1", "(", currentHalfValue, ")");
    
    // Dodatkowe logowanie dla diagnozowania problemu
    console.log("Dane z formularza przed zapisem:", {
      selectedPlayerId,
      selectedReceiverId,
      selectedZone,
      receiverZoneValue,
      customStartZone,
      customEndZone,
      actionType,
      actionMinute,
      currentPoints,
      isP3Active,
      isShot,
      isGoal,
      isPenaltyAreaEntry,
      isSecondHalf: currentHalfValue,
      clickValue1,
      clickValue2,
    });
    
    console.log("handleSaveAction - wartości:", { 
      selectedPlayerId,
      selectedReceiverId,
      selectedZone,
      receiverZoneValue,
      customStartZone,
      customEndZone,
      actionType,
      currentHalfValue
    });
     
    if (
      !selectedPlayerId ||
      (actionType === "pass" && !selectedReceiverId)
    ) {
      alert(
        actionType === "pass"
          ? "Wybierz nadawcę i odbiorcę podania!"
          : "Wybierz zawodnika dryblującego!"
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

    // Używamy dostarczonych wartości stref, jeśli są dostępne
    const startZoneToUse = customStartZone !== undefined ? customStartZone : selectedZone;
    const endZoneToUse = customEndZone !== undefined ? customEndZone : receiverZoneValue;
    
    // Dodatkowy log
    console.log("Wartości stref i xT:", {
      startZoneToUse,
      endZoneToUse,
      clickValue1,
      clickValue2,
      isSecondHalf: currentHalfValue
    });

    // Obliczamy wartości XT z stref, jeśli nie zostały wcześniej ustawione
    let senderClickValue = clickValue1;
    let receiverClickValue = clickValue2;
    
    // Jeśli startZoneToUse nie jest null i nie mamy wartości clickValue1, obliczamy ją
    if (startZoneToUse !== null && senderClickValue === null) {
      senderClickValue = getXTValueForZone(startZoneToUse);
      console.log(`Obliczono senderClickValue z strefy ${startZoneToUse}: ${senderClickValue}`);
    }
    
    // Podobnie dla endZoneToUse i clickValue2
    if (endZoneToUse !== null && receiverClickValue === null) {
      receiverClickValue = getXTValueForZone(endZoneToUse);
      console.log(`Obliczono receiverClickValue z strefy ${endZoneToUse}: ${receiverClickValue}`);
    }
    
    // Dla dryblingu, jeśli mamy tylko jeden clickValue, używamy go dla obu
    if (actionType === "dribble" && senderClickValue !== null && receiverClickValue === null) {
      receiverClickValue = senderClickValue;
      console.log(`Ustawiono receiverClickValue takie samo jak senderClickValue dla dryblingu: ${receiverClickValue}`);
    }
    
    // Jeśli wciąż nie mamy wartości, ustawiamy na 0 - ale to tylko zabezpieczenie, nie powinno się zdarzać
    if (senderClickValue === null) {
      console.warn("Nie udało się obliczyć senderClickValue - ustawiam na 0");
      senderClickValue = 0;
    }
    
    if (receiverClickValue === null) {
      console.warn("Nie udało się obliczyć receiverClickValue - ustawiam na 0");
      receiverClickValue = 0;
    }

    // Obliczamy wartość XT na podstawie strefy (dla xTValue w bazie danych)
    const xtValue = startZoneToUse !== null ? getXTValueForZone(startZoneToUse) : 0;

    // Użyj bezpiecznej implementacji UUID z zabezpieczeniem przed środowiskiem SSR
    const generateUUID = () => {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      // Fallback dla starszych przeglądarek lub środowisk SSR
      return "id-" + Date.now() + "-" + Math.random().toString(36).substring(2);
    };

    // Znajdź kluczową wartość ze strefy (name z XT_VALUES)
    const getZoneName = (zone: number | null): string => {
      // Zabezpieczenie przed null
      if (zone === null) {
        console.error("getZoneName otrzymało null zamiast numeru strefy!");
        return "unknown";
      }
      
      // Używamy funkcji z xtValues.ts do pobrania nazwy strefy
      const zoneName = getZoneData(zone)?.name;
      
      if (zoneName) {
        // Konwertujemy tablicę [litera, numer] na format JSON do zapisania w bazie danych
        return JSON.stringify(zoneName);
      }
      
      return `zone${zone}`;
    };

    // Określamy wartość dla pola startZone - zawsze jest to strefa początkowa akcji
    const startZoneName = getZoneName(startZoneToUse);
    
    // Logowanie stanu przed utworzeniem akcji
    console.log("Przygotowanie do zapisania akcji:", {
      actionType,
      startZoneToUse,
      endZoneToUse,
      isDrybling: actionType === "dribble"
    });
    
    // Określamy wartość dla pola endZone
    let endZoneName: string | null = null;
    
    if (endZoneToUse !== null) {
      // Używamy receiverZoneValue niezależnie od typu akcji
      // Dla dryblingu będzie to strefa przesunięta w prawo
      // Dla podania będzie to strefa drugiego kliknięcia
      endZoneName = getZoneName(endZoneToUse);
    }
    
    // Logowanie obliczonych wartości dla stref
    console.log("Obliczone wartości stref:", {
      startZoneName,
      endZoneName,
      isDrybling: actionType === "dribble"
    });

    // Przed utworzeniem akcji, ponownie sprawdzamy aktualną wartość połowy
    // aby być absolutnie pewnym, że używamy aktualnej wartości
    const finalHalfValue = getCurrentHalfValue();
    
    console.log("Finalna wartość połowy przed utworzeniem akcji:", finalHalfValue ? "P2" : "P1");

    const newAction: Action = {
      id: generateUUID(),
      minute: actionMinute,
      senderId: sender.id,
      senderName: sender.name,
      senderNumber: sender.number,
      senderClickValue: senderClickValue,
      receiverId: receiver.id,
      receiverName: receiver.name,
      receiverNumber: receiver.number,
      receiverClickValue: receiverClickValue,
      // Używamy wcześniej obliczonych wartości
      startZone: startZoneName,
      endZone: endZoneName,
      packingPoints: currentPoints,
      actionType,
      xTValue: xtValue,
      isP3: isP3Active,
      isShot,
      isGoal,
      isPenaltyAreaEntry,
      isSecondHalf: finalHalfValue, // Używamy ostatecznej wartości
      matchId: matchInfo.matchId,
    };

    console.log("Zapisuję akcję:", { 
      actionType,
      startZone: newAction.startZone, 
      endZone: newAction.endZone,
      isDrybling: actionType === "dribble",
      xTValues: {
        senderClickValue: newAction.senderClickValue,
        receiverClickValue: newAction.receiverClickValue,
      },
      isSecondHalf: newAction.isSecondHalf,
    });

    // Logujemy dane akcji do konsoli
    console.log("Finalne dane zapisywanej akcji:", {
      id: newAction.id,
      senderId: newAction.senderId,
      receiverId: newAction.receiverId,
      actionType: newAction.actionType,
      isSecondHalf: newAction.isSecondHalf,
      senderClickValue: newAction.senderClickValue,
      receiverClickValue: newAction.receiverClickValue,
      minute: newAction.minute,
      packingPoints: newAction.packingPoints
    });

    try {
      setIsLoading(true);
      setError(null);
      
      // Logowanie bezpośrednio przed wysłaniem danych do API
      console.log("Wysyłanie do API:", {
        actionType: newAction.actionType,
        startZone: newAction.startZone,
        endZone: newAction.endZone
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

  // Wrapper dla setIsSecondHalf z dodatkowym logowaniem
  const handleSetIsSecondHalf = (value: boolean | ((prevState: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(isSecondHalf) : value;
    
    console.log("useActionsState - ustawiam połowę na:", 
      newValue ? "P2" : "P1", 
      "obecna wartość:", isSecondHalf);
    
    // Najpierw zaktualizujmy stan lokalny
    setIsSecondHalf(newValue);
    
    // Dodajemy dodatkowe debugowanie
    console.log(`Wartość isSecondHalf po aktualizacji będzie: ${newValue ? 'P2 (true)' : 'P1 (false)'}`);
    
    // Sprawdzamy, czy localStorage jest dostępne
    if (typeof window !== 'undefined') {
      // Zapisujemy wartość w localStorage dla dodatkowego zabezpieczenia
      try {
        localStorage.setItem('currentHalf', newValue ? 'P2' : 'P1');
        console.log(`Zapisano wartość połowy w localStorage: ${newValue ? 'P2' : 'P1'}`);
      } catch (err) {
        console.error('Nie można zapisać wartości połowy w localStorage:', err);
      }
    }
  };

  // Przy inicjalizacji komponentu, sprawdzamy, czy jest zapisana wartość w localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHalf = localStorage.getItem('currentHalf');
      if (savedHalf) {
        const isP2 = savedHalf === 'P2';
        console.log(`Wczytano wartość połowy z localStorage: ${savedHalf}`);
        setIsSecondHalf(isP2);
      }
    }
  }, []);

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
    isSecondHalf,
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
    setIsSecondHalf: handleSetIsSecondHalf,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
  };
}
