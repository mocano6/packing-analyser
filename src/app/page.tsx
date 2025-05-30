// src/app/page.tsx
"use client";

import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Tab, Player, TeamInfo, PlayerMinutes, Action } from "@/types";
import Instructions from "@/components/Instructions/Instructions";
import PlayersGrid from "@/components/PlayersGrid/PlayersGrid";
import Tabs from "@/components/Tabs/Tabs";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useActionsState } from "@/hooks/useActionsState";
import { usePackingActions } from "@/hooks/usePackingActions";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { TEAMS, fetchTeams } from "@/constants/teamsLoader";
import { getXTValueFromMatrix } from "@/constants/xtValues";
import styles from "./page.module.css";
import OfflineStatus from '@/components/OfflineStatus/OfflineStatus';
import ExportButton from "@/components/ExportButton/ExportButton";
import ImportButton from "@/components/ImportButton/ImportButton";
import { initializeTeams, checkTeamsCollection } from "@/utils/initializeTeams";
import { useAuth } from "@/hooks/useAuth";
import toast from 'react-hot-toast';
import OfflineStatusBanner from "@/components/OfflineStatusBanner/OfflineStatusBanner";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import PlayerModal from "@/components/PlayerModal/PlayerModal";
import PlayerMinutesModal from "@/components/PlayerMinutesModal/PlayerMinutesModal";
import MatchInfoModal from "@/components/MatchInfoModal/MatchInfoModal";
import Link from "next/link";
import ActionModal from "@/components/ActionModal/ActionModal";

// Rozszerzenie interfejsu Window
declare global {
  interface Window {
    _isRefreshingMatches?: boolean;
  }
}

// Dynamiczny import komponentów używanych warunkowo dla lepszej wydajności
const ActionSection = dynamic(
  () => import("@/components/ActionSection/ActionSection"),
  {
    ssr: false,
  }
);
const ActionsTable = dynamic(
  () => import("@/components/ActionsTable/ActionsTable"),
  {
    ssr: false,
  }
);
const MatchInfoHeader = dynamic(
  () => import("@/components/MatchInfoHeader/MatchInfoHeader")
);

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

export default function Page() {
  const [activeTab] = React.useState<"packing">("packing");
  const [selectedTeam, setSelectedTeam] = React.useState<string>(TEAMS.REZERWY.id);
  const [isPlayerMinutesModalOpen, setIsPlayerMinutesModalOpen] = React.useState(false);
  const [editingMatch, setEditingMatch] = React.useState<TeamInfo | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false);
  const [startZone, setStartZone] = React.useState<number | null>(null);
  const [endZone, setEndZone] = React.useState<number | null>(null);
  const [isNewMatchModalOpen, setIsNewMatchModalOpen] = React.useState(false);
  const [isSecondHalf, setIsSecondHalf] = React.useState(false);
  const [matchesListRefreshCounter, setMatchesListRefreshCounter] = useState(0);
  const [selectedZone, setSelectedZone] = React.useState<string | number | null>(null);
  const [isActionEditModalOpen, setIsActionEditModalOpen] = React.useState(false);
  const [editingAction, setEditingAction] = React.useState<Action | null>(null);

  const useActionsStateRef = useRef<any>(null);

  // Custom hooks
  const {
    players,
    isModalOpen,
    editingPlayerId,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
    testConnection,
  } = usePlayersState();

  const {
    matchInfo,
    allMatches,
    isMatchModalOpen,
    toggleMatchModal,
    handleSaveMatchInfo,
    handleSelectMatch,
    handleDeleteMatch,
    handleSavePlayerMinutes,
    fetchMatches,
    isOfflineMode
  } = useMatchInfo();

  const packingActions = usePackingActions(players, matchInfo);
  
  const {
    actions,
    selectedPlayerId,
    selectedReceiverId,
    selectedZone: hookSelectedZone,
    currentPoints,
    actionMinute,
    actionType,
    isP3Active,
    isShot,
    isGoal,
    isPenaltyAreaEntry,
    setSelectedPlayerId,
    setSelectedReceiverId,
    setCurrentPoints,
    setActionMinute,
    setActionType: originalSetActionType,
    setIsP3Active,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
    setActions,
  } = packingActions;

  const { logout } = useAuth();

  // Automatycznie aktywuj tryb deweloperski (obejście uwierzytelniania)
  useEffect(() => {
    console.log('🔓 Aktywacja trybu deweloperskiego - obejście uwierzytelniania');
    localStorage.setItem('packing_app_bypass_auth', 'true');
  }, []);

  // Gdy hookSelectedZone się zmienia, aktualizujemy lokalny selectedZone
  useEffect(() => {
    setSelectedZone(hookSelectedZone);
  }, [hookSelectedZone]);

  const filteredPlayers = useMemo(() => {
    // Filtruj graczy na podstawie wybranego zespołu
    return players.filter(player => {
      return player.teams && player.teams.includes(selectedTeam);
    });
  }, [players, selectedTeam]);

  React.useEffect(() => {
    // Sprawdzamy, czy w localStorage jest zapisana wartość połowy
    const savedHalf = localStorage.getItem('currentHalf');
    if (savedHalf) {
      const isP2 = savedHalf === 'P2';
      console.log(`page.tsx: Wczytano wartość połowy z localStorage: ${savedHalf}`);
      setIsSecondHalf(isP2);
    }
  }, []);

  // Dodajemy useCallback dla fetchMatches, aby można było bezpiecznie używać go w efektach
  const refreshMatchesList = useCallback(async (teamId?: string) => {
    console.log("⚡ Wymuszam odświeżenie listy meczów dla zespołu:", teamId || selectedTeam);
    
    try {
      // Używamy blokady, aby zapobiec wielokrotnym wywołaniom
      if (window._isRefreshingMatches) {
        console.log("🚫 Odświeżanie listy meczów już trwa, pomijam");
        return;
      }
      
      window._isRefreshingMatches = true;
      
      const matches = await fetchMatches(teamId || selectedTeam);
      console.log("📋 Lista meczów pobrana pomyślnie, elementów:", matches?.length || 0);
      
      // Używamy funkcji aktualizującej, aby uniknąć uzależnienia od bieżącej wartości
      if (matches) {
        // Opóźniamy aktualizację licznika, aby uniknąć pętli renderowania
        setTimeout(() => {
          setMatchesListRefreshCounter(prev => {
            console.log("🔄 Zwiększam licznik odświeżeń:", prev, "->", prev + 1);
            return prev + 1;
          });
        }, 50);
      }
    } catch (error) {
      console.error("❌ Błąd podczas odświeżania listy meczów:", error);
    } finally {
      // Resetujemy blokadę po zakończeniu
      setTimeout(() => {
        window._isRefreshingMatches = false;
      }, 500);
    }
  }, [fetchMatches, selectedTeam]);
  
  // Dodajemy useRef, aby śledzić, czy efekt już został wykonany
  const initEffectExecutedRef = useRef(false);
  
  // Dodajemy efekt inicjalizujący, który odświeży listę meczów przy pierwszym renderowaniu
  React.useEffect(() => {
    if (initEffectExecutedRef.current) return;
    initEffectExecutedRef.current = true;
    
    console.log("🔄 Inicjalizacja aplikacji - odświeżanie listy meczów");
    
    // Używamy setTimeout, aby zapewnić, że Firebase jest w pełni zainicjalizowany
    const timer = setTimeout(async () => {
      try {
        await fetchMatches(selectedTeam);
        // Nie aktualizujemy licznika tutaj - to tylko inicjalne pobranie danych
      } catch (error) {
        console.error("❌ Błąd podczas inicjalizacji listy meczów:", error);
      }
    }, 300);
    
    return () => {
      clearTimeout(timer);
    };
  }, [fetchMatches, selectedTeam]);

  // Nasłuchuj na zmiany w hashu URL, aby ewentualnie obsłużyć odświeżenie strony
  React.useEffect(() => {
    // Używamy zmiennej do śledzenia, czy komponent jest zamontowany
    let isMounted = true;
    
    const handleHashChange = () => {
      if (!isMounted) return;
      
      const hash = window.location.hash;
      console.log("Zmiana hash URL:", hash);
      
      // Jeśli hash zawiera informację o odświeżeniu dla konkretnego zespołu
      if (hash.startsWith('#refresh=')) {
        const teamId = hash.replace('#refresh=', '');
        console.log("Wykryto żądanie odświeżenia dla zespołu:", teamId);
        
        // Wyczyść hash
        window.location.hash = '';
        
        // Odśwież listę meczów dla tego zespołu
        if (teamId && isMounted) {
          // Zamiast wywoływać refreshMatchesList, bezpośrednio wywołujemy fetchMatches
          // i aktualizujemy selectedTeam jeśli potrzeba
          if (teamId !== selectedTeam) {
            setSelectedTeam(teamId);
          }
          
          // Używamy setTimeout, aby oddzielić zmianę stanu od renderowania i uniknąć niepotrzebnych wywołań
          setTimeout(async () => {
            if (!isMounted) return;
            
            // Unikamy nakładających się operacji
            if (window._isRefreshingMatches) {
              console.log("🚫 Pominięto odświeżanie - już trwa inna operacja");
              return;
            }
            
            window._isRefreshingMatches = true;
            
            try {
              const matches = await fetchMatches(teamId);
              if (isMounted && matches) {
                setTimeout(() => {
                  if (isMounted) {
                    setMatchesListRefreshCounter(prev => prev + 1);
                  }
                  window._isRefreshingMatches = false;
                }, 100);
              } else {
                window._isRefreshingMatches = false;
              }
            } catch (error) {
              console.error("❌ Błąd podczas pobierania meczów z URL hash:", error);
              window._isRefreshingMatches = false;
            }
          }, 500);
        }
      }
    };
    
    // Wywołaj raz przy montowaniu, aby obsłużyć sytuację po odświeżeniu
    handleHashChange();
    
    // Nasłuchuj na zmiany
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      isMounted = false;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [fetchMatches, selectedTeam]);

  // Modyfikujemy efekt nasłuchujący na zdarzenie odświeżenia listy meczów
  useEffect(() => {
    // Używamy zmiennej do śledzenia, czy komponent jest zamontowany
    let isMounted = true;
    // Używamy zmiennej do śledzenia ostatniego timestampu, aby ignorować zdublowane zdarzenia
    let lastEventTimestamp = 0;
    
    const handleRefreshMatchesList = (event: Event) => {
      if (!isMounted) return;
      
      const customEvent = event as CustomEvent<{teamId?: string, timestamp?: number}>;
      const teamId = customEvent.detail?.teamId;
      const timestamp = customEvent.detail?.timestamp || 0;
      
      // Ignoruj zdarzenia starsze niż ostatnie przetworzone lub gdy trwa już odświeżanie
      if (timestamp <= lastEventTimestamp || window._isRefreshingMatches) {
        console.log(`🚫 Ignoruję zdarzenie matchesListRefresh o czasie ${timestamp}`);
        return;
      }
      
      lastEventTimestamp = timestamp;
      console.log(`🔔 Złapano zdarzenie matchesListRefresh o czasie ${timestamp} dla zespołu:`, teamId);
      
      // Ustawiamy zespół, jeśli został przekazany i różni się od obecnego
      if (teamId && teamId !== selectedTeam) {
        console.log("🔄 Zmieniam wybrany zespół na:", teamId);
        setSelectedTeam(teamId);
        // Nie wykonujemy żadnych dodatkowych akcji - zmiana selectedTeam
        // spowoduje ponowne pobranie danych przez efekt zależny od selectedTeam
      } else if (isMounted) {
        // Odświeżamy listę tylko jeśli teamId jest taki sam jak obecny lub nie został podany
        console.log("🔄 Odświeżam listę meczów bez zmiany zespołu");
        // Zamiast wywoływać refreshMatchesList, tylko zwiększamy licznik
        window._isRefreshingMatches = true;
        
        setTimeout(() => {
          if (isMounted) {
            setMatchesListRefreshCounter(prev => prev + 1);
          }
          window._isRefreshingMatches = false;
        }, 100);
      }
    };
    
    // Dodajemy nasłuchiwanie na zdarzenie odświeżenia listy
    console.log("🎧 Dodaję nasłuchiwanie na zdarzenie matchesListRefresh");
    document.addEventListener('matchesListRefresh', handleRefreshMatchesList);
    
    // Usuwamy nasłuchiwanie przy odmontowaniu komponentu
    return () => {
      isMounted = false;
      console.log("🛑 Usuwam nasłuchiwanie na zdarzenie matchesListRefresh");
      document.removeEventListener('matchesListRefresh', handleRefreshMatchesList);
    };
  }, [selectedTeam]); // Usuwamy wszelkie zależności od funkcji, które mogą powodować pętlę

  // Dodajemy efekt, który reaguje na zmianę selectedTeam
  React.useEffect(() => {
    console.log("🔄 Zmiana wybranego zespołu na:", selectedTeam);
    refreshMatchesList(selectedTeam);
  }, [selectedTeam, refreshMatchesList]);

  // Funkcja do zapisywania zawodnika
  const handleSavePlayerWithTeams = (playerData: Omit<Player, "id">) => {
    // Upewnij się, że teams jest tablicą (dla wstecznej kompatybilności)
    let teams = playerData.teams || [];
    
    // Jeśli edytujemy istniejącego zawodnika
    if (editingPlayerId) {
      const existingPlayer = players.find(p => p.id === editingPlayerId);
      
      // Dla wstecznej kompatybilności: jeśli zawodnik miał pojedynczy team zamiast tablicy teams
      if (existingPlayer && !existingPlayer.teams && 'team' in existingPlayer) {
        const oldTeam = (existingPlayer as any).team;
        if (oldTeam && !teams.includes(oldTeam)) {
          teams = [...teams, oldTeam];
        }
      }
    }
    
    handleSavePlayer({
      ...playerData,
      teams: teams,
    });
  };

  const onDeletePlayer = async (playerId: string) => {
    const wasDeleted = await handleDeletePlayer(playerId);
    if (wasDeleted && selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      resetActionState();
    }
  };

  // Funkcja przygotowująca strefy do zapisu akcji
  const prepareZonesForAction = () => {
    console.log("prepareZonesForAction - wartości wejściowe:", { startZone, endZone });
    
    if (!startZone || !endZone) {
      console.error("Brak wartości startZone lub endZone!");
      return false;
    }
    
    try {
      // Pobierz wartości xT dla stref
      const row1 = Math.floor(startZone / 12);
      const col1 = startZone % 12;
      const startXT = getXTValueFromMatrix(row1, col1);
      
      const row2 = Math.floor(endZone / 12);
      const col2 = endZone % 12;
      const endXT = getXTValueFromMatrix(row2, col2);
      
      // Zapisz wartości stref przed wywołaniem handleZoneSelect
      const isDrybling = startZone === endZone;
      
      if (isDrybling) {
        // To jest drybling - dla dryblingu potrzebujemy przekazać te same wartości dla value1 i value2
        setActionType("dribble");
        console.log("Ustawiamy drybling:", { startZone, startXT });
        
        // Najpierw czyścimy poprzednie wartości
        handleZoneSelect(null); // reset
        
        // Teraz ustawiamy strefę dla dryblingu
        if (startZone !== null) {
          // Przekazujemy startZone jako number, co jest teraz zgodne z typem funkcji
          handleZoneSelect(startZone, startXT);
        }
      } else {
        // To jest podanie
        setActionType("pass");
        console.log("Ustawiamy podanie:", { startZone, endZone, startXT, endXT });
        
        // Najpierw czyścimy poprzednie wartości
        handleZoneSelect(null); // reset
        
        // Teraz ustawiamy strefę początkową
        if (startZone !== null) {
          // Przekazujemy startZone jako number, co jest teraz zgodne z typem funkcji
          handleZoneSelect(startZone, startXT);
        }
        
        // Potem ustawiamy strefę końcową
        if (endZone !== null) {
          // Przekazujemy endZone jako number, co jest teraz zgodne z typem funkcji
          handleZoneSelect(endZone, endXT);
        }
      }
      
      return true;
    } catch (error) {
      console.error("Błąd podczas przygotowywania stref:", error);
      return false;
    }
  };

  const onSaveAction = async () => {
    console.log("onSaveAction wywołana z wartościami stref:", { startZone, endZone });
    
    // Sprawdzamy czy matchInfo istnieje przed wywołaniem handleSaveAction
    if (!matchInfo) {
      console.error("Brak informacji o meczu - nie można zapisać akcji");
      toggleMatchModal(true);
      return;
    }
    
    // Sprawdzamy, czy wszystkie wymagane dane są ustawione
    if (!selectedPlayerId) {
      console.error("Brak wybranego zawodnika - nie można zapisać akcji");
      alert("Wybierz zawodnika rozpoczynającego akcję!");
      return;
    }
    
    // W przypadku podania sprawdzamy, czy wybrany jest odbiorca
    if (actionType === "pass" && !selectedReceiverId) {
      console.error("Brak wybranego odbiorcy dla podania - nie można zapisać akcji");
      alert("Wybierz zawodnika kończącego podanie!");
      return;
    }
    
    // Pobieramy wartości stref z localStorage, jeśli są tam zapisane
    let finalStartZone = startZone;
    let finalEndZone = endZone;
    
    // Jeśli startZone jest null, próbujemy pobrać z localStorage
    if (finalStartZone === null || finalStartZone === undefined) {
      const savedStartZone = localStorage.getItem('tempStartZone');
      if (savedStartZone) {
        finalStartZone = Number(savedStartZone);
        console.log("Pobrano startZone z localStorage:", finalStartZone);
      }
    }
    
    // Jeśli endZone jest null, próbujemy pobrać z localStorage
    if (finalEndZone === null || finalEndZone === undefined) {
      const savedEndZone = localStorage.getItem('tempEndZone');
      if (savedEndZone) {
        finalEndZone = Number(savedEndZone);
        console.log("Pobrano endZone z localStorage:", finalEndZone);
      }
    }
    
    // Sprawdzamy szczegółowo strefy
    console.log("Sprawdzanie stref przed zapisem:", {
      startZone: finalStartZone,
      endZone: finalEndZone,
      startZoneType: typeof finalStartZone,
      endZoneType: typeof finalEndZone,
      startZoneValue: finalStartZone === 0 ? "zero" : finalStartZone,
      endZoneValue: finalEndZone === 0 ? "zero" : finalEndZone,
      localStorage: {
        tempStartZone: localStorage.getItem('tempStartZone'),
        tempEndZone: localStorage.getItem('tempEndZone')
      }
    });
    
    // Sprawdzamy czy startZone jest zdefiniowane (nawet jeśli jest zerem)
    if (finalStartZone === null || finalStartZone === undefined) {
      console.error("Brak strefy początkowej - nie można zapisać akcji");
      alert("Wybierz strefę początkową akcji!");
      return;
    }

    // Sprawdzamy czy endZone jest zdefiniowane (nawet jeśli jest zerem)
    if (finalEndZone === null || finalEndZone === undefined) {
      console.error("Brak strefy końcowej - nie można zapisać akcji");
      alert("Wybierz strefę końcową akcji!");
      return;
    }
    
    // Przygotujemy wartości xT dla stref
    try {
      const row1 = Math.floor(finalStartZone / 12);
      const col1 = finalStartZone % 12;
      const startXT = getXTValueFromMatrix(row1, col1);
      
      const row2 = Math.floor(finalEndZone / 12);
      const col2 = finalEndZone % 12;
      const endXT = getXTValueFromMatrix(row2, col2);
      
      // Ustawimy odpowiedni typ akcji
      const isDrybling = finalStartZone === finalEndZone;
      if (isDrybling) {
        setActionType("dribble");
      }
      
      // Logujemy stan przed wywołaniem handleSaveAction
      console.log("Stan przed zapisem akcji:", {
        selectedPlayerId,
        selectedReceiverId,
        actionType: isDrybling ? "dribble" : "pass",
        startZone: finalStartZone,
        endZone: finalEndZone,
        startXT,
        endXT,
        currentPoints
      });
      
      // Wywołujemy handleSaveAction z matchInfo, wartościami stref i wartościami xT
      try {
        console.log("Wywołuję handleSaveAction z parametrami:", {
          matchInfo: { matchId: matchInfo.matchId, team: matchInfo.team },
          startZone: finalStartZone,
          endZone: finalEndZone,
          startXT,
          endXT,
          currentPoints,
          isSecondHalf
        });
        
        const success = await handleSaveAction(
          matchInfo, 
          finalStartZone, 
          finalEndZone,   
          startXT,   
          endXT,     
          currentPoints,
          isSecondHalf
        );
        
        console.log("Wynik handleSaveAction:", success);
        
        if (success) {
          // Resetujemy stan tylko jeśli zapis się powiódł
          console.log("Akcja zapisana pomyślnie - resetuję stany stref");
          
          // Usuwamy wartości stref z localStorage
          localStorage.removeItem('tempStartZone');
          localStorage.removeItem('tempEndZone');
          
          // Resetujemy stan komponentu
          setEndZone(null);
          setStartZone(null);
          setIsActionModalOpen(false);
        } else {
          console.error("Zapis akcji nie powiódł się - zachowuję wybrane strefy");
        }
      } catch (error) {
        console.error("Błąd podczas zapisywania akcji:", error);
        alert("Wystąpił błąd podczas zapisywania akcji: " + (error instanceof Error ? error.message : String(error)));
      }
    } catch (error) {
      console.error("Błąd podczas przygotowywania danych stref:", error);
      alert("Wystąpił błąd podczas przygotowywania danych: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Obsługa otwarcia modalu minut zawodników
  const handleOpenPlayerMinutesModal = (match: TeamInfo) => {
    setEditingMatch(match);
    setIsPlayerMinutesModalOpen(true);
  };

  // Obsługa zapisywania minut zawodników
  const handleSaveMinutes = (playerMinutes: PlayerMinutes[]) => {
    if (editingMatch) {
      handleSavePlayerMinutes(editingMatch, playerMinutes);
    }
    setIsPlayerMinutesModalOpen(false);
    setEditingMatch(null);
  };

  // Funkcja do otwierania modalu nowego meczu
  const openNewMatchModal = () => {
    console.log("Otwieranie modalu dla nowego meczu");
    setIsNewMatchModalOpen(true);
  };

  // Funkcja do zamykania modalu nowego meczu
  const closeNewMatchModal = () => {
    console.log("Zamykanie modalu dla nowego meczu");
    setIsNewMatchModalOpen(false);
    
    // Hook useMatchInfo sam zajmuje się odświeżeniem listy meczów
    console.log("Modal nowego meczu zamknięty - lista meczów zostanie odświeżona automatycznie");
  };
  
  // Funkcja do otwierania modalu edycji meczu
  const openEditMatchModal = () => {
    console.log("Otwieranie modalu dla edycji meczu");
    toggleMatchModal(true);
  };

  // Funkcja do zamykania modalu edycji meczu
  const closeEditMatchModal = () => {
    console.log("Zamykanie modalu dla edycji meczu");
    toggleMatchModal(false);
    
    // Hook useMatchInfo sam zajmuje się odświeżeniem listy meczów
    console.log("Modal edycji meczu zamknięty - lista meczów zostanie odświeżona automatycznie");
  };

  // Modyfikujemy funkcje obsługi zapisywania, aby odświeżały listę meczów po zapisie
  const handleSaveNewMatch = async (matchInfo: TeamInfo) => {
    console.log("💾 Zapisywanie nowego meczu:", matchInfo);
    try {
      // Zapisujemy mecz
      const savedMatch = await handleSaveMatchInfo(matchInfo);
      console.log("✅ Nowy mecz zapisany:", savedMatch);
      
      // Hook useMatchInfo sam zajmuje się odświeżeniem listy meczów
      
      return savedMatch;
    } catch (error) {
      console.error("❌ Błąd przy zapisywaniu nowego meczu:", error);
      alert("Wystąpił błąd przy zapisywaniu meczu. Spróbuj ponownie.");
      return null;
    }
  };

  // Obsługa zapisywania edytowanego meczu
  const handleSaveEditedMatch = async (matchInfo: TeamInfo) => {
    console.log("💾 Zapisywanie edytowanego meczu:", matchInfo);
    try {
      // Zapisujemy mecz
      const savedMatch = await handleSaveMatchInfo(matchInfo);
      console.log("✅ Edytowany mecz zapisany:", savedMatch);
      
      // Hook useMatchInfo sam zajmuje się odświeżeniem listy meczów
      
      return savedMatch;
    } catch (error) {
      console.error("❌ Błąd przy zapisywaniu edytowanego meczu:", error);
      alert("Wystąpił błąd przy zapisywaniu meczu. Spróbuj ponownie.");
      return null;
    }
  };

  // Dodaj funkcję obsługi sukcesu importu
  const handleImportSuccess = (data: { players: Player[], actions: Action[], matchInfo: any }) => {
    // Aktualizuj graczy
    const newPlayers = data.players.filter(
      importedPlayer => !players.some(p => p.id === importedPlayer.id)
    );
    if (newPlayers.length > 0) {
      // Używamy handleSavePlayerWithTeams dla każdego nowego gracza
      newPlayers.forEach(player => {
        // Tworzymy kopię bez pola id, aby funkcja mogła wygenerować nowe id
        const { id, ...playerData } = player;
        handleSavePlayerWithTeams(playerData as Omit<Player, "id">);
      });
    }
    
    // Aktualizuj akcje
    const newActions = data.actions.filter(
      importedAction => !actions.some(a => a.id === importedAction.id)
    );
    if (newActions.length > 0) {
      // Dodajemy nowe akcje do lokalnego stanu - będą pobrane przez hook useActionsState
      console.log(`Dodano ${newActions.length} nowych akcji`);
    }
    
    // Aktualizuj informacje o meczu, jeśli to nowy mecz
    if (data.matchInfo && !allMatches.some(m => m.matchId === data.matchInfo.matchId)) {
      setEditingMatch(data.matchInfo);
      toggleMatchModal(true);
    }
    
    alert(`Import zakończony sukcesem! Zaimportowano ${newPlayers.length} graczy i ${newActions.length} akcji.`);
  };

  // Dodaj funkcję obsługi błędu importu
  const handleImportError = (error: string) => {
    alert(`Błąd importu: ${error}`);
  };

  // Nowa funkcja do obsługi wyboru strefy
  const handleZoneSelection = (zoneId: number, xT?: number) => {
    if (zoneId === null || zoneId === undefined) {
      console.error("handleZoneSelection: Otrzymano pustą strefę!");
      return;
    }
    
    console.log("handleZoneSelection wywołane z:", { 
      zoneId, 
      xT, 
      isNumber: typeof zoneId === 'number',
      startZone, 
      endZone 
    });
    
    // Jeśli nie mamy startZone, to ustawiamy ją
    if (startZone === null) {
      console.log("Ustawiam startZone:", zoneId);
      setStartZone(zoneId);
      
      // Zapisujemy strefę początkową w localStorage 
      localStorage.setItem('tempStartZone', String(zoneId));
      
      // Dodatkowe sprawdzenie po ustawieniu
      setTimeout(() => {
        console.log("Sprawdzenie po ustawieniu startZone:", { startZone });
      }, 50);
      return;
    }
    
    // Jeśli mamy startZone, ale nie mamy endZone, to ustawiamy ją
    if (endZone === null) {
      console.log("Ustawiam endZone:", zoneId);
      setEndZone(zoneId);
      
      // Zapisujemy strefę końcową w localStorage
      localStorage.setItem('tempEndZone', String(zoneId));
      
      // Dodatkowe sprawdzenie po ustawieniu
      setTimeout(() => {
        console.log("Sprawdzenie po ustawieniu endZone:", { endZone });
        
        // Odczekaj jeszcze chwilę przed otwarciem modalu, aby stan się zaktualizował
        setTimeout(() => {
          // Otwieramy ActionModal bez resetowania wyboru zawodnika
          console.log("Otwieram ActionModal z wartościami stref:", { startZone, endZone });
          setIsActionModalOpen(true);
        }, 50);
      }, 50);
      
      return;
    }
    
    // Jeśli mamy obie strefy, resetujemy je i zaczynamy od nowa
    console.log("Resetuję strefy i ustawiam nową startZone:", zoneId);
    
    // Najpierw resetujemy strefy
    setEndZone(null);
    localStorage.removeItem('tempEndZone');
    
    // Dajemy czas na zaktualizowanie stanu
    setTimeout(() => {
      // Ustawiamy nową strefę początkową
      setStartZone(zoneId);
      localStorage.setItem('tempStartZone', String(zoneId));
      
      console.log("Strefy po resecie:", { startZone: zoneId, endZone: null });
    }, 50);
  };

  // Modyfikujemy funkcję resetActionState, aby nie odwoływała się do hookResetActionState
  // Niestandardowa funkcja resetująca stan akcji zachowująca wybrane wartości
  const resetCustomActionState = () => {
    // Używamy funkcji z nowego hooka
    resetActionState();
    
    console.log("Wykonano resetowanie stanu akcji przy zachowaniu stref i zawodników");
  };

  // Modyfikujemy funkcję obsługi przełącznika half
  const handleSecondHalfToggle = React.useCallback((value: React.SetStateAction<boolean>) => {
    // Określamy nową wartość niezależnie od typu value (funkcja lub wartość bezpośrednia)
    const newValue = typeof value === 'function' ? value(isSecondHalf) : value;
    
    console.log("page.tsx - zmiana połowy na:", newValue ? "P2" : "P1", "obecna wartość:", isSecondHalf);
    
    // Zapisujemy wartość w stanie lokalnym
    setIsSecondHalf(newValue);
    
    // Ustawiamy isSecondHalf w hooku usePackingActions
    if (typeof packingActions.setIsSecondHalf === 'function') {
      packingActions.setIsSecondHalf(newValue);
    }
    
    // Zapisujemy wartość w localStorage
    localStorage.setItem('currentHalf', newValue ? 'P2' : 'P1');
    
    // Przekazujemy wartość do hooka useActionsState
    if (useActionsStateRef.current?.setIsSecondHalf) {
      useActionsStateRef.current.setIsSecondHalf(newValue);
    }
  }, [isSecondHalf, packingActions]);

  // Modyfikacja funkcji usuwania meczu
  const handleMatchDelete = async (matchId: string) => {
    console.log("🗑️ Usuwanie meczu o ID:", matchId);
    
    try {
      await handleDeleteMatch(matchId);
      console.log("✅ Mecz usunięty pomyślnie");
      
      // Hook useMatchInfo sam zajmuje się odświeżeniem listy meczów
      // Nie ma potrzeby dodatkowego wywoływania refreshMatchesList
    } catch (error) {
      console.error("❌ Błąd podczas usuwania meczu:", error);
      alert("Wystąpił błąd podczas usuwania meczu. Spróbuj ponownie.");
    }
  };

  // Dodajemy efekt, który sprawdzi wartości stref w localStorage przy renderowaniu
  useEffect(() => {
    // Sprawdzamy, czy w localStorage są zapisane tymczasowe strefy
    const savedStartZone = localStorage.getItem('tempStartZone');
    const savedEndZone = localStorage.getItem('tempEndZone');
    
    console.log("Sprawdzenie zapisanych stref w localStorage:", { savedStartZone, savedEndZone });
    
    // Jeśli są strefy w localStorage, a stan jest pusty, wczytujemy je
    if (savedStartZone && startZone === null) {
      console.log("Wczytuję startZone z localStorage:", savedStartZone);
      setStartZone(Number(savedStartZone));
    }
    
    if (savedEndZone && endZone === null) {
      console.log("Wczytuję endZone z localStorage:", savedEndZone);
      setEndZone(Number(savedEndZone));
      
      // Jeśli mamy obie strefy, otwieramy ActionModal
      if (savedStartZone && !isActionModalOpen) {
        console.log("Obie strefy wczytane z localStorage, otwieram ActionModal");
        setTimeout(() => setIsActionModalOpen(true), 100);
      }
    }
  }, []);  // Wykonaj tylko raz przy montowaniu komponentu

  // Dodajemy efekt, który sprawdzi i zainicjalizuje kolekcję teams
  useEffect(() => {
    const setupTeamsCollection = async () => {
      try {
        // Najpierw sprawdzamy, czy aplikacja jest już w trybie offline
        const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('firestore_offline_mode') === 'true';
        if (isOfflineMode) {
          console.log("📴 Aplikacja w trybie offline - pomijam inicjalizację kolekcji teams");
          return;
        }
        
        const teamsExist = await checkTeamsCollection();
        if (!teamsExist) {
          console.log("Kolekcja teams nie istnieje, rozpoczynam inicjalizację...");
          const initialized = await initializeTeams();
          if (initialized) {
            console.log("Pomyślnie utworzono kolekcję teams w Firebase");
            // Po inicjalizacji pobierz zespoły, aby zaktualizować pamięć podręczną
            await fetchTeams();
          }
        } else {
          console.log("Kolekcja teams już istnieje w Firebase");
          // Pobierz zespoły do pamięci podręcznej
          await fetchTeams();
        }
      } catch (error) {
        console.error("Błąd podczas sprawdzania/inicjalizacji kolekcji teams:", error);
        
        // Sprawdzamy, czy to błąd uprawnień
        if (error instanceof Error && error.message.includes("Missing or insufficient permissions")) {
          console.log("🔒 Wykryto brak uprawnień do kolekcji teams, przełączam na tryb offline");
          if (typeof window !== 'undefined') {
            localStorage.setItem('firestore_offline_mode', 'true');
            toast.error("Brak uprawnień do kolekcji teams. Aplikacja działa w trybie offline.");
          }
        }
      }
    };

    // Wywołanie funkcji inicjalizującej
    setupTeamsCollection();
  }, []); // Wykonaj tylko raz przy montowaniu komponentu

  // Funkcja obsługująca wylogowanie
  const handleLogout = () => {
    if (window.confirm("Czy na pewno chcesz się wylogować?")) {
      logout();
      // Router przekieruje do strony logowania automatycznie przez AuthGuard
    }
  };

  // Przekażę informację do ActionsTable, aby można było zaktualizować dane akcji o imiona graczy
  const handleRefreshPlayersData = () => {
    if (!players || !matchInfo?.matchId) return;
    
    // Uzupełniamy dane graczy w akcjach
    const enrichedActions = actions.map(action => {
      const updatedAction = { ...action };
      
      // Dodaj dane nadawcy (sender)
      if (action.senderId && (!action.senderName || !action.senderNumber)) {
        const senderPlayer = players.find(p => p.id === action.senderId);
        if (senderPlayer) {
          updatedAction.senderName = senderPlayer.name;
          updatedAction.senderNumber = senderPlayer.number;
        }
      }
      
      // Dodaj dane odbiorcy (receiver)
      if (action.receiverId && (!action.receiverName || !action.receiverNumber)) {
        const receiverPlayer = players.find(p => p.id === action.receiverId);
        if (receiverPlayer) {
          updatedAction.receiverName = receiverPlayer.name;
          updatedAction.receiverNumber = receiverPlayer.number;
        }
      }
      
      return updatedAction;
    });
    
    // Jeśli dokonano jakichkolwiek zmian, zapisz do Firebase
    const hasChanges = enrichedActions.some((updatedAction, index) => 
      updatedAction.senderName !== actions[index].senderName || 
      updatedAction.senderNumber !== actions[index].senderNumber ||
      updatedAction.receiverName !== actions[index].receiverName ||
      updatedAction.receiverNumber !== actions[index].receiverNumber
    );
    
    if (hasChanges) {
      console.log("Uzupełniono dane graczy w akcjach - zapisuję do bazy danych");
      
      // Synchronizuj z bazą danych
      if (syncEnrichedActions) {
        syncEnrichedActions(matchInfo.matchId, enrichedActions);
      }
      
      // Aktualizuj lokalny stan akcji
      setActions(enrichedActions);
    } else {
      console.log("Wszystkie akcje mają już uzupełnione dane graczy");
    }
  };

  // Obsługa synchronizacji wzbogaconych akcji z Firebase
  const syncEnrichedActions = async (matchId: string, updatedActions: Action[]) => {
    try {
      console.log("Synchronizacja wzbogaconych akcji z Firebase dla meczu:", matchId);
      
      // Sprawdź czy Firebase jest dostępne
      if (!db) {
        console.error("Firebase nie jest zainicjalizowane - nie można zsynchronizować akcji");
        return false;
      }
      
      // Pobierz referencję do dokumentu meczu
      const matchRef = doc(db, "matches", matchId);
      
      // Aktualizuj dokument z wzbogaconymi akcjami
      await updateDoc(matchRef, {
        actions_packing: updatedActions.map(action => removeUndefinedFields(action))
      });
      
      console.log("✅ Wzbogacone akcje zsynchronizowane z Firebase");
      return true;
    } catch (error) {
      console.error("❌ Błąd podczas synchronizacji wzbogaconych akcji:", error);
      return false;
    }
  };

  // Obsługa edycji akcji
  const handleEditAction = (action: Action) => {
    console.log("Otwieranie edycji akcji:", action);
    setEditingAction(action);
    setIsActionEditModalOpen(true);
  };

  // Obsługa zapisania edytowanej akcji
  const handleSaveEditedAction = async (editedAction: Action) => {
    console.log("💾 Zapisywanie edytowanej akcji:", editedAction);
    
    try {
      if (!editedAction.matchId) {
        console.error("❌ Brak matchId w edytowanej akcji");
        alert("Nie można zapisać akcji bez przypisania do meczu");
        return;
      }

      // Sprawdź czy Firebase jest dostępne
      if (!db) {
        console.error("❌ Firebase nie jest zainicjalizowane");
        alert("Błąd połączenia z bazą danych");
        return;
      }

      // Znajdź oryginalną akcję, żeby sprawdzić czy zmieniał się mecz
      const originalAction = actions.find(a => a.id === editedAction.id);
      const originalMatchId = originalAction?.matchId;
      
      console.log("📋 Porównanie meczów - oryginalny:", originalMatchId, "nowy:", editedAction.matchId);

      // Czy akcja została przeniesiona do innego meczu?
      const isMovedToNewMatch = originalMatchId && originalMatchId !== editedAction.matchId;

      if (isMovedToNewMatch) {
        console.log("🔄 Przenoszenie akcji między meczami");
        
        // 1. Usuń akcję ze starego meczu
        const oldMatchRef = doc(db, "matches", originalMatchId);
        const oldMatchDoc = await getDoc(oldMatchRef);
        
        if (oldMatchDoc.exists()) {
          const oldMatchData = oldMatchDoc.data() as TeamInfo;
          const oldActions = oldMatchData.actions_packing || [];
          const filteredOldActions = oldActions.filter(a => a.id !== editedAction.id);
          
          console.log("🗑️ Usuwanie akcji ze starego meczu:", originalMatchId);
          await updateDoc(oldMatchRef, {
            actions_packing: filteredOldActions
          });
        }

        // 2. Dodaj akcję do nowego meczu
        const newMatchRef = doc(db, "matches", editedAction.matchId);
        const newMatchDoc = await getDoc(newMatchRef);
        
        if (!newMatchDoc.exists()) {
          console.error("❌ Nowy mecz nie istnieje:", editedAction.matchId);
          alert("Wybrany mecz nie istnieje");
          return;
        }

        const newMatchData = newMatchDoc.data() as TeamInfo;
        const newActions = newMatchData.actions_packing || [];
        
        console.log("➕ Dodawanie akcji do nowego meczu:", editedAction.matchId);
        const updatedNewActions = [...newActions, removeUndefinedFields(editedAction)];
        
        await updateDoc(newMatchRef, {
          actions_packing: updatedNewActions
        });

        // Aktualizuj lokalny stan jeśli dotknięty jest aktualny mecz
        if (matchInfo?.matchId === originalMatchId) {
          // Usuń akcję z lokalnego stanu (stary mecz)
          const filteredActions = actions.filter(a => a.id !== editedAction.id);
          setActions(filteredActions);
        } else if (matchInfo?.matchId === editedAction.matchId) {
          // Dodaj akcję do lokalnego stanu (nowy mecz)
          setActions([...actions, editedAction]);
        }
      } else {
        console.log("📝 Aktualizacja akcji w tym samym meczu");
        
        // Standardowa aktualizacja w tym samym meczu
        const matchRef = doc(db, "matches", editedAction.matchId);
        const matchDoc = await getDoc(matchRef);

        if (!matchDoc.exists()) {
          console.error("❌ Mecz nie istnieje:", editedAction.matchId);
          alert("Wybrany mecz nie istnieje");
          return;
        }

        const matchData = matchDoc.data() as TeamInfo;
        const currentActions = matchData.actions_packing || [];
        
        const actionIndex = currentActions.findIndex(a => a.id === editedAction.id);
        if (actionIndex === -1) {
          console.error("❌ Nie znaleziono akcji do edycji:", editedAction.id);
          alert("Nie znaleziono akcji do edycji");
          return;
        }

        const updatedActions = [...currentActions];
        updatedActions[actionIndex] = removeUndefinedFields(editedAction);

        await updateDoc(matchRef, {
          actions_packing: updatedActions
        });

        // Aktualizuj lokalny stan jeśli to aktualny mecz
        if (matchInfo && editedAction.matchId === matchInfo.matchId) {
          setActions(updatedActions);
        }
      }

      console.log("✅ Akcja zapisana pomyślnie");
      setIsActionEditModalOpen(false);
      setEditingAction(null);
      
      // Wywołaj event odświeżenia dla innych komponentów
      const refreshEvent = new CustomEvent('matchesListRefresh', {
        detail: { timestamp: Date.now() }
      });
      document.dispatchEvent(refreshEvent);
      
    } catch (error) {
      console.error("❌ Błąd podczas zapisywania edytowanej akcji:", error);
      alert("Wystąpił błąd podczas zapisywania akcji: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Obsługa zamknięcia modalu edycji akcji
  const handleCloseActionEditModal = () => {
    setIsActionEditModalOpen(false);
    setEditingAction(null);
  };

  // Wrapper dla setActionType z debuggiem
  const setActionType = (type: "pass" | "dribble") => {
    console.log("🎯 page.tsx: setActionType wrapper wywołane z:", type);
    originalSetActionType(type);
  };

  return (
    <div className={styles.container}>
      <OfflineStatusBanner />
      <Instructions />
      <MatchInfoHeader
        matchInfo={matchInfo}
        onChangeMatch={openEditMatchModal}
        allMatches={allMatches}
        onSelectMatch={handleSelectMatch}
        onDeleteMatch={handleMatchDelete}
        selectedTeam={selectedTeam}
        onChangeTeam={setSelectedTeam}
        onManagePlayerMinutes={handleOpenPlayerMinutesModal}
        onAddNewMatch={openNewMatchModal}
        refreshCounter={matchesListRefreshCounter}
        isOfflineMode={isOfflineMode}
        players={players}
      />

      <main className={styles.content}>
        <PlayersGrid
          players={filteredPlayers}
          selectedPlayerId={selectedPlayerId}
          onPlayerSelect={setSelectedPlayerId}
          onAddPlayer={() => setIsModalOpen(true)}
          onEditPlayer={handleEditPlayer}
          onDeletePlayer={onDeletePlayer}
        />

        <Tabs activeTab={activeTab} onTabChange={() => {}} />

        {activeTab === "packing" && (
          <ActionSection
            selectedZone={selectedZone}
            handleZoneSelect={handleZoneSelection}
            players={filteredPlayers}
            selectedPlayerId={selectedPlayerId}
            setSelectedPlayerId={setSelectedPlayerId}
            selectedReceiverId={selectedReceiverId}
            setSelectedReceiverId={setSelectedReceiverId}
            actionMinute={actionMinute}
            setActionMinute={setActionMinute}
            actionType={(editingAction?.actionType as "pass" | "dribble") || 'pass'}
            setActionType={setActionType}
            currentPoints={currentPoints}
            setCurrentPoints={setCurrentPoints}
            isP3Active={isP3Active}
            setIsP3Active={setIsP3Active}
            isShot={isShot}
            setIsShot={setIsShot}
            isGoal={isGoal}
            setIsGoal={setIsGoal}
            isPenaltyAreaEntry={isPenaltyAreaEntry}
            setIsPenaltyAreaEntry={setIsPenaltyAreaEntry}
            isSecondHalf={isSecondHalf}
            setIsSecondHalf={handleSecondHalfToggle}
            handleSaveAction={onSaveAction}
            resetActionState={resetCustomActionState}
            startZone={startZone}
            endZone={endZone}
            isActionModalOpen={isActionModalOpen}
            setIsActionModalOpen={setIsActionModalOpen}
          />
        )}

        <ActionsTable
          actions={actions}
          players={players}
          onDeleteAction={handleDeleteAction}
          onEditAction={handleEditAction}
          onRefreshPlayersData={handleRefreshPlayersData}
        />

        <PlayerModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={handleSavePlayerWithTeams}
          editingPlayer={
            editingPlayerId
              ? players.find((p) => p.id === editingPlayerId)
              : undefined
          }
          currentTeam={selectedTeam}
          allTeams={Object.values(TEAMS)}
          existingPlayers={players}
        />

        {/* Modal dla nowego meczu */}
        <MatchInfoModal
          isOpen={isNewMatchModalOpen}
          onClose={closeNewMatchModal}
          onSave={handleSaveNewMatch}
          currentInfo={null}
        />

        {/* Modal dla edycji meczu */}
        <MatchInfoModal
          isOpen={isMatchModalOpen}
          onClose={closeEditMatchModal}
          onSave={handleSaveEditedMatch}
          currentInfo={matchInfo}
        />

        {/* Modal minut zawodników */}
        {editingMatch && (
          <PlayerMinutesModal
            isOpen={isPlayerMinutesModalOpen}
            onClose={() => {
              setIsPlayerMinutesModalOpen(false);
              setEditingMatch(null);
            }}
            onSave={handleSaveMinutes}
            match={editingMatch as TeamInfo}
            players={players.filter(
              (player) => player.teams && player.teams.includes(editingMatch.team)
            )}
            currentPlayerMinutes={editingMatch.playerMinutes || []}
          />
        )}

        {/* Modal edycji akcji */}
        <ActionModal
          isOpen={isActionEditModalOpen}
          onClose={handleCloseActionEditModal}
          players={players}
          selectedPlayerId={editingAction?.senderId || null}
          selectedReceiverId={editingAction?.receiverId || null}
          onSenderSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                senderId: id || '',
                senderName: player?.name || '',
                senderNumber: player?.number || 0
              });
            }
          }}
          onReceiverSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                receiverId: id || '',
                receiverName: player?.name || '',
                receiverNumber: player?.number || 0
              });
            }
          }}
          actionMinute={editingAction?.minute || 0}
          onMinuteChange={(minute) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                minute
              });
            }
          }}
          actionType={(editingAction?.actionType as "pass" | "dribble") || 'pass'}
          onActionTypeChange={(type) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                actionType: type
              });
            }
          }}
          currentPoints={editingAction?.packingPoints || 0}
          onAddPoints={(points) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                packingPoints: points
              });
            }
          }}
          isP3Active={editingAction?.isP3 || false}
          onP3Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP3: !editingAction.isP3
              });
            }
          }}
          isShot={editingAction?.isShot || false}
          onShotToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isShot: checked
              });
            }
          }}
          isGoal={editingAction?.isGoal || false}
          onGoalToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isGoal: checked
              });
            }
          }}
          isPenaltyAreaEntry={editingAction?.isPenaltyAreaEntry || false}
          onPenaltyAreaEntryToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isPenaltyAreaEntry: checked
              });
            }
          }}
          isSecondHalf={editingAction?.isSecondHalf || false}
          onSecondHalfToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isSecondHalf: checked
              });
            }
          }}
          onSaveAction={() => {
            console.log("💾 Zapisywanie edytowanej akcji:", editingAction);
            if (editingAction) {
              handleSaveEditedAction(editingAction);
            }
          }}
          onReset={() => {
            if (editingAction) {
              const originalAction = actions.find(a => a.id === editingAction.id);
              if (originalAction) {
                setEditingAction({ ...originalAction });
              }
            }
          }}
          editingAction={editingAction}
          allMatches={allMatches}
          selectedMatchId={editingAction?.matchId || null}
          onMatchSelect={(matchId) => {
            console.log("🔄 Zmiana meczu dla akcji na:", matchId);
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                matchId
              });
            }
          }}
        />

        {/* Przyciski eksportu i importu */}
        <div className={styles.buttonsContainer}>
          {/* <Link href="/zawodnicy" className={styles.playersButton}>
            👥 Statystyki zawodników
          </Link>
          <Link href="/statystyki-zespolu" className={styles.teamStatsButton}>
            📊 Statystyki zespołu
          </Link>
          <Link href="/lista-zawodnikow" className={styles.listButton}>
            📋 Lista wszystkich zawodników
          </Link> */}
          <ExportButton
            players={players}
            actions={actions}
            matchInfo={matchInfo}
          />
          <ImportButton 
            onImportSuccess={handleImportSuccess}
            onImportError={handleImportError}
          />
          <button 
            onClick={handleLogout}
            className={styles.logoutButton}
            title="Wyloguj się z aplikacji"
          >
            Wyloguj
          </button>
        </div>

        <OfflineStatus />
      </main>
    </div>
  );
}
