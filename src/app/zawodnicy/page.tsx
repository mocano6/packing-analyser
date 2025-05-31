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

  // Znajdź potencjalne duplikaty - ulepszona wersja
  const findDuplicates = () => {
    const duplicatesFound: { name: string; players: Player[] }[] = [];
    
    console.log('🔍 DEBUGGING DUPLIKATÓW:');
    console.log('Liczba zawodników w zespole:', filteredPlayers.length);
    console.log('Zawodnicy w zespole:', filteredPlayers.map(p => ({
      id: p.id,
      name: p.name,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: getPlayerFullName(p)
    })));
    
    // Grupuj zawodników po podobnych imionach/nazwiskach
    for (let i = 0; i < filteredPlayers.length; i++) {
      for (let j = i + 1; j < filteredPlayers.length; j++) {
        const player1 = filteredPlayers[i];
        const player2 = filteredPlayers[j];
        
        console.log(`\n🔄 Porównuję: ${getPlayerFullName(player1)} vs ${getPlayerFullName(player2)}`);
        
        let areDuplicates = false;
        let duplicateName = "";
        
        // Sprawdź różne kryteria duplikatów
        
        // 1. Identyczne pole name (jeśli istnieje)
        if (player1.name && player2.name) {
          const name1 = player1.name.toLowerCase().trim();
          const name2 = player2.name.toLowerCase().trim();
          console.log(`  Porównanie name: "${name1}" vs "${name2}"`);
          if (name1 === name2) {
            areDuplicates = true;
            duplicateName = player1.name.trim();
            console.log(`  ✅ DUPLIKAT przez name: ${duplicateName}`);
          }
        }
        
        // 2. Identyczne firstName + lastName
        if (!areDuplicates && player1.firstName && player1.lastName && 
                 player2.firstName && player2.lastName) {
          const firstName1 = player1.firstName.toLowerCase().trim();
          const lastName1 = player1.lastName.toLowerCase().trim();
          const firstName2 = player2.firstName.toLowerCase().trim();
          const lastName2 = player2.lastName.toLowerCase().trim();
          
          console.log(`  Porównanie firstName+lastName: "${firstName1} ${lastName1}" vs "${firstName2} ${lastName2}"`);
          
          if (firstName1 === firstName2 && lastName1 === lastName2) {
            areDuplicates = true;
            duplicateName = `${player1.firstName} ${player1.lastName}`.trim();
            console.log(`  ✅ DUPLIKAT przez firstName+lastName: ${duplicateName}`);
          }
        }
        
        // 3. getPlayerFullName zwraca identyczne wartości (i nie są puste)
        if (!areDuplicates) {
          const fullName1 = getPlayerFullName(player1).toLowerCase().trim();
          const fullName2 = getPlayerFullName(player2).toLowerCase().trim();
          console.log(`  Porównanie getPlayerFullName: "${fullName1}" vs "${fullName2}"`);
          
          if (fullName1 && fullName2 && fullName1 === fullName2) {
            areDuplicates = true;
            duplicateName = getPlayerFullName(player1).trim();
            console.log(`  ✅ DUPLIKAT przez getPlayerFullName: ${duplicateName}`);
          }
        }
        
        if (areDuplicates) {
          console.log(`  🎯 ZNALEZIONO DUPLIKAT: ${duplicateName}`);
          
          // Sprawdź czy ta grupa duplikatów już istnieje
          let existingGroup = duplicatesFound.find(group => 
            group.players.some(p => p.id === player1.id || p.id === player2.id)
          );
          
          if (existingGroup) {
            console.log(`  📝 Dodaję do istniejącej grupy`);
            // Dodaj do istniejącej grupy jeśli nie ma jeszcze tego zawodnika
            if (!existingGroup.players.some(p => p.id === player1.id)) {
              existingGroup.players.push(player1);
            }
            if (!existingGroup.players.some(p => p.id === player2.id)) {
              existingGroup.players.push(player2);
            }
          } else {
            console.log(`  📝 Tworzę nową grupę duplikatów`);
            // Utwórz nową grupę duplikatów
            duplicatesFound.push({
              name: duplicateName,
              players: [player1, player2]
            });
          }
        } else {
          console.log(`  ❌ Nie są duplikatami`);
        }
      }
    }
    
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
    console.log('Ale sprawdźmy czy są duplikaty w filteredPlayers...');
    
    // Sprawdź czy są duplikaty imion w filteredPlayers
    const playerNames = filteredPlayers.map(p => getPlayerFullName(p));
    const uniqueNames = [...new Set(playerNames)];
    console.log('👥 Wszyscy zawodnicy:', playerNames);
    console.log('🔢 Unikalne imiona:', uniqueNames);
    console.log('📊 Czy są duplikaty w nazwach?', playerNames.length !== uniqueNames.length);
    
    // Znajdź duplikaty ręcznie
    const nameCounts: { [key: string]: number } = {};
    playerNames.forEach(name => {
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    });
    
    const actualDuplicates = Object.entries(nameCounts).filter(([_, count]) => count > 1);
    console.log('🔍 Ręczne wyszukiwanie duplikatów:', actualDuplicates);
    
    // Sprawdź szczegóły dla Oliwier Sujka
    const oliwierPlayers = filteredPlayers.filter(p => 
      getPlayerFullName(p).toLowerCase().includes('oliwier') && 
      getPlayerFullName(p).toLowerCase().includes('sujka')
    );
    console.log('👨 Zawodnicy z imieniem Oliwier Sujka:', oliwierPlayers);
    
    // NOWE DEBUGGING - sprawdź zawodników w akcjach
    console.log('\n🎯 DEBUGGING TABELI vs FILTERED PLAYERS:');
    
    // Zbierz wszystkich zawodników z akcji (senderów i odbiorców)
    const playersFromActions = new Set<string>();
    const playerNamesFromActions = new Map<string, { id: string, name: string }>();
    
    filteredActions.forEach(action => {
      if (action.senderId) {
        playersFromActions.add(action.senderId);
        if (action.senderName) {
          playerNamesFromActions.set(action.senderId, {
            id: action.senderId,
            name: action.senderName
          });
        }
      }
      if (action.receiverId) {
        playersFromActions.add(action.receiverId);
        if (action.receiverName) {
          playerNamesFromActions.set(action.receiverId, {
            id: action.receiverId,
            name: action.receiverName
          });
        }
      }
    });
    
    console.log('📊 Zawodnicy w akcjach (unique IDs):', playersFromActions.size);
    console.log('📊 Zawodnicy w filteredPlayers:', filteredPlayers.length);
    
    // Sprawdź Oliwier Sujka w akcjach
    const oliwierInActions = Array.from(playerNamesFromActions.values()).filter(p => 
      p.name.toLowerCase().includes('oliwier') && p.name.toLowerCase().includes('sujka')
    );
    console.log('👨 Oliwier Sujka w akcjach:', oliwierInActions);
    
    // Sprawdź czy wszystkie ID z akcji są w filteredPlayers
    const playerIdsInFiltered = new Set(filteredPlayers.map(p => p.id));
    const playersInActionsButNotInFiltered = Array.from(playersFromActions).filter(id => 
      !playerIdsInFiltered.has(id)
    );
    
    console.log('🚨 Zawodnicy w akcjach ale NIE w filteredPlayers:', playersInActionsButNotInFiltered);
    playersInActionsButNotInFiltered.forEach(id => {
      const playerFromAction = playerNamesFromActions.get(id);
      console.log(`  - ID: ${id}, Nazwa: ${playerFromAction?.name || 'brak'}`);
    });
    
    // Sprawdź duplikaty w nazwach z akcji
    const nameCountsFromActions: { [key: string]: string[] } = {};
    Array.from(playerNamesFromActions.values()).forEach(player => {
      const name = player.name.toLowerCase().trim();
      if (!nameCountsFromActions[name]) {
        nameCountsFromActions[name] = [];
      }
      nameCountsFromActions[name].push(player.id);
    });
    
    const duplicateNamesInActions = Object.entries(nameCountsFromActions).filter(([_, ids]) => ids.length > 1);
    console.log('🔥 Duplikaty nazw w akcjach:', duplicateNamesInActions);
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