"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from "next/link";
import { collection, getDocs, doc, getDoc } from '@/lib/firestoreWithMetrics';
import { db } from '@/lib/firebase';
import { TeamInfo, Action } from '@/types';
import { fetchTeams, Team } from '@/constants/teamsLoader';
import { useAuth } from "@/hooks/useAuth";
import SidePanel from "@/components/SidePanel/SidePanel";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePresentationMode } from '@/contexts/PresentationContext';
import styles from './weryfikacja-meczow.module.css';

interface CategoryStatus {
  actionsP1: number;
  actionsP2: number;
  totalActions: number;
  isP1Verified: boolean;
  isP2Verified: boolean;
  isVerified: boolean;
}

interface MatchWithActions extends TeamInfo {
  id: string;
  packing: CategoryStatus;
  regain: CategoryStatus;
  loses: CategoryStatus;
  deadline: string; // Termin (piątek tygodnia po meczu)
  isWithin60Days: boolean;
  // Informacyjne liczby
  shotsCount: number;
  pkEntriesCount: number;
  acc8sCount: number;
}

type ChartType = 'packing' | 'regain' | 'loses' | 'xg' | 'pk' | 'acc8s' | null;

export default function WeryfikacjaMeczow() {
  const [matches, setMatches] = useState<MatchWithActions[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [showTeamsDropdown, setShowTeamsDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'verified'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  const { isAuthenticated, isAdmin, isLoading: authLoading, userRole, linkedPlayerId } = useAuth();
  const { isPresentationMode } = usePresentationMode();

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
        const teamsData = await fetchTeams({ includeInactive: true });
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
        const matchesRef = collection(db, 'matches');
        const matchesQuery = selectedTeam !== 'all'
          ? query(matchesRef, where('team', '==', selectedTeam))
          : matchesRef;
        const matchesSnapshot = await getDocs(matchesQuery);
        const allMatches: MatchWithActions[] = [];

        matchesSnapshot.docs.forEach(doc => {
          const matchData = doc.data() as TeamInfo;
          
          // Pobierz akcje z kategorii (tylko packing jest weryfikowany)
          const packingActions = matchData.actions_packing || [];
          const regainActions = matchData.actions_regain || [];
          const losesActions = matchData.actions_loses || [];
          
          // Oblicz status dla każdej kategorii
          const packing = getCategoryStatus(packingActions);
          const regain = getCategoryStatus(regainActions);
          const loses = getCategoryStatus(losesActions);
          
          // Informacyjne liczby
          const shotsCount = (matchData.shots || []).length;
          const pkEntriesCount = (matchData.pkEntries || []).length;
          const acc8sCount = ((matchData as any).acc8sEntries || []).length;
          
          // Oblicz termin i sprawdź czy mecz jest z ostatnich 60 dni
          const deadline = calculateDeadline(matchData.date);
          const within60Days = isWithin60Days(matchData.date);

          allMatches.push({
            ...matchData,
            id: doc.id,
            packing,
            regain,
            loses,
            deadline,
            isWithin60Days: within60Days,
            shotsCount,
            pkEntriesCount,
            acc8sCount
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
  }, [isAuthenticated, isAdmin, selectedTeam]);

  // Filtrowanie i sortowanie
  const filteredAndSortedMatches = useMemo(() => {
    let filtered = matches;

    // Filtruj tylko mecze z ostatnich 60 dni
    filtered = filtered.filter(match => match.isWithin60Days);

    // Filtruj po zespołach
    if (selectedTeam !== 'all') {
      filtered = filtered.filter(match => match.team === selectedTeam);
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
          // Suma akcji packing (tylko packing jest weryfikowany)
          aValue = a.packing.totalActions;
          bValue = b.packing.totalActions;
          break;
        case 'verified':
          aValue = a.packing.isVerified ? 1 : 0;
          bValue = b.packing.isVerified ? 1 : 0;
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

  // Funkcja obliczająca termin (najbliższy piątek tygodnia po meczu)
  const calculateDeadline = (matchDate: string): string => {
    const date = new Date(matchDate);
    // Znajdź najbliższy piątek (dzień tygodnia 5 = piątek, gdzie 0 = niedziela)
    const dayOfWeek = date.getDay(); // 0 = niedziela, 1 = poniedziałek, ..., 5 = piątek, 6 = sobota
    
    let daysUntilFriday: number;
    if (dayOfWeek === 5) {
      // Jeśli mecz jest w piątek, termin to ten sam piątek
      daysUntilFriday = 0;
    } else if (dayOfWeek === 6) {
      // Jeśli mecz jest w sobotę, termin to następny piątek (6 dni)
      daysUntilFriday = 6;
    } else if (dayOfWeek === 0) {
      // Jeśli mecz jest w niedzielę, termin to następny piątek (5 dni)
      daysUntilFriday = 5;
    } else {
      // Dla pozostałych dni (pon-czw), termin to najbliższy piątek tego tygodnia
      daysUntilFriday = 5 - dayOfWeek;
    }
    
    const deadline = new Date(date);
    deadline.setDate(date.getDate() + daysUntilFriday);
    return deadline.toISOString().split('T')[0];
  };

  // Funkcja sprawdzająca czy mecz jest z ostatnich 60 dni
  const isWithin60Days = (matchDate: string): boolean => {
    const date = new Date(matchDate);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= 60;
  };

  // Funkcja sprawdzająca status kategorii
  const getCategoryStatus = (actions: Action[]): CategoryStatus => {
    const actionsP1 = actions.filter((action: Action) => !action.isSecondHalf).length;
    const actionsP2 = actions.filter((action: Action) => action.isSecondHalf).length;
    const totalActions = actions.length;
    const isP1Verified = actionsP1 >= 20;
    const isP2Verified = actionsP2 >= 20;
    const isVerified = isP1Verified && isP2Verified;
    
    return {
      actionsP1,
      actionsP2,
      totalActions,
      isP1Verified,
      isP2Verified,
      isVerified
    };
  };

  // Statystyki
  const stats = useMemo(() => {
    const totalMatches = filteredAndSortedMatches.length;
    
    // Policz zweryfikowane mecze (tylko packing jest weryfikowany)
    const verifiedMatches = filteredAndSortedMatches.filter(m => 
      m.packing.isVerified
    ).length;
    
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
    const rawName = team ? team.name : 'Nieznany zespół';
    if (!isPresentationMode) return rawName;
    return 'Zespół';
  };

  // Funkcja do generowania danych wykresu (liczba akcji co 5 minut)
  const generateChartData = (items: any[], getMinute: (item: any) => number): any[] => {
    const intervals: { [key: number]: number } = {};
    
    // Tworzymy wszystkie przedziały 0-90 minut (co 5 min)
    for (let i = 0; i <= 90; i += 5) {
      intervals[i] = 0;
    }
    
    // Zliczamy akcje w każdym przedziale
    items.forEach(item => {
      const minute = getMinute(item);
      const interval = Math.floor(minute / 5) * 5;
      if (intervals[interval] !== undefined) {
        intervals[interval]++;
      }
    });
    
    // Konwertuj na tablicę
    return Object.keys(intervals).map(key => ({
      minute: `${key}-${parseInt(key) + 5}`,
      minuteValue: parseInt(key),
      count: intervals[parseInt(key)]
    }));
  };

  // Obsługa kliknięcia w wiersz/kolumnę
  const handleRowClick = async (matchId: string, chartType: ChartType) => {
    if (selectedMatchId === matchId && selectedChartType === chartType) {
      // Jeśli kliknięto ten sam mecz i typ, zamknij wykres
      setSelectedMatchId(null);
      setSelectedChartType(null);
      setChartData([]);
      return;
    }

    setSelectedMatchId(matchId);
    setSelectedChartType(chartType);
    setIsLoadingChart(true);

    try {
      const matchDoc = await getDoc(doc(db, 'matches', matchId));
      if (!matchDoc.exists()) {
        console.error('Mecz nie istnieje:', matchId);
        setIsLoadingChart(false);
        return;
      }

      const matchData = matchDoc.data() as TeamInfo;
      let chartDataArray: any[] = [];

      switch (chartType) {
        case 'packing':
          const packingActions = matchData.actions_packing || [];
          chartDataArray = generateChartData(packingActions, (action: Action) => action.minute || 0);
          break;
        case 'regain':
          const regainActions = matchData.actions_regain || [];
          chartDataArray = generateChartData(regainActions, (action: Action) => action.minute || 0);
          break;
        case 'loses':
          const losesActions = matchData.actions_loses || [];
          chartDataArray = generateChartData(losesActions, (action: Action) => action.minute || 0);
          break;
        case 'xg':
          const shots = matchData.shots || [];
          chartDataArray = generateChartData(shots, (shot: any) => shot.minute || 0);
          break;
        case 'pk':
          const pkEntries = matchData.pkEntries || [];
          chartDataArray = generateChartData(pkEntries, (entry: any) => entry.minute || 0);
          break;
        case 'acc8s':
          const acc8sEntries = (matchData as any).acc8sEntries || [];
          chartDataArray = generateChartData(acc8sEntries, (entry: any) => entry.minute || 0);
          break;
      }

      setChartData(chartDataArray);
    } catch (error) {
      console.error('Błąd podczas ładowania danych wykresu:', error);
      setChartData([]);
    } finally {
      setIsLoadingChart(false);
    }
  };

  // Funkcja do uzyskania nazwy typu wykresu
  const getChartTypeName = (type: ChartType): string => {
    switch (type) {
      case 'packing': return 'Packing';
      case 'regain': return 'Regain';
      case 'loses': return 'Loses';
      case 'xg': return 'xG (Strzały)';
      case 'pk': return 'Wejścia w PK';
      case 'acc8s': return '8s ACC';
      default: return '';
    }
  };



  // Dodaj teams do zależności w useMemo dla getTeamName
  const memoizedGetTeamName = useMemo(() => {
    return (teamId: string) => {
      const team = Object.values(teams).find(t => t.id === teamId);
      const rawName = team ? team.name : teamId;
      if (!isPresentationMode) return rawName;
      return rawName === 'Wszystkie zespoły' ? rawName : 'Zespół';
    };
  }, [teams, isPresentationMode]);

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
          <Link href="/analyzer" className={styles.backButton}>
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
          <Link href="/analyzer" className={styles.backButton}>
            ← Powrót do głównej
          </Link>
        </div>
                 <p className={styles.description}>
           Weryfikacja kompletności raportów analitycznych dla meczów z ostatnich 60 dni. 
           <strong> Packing: każda połowa musi mieć co najmniej 20 akcji. Termin uzupełnienia: najbliższy piątek tygodnia po meczu.</strong>
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
                    <span>{memoizedGetTeamName(team.id)}</span>
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
              <th>Termin</th>
              <th>Zespół</th>
              <th>Przeciwnik</th>
              <th>Mecz</th>
              <th>Packing</th>
              <th>Regain</th>
              <th>Loses</th>
              <th>xG</th>
              <th>PK</th>
              <th>8s ACC</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedMatches.map((match) => {
              const isSelected = selectedMatchId === match.id;
              return (
                <tr 
                  key={match.id} 
                  className={`${!match.packing.isVerified ? styles.unverifiedRow : ''} ${isSelected ? styles.selectedRow : ''}`}
                >
                  <td 
                    onClick={() => handleRowClick(match.id, 'packing')}
                    className={styles.clickableCell}
                  >{formatDate(match.date)}</td>
                  <td>{formatDate(match.deadline)}</td>
                  <td>
                    <span>{memoizedGetTeamName(match.team)}</span>
                    <div className={styles.matchIdRow}>{match.id}</div>
                  </td>
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
                  <td 
                    className={styles.categoryCell}
                    onClick={() => handleRowClick(match.id, 'packing')}
                  >
                    <div className={styles.categoryStatus}>
                      <div className={styles.categoryHeader}>Packing</div>
                      <div className={styles.categoryDetails}>
                        <span className={match.packing.isP1Verified ? '' : styles.unverifiedText}>P1: {match.packing.actionsP1}</span>
                        <span className={match.packing.isP2Verified ? '' : styles.unverifiedText}>P2: {match.packing.actionsP2}</span>
                        <span className={styles.totalText}>Σ: {match.packing.totalActions}</span>
                      </div>
                      <span className={`${styles.status} ${match.packing.isVerified ? styles.verified : styles.unverified}`}>
                        {match.packing.isVerified ? '✅' : '❌'}
                      </span>
                      {(() => {
                        const pos = match.matchData?.possession;
                        const p1Team = pos?.teamFirstHalf ?? null;
                        const p1Opp = pos?.opponentFirstHalf ?? null;
                        const p2Team = pos?.teamSecondHalf ?? null;
                        const p2Opp = pos?.opponentSecondHalf ?? null;
                        const hasPossession = [p1Team, p1Opp, p2Team, p2Opp].some(v => v != null && v !== undefined);
                        if (!hasPossession) {
                          return <div className={styles.possessionRow}>Posiadanie: brak danych</div>;
                        }
                        const fmt = (v: number | null | undefined) => (v != null ? v.toFixed(1) : '–');
                        const isLow = (v: number | null | undefined) => v != null && v < 1;
                        const wrapLow = (v: number | null | undefined, label: string) =>
                          isLow(v) ? <span className={styles.possessionLow}>{label}</span> : label;
                        return (
                          <div className={styles.possessionRow}>
                            <div>Posiadanie P1: zespół {wrapLow(p1Team, fmt(p1Team))} min, przeciwnik {wrapLow(p1Opp, fmt(p1Opp))} min</div>
                            <div>Posiadanie P2: zespół {wrapLow(p2Team, fmt(p2Team))} min, przeciwnik {wrapLow(p2Opp, fmt(p2Opp))} min</div>
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td 
                    className={styles.infoCell}
                    onClick={() => handleRowClick(match.id, 'regain')}
                  >
                    <div className={styles.infoValue}>
                      <div className={styles.infoLabel}>Regain</div>
                      <div className={styles.infoNumber}>{match.regain.totalActions}</div>
                    </div>
                  </td>
                  <td 
                    className={styles.infoCell}
                    onClick={() => handleRowClick(match.id, 'loses')}
                  >
                    <div className={styles.infoValue}>
                      <div className={styles.infoLabel}>Loses</div>
                      <div className={styles.infoNumber}>{match.loses.totalActions}</div>
                    </div>
                  </td>
                  <td 
                    className={styles.infoCell}
                    onClick={() => handleRowClick(match.id, 'xg')}
                  >
                    <div className={styles.infoValue}>
                      <div className={styles.infoLabel}>xG</div>
                      <div className={styles.infoNumber}>{match.shotsCount}</div>
                    </div>
                  </td>
                  <td 
                    className={styles.infoCell}
                    onClick={() => handleRowClick(match.id, 'pk')}
                  >
                    <div className={styles.infoValue}>
                      <div className={styles.infoLabel}>PK</div>
                      <div className={styles.infoNumber}>{match.pkEntriesCount}</div>
                    </div>
                  </td>
                  <td 
                    className={styles.infoCell}
                    onClick={() => handleRowClick(match.id, 'acc8s')}
                  >
                    <div className={styles.infoValue}>
                      <div className={styles.infoLabel}>8s ACC</div>
                      <div className={styles.infoNumber}>{match.acc8sCount}</div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedMatches.length === 0 && (
          <div className={styles.noData}>
            <p>Brak meczów do wyświetlenia.</p>
          </div>
        )}
      </div>

      {/* Wykres pod tabelą */}
      {selectedMatchId && selectedChartType && (
        <div className={styles.chartContainer}>
          <div className={styles.chartHeader}>
            <h3>
              {(() => {
                const match = filteredAndSortedMatches.find(m => m.id === selectedMatchId);
                if (!match) return '';
                return `${memoizedGetTeamName(match.team)} vs ${match.opponent} - ${getChartTypeName(selectedChartType)}`;
              })()}
            </h3>
            <button 
              className={styles.closeChartButton}
              onClick={() => {
                setSelectedMatchId(null);
                setSelectedChartType(null);
                setChartData([]);
              }}
            >
              ×
            </button>
          </div>
          {isLoadingChart ? (
            <div className={styles.chartLoading}>
              <div className={styles.spinner}></div>
              <p>Ładowanie danych...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis 
                  dataKey="minute" 
                  tick={{ fontSize: 11 }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const data = payload[0].payload;
                    return (
                      <div className={styles.chartTooltip}>
                        <p className={styles.chartTooltipLabel}>{`Przedział: ${data.minute} min`}</p>
                        <p style={{ color: '#3b82f6', fontWeight: 600 }}>Liczba: {data.count}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" name="Liczba akcji" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Legenda */}
      <div className={styles.legend}>
        <h3>Legenda:</h3>
        <div className={styles.legendItems}>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{backgroundColor: '#fee2e2'}}></span>
            <span>Mecze niezweryfikowane (Packing: &lt; 20 akcji w P1 lub P2)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{backgroundColor: '#dcfce7'}}></span>
            <span>Mecze zweryfikowane (Packing: ≥ 20 akcji w P1 i P2)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{color: '#991b1b', fontWeight: 'bold'}}>❌</span>
            <span>Packing niekompletny (&lt; 20 akcji w P1 lub P2)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{color: '#22543d', fontWeight: 'bold'}}>✅</span>
            <span>Packing kompletny (≥ 20 akcji w P1 i P2)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{color: '#4a5568', fontStyle: 'italic'}}>ℹ️</span>
            <span>Regain, Loses, xG, PK, 8s ACC - wyświetlane informacyjnie</span>
          </div>
        </div>
      </div>

      {/* Panel boczny z menu */}
      <SidePanel
        players={[]}
        actions={[]}
        matchInfo={null}
        isAdmin={isAdmin}
        userRole={userRole}
        linkedPlayerId={linkedPlayerId}
        selectedTeam={selectedTeam}
        onRefreshData={async () => {}}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={() => {}}
      />
    </div>
  );
} 