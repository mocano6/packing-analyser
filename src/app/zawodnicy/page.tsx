"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import PackingChart from '@/components/PackingChart/PackingChart';
import PlayerModal from "@/components/PlayerModal/PlayerModal";
import { TEAMS } from "@/constants/teamsLoader";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { sortPlayersByLastName, getPlayerFullName } from "@/utils/playerUtils";
import Link from "next/link";
import styles from "./zawodnicy.module.css";

export default function ZawodnicyPage() {
  const [selectedTeam, setSelectedTeam] = useState<string>(TEAMS.REZERWY.id);
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);

  const {
    players,
    isModalOpen,
    editingPlayerId,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
  } = usePlayersState();

  const { allMatches, fetchMatches } = useMatchInfo();

  // Pobierz mecze dla wybranego zespołu
  useEffect(() => {
    if (selectedTeam) {
      fetchMatches(selectedTeam);
    }
  }, [selectedTeam, fetchMatches]);

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
        const allActionsPromises = teamMatches.map(async (match) => {
          if (!match.matchId) return [];
          
          try {
            const matchRef = doc(db!, "matches", match.matchId);
            const matchDoc = await getDoc(matchRef);
            
            if (matchDoc.exists()) {
              const matchData = matchDoc.data() as TeamInfo;
              const matchActions = matchData.actions_packing || [];
              
              // Uzupełnij dane zawodników w akcjach
              return matchActions.map(action => {
                const enrichedAction = { ...action };
                
                // Dodaj dane nadawcy
                if (action.senderId && (!action.senderName || !action.senderNumber)) {
                  const senderPlayer = players.find(p => p.id === action.senderId);
                  if (senderPlayer) {
                    enrichedAction.senderName = senderPlayer.name;
                    enrichedAction.senderNumber = senderPlayer.number;
                  }
                }
                
                // Dodaj dane odbiorcy
                if (action.receiverId && (!action.receiverName || !action.receiverNumber)) {
                  const receiverPlayer = players.find(p => p.id === action.receiverId);
                  if (receiverPlayer) {
                    enrichedAction.receiverName = receiverPlayer.name;
                    enrichedAction.receiverNumber = receiverPlayer.number;
                  }
                }
                
                return enrichedAction;
              });
            }
            return [];
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji dla meczu ${match.matchId}:`, error);
            return [];
          }
        });

        const allActionsArrays = await Promise.all(allActionsPromises);
        const flatActions = allActionsArrays.flat();
        setAllActions(flatActions);
        console.log(`Pobrano ${flatActions.length} akcji ze wszystkich meczów zespołu ${selectedTeam}`);
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
    const teamFiltered = players.filter(player => 
      player.teams && player.teams.includes(selectedTeam)
    );
    
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

  // Znajdź potencjalne duplikaty - ulepszona wersja dla akcji vs zawodników
  const findDuplicates = () => {
    const duplicatesFound: { name: string; players: Player[] }[] = [];
    
    console.log('🔍 DEBUGGING DUPLIKATÓW - NOWA WERSJA:');
    
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
    console.log('🔥 Duplikaty nazw w akcjach:', duplicateNamesInActions);
    
    // Dla każdego duplikatu z akcji, sprawdź czy można go sparować
    duplicateNamesInActions.forEach(([name, actionPlayers]) => {
      console.log(`\n🎯 Przetwarzam duplikat: ${name}`);
      
      const allPlayersForName: Player[] = [];
      
      // Dodaj zawodników z filteredPlayers o tej samej nazwie
      filteredPlayers.forEach(player => {
        const playerName = getPlayerFullName(player).toLowerCase().trim();
        if (playerName === name) {
          allPlayersForName.push(player);
          console.log(`  ✅ Znaleziono w filteredPlayers: ${player.id} - ${getPlayerFullName(player)}`);
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
          console.log(`  ⚠️ Znaleziono w akcjach (nie w zespole): ${actionPlayer.id} - ${actionPlayer.name}`);
        }
      });
      
      // Jeśli mamy więcej niż 1 zawodnika o tej nazwie, to są duplikaty
      if (allPlayersForName.length > 1) {
        duplicatesFound.push({
          name: name,
          players: allPlayersForName
        });
        console.log(`  🎯 DUPLIKAT DODANY: ${name} (${allPlayersForName.length} zawodników)`);
      }
    });
    
    console.log('\n🏁 WYNIK WYSZUKIWANIA DUPLIKATÓW:');
    console.log('Liczba grup duplikatów:', duplicatesFound.length);
    console.log('Duplikaty:', duplicatesFound);
    
    return duplicatesFound;
  };

  const duplicates = findDuplicates();
  
  // Debug log dla duplikatów
  if (duplicates.length > 0) {
    console.log('🚨 Znaleziono duplikaty:', duplicates);
  } else {
    console.log('✅ Brak duplikatów w zespole:', selectedTeam);
  }

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

        console.log(`Sparowywanie grup duplikatów dla: ${getPlayerFullName(mainPlayer)}`);

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
            console.log(`Usunięto duplikat: ${duplicate.id} (${getPlayerFullName(duplicate)})`);
          }

          mergedCount++;
          console.log(`✅ Pomyślnie sparowano grupę duplikatów dla: ${getPlayerFullName(mainPlayer)}`);

        } catch (error) {
          console.error(`❌ Błąd podczas sparowywania duplikatów dla ${getPlayerFullName(mainPlayer)}:`, error);
          errorCount++;
        }
      }

      // Odśwież dane po zakończeniu
      window.location.reload(); // Prościej niż manualne odświeżanie stanu

    } catch (error) {
      console.error('❌ Błąd podczas sparowywania duplikatów:', error);
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
        <select
          id="team-select"
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className={styles.teamSelect}
        >
          {Object.values(TEAMS).map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
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

      {/* Debug info dla duplikatów */}
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#f0f0f0', 
        margin: '10px 0',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <strong>🐛 DEBUG INFO:</strong><br/>
        Liczba duplikatów: {duplicates.length}<br/>
        Czy sekcja duplikatów powinna się wyświetlić: {duplicates.length > 0 ? 'TAK' : 'NIE'}<br/>
        Liczba zawodników w zespole: {filteredPlayers.length}<br/>
        Wybrany zespół: {selectedTeam}<br/>
        {(() => {
          console.log('🎯 RENDER DEBUG:', { 
            duplicatesLength: duplicates.length, 
            shouldShowSection: duplicates.length > 0,
            playersCount: filteredPlayers.length,
            selectedTeam 
          });
          return '';
        })()}
      </div>

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
        editingPlayer={
          editingPlayerId
            ? players.find((p) => p.id === editingPlayerId)
            : undefined
        }
        currentTeam={selectedTeam}
        allTeams={Object.values(TEAMS)}
      />
    </div>
  );
} 