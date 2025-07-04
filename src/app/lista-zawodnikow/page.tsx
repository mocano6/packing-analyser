"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from "next/link";
import { Player, Action } from '@/types';
import { usePlayersState } from "@/hooks/usePlayersState";
import { useAuth } from "@/hooks/useAuth";
import { getPlayerFullName } from '@/utils/playerUtils';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './page.module.css';

export default function ListaZawodnikow() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'actions' | 'teams'>('actions');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<Set<string>>(new Set());

  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const { players, handleDeletePlayer: deletePlayer } = usePlayersState();

  // Sprawdź uprawnienia administratora
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Sprawdzanie uprawnień...</p>
        </div>
      </div>
    );
  }

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

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.accessDenied}>
          <h2>🔒 Brak uprawnień</h2>
          <p>Tylko administratorzy mają dostęp do listy wszystkich zawodników.</p>
          <Link href="/" className={styles.backButton}>
            Powrót do aplikacji
          </Link>
        </div>
      </div>
    );
  }

  // Pobierz wszystkie akcje z Firebase
  useEffect(() => {
    const fetchAllActions = async () => {
      if (!db) {
        console.error('Firebase nie jest zainicjalizowane');
        return;
      }

      setIsLoading(true);
      try {
        // Pobierz wszystkie mecze
        const matchesSnapshot = await getDocs(collection(db, 'matches'));
        const allMatchActions: Action[] = [];

        // Przejdź przez każdy mecz i pobierz jego akcje
        matchesSnapshot.docs.forEach(doc => {
          const matchData = doc.data();
          if (matchData.actions_packing && Array.isArray(matchData.actions_packing)) {
            allMatchActions.push(...matchData.actions_packing);
          }
        });

        console.log(`Pobrano ${allMatchActions.length} akcji z ${matchesSnapshot.docs.length} meczów`);
        setAllActions(allMatchActions);
      } catch (error) {
        console.error('Błąd podczas pobierania akcji:', error);
        setAllActions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllActions();
  }, []);

  // Oblicz liczbę akcji dla każdego zawodnika
  const playersWithStats = useMemo(() => {
    return players.map(player => {
      const playerActions = allActions.filter(action => 
        action.senderId === player.id || action.receiverId === player.id
      );
      
      return {
        ...player,
        actionsCount: playerActions.length,
        teamsString: player.teams ? player.teams.join(', ') : ''
      };
    });
  }, [players, allActions]);

  // Filtrowanie i sortowanie
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = playersWithStats.filter(player =>
      getPlayerFullName(player).toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.number.toString().includes(searchTerm) ||
      (player.teamsString.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      let aValue, bValue;
      
      // Funkcja do wyciągnięcia nazwiska (ostatnie słowo) z pełnej nazwy
      const getLastName = (fullName: string) => {
        const words = fullName.trim().split(/\s+/);
        return words[words.length - 1].toLowerCase();
      };
      
      switch (sortBy) {
        case 'name':
          // Sortuj po nazwisku zamiast po pełnej nazwie
          aValue = getLastName(a.name || '');
          bValue = getLastName(b.name || '');
          break;
        case 'actions':
          aValue = a.actionsCount;
          bValue = b.actionsCount;
          break;
        case 'teams':
          aValue = a.teamsString.toLowerCase();
          bValue = b.teamsString.toLowerCase();
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue, 'pl', { sensitivity: 'base' })
          : bValue.localeCompare(aValue, 'pl', { sensitivity: 'base' });
      } else {
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
  }, [playersWithStats, searchTerm, sortBy, sortDirection]);

  // Znajdź potencjalne duplikaty
  const findDuplicates = () => {
    console.log('🔍 Sprawdzanie duplikatów...', playersWithStats.length, 'zawodników');
    
    // Funkcja do normalizacji nazwy
    const normalizeName = (name: string) => {
      if (!name) return '';
      
      return name
        .toLowerCase()
        .trim()
        // Usuń znaki diakrytyczne
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Usuń wielokrotne spacje i zastąp pojedynczą spacją
        .replace(/\s+/g, ' ')
        // Usuń znaki specjalne oprócz spacji i liter
        .replace(/[^a-z\s]/g, '');
    };

    const nameGroups: { [key: string]: typeof playersWithStats } = {};
    
    // Grupowanie tylko po nazwie (imię i nazwisko)
    playersWithStats.forEach(player => {
      const originalName = getPlayerFullName(player) || '';
      const normalizedName = normalizeName(originalName);
      console.log(`   📝 Zawodnik: "${originalName}" → normalizowana: "${normalizedName}"`);
      
      if (normalizedName) {
        if (!nameGroups[normalizedName]) {
          nameGroups[normalizedName] = [];
        }
        nameGroups[normalizedName].push(player);
      }
    });

    // Znajdź duplikaty po nazwie (tylko imię i nazwisko)
    const nameDuplicates = Object.entries(nameGroups)
      .filter(([_, players]) => players.length > 1)
      .map(([name, players]) => ({ 
        type: 'name' as const,
        key: name, 
        players 
      }));

    console.log('📊 Wyniki wykrywania duplikatów:', {
      nameDuplicates: nameDuplicates.length,
      total: nameDuplicates.length
    });
    
    // Loguj szczegóły każdej grupy duplikatów
    nameDuplicates.forEach((group, index) => {
      console.log(`   📋 Grupa ${index + 1}: "${group.key}"`, 
        group.players.map(p => `${getPlayerFullName(p)} (#${p.number}, ID: ${p.id})`));
    });

    // DODATKOWE DEBUGOWANIE - sprawdź czy "Barłomiej Zieliński" jest wykrywany
    const barłomiejPlayers = playersWithStats.filter(p => {
      const fullName = getPlayerFullName(p);
      return fullName && (fullName.includes('Barłomiej') || fullName.includes('Bartłomiej'));
    });
    
    if (barłomiejPlayers.length > 0) {
      console.log('🔍 SPRAWDZENIE "Barłomiej/Bartłomiej":');
      barłomiejPlayers.forEach(player => {
        const fullName = getPlayerFullName(player) || '';
        const normalized = normalizeName(fullName);
        console.log(`  👤 "${fullName}" (ID: ${player.id}) → "${normalized}"`);
      });
      
      // Sprawdź czy znormalizowane nazwy są identyczne
      const normalizedNames = barłomiejPlayers.map(p => normalizeName(getPlayerFullName(p) || ''));
      const uniqueNormalized = [...new Set(normalizedNames)];
      console.log(`  🎯 Unikalne znormalizowane nazwy: ${uniqueNormalized.length}`, uniqueNormalized);
      
      if (uniqueNormalized.length < barłomiejPlayers.length) {
        console.log('  ✅ Duplikaty powinny być wykryte!');
      } else {
        console.log('  ❌ Duplikaty NIE BĘDĄ wykryte - różne znormalizowane nazwy');
      }
    }

    return nameDuplicates;
  };

  const duplicates = findDuplicates();

  // Funkcja do przełączania rozwinięcia akcji zawodnika
  const togglePlayerActions = (playerId: string) => {
    setExpandedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // Funkcja do pobierania akcji konkretnego zawodnika
  const getPlayerActions = (playerId: string) => {
    return allActions.filter(action => 
      action.senderId === playerId || action.receiverId === playerId
    ).sort((a, b) => b.minute - a.minute); // Sortuj od najnowszych
  };

  // Funkcja do obliczania podobieństwa stringów (algorytm Jaro-Winkler uproszczony)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Uproszczony algorytm - sprawdź ile znaków jest wspólnych
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] === shorter[i]) {
        matches++;
      }
    }
    
    return matches / longer.length;
  };

  // Funkcja do sparowania duplikatów
  const mergeDuplicates = async () => {
    console.log('🔧 mergeDuplicates START:', { duplicatesCount: duplicates.length });
    
    if (duplicates.length === 0) {
      alert('Nie znaleziono duplikatów do sparowania.');
      return;
    }

    if (!db) {
      alert('Firebase nie jest zainicjalizowane. Nie można sparować duplikatów.');
      return;
    }

    // Pokaż szczegóły duplikatów do sparowania
    const duplicatesSummary = duplicates.map(({ key, players }) => 
      `👥 ${key}: ${players.length} zawodników`
    ).join('\n');

    const confirmMerge = window.confirm(
      `Czy na pewno chcesz sparować ${duplicates.length} grup duplikatów?\n\n` +
      'Znalezione duplikaty (to samo imię i nazwisko):\n' +
      duplicatesSummary + '\n\n' +
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
      for (const { key, players: duplicatePlayers } of duplicates) {
        if (duplicatePlayers.length < 2) {
          continue;
        }

        // Sortuj zawodników: pierwszeństwo ma ten z więcej akcjami, a jeśli równo to starsze ID
        const sortedPlayers = [...duplicatePlayers].sort((a, b) => {
          if (a.actionsCount !== b.actionsCount) {
            return b.actionsCount - a.actionsCount; // Więcej akcji = główny
          }
          return a.id.localeCompare(b.id); // Starsze ID = główny
        });

        const mainPlayer = sortedPlayers[0]; // Główny zawodnik (zostanie)
        const duplicatesToMerge = sortedPlayers.slice(1); // Duplikaty (zostaną usunięte)

        try {
          // Krok 1: Znajdź wszystkie akcje duplikatów i przenieś je do głównego zawodnika
          console.log('📝 Krok 1: Przenoszenie akcji...');
          const matchesSnapshot = await getDocs(collection(db, 'matches'));
          let totalActionsUpdated = 0;
          
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
                    updatedAction.senderName = getPlayerFullName(mainPlayer) || 'Brak nazwy';
                    updatedAction.senderNumber = mainPlayer.number;
                    actionsChanged = true;
                    totalActionsUpdated++;
                    console.log(`   ✅ Przeniesiono akcję (sender): ${action.id} z ${duplicate.id} na ${mainPlayer.id}`);
                  }
                  
                  if (action.receiverId === duplicate.id) {
                    updatedAction.receiverId = mainPlayer.id;
                    updatedAction.receiverName = getPlayerFullName(mainPlayer) || 'Brak nazwy';
                    updatedAction.receiverNumber = mainPlayer.number;
                    actionsChanged = true;
                    totalActionsUpdated++;
                    console.log(`   ✅ Przeniesiono akcję (receiver): ${action.id} z ${duplicate.id} na ${mainPlayer.id}`);
                  }
                });
                
                return updatedAction;
              });

              // Zapisz zaktualizowane akcje jeśli były zmiany
              if (actionsChanged) {
                await updateDoc(doc(db, 'matches', matchDoc.id), {
                  actions_packing: updatedActions
                });
                console.log(`   💾 Zaktualizowano akcje w meczu: ${matchDoc.id}`);
              }
            }
          }
          
          console.log(`📊 Łącznie przeniesionych akcji: ${totalActionsUpdated}`);

          // Krok 2: Połącz zespoły z duplikatów z głównym zawodnikiem
          console.log('🏆 Krok 2: Łączenie zespołów...');
          const allTeams = new Set(mainPlayer.teams || []);
          const teamsBeforeMerge = Array.from(allTeams);
          
          duplicatesToMerge.forEach(duplicate => {
            if (duplicate.teams) {
              duplicate.teams.forEach(team => allTeams.add(team));
            }
          });
          
          const teamsAfterMerge = Array.from(allTeams);
          console.log(`   🔄 Zespoły przed: ${teamsBeforeMerge.join(', ')}`);
          console.log(`   ✅ Zespoły po: ${teamsAfterMerge.join(', ')}`);

          // Aktualizuj głównego zawodnika z połączonymi zespołami
          const updatedMainPlayer = {
            ...mainPlayer,
            teams: teamsAfterMerge,
            // Zaktualizuj pozycję jeśli była pusta
            position: mainPlayer.position || duplicatesToMerge.find(d => d.position)?.position || mainPlayer.position,
            // Zaktualizuj rok urodzenia jeśli był pusty
            birthYear: mainPlayer.birthYear || duplicatesToMerge.find(d => d.birthYear)?.birthYear || mainPlayer.birthYear
          };

          await updateDoc(doc(db, 'players', mainPlayer.id), {
            teams: updatedMainPlayer.teams,
            position: updatedMainPlayer.position,
            birthYear: updatedMainPlayer.birthYear
          });
          console.log(`   💾 Zaktualizowano głównego zawodnika: ${mainPlayer.id}`);

          // Krok 3: Usuń duplikaty
          console.log('🗑️ Krok 3: Usuwanie duplikatów...');
          for (const duplicate of duplicatesToMerge) {
            await deleteDoc(doc(db, 'players', duplicate.id));
            console.log(`   ❌ Usunięto duplikat: ${duplicate.id} (${getPlayerFullName(duplicate) || 'Brak nazwy'})`);
          }

          mergedCount++;
          console.log(`✅ Pomyślnie sparowano grupę duplikatów dla: ${getPlayerFullName(mainPlayer) || 'Brak nazwy'}`);

        } catch (error) {
          console.error(`❌ Błąd podczas sparowywania duplikatów dla ${getPlayerFullName(mainPlayer) || 'Brak nazwy'}:`, error);
          errorCount++;
        }
      }

      console.log(`🏁 Sparowanie zakończone: ${mergedCount} sukces, ${errorCount} błędy`);
      
      // Odśwież dane po zakończeniu
      console.log('🔄 Odświeżam stronę...');
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

  const handleSort = (field: 'name' | 'actions' | 'teams') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: 'name' | 'actions' | 'teams') => {
    if (sortBy !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleDeletePlayerFromList = async (playerId: string, playerName: string) => {
    if (window.confirm(`Czy na pewno chcesz usunąć zawodnika ${playerName}?`)) {
      console.log('🗑️ Próba usunięcia zawodnika:', { playerId, playerName });
      
      const success = await deletePlayer(playerId);
      console.log('📊 Wynik usuwania:', success);
      
      if (success) {
        alert(`Zawodnik ${playerName} został usunięty`);
        console.log('🔄 Odświeżam stronę po usunięciu zawodnika...');
        // Odśwież stronę aby zaktualizować listę
        window.location.reload();
      } else {
        alert('Wystąpił błąd podczas usuwania zawodnika');
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lista wszystkich zawodników</h1>
        <Link href="/" className={styles.backButton}>
          ← Powrót do głównej
        </Link>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Szukaj zawodnika (imię, nazwisko, numer, zespół)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.stats}>
          <span className={styles.totalCount}>
            Łącznie zawodników: {players.length}
          </span>
          <span className={styles.filteredCount}>
            Wyświetlanych: {filteredAndSortedPlayers.length}
          </span>
          {duplicates.length > 0 && (
            <span className={styles.duplicatesWarning}>
              ⚠️ Znaleziono {duplicates.length} potencjalnych duplikatów
            </span>
          )}
          <button 
            onClick={mergeDuplicates}
            disabled={isMergingDuplicates}
            className={styles.mergeDuplicatesButton}
            title="Sparuj wszystkie duplikaty automatycznie"
          >
            {isMergingDuplicates ? 'Sparowywanie...' : `🔄 Sparuj ${duplicates.length} grup duplikatów`}
          </button>
          <button 
            onClick={() => console.log('Funkcja czyszczenia Firebase niedostępna')}
            className={styles.cleanupButton}
            title="Usuń duplikaty z Firebase (na podstawie name + number)"
            disabled
          >
            🧹 Wyczyść duplikaty Firebase
          </button>
          <button 
            onClick={() => console.log('Funkcja czyszczenia lokalnie niedostępna')}
            className={styles.cleanupButton}
            title="Usuń duplikaty ID z lokalnego stanu"
            disabled
          >
            🧹 Wyczyść duplikaty lokalnie
          </button>
        </div>
      </div>

      {/* Sekcja duplikatów */}
      {duplicates.length > 0 && (
        <div className={styles.duplicatesSection}>
          <div className={styles.duplicatesHeader}>
            <h3>⚠️ Potencjalne duplikaty (to samo imię i nazwisko)</h3>
          </div>
          {duplicates.map(({ key, players: duplicatePlayers }) => (
            <div key={key} className={styles.duplicateGroup}>
              <h4>👥 Nazwa: "{key.charAt(0).toUpperCase() + key.slice(1)}"</h4>
              <div className={styles.duplicateList}>
                {duplicatePlayers.map(player => (
                  <div key={player.id} className={styles.duplicateItem}>
                    <div className={styles.playerInfo}>
                      <span className={styles.playerName}>{getPlayerFullName(player)}</span>
                      <span className={styles.playerNumber}>#{player.number}</span>
                      <span className={styles.playerBirthYear}>
                        {player.birthYear ? `ur. ${player.birthYear}` : 'Brak roku urodzenia'}
                      </span>
                      <span className={styles.playerTeams}>{player.teamsString || 'Brak zespołu'}</span>
                      <span className={styles.playerActions}>{player.actionsCount} akcji</span>
                      <span className={styles.playerId} title="ID zawodnika">ID: {player.id}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePlayerFromList(player.id, getPlayerFullName(player) || 'Brak nazwy')}
                      className={styles.deleteButton}
                      title="Usuń tego zawodnika"
                    >
                      🗑️ Usuń
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabela wszystkich zawodników */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                Imię i nazwisko (sortuj wg nazwiska) {getSortIcon('name')}
              </th>
              <th>Numer</th>
              <th>Rok urodzenia</th>
              <th>Pozycja</th>
              <th onClick={() => handleSort('teams')} className={styles.sortableHeader}>
                Zespoły {getSortIcon('teams')}
              </th>
              <th onClick={() => handleSort('actions')} className={styles.sortableHeader}>
                Liczba akcji {getSortIcon('actions')}
              </th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPlayers.map((player) => (
              <tr key={player.id} className={styles.tableRow}>
                <td className={styles.playerName}>{getPlayerFullName(player)}</td>
                <td className={styles.playerNumber}>#{player.number}</td>
                <td>{player.birthYear || '-'}</td>
                <td>{player.position || '-'}</td>
                <td className={styles.playerTeams}>{player.teamsString || '-'}</td>
                <td className={`${styles.actionsCount} ${player.actionsCount === 0 ? styles.noActions : ''}`}>
                  <button
                    onClick={() => togglePlayerActions(player.id)}
                    className={`${styles.actionsButton} ${expandedPlayerIds.has(player.id) ? styles.expanded : ''}`}
                    disabled={player.actionsCount === 0}
                    title={player.actionsCount > 0 ? "Kliknij aby zobaczyć akcje" : "Brak akcji"}
                  >
                    {player.actionsCount}
                    {player.actionsCount > 0 && (
                      <span className={styles.expandIcon}>
                        {expandedPlayerIds.has(player.id) ? ' ▼' : ' ▶'}
                      </span>
                    )}
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => handleDeletePlayerFromList(player.id, getPlayerFullName(player) || 'Brak nazwy')}
                    className={styles.deleteButton}
                    title="Usuń zawodnika"
                    disabled={player.actionsCount > 0}
                  >
                    🗑️
                  </button>
                  {player.actionsCount > 0 && (
                    <span className={styles.deleteWarning} title="Nie można usunąć zawodnika z akcjami">
                      ⚠️
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Sekcja z rozwiniętymi akcjami */}
        {Array.from(expandedPlayerIds).map(playerId => {
          const player = filteredAndSortedPlayers.find(p => p.id === playerId);
          const playerActions = getPlayerActions(playerId);
          
          if (!player || playerActions.length === 0) return null;

          return (
            <div key={`actions-${playerId}`} className={styles.expandedActionsSection}>
              <div className={styles.actionsHeader}>
                <h3>Akcje zawodnika: {getPlayerFullName(player)}</h3>
                <button 
                  onClick={() => togglePlayerActions(playerId)}
                  className={styles.closeActionsButton}
                  title="Zamknij listę akcji"
                >
                  ✕
                </button>
              </div>
              
              <div className={styles.actionsStats}>
                <span>Łącznie akcji: <strong>{playerActions.length}</strong></span>
                <span>Jako nadawca: <strong>{playerActions.filter(a => a.senderId === playerId).length}</strong></span>
                <span>Jako odbiorca: <strong>{playerActions.filter(a => a.receiverId === playerId).length}</strong></span>
              </div>

              <div className={styles.actionsTable}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Minuta</th>
                      <th>Typ akcji</th>
                      <th>Rola</th>
                      <th>Partner</th>
                      <th>Strefa</th>
                      <th>Punkty</th>
                      <th>Szczegóły</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerActions.map((action, index) => {
                      const isActionSender = action.senderId === playerId;
                      const partnerName = isActionSender ? action.receiverName : action.senderName;
                      const partnerNumber = isActionSender ? action.receiverNumber : action.senderNumber;
                      
                      return (
                        <tr key={`${action.id}-${index}`} className={styles.actionRow}>
                          <td className={styles.actionMinute}>{action.minute}'</td>
                          <td className={styles.actionType}>
                            {action.actionType === 'pass' ? '⚽ Podanie' : '🏃 Drybling'}
                          </td>
                          <td className={`${styles.actionRole} ${isActionSender ? styles.sender : styles.receiver}`}>
                            {isActionSender ? '📤 Nadawca' : '📥 Odbiorca'}
                          </td>
                          <td className={styles.actionPartner}>
                            {action.actionType === 'pass' && partnerName ? 
                              `${partnerName} (#${partnerNumber})` : 
                              '-'}
                          </td>
                          <td className={styles.actionZone}>
                            {action.startZone && action.endZone ? 
                              `${action.startZone} → ${action.endZone}` : 
                              action.startZone || action.endZone || '-'}
                          </td>
                          <td className={`${styles.actionPoints} ${(action.packingPoints || 0) >= 3 ? styles.highPoints : ''}`}>
                            <strong>{action.packingPoints || 0}</strong>
                          </td>
                          <td className={styles.actionDetails}>
                            {action.isP3 && <span className={styles.p3Badge}>P3</span>}
                            {action.isShot && <span className={styles.shotBadge}>🎯 Strzał</span>}
                            {action.isGoal && <span className={styles.goalBadge}>⚽ Gol</span>}
                            {action.isPenaltyAreaEntry && <span className={styles.penaltyBadge}>📦 Pole karne</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <div className={styles.noResults}>
          <p>Brak zawodników spełniających kryteria wyszukiwania</p>
        </div>
      )}
    </div>
  );
} 