"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from "next/link";
import { Player, Action } from '@/types';
import { usePlayersState } from "@/hooks/usePlayersState";
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './page.module.css';

export default function ListaZawodnikow() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'actions' | 'teams'>('actions');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { players, handleDeletePlayer: deletePlayer } = usePlayersState();

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
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.number.toString().includes(searchTerm) ||
      (player.teamsString.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
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
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
  }, [playersWithStats, searchTerm, sortBy, sortDirection]);

  // Znajdź potencjalne duplikaty
  const findDuplicates = () => {
    const nameGroups: { [key: string]: typeof playersWithStats } = {};
    
    playersWithStats.forEach(player => {
      const nameKey = player.name.toLowerCase().trim();
      if (!nameGroups[nameKey]) {
        nameGroups[nameKey] = [];
      }
      nameGroups[nameKey].push(player);
    });

    return Object.entries(nameGroups)
      .filter(([_, players]) => players.length > 1)
      .map(([name, players]) => ({ name, players }));
  };

  const duplicates = findDuplicates();

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
      const success = await deletePlayer(playerId);
      if (success) {
        alert(`Zawodnik ${playerName} został usunięty`);
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
        </div>
      </div>

      {/* Sekcja duplikatów */}
      {duplicates.length > 0 && (
        <div className={styles.duplicatesSection}>
          <h3>⚠️ Potencjalne duplikaty (to samo imię i nazwisko)</h3>
          {duplicates.map(({ name, players: duplicatePlayers }) => (
            <div key={name} className={styles.duplicateGroup}>
              <h4>Nazwa: "{name.charAt(0).toUpperCase() + name.slice(1)}"</h4>
              <div className={styles.duplicateList}>
                {duplicatePlayers.map(player => (
                  <div key={player.id} className={styles.duplicateItem}>
                    <div className={styles.playerInfo}>
                      <span className={styles.playerName}>{player.name}</span>
                      <span className={styles.playerNumber}>#{player.number}</span>
                      <span className={styles.playerBirthYear}>
                        {player.birthYear ? `ur. ${player.birthYear}` : 'Brak roku urodzenia'}
                      </span>
                      <span className={styles.playerTeams}>{player.teamsString || 'Brak zespołu'}</span>
                      <span className={styles.playerActions}>{player.actionsCount} akcji</span>
                    </div>
                    <button
                      onClick={() => handleDeletePlayerFromList(player.id, player.name)}
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
                Imię i nazwisko {getSortIcon('name')}
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
                <td className={styles.playerName}>{player.name}</td>
                <td className={styles.playerNumber}>#{player.number}</td>
                <td>{player.birthYear || '-'}</td>
                <td>{player.position || '-'}</td>
                <td className={styles.playerTeams}>{player.teamsString || '-'}</td>
                <td className={`${styles.actionsCount} ${player.actionsCount === 0 ? styles.noActions : ''}`}>
                  {player.actionsCount}
                </td>
                <td>
                  <button
                    onClick={() => handleDeletePlayerFromList(player.id, player.name)}
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
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <div className={styles.noResults}>
          <p>Brak zawodników spełniających kryteria wyszukiwania</p>
        </div>
      )}
    </div>
  );
} 