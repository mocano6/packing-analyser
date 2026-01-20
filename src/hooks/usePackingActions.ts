"use client";

import { useState, useCallback, useEffect } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { getDB } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";
// Usunięto import funkcji synchronizacji - akcje są teraz tylko w matches
import { getPlayerFullName } from '@/utils/playerUtils';
import { getOppositeXTValueForZone, zoneNameToIndex, getZoneName, zoneNameToString, getZoneData } from '@/constants/xtValues';

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

export function usePackingActions(players: Player[], matchInfo: TeamInfo | null, actionMode?: "attack" | "defense", selectedDefensePlayers?: string[], actionCategory?: "packing" | "regain" | "loses", loadBothRegainLoses?: boolean) {
  // Stany dla wybranego zawodnika
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  
  // Stany dla strefy
  const [selectedZone, setSelectedZone] = useState<string | number | null>(null);
  
  // Stany dla cech akcji
  const [actionMinute, setActionMinute] = useState<number>(1);
  const [actionType, setActionType] = useState<"pass" | "dribble">("pass");
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [isP0StartActive, setIsP0StartActive] = useState<boolean>(false);
  const [isP1StartActive, setIsP1StartActive] = useState<boolean>(false);
  const [isP2StartActive, setIsP2StartActive] = useState<boolean>(false);
  const [isP3StartActive, setIsP3StartActive] = useState<boolean>(false);
  const [isP0Active, setIsP0Active] = useState<boolean>(false);
  const [isP1Active, setIsP1Active] = useState<boolean>(false);
  const [isP2Active, setIsP2Active] = useState<boolean>(false);
  const [isP3Active, setIsP3Active] = useState<boolean>(false);
  const [isContact1Active, setIsContact1Active] = useState<boolean>(false);
  const [isContact2Active, setIsContact2Active] = useState<boolean>(false);
  const [isContact3PlusActive, setIsContact3PlusActive] = useState<boolean>(false);
  const [isShot, setIsShot] = useState<boolean>(false);
  const [isGoal, setIsGoal] = useState<boolean>(false);
  const [isPenaltyAreaEntry, setIsPenaltyAreaEntry] = useState<boolean>(false);
  const [isControversial, setIsControversial] = useState<boolean>(false);
  
  // Dodaj stan isSecondHalf
  const [isSecondHalf, setIsSecondHalf] = useState<boolean>(false);
  
  // Dodaj stan isBelow8sActive dla regain
  const [isBelow8sActive, setIsBelow8sActive] = useState<boolean>(false);
  
  // Dodaj stan isReaction5sActive dla loses
  const [isReaction5sActive, setIsReaction5sActive] = useState<boolean>(false);
  
  // Dodaj stan isAutActive dla loses
  const [isAutActive, setIsAutActive] = useState<boolean>(false);
  
  // Dodaj stan isReaction5sNotApplicableActive dla loses
  const [isReaction5sNotApplicableActive, setIsReaction5sNotApplicableActive] = useState<boolean>(false);
  
  // Dodaj stan isPMAreaActive dla loses
  const [isPMAreaActive, setIsPMAreaActive] = useState<boolean>(false);
  
  // Dodaj stan playersBehindBall dla regain (liczba partnerów przed piłką)
  const [playersBehindBall, setPlayersBehindBall] = useState<number>(0);
  
  // Dodaj stan opponentsBehindBall dla regain/loses (liczba przeciwników za piłką)
  const [opponentsBehindBall, setOpponentsBehindBall] = useState<number>(0);
  
  // Dodaj stan playersLeftField dla regain/loses (liczba zawodników naszego zespołu, którzy opuścili boisko)
  const [playersLeftField, setPlayersLeftField] = useState<number>(0);
  
  // Dodaj stan opponentsLeftField dla regain/loses (liczba zawodników przeciwnika, którzy opuścili boisko)
  const [opponentsLeftField, setOpponentsLeftField] = useState<number>(0);
  
  // Dane o akcjach
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Funkcja synchronizująca wzbogacone akcje z bazą Firebase
  const syncEnrichedActions = useCallback(async (matchId: string, enrichedActions: Action[]) => {
    // Sprawdzamy, czy mamy jakieś akcje do synchronizacji
    if (!matchId || !enrichedActions.length) return;

    try {
      // Pobierz aktualny dokument meczu
      const matchRef = doc(getDB(), "matches", matchId);
      
      // Określamy kolekcję na podstawie kategorii akcji
      let collectionField: string;
      if (actionCategory === "regain") {
        collectionField = "actions_regain";
      } else if (actionCategory === "loses") {
        collectionField = "actions_loses";
      } else {
        collectionField = "actions_packing";
      }
      
      // Aktualizuj dokument z wzbogaconymi akcjami
      await updateDoc(matchRef, {
        [collectionField]: enrichedActions.map(action => removeUndefinedFields(action))
      });

    } catch (error) {
      console.error("❌ Błąd podczas synchronizacji uzupełnionych akcji:", error);
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, getDB());
    }
  }, [actionCategory]);

  // Funkcja ładująca akcje dla danego meczu
  const loadActionsForMatch = useCallback(async (matchId: string) => {
    try {
      setIsLoading(true);
      
      // Pobierz dokument meczu
      const matchRef = doc(getDB(), "matches", matchId);
      const matchDoc = await getDoc(matchRef);
      
      if (matchDoc.exists()) {
        const matchData = matchDoc.data() as TeamInfo;
        // Ładujemy akcje z odpowiedniej kolekcji w zależności od kategorii
        let loadedActions: Action[];
        if (loadBothRegainLoses) {
          // Gdy chcemy pokazać obie kategorie (regain i loses), ładujemy z obu kolekcji
          const regainActions = matchData.actions_regain || [];
          const losesActions = matchData.actions_loses || [];
          loadedActions = [...regainActions, ...losesActions];
        } else if (actionCategory === "regain") {
          loadedActions = matchData.actions_regain || [];
        } else if (actionCategory === "loses") {
          loadedActions = matchData.actions_loses || [];
        } else {
          // Dla packing ładujemy akcje z obu kolekcji (packing i unpacking)
          const packingActions = matchData.actions_packing || [];
          const unpackingActions = matchData.actions_unpacking || [];
          loadedActions = [...packingActions, ...unpackingActions];
        }
        
        

        
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
  }, [actionCategory, players, syncEnrichedActions]);

  // Pobieranie akcji przy zmianie meczu lub kategorii akcji
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
  }, [matchInfo?.matchId, actionCategory, loadBothRegainLoses, loadActionsForMatch]);

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

    // Walidacja w zależności od kategorii i trybu
    if (actionCategory === "regain") {
      // W akcjach regain sprawdzamy tylko jednego zawodnika (odbiorcę piłki)
      if (!selectedPlayerId) {
        console.error("Brak ID zawodnika odbierającego piłkę (selectedPlayerId jest null/undefined)");
        return false;
      }
    } else if (actionCategory === "loses") {
      // W akcjach loses sprawdzamy tylko jednego zawodnika (zawodnika, który stracił piłkę)
      if (!selectedPlayerId) {
        console.error("Brak ID zawodnika, który stracił piłkę (selectedPlayerId jest null/undefined)");
        return false;
      }
    } else if (actionMode === "defense") {
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

    // Dodatkowa walidacja biznesowa dla akcji packing w ataku:
    // - xT nie może być ujemne ani równe 0
    // - liczba miniętych przeciwników (packingValue / currentPoints) musi być >= 1
    // - musi być zaznaczona co najmniej jedna z opcji P0–P3 (Start lub koniec) LUB liczba kontaktów (1T/2T/3T+)
    if (actionCategory === "packing" && actionMode === "attack") {
      // Oblicz różnicę xT (jak w PxT: xTEnd - xTStart)
      const xTStart = typeof startZoneXT === "number" ? startZoneXT : undefined;
      const xTEnd = typeof endZoneXT === "number" ? endZoneXT : undefined;
      const xTDifference =
        xTStart !== undefined && xTEnd !== undefined
          ? xTEnd - xTStart
          : xTEnd !== undefined
            ? xTEnd
            : undefined;

      const packingPoints = typeof packingValue === "number" ? packingValue : currentPoints;

      const hasPStart =
        isP0StartActive ||
        isP1StartActive ||
        isP2StartActive ||
        isP3StartActive;

      const hasPEnd =
        isP0Active ||
        isP1Active ||
        isP2Active ||
        isP3Active;

      const hasContact =
        isContact1Active ||
        isContact2Active ||
        isContact3PlusActive;

      // Wymagamy co najmniej jednej z grup P-start / P-end / Contact
      if (!hasPStart && !hasPEnd && !hasContact) {
        if (typeof window !== "undefined") {
          alert("Akcja musi mieć zaznaczoną co najmniej jedną opcję P0–P3 (Start lub Koniec) lub liczbę kontaktów (1T / 2T / 3T+).");
        }
        return false;
      }

      // Sprawdzenie wartości xT oraz liczby miniętych przeciwników
      const isXTInvalid = xTDifference !== undefined && xTDifference <= 0;
      const hasTooFewBypassedOpponents = packingPoints < 1;

      if (isXTInvalid || hasTooFewBypassedOpponents) {
        if (typeof window !== "undefined") {
          alert("Akcja o ujemnej wartości, lub brak miniętych przeciwników. Sprawdź poprawność wartości, lub pomiń akcję");
        }
        return false;
      }
    }
    
    try {
      // Konwertujemy strefy na format literowo-liczbowy, jeśli podano liczby
      // Najpierw upewniamy się, że startZone i endZone nie są null
      const formattedStartZone = startZone !== null && startZone !== undefined ? 
        (typeof startZone === 'number' ? convertZoneNumberToString(startZone) : String(startZone)) 
        : "";
      const formattedEndZone = endZone !== null && endZone !== undefined ? 
        (typeof endZone === 'number' ? convertZoneNumberToString(endZone) : String(endZone)) 
        : "";
      
      // Upewniamy się, że startZoneXT i endZoneXT mają wartości numeryczne
      // Nowa logika: nigdy nie używaj wartości domyślnej 0 - jeśli nie ma wartości, użyj undefined
      const xTStart = typeof startZoneXT === 'number' ? startZoneXT : undefined;
      const xTEnd = typeof endZoneXT === 'number' ? endZoneXT : undefined;
      
      // Pobierz czas z YouTube z localStorage
      const videoTimestamp = localStorage.getItem('tempVideoTimestamp');
      const parsedVideoTimestamp = videoTimestamp !== null && videoTimestamp !== '' ? parseInt(videoTimestamp, 10) : undefined;
      const isValidTimestamp = parsedVideoTimestamp !== undefined && !isNaN(parsedVideoTimestamp) && parsedVideoTimestamp >= 0;

      // Surowy timestamp bez korekty (-10s)
      const videoTimestampRaw = localStorage.getItem('tempVideoTimestampRaw');
      const parsedVideoTimestampRaw = videoTimestampRaw !== null && videoTimestampRaw !== '' ? parseInt(videoTimestampRaw, 10) : undefined;
      const isValidTimestampRaw = parsedVideoTimestampRaw !== undefined && !isNaN(parsedVideoTimestampRaw) && parsedVideoTimestampRaw >= 0;
      
      // PxT będzie obliczane dynamicznie na froncie
      
      // Oblicz opposite wartości dla regain i loses PRZED utworzeniem obiektu akcji
      let regainOppositeXT: number | undefined;
      let regainOppositeZone: string | undefined;
      let regainIsAttack: boolean | undefined;
      let losesOppositeXT: number | undefined;
      let losesOppositeZone: string | undefined;
      
      if (actionCategory === "regain" || actionCategory === "loses") {
        
        // Używamy formattedStartZone - dla regain startZone i endZone są takie same
        const zoneToProcess = formattedStartZone;
        
        if (zoneToProcess && zoneToProcess.trim() !== "") {
          // Konwertuj strefę na nazwę (format "A1")
          const startZoneName = typeof zoneToProcess === 'string' 
            ? zoneToProcess.toUpperCase() 
            : convertZoneNumberToString(zoneToProcess);
          
          
          // Oblicz opposite strefę
          const zoneIndex = zoneNameToIndex(startZoneName);
          
          if (zoneIndex !== null) {
            // Oblicz opposite indeks
            const row = Math.floor(zoneIndex / 12);
            const col = zoneIndex % 12;
            const oppositeRow = 7 - row;
            const oppositeCol = 11 - col;
            const oppositeIndex = oppositeRow * 12 + oppositeCol;
            
            
            // Pobierz opposite strefę i xT
            const oppositeZoneData = getZoneName(oppositeIndex);
            
            if (oppositeZoneData) {
              regainOppositeZone = zoneNameToString(oppositeZoneData);
              regainOppositeXT = getOppositeXTValueForZone(zoneIndex);
            } else {
              console.warn(`⚠️ DEBUG regain - nie można pobrać oppositeZoneData dla indeksu ${oppositeIndex}`);
            }
          } else {
            console.warn(`⚠️ DEBUG regain - nie można obliczyć zoneIndex dla strefy ${startZoneName}`);
          }
        } else {
          console.warn(`⚠️ DEBUG regain - brak lub pusty formattedStartZone: "${zoneToProcess}"`);
        }
        
        if (actionCategory === "regain") {
        // Określ czy to atak czy obrona na podstawie xT odbiorców
        const receiverXT = xTEnd !== undefined ? xTEnd : 0;
        regainIsAttack = receiverXT < 0.02; // xT < 0.02 to atak
        } else if (actionCategory === "loses") {
          // Dla loses używamy tych samych wartości co dla regain
          losesOppositeXT = regainOppositeXT;
          losesOppositeZone = regainOppositeZone;
        }
      }
      
      // Tworzymy nową akcję
      const newAction: Action = {
        id: uuidv4(), // Generujemy unikalny identyfikator
        matchId: matchInfoArg.matchId,
        teamId: matchInfoArg.team, // Używamy team zamiast teamId dla spójności
        senderId: selectedPlayerId || '',
        receiverId: (actionCategory === "regain" || actionCategory === "loses") ? undefined : (actionType === "pass" ? selectedReceiverId || undefined : undefined),
        // Dla regain i loses nie używamy fromZone/toZone
        ...(actionCategory !== "regain" && actionCategory !== "loses" && {
        fromZone: formattedStartZone,
        toZone: formattedEndZone,
        }),
        actionType: actionType,
        minute: actionMinute,
        // packingPoints tylko dla akcji innych niż regain i loses
        ...(actionCategory !== "regain" && actionCategory !== "loses" && {
        packingPoints: packingValue || currentPoints,
        }),
        ...(isValidTimestamp && { videoTimestamp: parsedVideoTimestamp }),
        ...(isValidTimestampRaw && { videoTimestampRaw: parsedVideoTimestampRaw }),
        // Przypisujemy wartości xT tylko jeśli są zdefiniowane i NIE jest to regain ani loses
        ...(actionCategory !== "regain" && actionCategory !== "loses" && xTStart !== undefined && { xTValueStart: xTStart }),
        ...(actionCategory !== "regain" && actionCategory !== "loses" && xTEnd !== undefined && { xTValueEnd: xTEnd }),
        // PxT będzie obliczane dynamicznie na froncie
        // Pola P0-P3 Start tylko dla akcji innych niż regain i loses
        ...(actionCategory !== "regain" && actionCategory !== "loses" && {
        isP0Start: isP0StartActive,
        isP1Start: isP1StartActive,
        isP2Start: isP2StartActive,
        isP3Start: isP3StartActive,
        }),
        // Pola P0-P3 tylko dla akcji innych niż regain i loses
        ...(actionCategory !== "regain" && actionCategory !== "loses" && {
        isP0: isP0Active,
        isP1: isP1Active,
        isP2: isP2Active,
        isP3: isP3Active,
        }),
        // Pola Contact tylko dla akcji innych niż regain i loses
        ...(actionCategory !== "regain" && actionCategory !== "loses" && {
        isContact1: isContact1Active,
        isContact2: isContact2Active,
        isContact3Plus: isContact3PlusActive,
        }),
        // Pola isShot, isGoal, isPenaltyAreaEntry tylko dla akcji innych niż regain i loses
        ...(actionCategory !== "regain" && actionCategory !== "loses" && {
        isShot: isShot,
        isGoal: isGoal,
        isPenaltyAreaEntry: isPenaltyAreaEntry,
        }),
        // Zawsze zapisujemy informację o połowie meczu (nie jako opcjonalną)
        isSecondHalf: isSecondHalfParam !== undefined ? isSecondHalfParam : isSecondHalf,
        isControversial: isControversial,
        // Dodajemy tryb akcji i zawodników obrony (tylko dla akcji innych niż regain i loses)
        ...(actionCategory !== "regain" && actionCategory !== "loses" && {
        mode: actionMode,
        ...(actionMode === "defense" && selectedDefensePlayers && { defensePlayers: selectedDefensePlayers }),
        }),
        ...(actionCategory === "regain" && (() => {
          // Dla regainów: xTValueStart i xTValueEnd są takie same, używamy jednej wartości dla obrony
          const defenseXT = xTStart !== undefined ? xTStart : (xTEnd !== undefined ? xTEnd : undefined);
          
          // Jeśli defenseXT nie jest dostępne, oblicz z strefy
          if (defenseXT === undefined && formattedStartZone) {
            const startZoneName = typeof formattedStartZone === 'string' 
              ? formattedStartZone.toUpperCase() 
              : convertZoneNumberToString(formattedStartZone);
            const zoneIndex = zoneNameToIndex(startZoneName);
            if (zoneIndex !== null) {
              const zoneData = getZoneData(zoneIndex);
              if (zoneData && typeof zoneData.value === 'number') {
                // defenseXT będzie ustawione później w regainFields
              }
            }
          }
          
          const regainFields: any = {
            // Zamieniamy zapis atak/obrona: wybrana strefa = atak, opposite = obrona
            regainAttackZone: formattedStartZone, // Strefa ataku (wybrana strefa)
            regainDefenseZone: regainOppositeZone || formattedStartZone, // Strefa obrony (opposite zone)
            isBelow8s: isBelow8sActive, 
            playersBehindBall: playersBehindBall, 
            opponentsBehindBall: opponentsBehindBall,
            playersLeftField: playersLeftField,
            opponentsLeftField: opponentsLeftField,
            totalPlayersOnField: 11 - playersLeftField,
            totalOpponentsOnField: 11 - opponentsLeftField,
            // Dodajemy pola P0-P3 i Contact, aby były zapisywane i mogły być odczytane podczas edycji
            // Używamy wartości bezpośrednio z closure, aby upewnić się, że są aktualne
            isP0: isP0Active === true,
            isP1: isP1Active === true,
            isP2: isP2Active === true,
            isP3: isP3Active === true,
            isContact1: isContact1Active === true,
            isContact2: isContact2Active === true,
            isContact3Plus: isContact3PlusActive === true,
            // Dodajemy pola isShot, isGoal, isPenaltyAreaEntry dla regain (używane w modalu)
            isShot: isShot === true,
            isGoal: isGoal === true,
            isPenaltyAreaEntry: isPenaltyAreaEntry === true
          };
          
          // Dodaj wartości xT dla regainów - zapis odwrócony: atak = strefa wyboru, obrona = opposite
          if (defenseXT !== undefined) {
            regainFields.regainAttackXT = defenseXT; // Wartość xT w ataku (z wybranej strefy)
          } else if (formattedStartZone) {
            // Jeśli attackXT nie jest dostępne, oblicz z wybranej strefy
            const startZoneName = typeof formattedStartZone === 'string' 
              ? formattedStartZone.toUpperCase() 
              : convertZoneNumberToString(formattedStartZone);
            const zoneIndex = zoneNameToIndex(startZoneName);
            if (zoneIndex !== null) {
              const zoneData = getZoneData(zoneIndex);
              if (zoneData && typeof zoneData.value === 'number') {
                regainFields.regainAttackXT = zoneData.value;
              }
            }
          }
          if (regainOppositeXT !== undefined) {
            regainFields.regainDefenseXT = regainOppositeXT; // Wartość xT w obronie (z opposite zone)
          }
          if (regainIsAttack !== undefined) {
            regainFields.isAttack = regainIsAttack;
          }
          
          return regainFields;
        })()),
        ...(actionCategory === "loses" && (() => {
          // Dla loses: xTValueStart i xTValueEnd są takie same, używamy jednej wartości dla obrony
          let defenseXT = xTStart !== undefined ? xTStart : (xTEnd !== undefined ? xTEnd : undefined);
          
          const losesFields: any = {
            // Zamieniamy zapis atak/obrona: wybrana strefa = atak, opposite = obrona
            losesAttackZone: formattedStartZone, // Strefa ataku (wybrana strefa)
            losesDefenseZone: losesOppositeZone || formattedStartZone, // Strefa obrony (opposite zone)
          isBelow8s: isBelow8sActive, 
          isReaction5s: isReaction5sActive, 
          isAut: isAutActive,
          isReaction5sNotApplicable: isReaction5sNotApplicableActive,
          playersBehindBall: playersBehindBall, 
            opponentsBehindBall: opponentsBehindBall,
            playersLeftField: playersLeftField,
            opponentsLeftField: opponentsLeftField,
            totalPlayersOnField: 11 - playersLeftField,
            totalOpponentsOnField: 11 - opponentsLeftField,
            // Dodajemy pola P0-P3 i Contact, aby były zapisywane i mogły być odczytane podczas edycji
            // Używamy wartości bezpośrednio z closure, aby upewnić się, że są aktualne
            isP0: isP0Active === true,
            isP1: isP1Active === true,
            isP2: isP2Active === true,
            isP3: isP3Active === true,
            isContact1: isContact1Active === true,
            isContact2: isContact2Active === true,
            isContact3Plus: isContact3PlusActive === true,
            // Dodajemy pola isShot, isGoal, isPenaltyAreaEntry, isPMArea dla loses
            isShot: isShot === true,
            isGoal: isGoal === true,
            isPenaltyAreaEntry: isPenaltyAreaEntry === true,
            isPMArea: isPMAreaActive === true
          };
          
          // Dodaj wartości xT dla loses - zapis odwrócony: atak = strefa wyboru, obrona = opposite
          if (typeof defenseXT === 'number') {
            losesFields.losesAttackXT = defenseXT; // Wartość xT w ataku (z wybranej strefy)
          } else if (formattedStartZone) {
            // Jeśli attackXT nie jest dostępne, oblicz z wybranej strefy
            const startZoneName = typeof formattedStartZone === 'string' 
              ? formattedStartZone.toUpperCase() 
              : convertZoneNumberToString(formattedStartZone);
            const zoneIndex = zoneNameToIndex(startZoneName);
            if (zoneIndex !== null) {
              const zoneData = getZoneData(zoneIndex);
              if (zoneData && typeof zoneData.value === 'number') {
                losesFields.losesAttackXT = zoneData.value;
              }
            }
          }
          if (typeof losesOppositeXT === 'number') {
            losesFields.losesDefenseXT = losesOppositeXT; // Wartość xT w obronie (z opposite zone)
          }
          
          return losesFields;
        })())
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
      
      // DEBUG: Sprawdzamy wartości stanu przed zapisem
      if (actionCategory === "loses") {
      }
      
      // Usuwamy pola undefined z obiektu akcji przed zapisem
      let cleanedAction = removeUndefinedFields(newAction);
      
      // Dla akcji regain i loses usuwamy niepotrzebne pola, które nie są używane
      // UWAGA: Nie usuwamy pól isP0, isP1, isP2, isP3, isContact1, isContact2, isContact3Plus,
      // isShot, isGoal, isPenaltyAreaEntry, isPMArea - są one używane w modalu podczas edycji akcji
      if (actionCategory === "regain") {
        const { 
          xTValueStart, 
          xTValueEnd, 
          isP0Start, 
          isP1Start, 
          isP2Start, 
          isP3Start, 
          fromZone,
          toZone,
          oppositeXT,
          mode,
          oppositeZone,
          regainZone,
          ...rest 
        } = cleanedAction as any;
        // Zachowujemy wszystkie pola boolean, używając wartości bezpośrednio z closure
        cleanedAction = {
          ...rest,
          isP0: isP0Active === true,
          isP1: isP1Active === true,
          isP2: isP2Active === true,
          isP3: isP3Active === true,
          isContact1: isContact1Active === true,
          isContact2: isContact2Active === true,
          isContact3Plus: isContact3PlusActive === true,
          isShot: isShot === true,
          isGoal: isGoal === true,
          isPenaltyAreaEntry: isPenaltyAreaEntry === true
        } as Action;
      } else if (actionCategory === "loses") {
        const { 
          xTValueStart, 
          xTValueEnd, 
          isP0Start, 
          isP1Start, 
          isP2Start, 
          isP3Start, 
          fromZone,
          toZone,
          mode,
          packingPoints,
          ...rest 
        } = cleanedAction as any;
        // Zachowujemy wszystkie pola boolean, używając wartości bezpośrednio z closure
        cleanedAction = {
          ...rest,
          isP0: isP0Active === true,
          isP1: isP1Active === true,
          isP2: isP2Active === true,
          isP3: isP3Active === true,
          isContact1: isContact1Active === true,
          isContact2: isContact2Active === true,
          isContact3Plus: isContact3PlusActive === true,
          isShot: isShot === true,
          isGoal: isGoal === true,
          isPenaltyAreaEntry: isPenaltyAreaEntry === true,
          isPMArea: isPMAreaActive === true
        } as Action;
      }
      
      // DEBUG: Wypisujemy strukturę obiektu akcji do konsoli
      if (actionCategory === "regain") {
      }
      if (actionCategory === "loses") {
      }
      
      // Zapisujemy do Firebase
      try {
        // Pobierz aktualny dokument meczu
        const matchRef = doc(getDB(), "matches", matchInfoArg.matchId);
        const matchDoc = await getDoc(matchRef);
        
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
          
          // Wybieramy kolekcję w zależności od kategorii i trybu
          let collectionField: string;
          if (actionCategory === "regain") {
            collectionField = "actions_regain";
          } else if (actionCategory === "loses") {
            collectionField = "actions_loses";
          } else {
            collectionField = actionMode === "defense" ? "actions_unpacking" : "actions_packing";
          }
          const currentActions = (matchData[collectionField as keyof TeamInfo] as Action[] | undefined) || [];
          
          // Upewniamy się, że wszystkie akcje są oczyszczone z undefined
          const cleanedActions = currentActions.map((action: Action) => removeUndefinedFields(action));
          
          // Dodaj nową (oczyszczoną) akcję i aktualizuj dokument
          // Upewniamy się, że wszystkie pola boolean są zapisane, nawet jeśli są false
          const actionToSave = {
            ...cleanedAction,
            ...(actionCategory === "regain" || actionCategory === "loses" ? {
              isP0: cleanedAction.isP0 ?? false,
              isP1: cleanedAction.isP1 ?? false,
              isP2: cleanedAction.isP2 ?? false,
              isP3: cleanedAction.isP3 ?? false,
              isContact1: cleanedAction.isContact1 ?? false,
              isContact2: cleanedAction.isContact2 ?? false,
              isContact3Plus: cleanedAction.isContact3Plus ?? false,
              isShot: cleanedAction.isShot ?? false,
              isGoal: cleanedAction.isGoal ?? false,
              isPenaltyAreaEntry: cleanedAction.isPenaltyAreaEntry ?? false,
              ...(actionCategory === "loses" && {
                isPMArea: (cleanedAction as any).isPMArea ?? false
              })
            } : {})
          };
          
          await updateDoc(matchRef, {
            [collectionField]: [...cleanedActions, actionToSave]
          });
          
          // Console log z całym obiektem zapisanej akcji
          
          // Specjalny console log dla akcji loses
          if (actionCategory === "loses") {
          }
          
          // Akcje są teraz przechowywane tylko w matches - nie duplikujemy w players
          
          // Po udanym zapisie odświeżamy akcje z bazy - WAŻNE: używamy await, aby upewnić się, że akcje są załadowane
          await loadActionsForMatch(matchInfoArg.matchId);
          
          // Dodajemy akcję do lokalnego stanu po odświeżeniu z bazy (aby uniknąć duplikacji)
          // setActions jest już wywoływane w loadActionsForMatch, więc nie musimy tego robić tutaj
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
  }, [selectedPlayerId, selectedReceiverId, actionType, actionMinute, currentPoints, isP0StartActive, isP1StartActive, isP2StartActive, isP3StartActive, isP0Active, isP1Active, isP2Active, isP3Active, isContact1Active, isContact2Active, isContact3PlusActive, isShot, isGoal, isPenaltyAreaEntry, isSecondHalf, isBelow8sActive, isReaction5sActive, isAutActive, isReaction5sNotApplicableActive, isPMAreaActive, playersBehindBall, opponentsBehindBall, playersLeftField, opponentsLeftField, actionCategory, actionMode, selectedDefensePlayers, loadActionsForMatch]);

  // Funkcja pomocnicza do określenia kategorii akcji
  const getActionCategory = (action: Action): "packing" | "regain" | "loses" => {
    // Loses: ma isReaction5s (to jest główny wskaźnik dla loses)
    if (action.isReaction5s !== undefined) {
      return "loses";
    }
    // Regain: ma playersBehindBall lub opponentsBehindBall, ale NIE ma isReaction5s
    if (action.playersBehindBall !== undefined || 
        action.opponentsBehindBall !== undefined ||
        action.totalPlayersOnField !== undefined ||
        action.totalOpponentsOnField !== undefined ||
        action.playersLeftField !== undefined ||
        action.opponentsLeftField !== undefined) {
      return "regain";
    }
    // Packing: domyślnie
    return "packing";
  };

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
        
        // Znajdź akcję w lokalnym stanie, aby określić jej kategorię
        const actionToDelete = actions.find(a => a.id === actionId);
        
        // Jeśli nie ma w lokalnym stanie, sprawdź wszystkie kolekcje w Firebase
        let foundAction: Action | undefined = actionToDelete;
        let collectionField: string = "actions_packing";
        
        if (!foundAction) {
          // Sprawdź wszystkie kolekcje
          const packingActions = matchData.actions_packing || [];
          const unpackingActions = matchData.actions_unpacking || [];
          const regainActions = matchData.actions_regain || [];
          const losesActions = matchData.actions_loses || [];
          
          foundAction = [...packingActions, ...unpackingActions, ...regainActions, ...losesActions]
            .find((action: Action) => action.id === actionId);
          
          if (foundAction) {
            const actionCategory = getActionCategory(foundAction);
            if (actionCategory === "regain") {
              collectionField = "actions_regain";
            } else if (actionCategory === "loses") {
              collectionField = "actions_loses";
            } else {
              // Dla packing sprawdzamy tryb (attack/defense)
              const isDefense = foundAction.mode === "defense";
              collectionField = isDefense ? "actions_unpacking" : "actions_packing";
            }
          }
        } else {
          // Określ kategorię na podstawie akcji z lokalnego stanu
          const actionCategory = getActionCategory(foundAction);
          if (actionCategory === "regain") {
            collectionField = "actions_regain";
          } else if (actionCategory === "loses") {
            collectionField = "actions_loses";
          } else {
            // Dla packing sprawdzamy tryb (attack/defense)
            const isDefense = foundAction.mode === "defense";
            collectionField = isDefense ? "actions_unpacking" : "actions_packing";
          }
        }
        
        if (!foundAction) {
          console.error("Nie znaleziono akcji o ID:", actionId);
          return false;
        }
        
        // Pobierz akcje z odpowiedniej kolekcji
        const currentActions = (matchData[collectionField as keyof TeamInfo] as Action[] | undefined) || [];
        
        // Filtrujemy akcje, aby usunąć tę o podanym ID
        const updatedActions = currentActions.filter((action: Action) => action.id !== actionId);
        
        // Oczyszczamy wszystkie akcje z wartości undefined
        const cleanedActions = updatedActions.map((action: Action) => removeUndefinedFields(action));
        
        // Aktualizujemy dokument z oczyszczonymi akcjami
        await updateDoc(matchRef, {
          [collectionField]: cleanedActions
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
  }, [matchInfo?.matchId, actions]);

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
    setIsP0StartActive(false);
    setIsP1StartActive(false);
    setIsP2StartActive(false);
    setIsP3StartActive(false);
    setIsP0Active(false);
    setIsP1Active(false);
    setIsP2Active(false);
    setIsP3Active(false);
    setIsContact1Active(false);
    setIsContact2Active(false);
    setIsContact3PlusActive(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
    setIsControversial(false);
    // DODANO: Resetujemy także wybór zawodników po zapisaniu akcji
    setSelectedPlayerId(null);
    setSelectedReceiverId(null);
    // Wyczyść zapisany czas YouTube
    localStorage.removeItem('tempVideoTimestamp');
    localStorage.removeItem('tempVideoTimestampRaw');
    // Nie resetujemy isSecondHalf, bo połowa meczu jest utrzymywana między akcjami
  }, []);

  // Reset tylko punktów i przełączników (zachowuje zawodników, minutę, połowę)
  const resetActionPoints = useCallback(() => {
    setCurrentPoints(0);
    setIsP0StartActive(false);
    setIsP1StartActive(false);
    setIsP2StartActive(false);
    setIsP3StartActive(false);
    setIsP0Active(false);
    setIsP1Active(false);
    setIsP2Active(false);
    setIsP3Active(false);
    setIsContact1Active(false);
    setIsContact2Active(false);
    setIsContact3PlusActive(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
    setIsControversial(false);
    setIsBelow8sActive(false);
    setIsReaction5sActive(false);
    setIsAutActive(false);
    setIsReaction5sNotApplicableActive(false);
    setIsPMAreaActive(false);
    setPlayersBehindBall(0);
    setOpponentsBehindBall(0);
    // NIE resetujemy: selectedPlayerId, selectedReceiverId, actionMinute, isSecondHalf, selectedZone
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
    isP0StartActive,
    isP1StartActive,
    isP2StartActive,
    isP3StartActive,
    isP0Active,
    isP1Active,
    isP2Active,
    isP3Active,
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
    setIsP0StartActive,
    setIsP1StartActive,
    setIsP2StartActive,
    setIsP3StartActive,
    setIsP0Active,
    setIsP1Active,
    setIsP2Active,
    setIsP3Active,
    setIsContact1Active,
    setIsContact2Active,
    setIsContact3PlusActive,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    isControversial,
    setIsControversial,
    setIsSecondHalf: setCurrentHalf,
    isBelow8sActive,
    setIsBelow8sActive,
    isReaction5sActive,
    setIsReaction5sActive,
    isAutActive,
    setIsAutActive,
    isReaction5sNotApplicableActive,
    setIsReaction5sNotApplicableActive,
    isPMAreaActive,
    setIsPMAreaActive,
    playersBehindBall,
    setPlayersBehindBall,
    opponentsBehindBall,
    setOpponentsBehindBall,
    playersLeftField,
    setPlayersLeftField,
    opponentsLeftField,
    setOpponentsLeftField,
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