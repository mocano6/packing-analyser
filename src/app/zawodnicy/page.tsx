"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import PackingChart from '@/components/PackingChart/PackingChart';
import PlayerModal from "@/components/PlayerModal/PlayerModal";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { sortPlayersByLastName, getPlayerFullName } from "@/utils/playerUtils";
import Link from "next/link";
import styles from "./zawodnicy.module.css";

export default function ZawodnicyPage() {
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);

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

  const { allMatches, fetchMatches, forceRefreshFromFirebase } = useMatchInfo();
  const { teams, isLoading: isTeamsLoading } = useTeams();
  const { isAuthenticated, isLoading: authLoading, userTeams, isAdmin, logout } = useAuth();

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

  // Wybierz pierwszy dostępny zespół jako domyślny
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  
  // Ustaw domyślny zespół gdy teams się załadują
  useEffect(() => {
    if (availableTeams.length > 0 && !selectedTeam) {
      setSelectedTeam(availableTeams[0].id);
    }
  }, [availableTeams, selectedTeam]);

  // Pobierz mecze dla wybranego zespołu - wymusza odświeżenie cache
  useEffect(() => {
    if (selectedTeam) {
      // Wymuszaj odświeżenie z Firebase przy każdej zmianie zespołu na stronie statystyk
      // żeby uniknąć problemów z cache
      forceRefreshFromFirebase(selectedTeam).then(() => {
        console.log('✅ Wymuszone odświeżenie meczów dla zespołu:', selectedTeam);
      }).catch(error => {
        console.error('❌ Błąd podczas wymuszania odświeżenia:', error);
        // Fallback - spróbuj zwykłego fetchMatches
        fetchMatches(selectedTeam);
      });
    }
  }, [selectedTeam, forceRefreshFromFirebase, fetchMatches]);

  // Filtruj mecze według wybranego zespołu
  const teamMatches = useMemo(() => {
    return allMatches.filter(match => match.team === selectedTeam);
  }, [allMatches, selectedTeam]);

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
        setAllActions([]);
        return;
      }

      // Sprawdź czy Firebase jest dostępne
      if (!db) {
        console.error("Firebase nie jest zainicjalizowane");
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
              
              // Pobierz akcje z kolekcji w ramach dokumentu meczu
              const actionsCollectionRef = collection(db, "matches", match.matchId, "actions");
              const actionsSnapshot = await getDocs(actionsCollectionRef);
              
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
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji dla meczu ${match.matchId}:`, error);
          }
        }

        // Filtruj tylko akcje zawodników z wybranego zespołu
        const teamPlayersIds = players
          .filter(player => {
            const hasTeams = player.teams && player.teams.includes(selectedTeam);
            return hasTeams;
          })
          .map(player => player.id);

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
  }, [teamMatches, players, selectedTeam]);

  // Filtruj zawodników według wybranego zespołu
  const filteredPlayers = useMemo(() => {
    const teamFiltered = players.filter(player => {
      const hasTeams = player.teams && player.teams.includes(selectedTeam);
      return hasTeams;
    });
    
    // Sortowanie alfabetyczne po nazwisku
    return sortPlayersByLastName(teamFiltered);
  }, [players, selectedTeam]);

  // Filtruj akcje według zaznaczonych meczów
  const filteredActions = useMemo(() => {
    if (selectedMatches.length === 0) return [];
    
    return allActions.filter(action => 
      action.matchId && selectedMatches.includes(action.matchId)
    );
  }, [allActions, selectedMatches]);

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
    
    // Zbierz wszystkich zawodników z akcji (senderów i odbiorców)
    const playersFromActions = new Map<string, { id: string, name: string }>();
    
    filteredActions.forEach(action => {
      if (action.senderId && action.senderName) {
        playersFromActions.set(action.senderId, {
          id: action.senderId,
          name: action.senderName
        });
      }
      if (action.receiverId && action.receiverName) {
        playersFromActions.set(action.receiverId, {
          id: action.receiverId,
          name: action.receiverName
        });
      }
    });
    
    // Sprawdź duplikaty w nazwach z akcji
    const nameCountsFromActions: { [key: string]: { id: string, name: string }[] } = {};
    Array.from(playersFromActions.values()).forEach(player => {
      const name = player.name.toLowerCase().trim();
      if (!nameCountsFromActions[name]) {
        nameCountsFromActions[name] = [];
      }
      nameCountsFromActions[name].push(player);
    });
    
    // Znajdź duplikaty w akcjach
    const duplicateNamesInActions = Object.entries(nameCountsFromActions).filter(([_, players]) => players.length > 1);
    
    // Dla każdego duplikatu z akcji, sprawdź czy można go sparować
    duplicateNamesInActions.forEach(([name, actionPlayers]) => {
      const allPlayersForName: Player[] = [];
      
      // Dodaj zawodników z filteredPlayers o tej samej nazwie
      filteredPlayers.forEach(player => {
        const playerName = getPlayerFullName(player).toLowerCase().trim();
        if (playerName === name) {
          allPlayersForName.push(player);
        }
      });
      
      // Dodaj zawodników z akcji o tej samej nazwie (którzy NIE są w filteredPlayers)
      actionPlayers.forEach(actionPlayer => {
        // Sprawdź czy ten ID już jest w filteredPlayers
        const existsInFiltered = filteredPlayers.some(p => p.id === actionPlayer.id);
        if (!existsInFiltered) {
          // Utwórz tymczasowy obiekt Player dla zawodnika z akcji
          const tempPlayer: Player = {
            id: actionPlayer.id,
            firstName: '',
            lastName: '',
            name: actionPlayer.name,
            number: 0,
            position: 'Nieznana',
            teams: [], // Nie należy do żadnego zespołu
          };
          allPlayersForName.push(tempPlayer);
        }
      });
      
      // Jeśli mamy więcej niż 1 zawodnika o tej nazwie, to są duplikaty
      if (allPlayersForName.length > 1) {
        duplicatesFound.push({
          name: name,
          players: allPlayersForName
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
            let actionsChanged = false;
            
            if (matchData.actions_packing && Array.isArray(matchData.actions_packing)) {
              const updatedActions = matchData.actions_packing.map((action: Action) => {
                const updatedAction = { ...action };
                
                // Sprawdź czy akcja ma senderId lub receiverId duplikatu
                duplicatesToMerge.forEach(duplicate => {
                  if (action.senderId === duplicate.id) {
                    updatedAction.senderId = mainPlayer.id;
                    updatedAction.senderName = getPlayerFullName(mainPlayer);
                    updatedAction.senderNumber = mainPlayer.number;
                    actionsChanged = true;
                  }
                  
                  if (action.receiverId === duplicate.id) {
                    updatedAction.receiverId = mainPlayer.id;
                    updatedAction.receiverName = getPlayerFullName(mainPlayer);
                    updatedAction.receiverNumber = mainPlayer.number;
                    actionsChanged = true;
                  }
                });
                
                return updatedAction;
              });

              // Zapisz zaktualizowane akcje jeśli zostały zmienione
              if (actionsChanged) {
                await updateDoc(doc(db, 'matches', matchDoc.id), {
                  actions_packing: updatedActions
                });
              }
            }
          }

          // Krok 2: Usuń duplikaty z kolekcji players
          for (const duplicate of duplicatesToMerge) {
            await deleteDoc(doc(db, 'players', duplicate.id));
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
        <Link href="/" className={styles.backButton}>
          ← Powrót do głównej
        </Link>
        <h1>Statystyki zawodników</h1>
      </div>

      {/* Sekcja wyboru zespołu */}
      <div className={styles.teamSelector}>
        <label htmlFor="team-select" className={styles.label}>
          Wybierz zespół:
        </label>
        {isTeamsLoading ? (
          <p>Ładowanie zespołów...</p>
        ) : (
          <select
            id="team-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className={styles.teamSelect}
            disabled={availableTeams.length === 0}
          >
            {availableTeams.length === 0 ? (
              <option value="">Brak dostępnych zespołów</option>
            ) : (
              Object.values(teamsObject).map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      {/* Sekcja wyboru meczów - tabela */}
      <div className={styles.matchSelector}>
        <div className={styles.matchSelectorHeader}>
          <h3>Wybierz mecze do analizy ({selectedMatches.length}/{teamMatches.length})</h3>
          <button 
            onClick={handleSelectAllMatches}
            className={styles.selectAllButton}
          >
            {selectedMatches.length === teamMatches.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
          </button>
        </div>
        
        <div className={styles.matchesTable}>
          {teamMatches.length === 0 ? (
            <p className={styles.noMatches}>Brak meczów dla wybranego zespołu</p>
          ) : (
            <>
              <div className={styles.tableHeader}>
                <div className={styles.headerCell}>Wybierz</div>
                <div className={styles.headerCell}>Przeciwnik</div>
                <div className={styles.headerCell}>Data</div>
                <div className={styles.headerCell}>Rozgrywki</div>
                <div className={styles.headerCell}>Dom/Wyjazd</div>
              </div>
              <div className={styles.tableBody}>
                {teamMatches.map(match => (
                  <div key={match.matchId || match.opponent} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <input
                        type="checkbox"
                        checked={match.matchId ? selectedMatches.includes(match.matchId) : false}
                        onChange={() => match.matchId && handleMatchToggle(match.matchId)}
                        className={styles.matchCheckbox}
                      />
                    </div>
                    <div className={styles.tableCell}>
                      <strong>{match.opponent}</strong>
                    </div>
                    <div className={styles.tableCell}>
                      {match.date}
                    </div>
                    <div className={styles.tableCell}>
                      {match.competition}
                    </div>
                    <div className={styles.tableCell}>
                      {match.isHome ? 'Dom' : 'Wyjazd'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

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
                        <span className={styles.playerName}>{getPlayerFullName(player)}</span>
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
          <p>Brak zawodników w wybranym zespole.</p>
        ) : (
          <div>
            <p>Pokazano statystyki z {filteredActions.length} akcji z {selectedMatches.length} meczów</p>
            <PackingChart
              actions={filteredActions}
              players={filteredPlayers}
              selectedPlayerId={selectedPlayerId}
              onPlayerSelect={setSelectedPlayerId}
              matches={teamMatches.filter(match => 
                match.matchId && selectedMatches.includes(match.matchId)
              )}
            />
          </div>
        )}
      </div>

      <PlayerModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSavePlayerWithTeams}
        editingPlayer={editingPlayer || undefined} // Użyj editingPlayer z usePlayersState (ze świeżymi danymi z Firebase)
        currentTeam={selectedTeam}
        allTeams={Object.values(teamsObject)}
        existingPlayers={players}
      />
    </div>
  );
}