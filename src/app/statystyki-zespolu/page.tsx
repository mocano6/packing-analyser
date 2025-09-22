"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Action, TeamInfo } from "@/types";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";
import { getCurrentSeason, filterMatchesBySeason, getAvailableSeasonsFromMatches } from "@/utils/seasonUtils";
import styles from "./statystyki-zespolu.module.css";

export default function StatystykiZespoluPage() {
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

  // Inicjalizuj selectedTeam z localStorage lub pustym stringiem
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedTeam') || "";
    }
    return "";
  });
  
  // Ustaw domyślny zespół gdy teams się załadują i zapisz w localStorage
  useEffect(() => {
    if (availableTeams.length > 0 && !selectedTeam) {
      const firstTeamId = availableTeams[0].id;
      setSelectedTeam(firstTeamId);
      localStorage.setItem('selectedTeam', firstTeamId);
    }
  }, [availableTeams, selectedTeam]);

  // Zapisuj wybrany zespół w localStorage przy każdej zmianie
  useEffect(() => {
    if (selectedTeam) {
      localStorage.setItem('selectedTeam', selectedTeam);
    }
  }, [selectedTeam]);

  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<'pxt' | 'xt' | 'packing'>('pxt');

  const { allMatches, fetchMatches, forceRefreshFromFirebase } = useMatchInfo();

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

  // Pobierz mecze dla wybranego zespołu - tylko przy zmianie zespołu
  useEffect(() => {
    if (selectedTeam) {
      // Nie wymuszaj odświeżenia przy każdej zmianie - używaj normalnego fetchMatches
      fetchMatches(selectedTeam).catch(error => {
        console.error('❌ Błąd podczas pobierania meczów:', error);
      });
    }
  }, [selectedTeam]); // Tylko selectedTeam w dependency - bez funkcji żeby uniknąć infinite loop

  // Filtruj mecze według wybranego zespołu i sezonu
  const teamMatches = useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    return selectedSeason ? filterMatchesBySeason(teamFiltered, selectedSeason) : teamFiltered;
  }, [allMatches, selectedTeam, selectedSeason]);

  // Oblicz dostępne sezony na podstawie meczów wybranego zespołu
  const availableSeasons = useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    return getAvailableSeasonsFromMatches(teamFiltered);
  }, [allMatches, selectedTeam]);

  // Wybierz pierwszy mecz domyślnie przy zmianie zespołu
  useEffect(() => {
    if (teamMatches.length > 0 && teamMatches[0].matchId) {
      setSelectedMatch(teamMatches[0].matchId);
    } else {
      setSelectedMatch("");
    }
  }, [teamMatches]);

  // Pobierz akcje dla wybranego meczu
  useEffect(() => {
    const loadActionsForMatch = async () => {
      if (!selectedMatch) {
        setAllActions([]);
        return;
      }

      setIsLoadingActions(true);

             try {
         if (!db) {
           console.error("Firebase nie jest zainicjalizowane");
           setAllActions([]);
           return;
         }

         const matchDoc = await getDoc(doc(db, "matches", selectedMatch));
        
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
           const actions = matchData.actions_packing || [];
           setAllActions(actions);
        } else {
          setAllActions([]);
        }
      } catch (error) {
        console.error("Błąd podczas pobierania akcji:", error);
        setAllActions([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadActionsForMatch();
  }, [selectedMatch]);

  // Przygotuj dane dla wykresów zespołowych
  const teamChartData = useMemo(() => {
    if (allActions.length === 0) return [];

    // Oblicz skumulowane wartości dla zespołu
    const data: any[] = [];
    let cumulativePacking = 0;
    let cumulativePxT = 0;
    let cumulativeXT = 0;
    
    // Sortuj akcje po minutach
    const sortedActions = [...allActions].sort((a, b) => a.minute - b.minute);
    
    sortedActions.forEach((action, index) => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;
      
      cumulativePacking += packingPoints;
      cumulativePxT += pxtValue;
      cumulativeXT += xTDifference;
      
      // Dodaj punkt co akcję dla płynnego wykresu
      data.push({
        minute: action.minute,
        actionIndex: index + 1,
        packing: cumulativePacking,
        pxt: cumulativePxT,
        xt: cumulativeXT
      });
    });

    return data;
  }, [allActions]);

  // Przygotuj podsumowanie połówek
  const halfTimeStats = useMemo(() => {
    if (allActions.length === 0) return { firstHalf: { packing: 0, pxt: 0, xt: 0 }, secondHalf: { packing: 0, pxt: 0, xt: 0 } };

    let firstHalf = { packing: 0, pxt: 0, xt: 0 };
    let secondHalf = { packing: 0, pxt: 0, xt: 0 };

    allActions.forEach(action => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;
      
      if (action.minute <= 45) {
        firstHalf.packing += packingPoints;
        firstHalf.pxt += pxtValue;
        firstHalf.xt += xTDifference;
      } else {
        secondHalf.packing += packingPoints;
        secondHalf.pxt += pxtValue;
        secondHalf.xt += xTDifference;
      }
    });

    return { firstHalf, secondHalf };
  }, [allActions]);

  // Znajdź wybrany mecz dla wyświetlenia informacji
  const selectedMatchInfo = useMemo(() => {
    return teamMatches.find(match => match.matchId === selectedMatch);
  }, [teamMatches, selectedMatch]);

  // Custom tooltip dla wykresu
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipLabel}>{`Minuta: ${data.minute?.toFixed(1)}`}</p>
          <p>Akcja: #{data.actionIndex}</p>
          <hr style={{margin: '8px 0', border: 'none', borderTop: '1px solid #ddd'}} />
          <p style={{ color: '#8884d8' }}>Packing: {data.packing?.toFixed(0)}</p>
          <p style={{ color: '#82ca9d' }}>PxT: {data.pxt?.toFixed(2)}</p>
          <p style={{ color: '#ffc658' }}>xT: {data.xt?.toFixed(3)}</p>
        </div>
      );
    }
    return null;
  };

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/" className={styles.backButton}>
          ← Powrót do głównej
        </Link>
        <h1>Statystyki zespołu - Analiza meczu</h1>
      </div>

      {/* Sekcja wyboru zespołu i sezonu */}
      <div className={styles.selectorsContainer}>
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

        <div className={styles.seasonSelector}>
          <SeasonSelector
            selectedSeason={selectedSeason}
            onChange={setSelectedSeason}
            showLabel={true}
            availableSeasons={availableSeasons}
            className={styles.teamSelect}
          />
        </div>
      </div>

      {/* Sekcja wyboru meczu */}
      <div className={styles.matchSelector}>
        <div className={styles.matchSelectorHeader}>
          <h3>Wybierz mecz do analizy</h3>
        </div>
        
        <div className={styles.matchSelectContainer}>
          {teamMatches.length === 0 ? (
            <p className={styles.noMatches}>Brak meczów dla wybranego zespołu</p>
          ) : (
            <select
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
              className={styles.matchSelect}
            >
              <option value="">-- Wybierz mecz --</option>
              {teamMatches.map(match => (
                <option key={match.matchId || match.opponent} value={match.matchId || ""}>
                  {match.opponent} ({match.date}) - {match.competition} - {match.isHome ? 'Dom' : 'Wyjazd'}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedMatchInfo && (
          <div className={styles.selectedMatchInfo}>
            <h4>Wybrany mecz:</h4>
            <p><strong>{selectedMatchInfo.opponent}</strong> - {selectedMatchInfo.date}</p>
            <p>{selectedMatchInfo.competition} ({selectedMatchInfo.isHome ? 'Dom' : 'Wyjazd'})</p>
          </div>
        )}
      </div>

      {/* Statystyki połówek */}
      {selectedMatch && allActions.length > 0 && (
        <div className={styles.halfTimeStats}>
          <h2>Statystyki połówek</h2>
          <div className={styles.metricSelector}>
            <button 
              className={`${styles.metricButton} ${selectedMetric === 'pxt' ? styles.active : ''}`}
              onClick={() => setSelectedMetric('pxt')}
            >
              PxT
            </button>
            <button 
              className={`${styles.metricButton} ${selectedMetric === 'xt' ? styles.active : ''}`}
              onClick={() => setSelectedMetric('xt')}
            >
              xT
            </button>
            <button 
              className={`${styles.metricButton} ${selectedMetric === 'packing' ? styles.active : ''}`}
              onClick={() => setSelectedMetric('packing')}
            >
              Packing
            </button>
          </div>
          
          <div className={styles.halfTimeContainer}>
            <div className={styles.halfTimeCard}>
              <h3>1. połowa</h3>
              <div className={styles.statValue}>
                {selectedMetric === 'pxt' && halfTimeStats.firstHalf.pxt.toFixed(2)}
                {selectedMetric === 'xt' && halfTimeStats.firstHalf.xt.toFixed(3)}
                {selectedMetric === 'packing' && halfTimeStats.firstHalf.packing.toFixed(0)}
              </div>
              <div className={styles.statLabel}>
                {selectedMetric === 'pxt' && 'PxT'}
                {selectedMetric === 'xt' && 'xT'}
                {selectedMetric === 'packing' && 'Packing'}
              </div>
            </div>
            
            <div className={styles.halfTimeCard}>
              <h3>2. połowa</h3>
              <div className={styles.statValue}>
                {selectedMetric === 'pxt' && halfTimeStats.secondHalf.pxt.toFixed(2)}
                {selectedMetric === 'xt' && halfTimeStats.secondHalf.xt.toFixed(3)}
                {selectedMetric === 'packing' && halfTimeStats.secondHalf.packing.toFixed(0)}
              </div>
              <div className={styles.statLabel}>
                {selectedMetric === 'pxt' && 'PxT'}
                {selectedMetric === 'xt' && 'xT'}
                {selectedMetric === 'packing' && 'Packing'}
              </div>
            </div>
            
            <div className={styles.halfTimeCard}>
              <h3>Łącznie</h3>
              <div className={styles.statValue}>
                {selectedMetric === 'pxt' && (halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt).toFixed(2)}
                {selectedMetric === 'xt' && (halfTimeStats.firstHalf.xt + halfTimeStats.secondHalf.xt).toFixed(3)}
                {selectedMetric === 'packing' && (halfTimeStats.firstHalf.packing + halfTimeStats.secondHalf.packing).toFixed(0)}
              </div>
              <div className={styles.statLabel}>
                {selectedMetric === 'pxt' && 'PxT'}
                {selectedMetric === 'xt' && 'xT'}
                {selectedMetric === 'packing' && 'Packing'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wykres zespołowy */}
      <div className={styles.chartPanel}>
        <h2>Przyrost statystyk zespołu w czasie meczu</h2>
        {isLoadingActions ? (
          <p>Ładowanie akcji...</p>
        ) : !selectedMatch ? (
          <p>Wybierz mecz, aby zobaczyć statystyki.</p>
        ) : teamChartData.length === 0 ? (
          <p>Brak danych dla wybranego meczu.</p>
        ) : (
          <div>
            <p>Pokazano statystyki z {allActions.length} akcji zespołu</p>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={teamChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="minute" 
                    label={{ value: 'Minuta', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left"
                    label={{ value: 'xT / PxT', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    label={{ value: 'Packing', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="xt" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="xT (skumulowane)"
                    connectNulls={true}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="pxt" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="PxT (skumulowane)"
                    connectNulls={true}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="packing" 
                    stroke="#ffc658" 
                    strokeWidth={2}
                    name="Packing (skumulowane)"
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 