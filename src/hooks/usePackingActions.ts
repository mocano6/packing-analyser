"use client";

import { useState, useCallback, useEffect } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";

// Funkcja do konwersji numeru strefy na format literowo-liczbowy
// Zakładamy, że boisko ma 12 kolumn (a-l) i 8 wierszy (1-8)
function convertZoneNumberToString(zoneNumber: number | string): string {
  if (typeof zoneNumber === 'string') return zoneNumber; // Jeśli już string, zwracamy bez zmian
  
  // Zakładamy, że numeracja biegnie od lewej do prawej, od góry do dołu
  // np. 0-11 to pierwszy wiersz, 12-23 to drugi wiersz, itd.
  const row = Math.floor(zoneNumber / 12) + 1; // Wiersze od 1
  const col = zoneNumber % 12; // Kolumny od 0
  
  // Konwertujemy kolumnę na literę (0 -> 'a', 1 -> 'b', itd.)
  const colLetter = String.fromCharCode(97 + col); // 97 to kod ASCII dla 'a'
  
  return `${colLetter}${row}`;
}

// Dodajemy funkcję pomocniczą do czyszczenia obiektu z wartości undefined
function removeUndefinedValues(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    // Pomijamy pola z wartością undefined
    if (value === undefined) return;
    
    // Jeśli wartość jest obiektem (ale nie null i nie tablica), rekurencyjnie czyścimy
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeUndefinedValues(value);
    } else if (Array.isArray(value)) {
      // Jeśli wartość jest tablicą, czyścimy każdy element tablicy
      result[key] = value.map(item => 
        item !== null && typeof item === 'object' ? removeUndefinedValues(item) : item
      );
    } else {
      // W przeciwnym razie zachowujemy wartość
      result[key] = value;
    }
  });
  
  return result;
}

export function usePackingActions(players: Player[], matchInfo: TeamInfo | null) {
  // Stany dla wybranego zawodnika
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  
  // Stany dla strefy
  const [selectedZone, setSelectedZone] = useState<string | number | null>(null);
  
  // Stany dla cech akcji
  const [actionMinute, setActionMinute] = useState<number>(1);
  const [actionType, setActionType] = useState<"pass" | "dribble">("pass");
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [isP3Active, setIsP3Active] = useState<boolean>(false);
  const [isShot, setIsShot] = useState<boolean>(false);
  const [isGoal, setIsGoal] = useState<boolean>(false);
  const [isPenaltyAreaEntry, setIsPenaltyAreaEntry] = useState<boolean>(false);
  
  // Dodaj stan isSecondHalf
  const [isSecondHalf, setIsSecondHalf] = useState<boolean>(false);
  
  // Dane o akcjach
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Pobieranie akcji przy zmianie meczu
  useEffect(() => {
    if (matchInfo?.matchId) {
      loadActionsForMatch(matchInfo.matchId);
      
      // Sprawdź, czy jest zapisana wartość połowy w localStorage
      const savedHalf = localStorage.getItem('currentHalf');
      if (savedHalf) {
        const isP2 = savedHalf === 'P2';
        console.log(`usePackingActions: Wczytano połowę z localStorage: ${savedHalf}`);
        setIsSecondHalf(isP2);
      }
    } else {
      // Resetuj akcje jeśli nie ma wybranego meczu
      setActions([]);
    }
  }, [matchInfo?.matchId]);

  // Funkcja ładująca akcje dla danego meczu
  const loadActionsForMatch = async (matchId: string) => {
    try {
      setIsLoading(true);
      console.log("Ładowanie akcji dla meczu:", matchId);
      
      // Pobierz dokument meczu
      const matchRef = doc(db, "matches", matchId);
      const matchDoc = await getDoc(matchRef);
      
      if (matchDoc.exists()) {
        const matchData = matchDoc.data() as TeamInfo;
        // Sprawdź czy istnieje tablica akcji
        const loadedActions = matchData.actions_packing || [];
        
        // Dodajemy log dla sprawdzenia, czy akcje mają ustawioną wartość isSecondHalf
        console.log(`Załadowano ${loadedActions.length} akcji dla meczu:`, matchId);
        console.log("Przykładowe wartości isSecondHalf:", loadedActions.slice(0, 3).map(a => a.isSecondHalf));
        
        // Upewniamy się, że wszystkie akcje mają ustawioną wartość isSecondHalf
        // i są oczyszczone z wartości undefined
        const validatedActions = loadedActions.map(action => {
          // Najpierw oczyszczamy akcję z wartości undefined
          const cleanedAction = removeUndefinedValues(action) as Action;
          
          // Następnie upewniamy się, że isSecondHalf jest wartością boolean
          return {
            ...cleanedAction,
            // Jeśli isSecondHalf jest undefined lub null, ustawiamy na false (domyślnie pierwsza połowa)
            isSecondHalf: cleanedAction.isSecondHalf === true
          } as Action;
        });
        
        setActions(validatedActions);
      } else {
        console.log("Nie znaleziono meczu o ID:", matchId);
        setActions([]);
      }
    } catch (error) {
      console.error("Błąd podczas ładowania akcji:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Obsługa wyboru strefy - może przyjmować różną liczbę argumentów
  const handleZoneSelect = useCallback((
    zone: string | number | null, 
    xT?: number, 
    value1?: number, 
    value2?: number
  ) => {
    console.log("Wybrano strefę:", zone, xT, value1, value2);
    setSelectedZone(zone);
    return true; // Zwracamy true, aby funkcja mogła być sprawdzana na truthiness
  }, []);

  // Zapisywanie akcji
  const handleSaveAction = useCallback(async (
    matchInfoArg: TeamInfo, 
    startZone: string | number | null, 
    endZone: string | number | null,
    startZoneXT?: number,
    endZoneXT?: number,
    packingValue?: number,
    isSecondHalfParam?: boolean
  ): Promise<boolean> => {
    // Najpierw wyświetlmy szczegółowe dane o przekazanych parametrach
    console.log("handleSaveAction wywołane z parametrami:", {
      matchInfoArg: matchInfoArg ? { matchId: matchInfoArg.matchId, team: matchInfoArg.team } : null,
      startZone,
      endZone,
      startZoneXT,
      endZoneXT,
      packingValue,
      isSecondHalfParam,
      startZoneType: typeof startZone,
      endZoneType: typeof endZone,
      selectedPlayerId
    });

    // Sprawdzmy każdy parametr oddzielnie, aby zidentyfikować dokładnie, który jest problemem
    if (!matchInfoArg) {
      console.error("Brak danych meczu (matchInfoArg jest null/undefined)");
      return false;
    }

    if (!matchInfoArg.matchId) {
      console.error("Brak ID meczu w obiekcie matchInfoArg");
      return false;
    }

    // Specjalne sprawdzenie dla wartości 0, które mogą być fałszywie uznawane za false w warunku !startZone
    const isStartZoneValid = startZone === 0 || Boolean(startZone);
    if (!isStartZoneValid) {
      console.error("Brak strefy początkowej (startZone jest null/undefined)");
      return false;
    }

    const isEndZoneValid = endZone === 0 || Boolean(endZone);
    if (!isEndZoneValid) {
      console.error("Brak strefy końcowej (endZone jest null/undefined)");
      return false;
    }

    if (!selectedPlayerId) {
      console.error("Brak ID zawodnika (selectedPlayerId jest null/undefined)");
      return false;
    }
    
    try {
      console.log("Zapisuję akcję do lokalnego stanu i dokumentu meczu...");
      console.log("Wartości xT otrzymane:", { startZoneXT, endZoneXT });
      console.log("Informacja o połowie meczu:", isSecondHalfParam);
      
      // Konwertujemy strefy na format literowo-liczbowy, jeśli podano liczby
      // Najpierw upewniamy się, że startZone i endZone nie są null
      const formattedStartZone = startZone !== null ? 
        (typeof startZone === 'number' ? convertZoneNumberToString(startZone) : startZone) 
        : "";
      const formattedEndZone = endZone !== null ? 
        (typeof endZone === 'number' ? convertZoneNumberToString(endZone) : endZone) 
        : "";
      
      // Upewniamy się, że startZoneXT i endZoneXT mają wartości numeryczne
      // Nowa logika: nigdy nie używaj wartości domyślnej 0 - jeśli nie ma wartości, użyj undefined
      const xTStart = typeof startZoneXT === 'number' ? startZoneXT : undefined;
      const xTEnd = typeof endZoneXT === 'number' ? endZoneXT : undefined;
      
      console.log("Wartości xT do zapisania - Start:", xTStart, "End:", xTEnd);
      
      // Tworzymy nową akcję
      const newAction: Action = {
        id: uuidv4(), // Generujemy unikalny identyfikator
        matchId: matchInfoArg.matchId,
        teamId: matchInfoArg.team, // Używamy team zamiast teamId dla spójności
        senderId: selectedPlayerId,
        receiverId: actionType === "pass" ? selectedReceiverId || undefined : undefined,
        fromZone: formattedStartZone,
        toZone: formattedEndZone,
        actionType: actionType,
        minute: actionMinute,
        packingPoints: packingValue || currentPoints,
        // Przypisujemy wartości xT tylko jeśli są zdefiniowane
        ...(xTStart !== undefined && { xTValueStart: xTStart }),
        ...(xTEnd !== undefined && { xTValueEnd: xTEnd }),
        isP3: isP3Active,
        isShot: isShot,
        isGoal: isGoal,
        isPenaltyAreaEntry: isPenaltyAreaEntry,
        // Zawsze zapisujemy informację o połowie meczu (nie jako opcjonalną)
        isSecondHalf: isSecondHalfParam !== undefined ? isSecondHalfParam : isSecondHalf
      };
      
      console.log("Utworzona akcja z wartościami xT i połową meczu:", { 
        xTValueStart: newAction.xTValueStart, 
        xTValueEnd: newAction.xTValueEnd,
        isSecondHalf: newAction.isSecondHalf
      });
      
      // Usuwamy pola undefined z obiektu akcji przed zapisem
      const cleanedAction = removeUndefinedValues(newAction);
      console.log("Akcja po oczyszczeniu z wartości undefined:", cleanedAction);
      
      // Dodajemy akcję do lokalnego stanu
      setActions(prevActions => [...prevActions, newAction]);
      
      // Zapisujemy do Firebase
      try {
        console.log("Próba zapisania akcji do dokumentu meczu...");
        
        // Pobierz aktualny dokument meczu
        const matchRef = doc(db, "matches", matchInfoArg.matchId);
        const matchDoc = await getDoc(matchRef);
        
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
          // Upewniamy się, że tablica akcji istnieje
          const currentActions = matchData.actions_packing || [];
          
          // Upewniamy się, że wszystkie akcje są oczyszczone z undefined
          const cleanedActions = currentActions.map(action => removeUndefinedValues(action));
          
          // Dodaj nową (oczyszczoną) akcję i aktualizuj dokument
          await updateDoc(matchRef, {
            actions_packing: [...cleanedActions, cleanedAction]
          });
          
          console.log("✅ Akcja została zapisana w dokumencie meczu z ID:", cleanedAction.id);
          
          // Po udanym zapisie odświeżamy akcje z bazy
          loadActionsForMatch(matchInfoArg.matchId);
        } else {
          console.error("Nie znaleziono meczu o ID:", matchInfoArg.matchId);
        }
      } catch (firebaseError) {
        console.error("❌ Błąd podczas zapisywania akcji w Firebase:", firebaseError);
        
        // Obsługa błędu wewnętrznego stanu Firestore
        const errorHandled = await handleFirestoreError(firebaseError, db);
        
        if (errorHandled) {
          console.log("✅ Błąd Firestore został obsłużony - akcja została zapisana lokalnie");
        } else {
          console.warn("⚠️ Akcja została dodana tylko lokalnie - synchronizacja z Firebase nieudana");
        }
      }
      
      console.log("Akcja została zapisana:", newAction);
      
      // Po zapisaniu resetujemy stan
      resetActionState();
      
      return true;
    } catch (error) {
      console.error("Błąd podczas zapisywania akcji:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, db);
      
      return false;
    }
  }, [selectedPlayerId, selectedReceiverId, actionType, actionMinute, currentPoints, isP3Active, isShot, isGoal, isPenaltyAreaEntry, isSecondHalf]);

  // Usuwanie akcji
  const handleDeleteAction = useCallback(async (actionId: string) => {
    if (!matchInfo?.matchId) {
      console.error("Brak ID meczu, nie można usunąć akcji");
      return false;
    }
    
    console.log("Usuwam akcję:", actionId);
    try {
      // Usuwanie akcji z lokalnego stanu
      setActions(prevActions => prevActions.filter(action => action.id !== actionId));
      
      // Usuwanie z dokumentu meczu
      const matchRef = doc(db, "matches", matchInfo.matchId);
      const matchDoc = await getDoc(matchRef);
      
      if (matchDoc.exists()) {
        const matchData = matchDoc.data() as TeamInfo;
        // Filtrujemy akcje, aby usunąć tę o podanym ID
        const updatedActions = (matchData.actions_packing || []).filter(action => action.id !== actionId);
        
        // Oczyszczamy wszystkie akcje z wartości undefined
        const cleanedActions = updatedActions.map(action => removeUndefinedValues(action));
        
        // Aktualizujemy dokument z oczyszczonymi akcjami
        await updateDoc(matchRef, {
          actions_packing: cleanedActions
        });
        
        console.log("✅ Akcja została usunięta z dokumentu meczu:", actionId);
      } else {
        console.error("Nie znaleziono meczu o ID:", matchInfo.matchId);
      }
      
      return true;
    } catch (error) {
      console.error("Błąd podczas usuwania akcji:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, db);
      
      return false;
    }
  }, [matchInfo?.matchId]);

  // Usuwanie wszystkich akcji
  const handleDeleteAllActions = useCallback(async () => {
    if (!matchInfo?.matchId) {
      console.error("Brak ID meczu, nie można usunąć akcji");
      return false;
    }
    
    if (window.confirm("Czy na pewno chcesz usunąć wszystkie akcje?")) {
      console.log("Usuwam wszystkie akcje");
      
      try {
        // Aktualizacja dokumentu meczu - ustawienie pustej tablicy akcji
        const matchRef = doc(db, "matches", matchInfo.matchId);
        await updateDoc(matchRef, {
          actions_packing: []
        });
        
        console.log(`✅ Usunięto wszystkie akcje z dokumentu meczu: ${matchInfo.matchId}`);
        
        // Czyścimy stan lokalny
        setActions([]);
        return true;
      } catch (error) {
        console.error("Błąd podczas usuwania wszystkich akcji:", error);
        
        // Obsługa błędu wewnętrznego stanu Firestore
        await handleFirestoreError(error, db);
        
        return false;
      }
    }
    return false;
  }, [matchInfo?.matchId]);

  // Dodaj nową funkcję do ustawiania połowy meczu
  const setCurrentHalf = useCallback((value: boolean) => {
    console.log(`usePackingActions: Zmiana połowy na ${value ? 'P2' : 'P1'}`);
    setIsSecondHalf(value);
    
    // Zapisujemy wartość w localStorage dla spójności w całej aplikacji
    localStorage.setItem('currentHalf', value ? 'P2' : 'P1');
  }, []);

  // Reset stanu akcji
  const resetActionState = useCallback(() => {
    setSelectedZone(null);
    setCurrentPoints(0);
    setIsP3Active(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
    // Nie resetujemy selectedPlayerId, selectedReceiverId i isSecondHalf,
    // bo te stany są utrzymywane między akcjami
  }, []);

  return {
    // Stany
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
    isPenaltyAreaEntry,
    isSecondHalf,
    isLoading,
    
    // Settery
    setSelectedPlayerId,
    setSelectedReceiverId,
    setCurrentPoints,
    setActionMinute,
    setActionType,
    setIsP3Active,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    setIsSecondHalf: setCurrentHalf,
    
    // Funkcje
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
    loadActionsForMatch,
  };
} 