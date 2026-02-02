"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import PackingChart from '@/components/PackingChart/PackingChart';
import PlayerModal from "@/components/PlayerModal/PlayerModal";
import ActionSection from "@/components/ActionSection/ActionSection";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { buildPlayersIndex, getPlayerLabel, sortPlayersByLastName } from "@/utils/playerUtils";
import Link from "next/link";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";
import { getCurrentSeason, filterMatchesBySeason, getAvailableSeasonsFromMatches } from "@/utils/seasonUtils";
import SidePanel from "@/components/SidePanel/SidePanel";
import styles from "./zawodnicy.module.css";

export default function ZawodnicyPage() {
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [birthYearFilter, setBirthYearFilter] = useState<{from: string; to: string}>({from: '', to: ''});
  const [showTeamsDropdown, setShowTeamsDropdown] = useState(false);
  const [showPositionsDropdown, setShowPositionsDropdown] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showMatchSelector, setShowMatchSelector] = useState<boolean>(false);

  // Funkcja do obsługi zaznaczania/odznaczania zespołów
  const handleTeamToggle = (teamId: string) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        // Jeśli zespół jest zaznaczony, odznacz go
        return prev.filter(id => id !== teamId);
      } else {
        // Jeśli zespół nie jest zaznaczony, zaznacz go
        return [...prev, teamId];
      }
    });
  };

  // Funkcja do zaznaczania/odznaczania wszystkich zespołów
  const handleSelectAllTeams = () => {
    if (selectedTeams.length === availableTeams.length) {
      // Jeśli wszystkie są zaznaczone, odznacz wszystkie
      setSelectedTeams([]);
    } else {
      // Jeśli nie wszystkie są zaznaczone, zaznacz wszystkie
      setSelectedTeams(availableTeams.map(team => team.id));
    }
  };

  // Stabilne callback dla wyboru zawodnika
  const handlePlayerSelect = useCallback((playerId: string | null) => {
    setSelectedPlayerId(playerId);
  }, []);

  const {
    players,
    isModalOpen,
    editingPlayerId,
    editingPlayer,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
  } = usePlayersState();

  // Ref dla aktualnych players żeby uniknąć dependency w useEffect
  const playersRef = useRef<Player[]>([]);
  playersRef.current = players;
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);

  const { allMatches, fetchMatches, forceRefreshFromFirebase } = useMatchInfo();
  const { teams, isLoading: isTeamsLoading } = useTeams();
  const { isAuthenticated, isLoading: authLoading, userTeams, isAdmin, logout } = useAuth();

  // Funkcja do mapowania pozycji na etykiety
  const getPositionLabel = (position: string): string => {
    const labels: { [key: string]: string } = {
      'GK': 'Bramkarz (GK)',
      'CB': 'Środkowy obrońca (CB)',
      'RB': 'Prawy obrońca (RB)',
      'LB': 'Lewy obrońca (LB)',
      'DM': 'Defensywny pomocnik (DM)',
      'AM': 'Ofensywny pomocnik (AM)',
      'LW': 'Lewy skrzydłowy (LS)',
      'RW': 'Prawy skrzydłowy (RS)',
      'ST': 'Napastnik (ST)',
    };
    return labels[position] || position;
  };

  // Dostępne pozycje
  const availablePositions = useMemo(() => {
    const positions = ['GK', 'CB', 'DM', 'AM', 'LW', 'RW', 'ST'];
    return positions.map(pos => ({
      value: pos,
      label: getPositionLabel(pos)
    }));
  }, []);

  // Funkcje obsługi dropdown pozycji
  const handlePositionToggle = (position: string) => {
    setSelectedPositions(prev => {
      if (prev.includes(position)) {
        return prev.filter(pos => pos !== position);
      } else {
        return [...prev, position];
      }
    });
  };

  const handleSelectAllPositions = () => {
    const allPositions = availablePositions.map(pos => pos.value);
    if (selectedPositions.length === allPositions.length) {
      setSelectedPositions([]);
    } else {
      setSelectedPositions(allPositions);
    }
  };

  // Zamknij dropdown'y przy kliknięciu poza nimi
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdownContainer')) {
        setShowTeamsDropdown(false);
        setShowPositionsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Usunięto stabilne funkcje - nie są już potrzebne

  // Filtruj dostępne zespoły na podstawie uprawnień użytkownika (tak jak w głównej aplikacji)
  const availableTeams = useMemo(() => {
    if (isAdmin) {
      // Administratorzy mają dostęp do wszystkich zespołów
      return teams;
    }
    
    if (!userTeams || userTeams.length === 0) {
      return [];
    }
    
    // Filtruj zespoły na podstawie uprawnień użytkownika
    return teams.filter(team => userTeams.includes(team.id));
  }, [userTeams, isAdmin, teams]);

  // Konwertuj availableTeams array na format używany w komponencie
  const teamsObject = useMemo(() => {
    const obj: Record<string, { id: string; name: string }> = {};
    availableTeams.forEach(team => {
      obj[team.id] = team;
    });
    return obj;
  }, [availableTeams]);

  // Inicjalizuj selectedTeams z localStorage lub pustą tablicą
  const [selectedTeams, setSelectedTeams] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedTeams');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  // Ustaw domyślny zespół gdy teams się załadują i zapisz w localStorage
  useEffect(() => {
    if (availableTeams.length > 0 && selectedTeams.length === 0) {
      const firstTeamId = availableTeams[0].id;
      setSelectedTeams([firstTeamId]);
      localStorage.setItem('selectedTeams', JSON.stringify([firstTeamId]));
    }
  }, [availableTeams, selectedTeams]);

  // Zapisuj wybrane zespoły w localStorage przy każdej zmianie
  useEffect(() => {
    if (selectedTeams.length > 0) {
      localStorage.setItem('selectedTeams', JSON.stringify(selectedTeams));
    }
  }, [selectedTeams]);

  // Stan dla wybranego sezonu
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  
  // Stan dla aktywnej zakładki
  const [activeTab, setActiveTab] = useState<'packing' | 'xg' | 'unpacking'>('packing');
  
  // Stany dla ActionSection (tylko dla zakładki unpacking)
  const [selectedZone, setSelectedZone] = useState<string | number | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  const [actionMinute, setActionMinute] = useState<number>(0);
  const [actionType, setActionType] = useState<"pass" | "dribble">("pass");
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [isP1Active, setIsP1Active] = useState<boolean>(false);
  const [isP2Active, setIsP2Active] = useState<boolean>(false);
  const [isP3Active, setIsP3Active] = useState<boolean>(false);
  const [isShot, setIsShot] = useState<boolean>(false);
  const [isGoal, setIsGoal] = useState<boolean>(false);
  const [isPenaltyAreaEntry, setIsPenaltyAreaEntry] = useState<boolean>(false);
  const [isSecondHalf, setIsSecondHalf] = useState<boolean>(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [startZone, setStartZone] = useState<number | null>(null);
  const [endZone, setEndZone] = useState<number | null>(null);
  const [actionMode, setActionMode] = useState<"attack" | "defense">("attack");
  const [selectedDefensePlayers, setSelectedDefensePlayers] = useState<string[]>([]);

  // Funkcje obsługi dla ActionSection
  const handleZoneSelection = (zone: number, xT?: number, value1?: number, value2?: number) => {
    setSelectedZone(zone);
    // Logika dla stref - można rozszerzyć w przyszłości
  };

  const handleSaveAction = () => {
    // Logika zapisywania akcji - można rozszerzyć w przyszłości
  };

  const resetActionState = () => {
    setSelectedPlayerId(null);
    setSelectedReceiverId(null);
    setActionMinute(0);
    setActionType("pass");
    setCurrentPoints(0);
    setIsP1Active(false);
    setIsP2Active(false);
    setIsP3Active(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
    setIsSecondHalf(false);
    setStartZone(null);
    setEndZone(null);
    setSelectedZone(null);
    setActionMode("attack");
    setSelectedDefensePlayers([]);
  };

  const resetActionPoints = () => {
    setCurrentPoints(0);
    setIsP1Active(false);
    setIsP2Active(false);
    setIsP3Active(false);
  };

  const handleP3Toggle = () => {
    setIsP3Active(!isP3Active);
  };

  const handleSecondHalfToggle = () => {
    setIsSecondHalf(!isSecondHalf);
  };

  // Inicjalizuj selectedSeason na najnowszy sezon na podstawie meczów
  useEffect(() => {
    if (!selectedSeason && allMatches.length > 0) {
      const availableSeasons = getAvailableSeasonsFromMatches(allMatches);
      if (availableSeasons.length > 0) {
        // Wybierz najnowszy sezon (pierwszy w posortowanej liście)
        setSelectedSeason(availableSeasons[0].id);
      } else {
        setSelectedSeason("all");
      }
    }
  }, [selectedSeason, allMatches]);

  // Pobierz mecze dla wybranych zespołów - tylko przy zmianie zespołów
  useEffect(() => {
    if (selectedTeams.length > 0) {
      // Dla wielu zespołów, użyj forceRefreshFromFirebase bez teamId (pobierze wszystkie)
      forceRefreshFromFirebase().catch(error => {
        console.error('❌ Błąd podczas pobierania meczów:', error);
      });
    }
  }, [selectedTeams]); // Tylko selectedTeams w dependency

  // Filtruj mecze według wybranych zespołów i sezonu
  const teamMatches = useMemo(() => {
    const teamFiltered = allMatches.filter(match => 
      selectedTeams.includes(match.team)
    );
    return selectedSeason ? filterMatchesBySeason(teamFiltered, selectedSeason) : teamFiltered;
  }, [allMatches, selectedTeams, selectedSeason]);

  // Oblicz dostępne sezony na podstawie meczów wybranych zespołów
  const availableSeasons = useMemo(() => {
    const teamFiltered = allMatches.filter(match => 
      selectedTeams.includes(match.team)
    );
    return getAvailableSeasonsFromMatches(teamFiltered);
  }, [allMatches, selectedTeams]);

  // Zaznacz wszystkie mecze domyślnie przy zmianie zespołu
  useEffect(() => {
    if (teamMatches.length > 0) {
      const validMatchIds = teamMatches
        .map(match => match.matchId)
        .filter((id): id is string => id !== undefined);
      setSelectedMatches(validMatchIds);
    }
  }, [teamMatches]);

  // Pobierz akcje ze wszystkich meczów zespołu
  useEffect(() => {
    const loadAllActionsForTeam = async () => {
      if (teamMatches.length === 0) {
        // Tylko resetuj jeśli rzeczywiście nie ma meczów dla zespołów, nie podczas ładowania
        if (selectedTeams.length > 0 && allMatches.length > 0) {
        setAllActions([]);
        }
        return;
      }

      // Sprawdź czy Firebase jest dostępne
      if (!db) {
        console.error("🔄 Resetowanie akcji - Firebase nie zainicjalizowane");
        setAllActions([]);
        return;
      }

      setIsLoadingActions(true);

      try {
        const allActionsData: Action[] = [];

        // Pobierz akcje ze wszystkich meczów dla wybranego zespołu
        for (const match of teamMatches) {
          if (!match.matchId) continue;
          
          try {
            // Pobierz dokument meczu
            const matchDoc = await getDoc(doc(db, "matches", match.matchId));
            
            if (matchDoc.exists()) {
              const matchData = matchDoc.data();
              
              // Sprawdź czy mecz ma akcje w polu actions_packing
              if (matchData.actions_packing && Array.isArray(matchData.actions_packing)) {
                matchData.actions_packing.forEach((actionData: Action) => {
                  if (match.matchId) {
                    allActionsData.push({
                      ...actionData,
                      matchId: match.matchId
                    });
                  }
                });
              }
              
              // Sprawdź też kolekcję actions (stara struktura)
              const actionsCollectionRef = collection(db, "matches", match.matchId, "actions");
              const actionsSnapshot = await getDocs(actionsCollectionRef);
              
              if (!actionsSnapshot.empty) {
                actionsSnapshot.forEach((actionDoc) => {
                  const actionData = actionDoc.data() as Action;
                  if (match.matchId) {
                    allActionsData.push({
                      ...actionData,
                      id: actionDoc.id,
                      matchId: match.matchId
              });
            }
                });
              }
            }
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji dla meczu ${match.matchId}:`, error);
          }
        }

        // Filtruj tylko akcje zawodników z wybranych zespołów
        const teamPlayers = playersRef.current.filter(player => {
          if (!player.teams) return false;
          return player.teams.some(playerTeam => selectedTeams.includes(playerTeam));
        });
        
        const teamPlayersIds = teamPlayers.map(player => player.id);

        const filteredActions = allActionsData.filter(action => 
          teamPlayersIds.includes(action.senderId) || 
          (action.receiverId && teamPlayersIds.includes(action.receiverId))
        );

        setAllActions(filteredActions);
      } catch (error) {
        console.error("Błąd podczas pobierania akcji:", error);
        setAllActions([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadAllActionsForTeam();
  }, [teamMatches, selectedTeams]);

  // Filtruj zawodników według wybranych zespołów i pozycji (rocznik filtrowany w PackingChart)
  const filteredPlayers = useMemo(() => {
    let teamFiltered = players.filter(player => {
      if (!player.teams) return false;
      return player.teams.some(playerTeam => selectedTeams.includes(playerTeam));
    });
    
    // Filtruj według pozycji jeśli wybrane
    if (selectedPositions.length > 0) {
      teamFiltered = teamFiltered.filter(player => 
        selectedPositions.includes(player.position)
      );
    }
    
    // Sortowanie alfabetyczne po nazwisku
    return sortPlayersByLastName(teamFiltered);
  }, [players, selectedTeams, selectedPositions]);

  // Filtruj akcje według zaznaczonych meczów
  const filteredActions = useMemo(() => {
    if (selectedMatches.length === 0) return [];
    
    return allActions.filter(action => 
      action.matchId && selectedMatches.includes(action.matchId)
    );
  }, [allActions, selectedMatches]);

  // Filtruj mecze według zaznaczonych - WAŻNE: stabilna referencja dla PackingChart
  const selectedMatchesData = useMemo(() => {
    return teamMatches.filter(match => 
      match.matchId && selectedMatches.includes(match.matchId)
    );
  }, [teamMatches, selectedMatches]);

  // TERAZ sprawdź czy aplikacja się ładuje - WSZYSTKIE HOOKI MUSZĄ BYĆ POWYŻEJ!
  if (authLoading || isTeamsLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Ładowanie aplikacji...</p>
        </div>
      </div>
    );
  }

  // Sprawdź uwierzytelnienie
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.accessDenied}>
          <h2>🔒 Brak dostępu</h2>
          <p>Musisz być zalogowany, aby uzyskać dostęp do tej strony.</p>
          <Link href="/login" className={styles.loginButton}>
            Przejdź do logowania
          </Link>
        </div>
      </div>
    );
  }

  // Sprawdź czy użytkownik ma dostęp do jakichkolwiek zespołów
  if (!isAdmin && (!userTeams || userTeams.length === 0)) {
    return (
      <div className={styles.container}>
        <div className={styles.noTeamsAccess}>
          <h2>🚫 Brak dostępu do zespołów</h2>
          <p>Twoje konto nie ma uprawnień do żadnego zespołu. Skontaktuj się z administratorem, aby uzyskać dostęp.</p>
          <button 
            onClick={logout}
            className={styles.logoutButton}
          >
            Wyloguj się
          </button>
        </div>
      </div>
    );
  }

  // Sprawdź czy są dostępne zespoły
  if (availableTeams.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noTeamsAccess}>
          <h2>⚠️ Brak dostępnych zespołów</h2>
          <p>Nie znaleziono żadnych zespołów dostępnych dla Twojego konta.</p>
          <Link href="/" className={styles.backButton}>
            Powrót do aplikacji
          </Link>
        </div>
      </div>
    );
  }

  // Znajdź potencjalne duplikaty - ulepszona wersja dla akcji vs zawodników
  const findDuplicates = () => {
    const duplicatesFound: { name: string; players: Player[] }[] = [];

    const nameBuckets: Record<string, Player[]> = {};
    filteredPlayers
      .filter(player => !player.isDeleted)
      .forEach(player => {
        const name = getPlayerLabel(player.id, playersIndex).toLowerCase().trim();
        if (!name) return;
        if (!nameBuckets[name]) {
          nameBuckets[name] = [];
        }
        nameBuckets[name].push(player);
      });

    Object.entries(nameBuckets).forEach(([name, playersWithName]) => {
      if (playersWithName.length > 1) {
        duplicatesFound.push({
          name,
          players: playersWithName
        });
      }
    });

    return duplicatesFound;
  };

  const duplicates = findDuplicates();
  
  // Funkcja do sparowania duplikatów
  const mergeDuplicates = async () => {
    if (duplicates.length === 0) {
      alert('Nie znaleziono duplikatów do sparowania.');
      return;
    }

    if (!db) {
      alert('Firebase nie jest zainicjalizowane. Nie można sparować duplikatów.');
      return;
    }

    const confirmMerge = window.confirm(
      `Czy na pewno chcesz sparować ${duplicates.length} grup duplikatów?\n\n` +
      'Operacja ta:\n' +
      '• Przeniesie wszystkie akcje z duplikatów do głównego zawodnika\n' +
      '• Usunie duplikaty z bazy danych\n' +
      '• Nie może być cofnięta\n\n' +
      'Czy kontynuować?'
    );

    if (!confirmMerge) return;

    setIsMergingDuplicates(true);
    let mergedCount = 0;
    let errorCount = 0;

    try {
      for (const { players: duplicatePlayers } of duplicates) {
        if (duplicatePlayers.length < 2) continue;

        // Sortuj zawodników: preferuj starszemu (ma więcej akcji), a jeśli równo to starszemu ID
        const playersWithActionCounts = duplicatePlayers.map(player => ({
          ...player,
          actionsCount: allActions.filter(action => 
            action.senderId === player.id || action.receiverId === player.id
          ).length
        }));

        const sortedPlayers = playersWithActionCounts.sort((a, b) => {
          if (a.actionsCount !== b.actionsCount) {
            return b.actionsCount - a.actionsCount; // Więcej akcji = główny
          }
          return a.id.localeCompare(b.id); // Starsze ID = główny
        });

        const mainPlayer = sortedPlayers[0]; // Główny zawodnik (zostanie)
        const duplicatesToMerge = sortedPlayers.slice(1); // Duplikaty (zostaną usunięte)

        try {
          // Krok 1: Znajdź wszystkie akcje duplikatów i przenieś je do głównego zawodnika
          const matchesSnapshot = await getDocs(collection(db, 'matches'));
          
          for (const matchDoc of matchesSnapshot.docs) {
            const matchData = matchDoc.data();
            const actionFields = ["actions_packing", "actions_unpacking", "actions_regain", "actions_loses"] as const;
            const updates: Record<string, Action[]> = {};
            let actionsChanged = false;

            actionFields.forEach((field) => {
              const actions = matchData[field];
              if (!Array.isArray(actions)) return;

              const updatedActions = actions.map((action: Action) => {
                const {
                  senderName,
                  senderNumber,
                  receiverName,
                  receiverNumber,
                  ...rest
                } = action as Action & {
                  senderName?: string;
                  senderNumber?: number;
                  receiverName?: string;
                  receiverNumber?: number;
                };
                const updatedAction: Action = { ...rest };

                if (senderName || senderNumber || receiverName || receiverNumber) {
                  actionsChanged = true;
                }

                // Sprawdź czy akcja ma senderId lub receiverId duplikatu
                duplicatesToMerge.forEach(duplicate => {
                  if (action.senderId === duplicate.id) {
                    updatedAction.senderId = mainPlayer.id;
                    actionsChanged = true;
                  }
                  if (action.receiverId === duplicate.id) {
                    updatedAction.receiverId = mainPlayer.id;
                    actionsChanged = true;
                  }
                });

                return updatedAction;
              });

              updates[field] = updatedActions;
            });

            if (actionsChanged) {
              await updateDoc(doc(db, 'matches', matchDoc.id), updates);
            }
          }

          // Krok 2: Soft delete duplikatów w kolekcji players
          for (const duplicate of duplicatesToMerge) {
            await updateDoc(doc(db, 'players', duplicate.id), { isDeleted: true });
          }

          mergedCount++;

        } catch (error) {
          errorCount++;
        }
      }

      // Odśwież dane po zakończeniu
      window.location.reload();

    } catch (error) {
      alert('Wystąpił błąd podczas sparowywania duplikatów. Sprawdź konsolę i spróbuj ponownie.');
    } finally {
      setIsMergingDuplicates(false);
    }

    if (mergedCount > 0 || errorCount > 0) {
      alert(
        `Sparowanie duplikatów zakończone!\n\n` +
        `✅ Pomyślnie sparowano: ${mergedCount} grup\n` +
        `❌ Błędy: ${errorCount} grup\n\n` +
        `Strona zostanie odświeżona aby pokazać zaktualizowane dane.`
      );
    }
  };

  // Funkcja do zapisywania zawodnika z zespołami
  const handleSavePlayerWithTeams = (playerData: Omit<Player, "id">) => {
    let teams = playerData.teams || [];
    
    if (editingPlayerId) {
      const existingPlayer = players.find(p => p.id === editingPlayerId);
      
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
    }
  };

  // Obsługa zmiany zaznaczenia meczu
  const handleMatchToggle = (matchId: string) => {
    setSelectedMatches(prev => 
      prev.includes(matchId) 
        ? prev.filter(id => id !== matchId)
        : [...prev, matchId]
    );
  };

  // Obsługa zaznaczenia/odznaczenia wszystkich meczów
  const handleSelectAllMatches = () => {
    if (selectedMatches.length === teamMatches.length) {
      setSelectedMatches([]);
    } else {
      const validMatchIds = teamMatches
        .map(match => match.matchId)
        .filter((id): id is string => id !== undefined);
      setSelectedMatches(validMatchIds);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/" className={styles.backButton} title="Powrót do głównej">
          ←
        </Link>
        <h1>Statystyki zawodników</h1>
      </div>

      {/* Sekcja wyboru zespołu i sezonu - minimalistyczna */}
      <div className={styles.selectorsContainer}>
        <div className={styles.teamSelector}>
          <label className={styles.label}>
            Wybierz zespoły ({selectedTeams.length}/{availableTeams.length}):
          </label>
          {isTeamsLoading ? (
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Ładowanie zespołów...</p>
          ) : (
            <div className={styles.teamsSelectContainer}>
              {availableTeams.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Brak dostępnych zespołów</p>
              ) : (
                <div className={`${styles.dropdownContainer} dropdownContainer`}>
                  <div 
                    className={styles.dropdownToggle}
                    onClick={() => setShowTeamsDropdown(!showTeamsDropdown)}
                  >
                    <span>
                      {selectedTeams.length === 0 ? 'Brak wybranych zespołów' : 
                       selectedTeams.length === availableTeams.length ? 'Wszystkie zespoły' :
                       `${selectedTeams.length} zespołów`}
                    </span>
                    <span className={styles.dropdownArrow}>{showTeamsDropdown ? '▲' : '▼'}</span>
                  </div>
                  {showTeamsDropdown && (
                    <div className={styles.dropdownMenu}>
                      <div 
                        className={styles.dropdownItem}
                        onClick={handleSelectAllTeams}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedTeams.length === availableTeams.length}
                          onChange={() => {}}
                        />
                        <span>Wszystkie zespoły</span>
                      </div>
                      {Object.values(teamsObject).map(team => (
                        <div 
                          key={team.id}
                          className={styles.dropdownItem}
                          onClick={() => handleTeamToggle(team.id)}
                        >
                          <input 
                            type="checkbox" 
                            checked={selectedTeams.includes(team.id)}
                            onChange={() => {}}
                          />
                          <span>{team.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.seasonSelector}>
          <label className={styles.label}>
            Wybierz sezon:
          </label>
          <SeasonSelector
            selectedSeason={selectedSeason}
            onChange={setSelectedSeason}
            showLabel={false}
            availableSeasons={availableSeasons}
            className={styles.seasonSelect}
          />
        </div>
        <div className={styles.matchToggleGroup}>
          <button
            className={styles.matchToggleButton}
            onClick={() => setShowMatchSelector(!showMatchSelector)}
          >
            {showMatchSelector ? "Ukryj" : "Pokaż"} wybór meczów ({selectedMatches.length}/{teamMatches.length})
          </button>
        </div>
      </div>

      {/* Lista meczów do wyboru */}
      {showMatchSelector && (
        <div className={styles.matchesListContainer}>
          <div className={styles.matchListHeader}>
            <button
              className={styles.selectAllButton}
              onClick={() => {
                const allIds = teamMatches
                  .filter(m => m.matchId)
                  .map(m => m.matchId!);
                setSelectedMatches(allIds);
              }}
            >
              Zaznacz wszystkie
            </button>
            <button
              className={styles.deselectAllButton}
              onClick={() => setSelectedMatches([])}
            >
              Odznacz wszystkie
            </button>
          </div>
          <div className={styles.matchesCheckboxes}>
            {teamMatches.length === 0 ? (
              <p className={styles.noMatchesCompact}>Brak meczów dla wybranego zespołu</p>
            ) : (
              teamMatches.map((match) => (
                <label key={match.matchId} className={styles.matchCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedMatches.includes(match.matchId || "")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMatches([...selectedMatches, match.matchId!]);
                      } else {
                        setSelectedMatches(selectedMatches.filter(id => id !== match.matchId));
                      }
                    }}
                  />
                  <span>
                    {match.opponent} ({typeof match.date === 'string' ? match.date : new Date(match.date).toLocaleDateString('pl-PL')}) - {match.competition}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sekcja duplikatów */}
      {duplicates.length > 0 && (
        <div className={styles.duplicatesSection}>
          <div className={styles.duplicatesHeader}>
            <h3>⚠️ Potencjalne duplikaty w wybranym zespole</h3>
            <button
              onClick={mergeDuplicates}
              disabled={isMergingDuplicates}
              className={styles.mergeDuplicatesButton}
              title="Sparuj wszystkie duplikaty automatycznie"
            >
              {isMergingDuplicates ? 'Sparowywanie...' : `🔄 Sparuj ${duplicates.length} grup duplikatów`}
            </button>
          </div>
          {duplicates.map(({ name, players: duplicatePlayers }) => (
            <div key={name} className={styles.duplicateGroup}>
              <h4>Nazwa: "{name.charAt(0).toUpperCase() + name.slice(1)}"</h4>
              <div className={styles.duplicateList}>
                {duplicatePlayers.map(player => {
                  const playerActionsCount = allActions.filter(action => 
                    action.senderId === player.id || action.receiverId === player.id
                  ).length;
                  
                  return (
                    <div key={player.id} className={styles.duplicateItem}>
                      <div className={styles.playerInfo}>
                        <span className={styles.playerName}>{getPlayerLabel(player.id, playersIndex)} ({player.id})</span>
                        <span className={styles.playerNumber}>#{player.number}</span>
                        <span className={styles.playerBirthYear}>
                          {player.birthYear ? `ur. ${player.birthYear}` : 'Brak roku urodzenia'}
                        </span>
                        <span className={styles.playerTeams}>{player.teams?.join(', ') || 'Brak zespołu'}</span>
                        <span className={styles.playerActions}>{playerActionsCount} akcji</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.playersPanel}>
        <h2>Statystyki zawodników</h2>
        {isLoadingActions ? (
          <p>Ładowanie akcji...</p>
        ) : selectedMatches.length === 0 ? (
          <p>Wybierz co najmniej jeden mecz, aby zobaczyć statystyki zawodników.</p>
        ) : filteredPlayers.length === 0 ? (
          <p>Brak zawodników spełniających kryteria filtrowania (zespół/pozycja).</p>
        ) : (
          <div>
            <div className={styles.tableControls}>
              <p>Pokazano statystyki z {filteredActions.length} akcji z {selectedMatches.length} meczów</p>
            </div>
            
            {/* Wyświetl odpowiedni komponent w zależności od aktywnej zakładki */}
            {activeTab === 'packing' && (
              <PackingChart
                actions={filteredActions}
                players={filteredPlayers}
                selectedPlayerId={selectedPlayerId}
                onPlayerSelect={handlePlayerSelect}
                matches={selectedMatchesData}
                teams={teams}
                birthYearFilter={birthYearFilter}
                onBirthYearFilterChange={setBirthYearFilter}
                selectedPositions={selectedPositions}
                onSelectedPositionsChange={setSelectedPositions}
                availablePositions={availablePositions}
                showPositionsDropdown={showPositionsDropdown}
                setShowPositionsDropdown={setShowPositionsDropdown}
                handlePositionToggle={handlePositionToggle}
                handleSelectAllPositions={handleSelectAllPositions}
              />
            )}
            
            {activeTab === 'xg' && (
              <div className={styles.placeholder}>
                <h3>xG Analysis</h3>
                <p>Funkcja xG będzie dostępna wkrótce...</p>
              </div>
            )}
            
            {activeTab === 'unpacking' && (
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
                actionType={actionType}
                setActionType={setActionType}
                currentPoints={currentPoints}
                setCurrentPoints={setCurrentPoints}
                isP1Active={isP1Active}
                setIsP1Active={setIsP1Active}
                isP2Active={isP2Active}
                setIsP2Active={setIsP2Active}
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
                handleSaveAction={handleSaveAction}
                resetActionState={resetActionState}
                resetActionPoints={resetActionPoints}
                startZone={startZone}
                endZone={endZone}
                isActionModalOpen={isActionModalOpen}
                setIsActionModalOpen={setIsActionModalOpen}
                matchInfo={selectedMatchesData[0] || null}
                // Nowe propsy dla trybu unpacking
                mode={actionMode}
                onModeChange={setActionMode}
                selectedDefensePlayers={selectedDefensePlayers}
                onDefensePlayersChange={setSelectedDefensePlayers}
              />
            )}
          </div>
        )}
      </div>

      <PlayerModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSavePlayerWithTeams}
        editingPlayer={editingPlayer || undefined} // Użyj editingPlayer z usePlayersState (ze świeżymi danymi z Firebase)
        currentTeam={selectedTeams.length > 0 ? selectedTeams[0] : ''}
        allTeams={Object.values(teamsObject)}
        existingPlayers={players}
      />

      {/* Panel boczny z menu */}
      <SidePanel
        players={players}
        actions={allActions}
        matchInfo={null}
        isAdmin={isAdmin}
        selectedTeam={selectedTeams.length > 0 ? selectedTeams[0] : ''}
        onRefreshData={() => forceRefreshFromFirebase().then(() => {})}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={logout}
      />
    </div>
  );
}