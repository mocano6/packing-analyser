"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from "next/link";
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TeamInfo, Action } from '@/types';
import { fetchTeams, Team } from '@/constants/teamsLoader';
import { useAuth } from "@/hooks/useAuth";
import SidePanel from "@/components/SidePanel/SidePanel";
import styles from './weryfikacja-meczow.module.css';

interface MatchWithActions extends TeamInfo {
  id: string;
  actionsP1: number;
  actionsP2: number;
  totalActions: number;
  isVerified: boolean;
  isP1Verified: boolean;
  isP2Verified: boolean;
}

export default function WeryfikacjaMeczow() {
  const [matches, setMatches] = useState<MatchWithActions[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [showTeamsDropdown, setShowTeamsDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'verified'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();

  // Zamknij dropdown przy kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdownContainer')) {
        setShowTeamsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  // Pobierz zespoły z Firebase
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await fetchTeams();
        setTeams(teamsData);
      } catch (error) {
        console.error('Błąd podczas pobierania zespołów:', error);
      }
    };

    loadTeams();
  }, []);

  // Pobierz wszystkie mecze z Firebase
  useEffect(() => {
    const fetchMatches = async () => {
      if (!db) {
        console.error('Firebase nie jest zainicjalizowane');
        return;
      }

      setIsLoading(true);
      try {
        const matchesSnapshot = await getDocs(collection(db, 'matches'));
        const allMatches: MatchWithActions[] = [];

        matchesSnapshot.docs.forEach(doc => {
          const matchData = doc.data() as TeamInfo;
          const actions = matchData.actions_packing || [];
          
          // Policz akcje w każdej połowie
          const actionsP1 = actions.filter((action: Action) => !action.isSecondHalf).length;
          const actionsP2 = actions.filter((action: Action) => action.isSecondHalf).length;
          const totalActions = actions.length;
          const isP1Verified = actionsP1 >= 20;
          const isP2Verified = actionsP2 >= 20;
          const isVerified = isP1Verified && isP2Verified;

          allMatches.push({
            ...matchData,
            id: doc.id,
            actionsP1,
            actionsP2,
            totalActions,
            isVerified,
            isP1Verified,
            isP2Verified
          });
        });

        setMatches(allMatches);
      } catch (error) {
        console.error('Błąd podczas pobierania meczów:', error);
        setMatches([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Wykonaj fetchMatches tylko jeśli użytkownik jest zalogowany i ma uprawnienia
    if (isAuthenticated && isAdmin) {
      fetchMatches();
    }
  }, [isAuthenticated, isAdmin]);

  // Filtrowanie i sortowanie
  const filteredAndSortedMatches = useMemo(() => {
    let filtered = matches;

    // Filtruj po zespołach
    if (selectedTeam !== 'all') {
      filtered = matches.filter(match => match.team === selectedTeam);
    }

    // Sortuj
    return filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'total':
          aValue = a.totalActions;
          bValue = b.totalActions;
          break;
        case 'verified':
          aValue = a.isVerified ? 1 : 0;
          bValue = b.isVerified ? 1 : 0;
          break;
        default:
          return 0;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [matches, selectedTeam, sortBy, sortDirection]);

  const handleSort = (field: 'date' | 'total' | 'verified') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: 'date' | 'total' | 'verified') => {
    if (sortBy !== field) return '↕️';
    return sortDirection === 'asc' ? '↗️' : '↘️';
  };

  const getTeamName = (teamId: string) => {
    const team = Object.values(teams).find(t => t.id === teamId);
    return team ? team.name : teamId;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Statystyki
  const stats = useMemo(() => {
    const totalMatches = filteredAndSortedMatches.length;
    const verifiedMatches = filteredAndSortedMatches.filter(m => m.isVerified).length;
    const unverifiedMatches = totalMatches - verifiedMatches;
    const verificationRate = totalMatches > 0 ? ((verifiedMatches / totalMatches) * 100).toFixed(1) : '0';

    return {
      totalMatches,
      verifiedMatches,
      unverifiedMatches,
      verificationRate
    };
  }, [filteredAndSortedMatches]);

  const getSelectedTeamName = () => {
    if (selectedTeam === 'all') return 'Wszystkie zespoły';
    const team = Object.values(teams).find(t => t.id === selectedTeam);
    return team ? team.name : 'Nieznany zespół';
  };



  // Dodaj teams do zależności w useMemo dla getTeamName
  const memoizedGetTeamName = useMemo(() => {
    return (teamId: string) => {
      const team = Object.values(teams).find(t => t.id === teamId);
      return team ? team.name : teamId;
    };
  }, [teams]);

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
          <p>Tylko administratorzy mają dostęp do weryfikacji meczów.</p>
          <Link href="/" className={styles.backButton}>
            Powrót do aplikacji
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Ładowanie meczów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1>🔍 Weryfikacja Meczów</h1>
          <Link href="/" className={styles.backButton}>
            ← Powrót do głównej
          </Link>
        </div>
                 <p className={styles.description}>
           Weryfikacja kompletności raportów analitycznych. 
           <strong> Każda połowa musi mieć co najmniej 20 akcji. Niezweryfikowane połowy są oznaczone na czerwono.</strong>
         </p>
      </div>

      {/* Statystyki ogólne */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{stats.totalMatches}</div>
          <div className={styles.statLabel}>Wszystkie mecze</div>
        </div>
        <div className={`${styles.statCard} ${styles.verified}`}>
          <div className={styles.statNumber}>{stats.verifiedMatches}</div>
          <div className={styles.statLabel}>Zweryfikowane</div>
        </div>
        <div className={`${styles.statCard} ${styles.unverified}`}>
          <div className={styles.statNumber}>{stats.unverifiedMatches}</div>
          <div className={styles.statLabel}>Niezweryfikowane</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{stats.verificationRate}%</div>
          <div className={styles.statLabel}>Wskaźnik weryfikacji</div>
        </div>
      </div>

      {/* Filtry */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Wybierz zespół:</label>
          <div className={`${styles.dropdownContainer} dropdownContainer`}>
            <div 
              className={styles.dropdownToggle}
              onClick={() => setShowTeamsDropdown(!showTeamsDropdown)}
            >
              <span>{getSelectedTeamName()}</span>
              <span className={styles.dropdownArrow}>{showTeamsDropdown ? '▲' : '▼'}</span>
            </div>
            {showTeamsDropdown && (
              <div className={styles.dropdownMenu}>
                <div 
                  className={`${styles.dropdownItem} ${selectedTeam === 'all' ? styles.active : ''}`}
                  onClick={() => {
                    setSelectedTeam('all');
                    setShowTeamsDropdown(false);
                  }}
                >
                  <span>Wszystkie zespoły</span>
                </div>
                {Object.values(teams).map(team => (
                  <div 
                    key={team.id}
                    className={`${styles.dropdownItem} ${selectedTeam === team.id ? styles.active : ''}`}
                    onClick={() => {
                      setSelectedTeam(team.id);
                      setShowTeamsDropdown(false);
                    }}
                  >
                    <span>{team.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Tabela meczów */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th 
                onClick={() => handleSort('date')}
                className={styles.sortableHeader}
              >
                Data {getSortIcon('date')}
              </th>
              <th>Zespół</th>
              <th>Przeciwnik</th>
              <th>Mecz</th>
              <th>P1</th>
              <th>P2</th>
              <th 
                onClick={() => handleSort('total')}
                className={styles.sortableHeader}
              >
                Łącznie {getSortIcon('total')}
              </th>
              <th 
                onClick={() => handleSort('verified')}
                className={styles.sortableHeader}
              >
                Status {getSortIcon('verified')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedMatches.map((match) => (
              <tr 
                key={match.id} 
                className={!match.isVerified ? styles.unverifiedRow : ''}
              >
                <td>{formatDate(match.date)}</td>
                <td>{memoizedGetTeamName(match.team)}</td>
                <td>{match.opponent}</td>
                <td>
                  <span className={styles.matchType}>
                    {match.isHome ? 'DOM' : 'WYJ'}
                  </span>
                  {match.competition && (
                    <span className={styles.competition}>
                      {match.competition}
                    </span>
                  )}
                </td>
                                 <td className={`${styles.actionsCount} ${!match.isP1Verified ? styles.unverifiedCell : ''}`}>
                   {match.actionsP1}
                 </td>
                 <td className={`${styles.actionsCount} ${!match.isP2Verified ? styles.unverifiedCell : ''}`}>
                   {match.actionsP2}
                 </td>
                <td className={`${styles.actionsCount} ${styles.totalActions}`}>
                  <strong>{match.totalActions}</strong>
                </td>
                <td>
                  <span className={`${styles.status} ${match.isVerified ? styles.verified : styles.unverified}`}>
                    {match.isVerified ? '✅ OK' : '❌ BRAK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSortedMatches.length === 0 && (
          <div className={styles.noData}>
            <p>Brak meczów do wyświetlenia.</p>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className={styles.legend}>
        <h3>Legenda:</h3>
                 <div className={styles.legendItems}>
           <div className={styles.legendItem}>
             <span className={styles.legendColor} style={{backgroundColor: '#fee2e2'}}></span>
             <span>Połowy niezweryfikowane (&lt; 20 akcji w P1 lub P2)</span>
           </div>
           <div className={styles.legendItem}>
             <span className={styles.legendColor} style={{backgroundColor: '#dcfce7'}}></span>
             <span>Mecze zweryfikowane (≥ 20 akcji w P1 I P2)</span>
           </div>
         </div>
      </div>

      {/* Panel boczny z menu */}
      <SidePanel
        players={[]}
        actions={[]}
        matchInfo={null}
        isAdmin={isAdmin}
        selectedTeam={selectedTeam}
        onRefreshData={async () => {}}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={() => {}}
      />
    </div>
  );
} 