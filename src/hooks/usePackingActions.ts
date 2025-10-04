"use client";

import { useState, useCallback, useEffect } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { getDB } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";
// Usunięto import funkcji synchronizacji - akcje są teraz tylko w matches
import { getPlayerFullName } from '@/utils/playerUtils';

// Funkcja do konwersji numeru strefy na format literowo-liczbowy
function convertZoneNumberToString(zoneNumber: number | string): string {
  if (typeof zoneNumber === 'string') return zoneNumber; // Jeśli już string, zwracamy bez zmian
  
  // Obliczanie wiersza i kolumny na podstawie zone (0-95)
  const row = Math.floor(zoneNumber / 12);
  const col = zoneNumber % 12;
  
  // Mapujemy indeksy wierszy na litery (0->a, 1->b, ..., 7->h)
  const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rowLetter = rowLetters[row];
  
  // Konwertujemy indeks kolumny na numer (0->1, 1->2, ..., 11->12)
  const colNumber = col + 1;
  
  return `${rowLetter}${colNumber}`;
}

// Funkcja pomocnicza do usuwania undefined z obiektów, zachowująca typ
function removeUndefinedFields<T extends object>(obj: T): T {
  const result = { ...obj };
  
  Object.keys(result).forEach(key => {
    if (result[key as keyof T] === undefined) {
      delete result[key as keyof T];
    }
  });
  
  
  return result;
}

export function usePackingActions(players: Player[], matchInfo: TeamInfo | null, actionMode?: "attack" | "defense", selectedDefensePlayers?: string[]) {
  // Stany dla wybranego zawodnika
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  
  // Stany dla strefy
  const [selectedZone, setSelectedZone] = useState<string | number | null>(null);
  
  // Stany dla cech akcji
  const [actionMinute, setActionMinute] = useState<number>(1);
  const [actionType, setActionType] = useState<"pass" | "dribble">("pass");
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [isP1Active, setIsP1Active] = useState<boolean>(false);
  const [isP2Active, setIsP2Active] = useState<boolean>(false);
  const [isP3BoxActive, setIsP3BoxActive] = useState<boolean>(false);
  const [isP3SiteActive, setIsP3SiteActive] = useState<boolean>(false);
  const [isContact1Active, setIsContact1Active] = useState<boolean>(false);
  const [isContact2Active, setIsContact2Active] = useState<boolean>(false);
  const [isContact3PlusActive, setIsContact3PlusActive] = useState<boolean>(false);
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
      
      // Pobierz dokument meczu
      const matchRef = doc(getDB(), "matches", matchId);
      const matchDoc = await getDoc(matchRef);
      
      if (matchDoc.exists()) {
        const matchData = matchDoc.data() as TeamInfo;
        // Ładujemy akcje z obu kolekcji
        const packingActions = matchData.actions_packing || [];
        const unpackingActions = matchData.actions_unpacking || [];
        const loadedActions = [...packingActions, ...unpackingActions];
        
        

        
        // Uzupełniamy brakujące dane zawodników w akcjach
        const enrichedActions = loadedActions.map(action => {
          // Najpierw oczyszczamy akcję z wartości undefined
          const cleanedAction = removeUndefinedFields(action) as Action;
          
          // Upewniamy się, że isSecondHalf jest wartością boolean
          const actionWithValidHalf = {
            ...cleanedAction,
            // Jeśli isSecondHalf jest undefined lub null, ustawiamy na false (domyślnie pierwsza połowa)
            isSecondHalf: cleanedAction.isSecondHalf === true
          } as Action;
          
          // Dodajemy brakujące dane nadawcy (sender)
          if (actionWithValidHalf.senderId && (!actionWithValidHalf.senderName || !actionWithValidHalf.senderNumber)) {
            const senderPlayer = players.find(p => p.id === actionWithValidHalf.senderId);
            if (senderPlayer) {
              actionWithValidHalf.senderName = getPlayerFullName(senderPlayer);
              actionWithValidHalf.senderNumber = senderPlayer.number;
            }
          }
          
          // Dodajemy brakujące dane odbiorcy (receiver)
          if (actionWithValidHalf.receiverId && (!actionWithValidHalf.receiverName || !actionWithValidHalf.receiverNumber)) {
            const receiverPlayer = players.find(p => p.id === actionWithValidHalf.receiverId);
            if (receiverPlayer) {
              actionWithValidHalf.receiverName = getPlayerFullName(receiverPlayer);
              actionWithValidHalf.receiverNumber = receiverPlayer.number;
            }
          }
          
          return actionWithValidHalf;
        });
        
        // Sprawdźmy, czy jakieś dane zostały uzupełnione
        const dataWasEnriched = enrichedActions.some((action, i) => 
          (action.senderName && !loadedActions[i].senderName) || 
          (action.receiverName && !loadedActions[i].receiverName)
        );
        
        if (dataWasEnriched) {
          // Synchronizujemy wzbogacone akcje z bazą Firebase
          syncEnrichedActions(matchId, enrichedActions);
        }
        
        setActions(enrichedActions);
      } else {
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

    // Walidacja w zależności od trybu
    if (actionMode === "defense") {
      // W trybie obrony sprawdzamy czy są wybrani zawodnicy obrony
      if (!selectedDefensePlayers || selectedDefensePlayers.length === 0) {
        console.error("Brak wybranych zawodników obrony (selectedDefensePlayers jest puste)");
        return false;
      }
    } else {
      // W trybie ataku sprawdzamy standardowe warunki
      if (!selectedPlayerId) {
        console.error("Brak ID zawodnika (selectedPlayerId jest null/undefined)");
        return false;
      }
    }
    
    try {
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
      
      // Pobierz czas z YouTube z localStorage
      const videoTimestamp = localStorage.getItem('tempVideoTimestamp');
      const parsedVideoTimestamp = videoTimestamp ? parseInt(videoTimestamp) : undefined;
      const isValidTimestamp = parsedVideoTimestamp && !isNaN(parsedVideoTimestamp) && parsedVideoTimestamp > 0;
      
      // PxT będzie obliczane dynamicznie na froncie
      
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
        ...(isValidTimestamp && { videoTimestamp: parsedVideoTimestamp }),
        // Przypisujemy wartości xT tylko jeśli są zdefiniowane
        ...(xTStart !== undefined && { xTValueStart: xTStart }),
        ...(xTEnd !== undefined && { xTValueEnd: xTEnd }),
        // PxT będzie obliczane dynamicznie na froncie
        isP1: isP1Active,
        isP2: isP2Active,
        isP3Box: isP3BoxActive,
        isP3Site: isP3SiteActive,
        isContact1: isContact1Active,
        isContact2: isContact2Active,
        isContact3Plus: isContact3PlusActive,
        isShot: isShot,
        isGoal: isGoal,
        isPenaltyAreaEntry: isPenaltyAreaEntry,
        // Zawsze zapisujemy informację o połowie meczu (nie jako opcjonalną)
        isSecondHalf: isSecondHalfParam !== undefined ? isSecondHalfParam : isSecondHalf,
        // Dodajemy tryb akcji i zawodników obrony
        mode: actionMode,
        ...(actionMode === "defense" && selectedDefensePlayers && { defensePlayers: selectedDefensePlayers })
      };
      
      // Dodajemy dane graczy do akcji
      if (selectedPlayerId) {
        const senderPlayer = players.find(p => p.id === selectedPlayerId);
        if (senderPlayer) {
          newAction.senderName = getPlayerFullName(senderPlayer);
          newAction.senderNumber = senderPlayer.number;
        }
      }
      
      // Jeśli to podanie, dodajemy dane odbiorcy
      if (actionType === "pass" && selectedReceiverId) {
        const receiverPlayer = players.find(p => p.id === selectedReceiverId);
        if (receiverPlayer) {
          newAction.receiverName = getPlayerFullName(receiverPlayer);
          newAction.receiverNumber = receiverPlayer.number;
        }
      }
      
      // Usuwamy pola undefined z obiektu akcji przed zapisem
      const cleanedAction = removeUndefinedFields(newAction);
      
      // DEBUG: Wypisujemy strukturę obiektu akcji do konsoli
      console.log("🔍 DEBUG - Struktura obiektu akcji przed zapisem do Firebase:");
      console.log("📋 Pełny obiekt akcji:", JSON.stringify(cleanedAction, null, 2));
      console.log("📊 Szczegóły akcji:");
      console.log("  - ID akcji:", cleanedAction.id);
      console.log("  - Tryb:", cleanedAction.mode);
      console.log("  - Zawodnik start:", cleanedAction.senderName);
      console.log("  - Zawodnik koniec:", cleanedAction.receiverName);
      console.log("  - Punkty packing:", cleanedAction.packingPoints);
      console.log("  - P1:", cleanedAction.isP1);
      console.log("  - P2:", cleanedAction.isP2);
      console.log("  - P3-Box:", cleanedAction.isP3Box);
      console.log("  - P3-Site:", cleanedAction.isP3Site);
      console.log("  - 1T:", cleanedAction.isContact1);
      console.log("  - 2T:", cleanedAction.isContact2);
      console.log("  - 3T+:", cleanedAction.isContact3Plus);
      console.log("  - Zawodnicy obrony:", cleanedAction.defensePlayers);
      
      // Dodajemy akcję do lokalnego stanu
      setActions(prevActions => [...prevActions, cleanedAction]);
      
      // Zapisujemy do Firebase
      try {
        // Pobierz aktualny dokument meczu
        const matchRef = doc(getDB(), "matches", matchInfoArg.matchId);
        const matchDoc = await getDoc(matchRef);
        
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
          
          // Wybieramy kolekcję w zależności od trybu
          const collectionField = actionMode === "defense" ? "actions_unpacking" : "actions_packing";
          const currentActions = matchData[collectionField] || [];
          
          // Upewniamy się, że wszystkie akcje są oczyszczone z undefined
          const cleanedActions = currentActions.map(action => removeUndefinedFields(action));
          
          // Dodaj nową (oczyszczoną) akcję i aktualizuj dokument
          await updateDoc(matchRef, {
            [collectionField]: [...cleanedActions, cleanedAction]
          });
          
          // Akcje są teraz przechowywane tylko w matches - nie duplikujemy w players
          
          // Po udanym zapisie odświeżamy akcje z bazy
          loadActionsForMatch(matchInfoArg.matchId);
        } else {
          console.error("Nie znaleziono meczu o ID:", matchInfoArg.matchId);
        }
      } catch (firebaseError) {
          console.error("Błąd podczas zapisywania akcji w Firebase:", firebaseError);
        
        // Obsługa błędu wewnętrznego stanu Firestore
        const errorHandled = await handleFirestoreError(firebaseError, getDB());
        
          if (!errorHandled) {
            // Akcja została dodana tylko lokalnie - synchronizacja z Firebase nieudana
        }
      }
      
      // Po zapisaniu resetujemy stan
      resetActionState();
      
      return true;
    } catch (error) {
      console.error("Błąd podczas zapisywania akcji:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, getDB());
      
      return false;
    }
  }, [selectedPlayerId, selectedReceiverId, actionType, actionMinute, currentPoints, isP1Active, isP2Active, isP3BoxActive, isP3SiteActive, isContact1Active, isContact2Active, isContact3PlusActive, isShot, isGoal, isPenaltyAreaEntry, isSecondHalf]);

  // Usuwanie akcji
  const handleDeleteAction = useCallback(async (actionId: string) => {
    if (!matchInfo?.matchId) {
      console.error("Brak ID meczu, nie można usunąć akcji");
      return false;
    }
    
    try {
      // Sprawdzamy dostępność bazy danych przez próbę dostępu
      getDB();
    } catch (dbError) {
      console.error("Brak połączenia z bazą danych");
      return false;
    }
    
    // Dodaj potwierdzenie przed usunięciem
    if (!window.confirm("Czy na pewno chcesz usunąć tę akcję?")) {
      return false;
    }
    
    try {
      // NAJPIERW usuwamy z Firebase
      const matchRef = doc(getDB(), "matches", matchInfo.matchId);
      const matchDoc = await getDoc(matchRef);
      
      if (matchDoc.exists()) {
        const matchData = matchDoc.data() as TeamInfo;
        
        // Znajdź akcję, którą chcemy usunąć, aby uzyskać senderId i receiverId
        const actionToDelete = (matchData.actions_packing || []).find(action => action.id === actionId);
        
        // Filtrujemy akcje, aby usunąć tę o podanym ID
        const updatedActions = (matchData.actions_packing || []).filter(action => action.id !== actionId);
        
        // Oczyszczamy wszystkie akcje z wartości undefined
        const cleanedActions = updatedActions.map(action => removeUndefinedFields(action));
        
        // Aktualizujemy dokument z oczyszczonymi akcjami
        await updateDoc(matchRef, {
          actions_packing: cleanedActions
        });
        
        // Akcje są teraz przechowywane tylko w matches - nie duplikujemy w players
        
        // DOPIERO PO UDANYM ZAPISIE usuwamy z lokalnego stanu
        setActions(prevActions => prevActions.filter(action => action.id !== actionId));
        
      } else {
        console.error("Nie znaleziono meczu o ID:", matchInfo.matchId);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Błąd podczas usuwania akcji:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, getDB());
      
      // Pokaż użytkownikowi błąd
      alert("Wystąpił błąd podczas usuwania akcji. Spróbuj ponownie.");
      
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
      try {
        // Pobierz aktualny dokument meczu, aby uzyskać listę akcji do usunięcia z danych zawodników
        const matchRef = doc(getDB(), "matches", matchInfo.matchId);
        const matchDoc = await getDoc(matchRef);
        
        let actionsToRemove: Action[] = [];
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
          actionsToRemove = matchData.actions_packing || [];
        }
        
        // Aktualizacja dokumentu meczu - ustawienie pustej tablicy akcji
        await updateDoc(matchRef, {
          actions_packing: []
        });
        
        // Akcje są teraz przechowywane tylko w matches - nie duplikujemy w players
    
        
        // Czyścimy stan lokalny
        setActions([]);
        return true;
      } catch (error) {
        console.error("Błąd podczas usuwania wszystkich akcji:", error);
        
        // Obsługa błędu wewnętrznego stanu Firestore
        await handleFirestoreError(error, getDB());
        
        return false;
      }
    }
    return false;
  }, [matchInfo?.matchId]);

  // Dodaj nową funkcję do ustawiania połowy meczu
  const setCurrentHalf = useCallback((value: boolean) => {
    setIsSecondHalf(value);
    
    // Zapisujemy wartość w localStorage dla spójności w całej aplikacji
    localStorage.setItem('currentHalf', value ? 'P2' : 'P1');
  }, []);

  // Reset stanu akcji - pełny reset (używany przy zamykaniu modalu)
  const resetActionState = useCallback(() => {
    setSelectedZone(null);
    setCurrentPoints(0);
    setIsP1Active(false);
    setIsP2Active(false);
    setIsP3BoxActive(false);
    setIsP3SiteActive(false);
    setIsContact1Active(false);
    setIsContact2Active(false);
    setIsContact3PlusActive(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
    // DODANO: Resetujemy także wybór zawodników po zapisaniu akcji
    setSelectedPlayerId(null);
    setSelectedReceiverId(null);
    // Wyczyść zapisany czas YouTube
    localStorage.removeItem('tempVideoTimestamp');
    // Nie resetujemy isSecondHalf, bo połowa meczu jest utrzymywana między akcjami
  }, []);

  // Reset tylko punktów i przełączników (zachowuje zawodników, minutę, połowę)
  const resetActionPoints = useCallback(() => {
    setCurrentPoints(0);
    setIsP1Active(false);
    setIsP2Active(false);
    setIsP3BoxActive(false);
    setIsP3SiteActive(false);
    setIsContact1Active(false);
    setIsContact2Active(false);
    setIsContact3PlusActive(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
    // NIE resetujemy: selectedPlayerId, selectedReceiverId, actionMinute, isSecondHalf, selectedZone
  }, []);

  // Funkcja synchronizująca wzbogacone akcje z bazą Firebase
  const syncEnrichedActions = useCallback(async (matchId: string, enrichedActions: Action[]) => {
    // Sprawdzamy, czy mamy jakieś akcje do synchronizacji
    if (!matchId || !enrichedActions.length) return;

    try {
      // Pobierz aktualny dokument meczu
      const matchRef = doc(getDB(), "matches", matchId);
      
      // Aktualizuj dokument z wzbogaconymi akcjami
      await updateDoc(matchRef, {
        actions_packing: enrichedActions.map(action => removeUndefinedFields(action))
      });
      

    } catch (error) {
      console.error("❌ Błąd podczas synchronizacji uzupełnionych akcji:", error);
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, getDB());
    }
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
    isP1Active,
    isP2Active,
    isP3BoxActive,
    isP3SiteActive,
    isContact1Active,
    isContact2Active,
    isContact3PlusActive,
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
    setIsP1Active,
    setIsP2Active,
    setIsP3BoxActive,
    setIsP3SiteActive,
    setIsContact1Active,
    setIsContact2Active,
    setIsContact3PlusActive,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    setIsSecondHalf: setCurrentHalf,
    setActions,
    
    // Funkcje
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
    resetActionPoints,
    loadActionsForMatch,
    syncEnrichedActions
  };
} 