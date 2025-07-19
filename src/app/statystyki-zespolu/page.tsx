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

  // Wybierz pierwszy dostępny zespół jako domyślny
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  
  // Ustaw domyślny zespół gdy teams się załadują
  useEffect(() => {
    if (availableTeams.length > 0 && !selectedTeam) {
      setSelectedTeam(availableTeams[0].id);
    }
  }, [availableTeams, selectedTeam]);

  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);

  const { allMatches, fetchMatches, forceRefreshFromFirebase } = useMatchInfo();

  // Pobierz mecze dla wybranego zespołu - tylko przy zmianie zespołu
  useEffect(() => {
    if (selectedTeam) {
      // Nie wymuszaj odświeżenia przy każdej zmianie - używaj normalnego fetchMatches
      fetchMatches(selectedTeam).catch(error => {
        console.error('❌ Błąd podczas pobierania meczów:', error);
      });
    }
  }, [selectedTeam]); // Tylko selectedTeam w dependency - bez funkcji żeby uniknąć infinite loop

  // Filtruj mecze według wybranego zespołu
  const teamMatches = useMemo(() => {
    return allMatches.filter(match => match.team === selectedTeam);
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

  // Przygotuj dane dla wykresu
  const chartData = useMemo(() => {
    if (allActions.length === 0) return [];

    // Grupuj akcje po minutach
    const actionsPerMinute: Record<number, number> = {};
    
    allActions.forEach(action => {
      const minute = Math.floor(action.minute);
      actionsPerMinute[minute] = (actionsPerMinute[minute] || 0) + 1;
      });

    // Konwertuj na format dla wykresu
    return Object.entries(actionsPerMinute)
      .map(([minute, count]) => ({
        minute: parseInt(minute),
        actions: count
      }))
      .sort((a, b) => a.minute - b.minute);
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
          <p className={styles.tooltipLabel}>{`Minuty: ${label}`}</p>
          <p>Akcji w przedziale: {data.actions}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
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

      {/* Wykres meczu */}
      <div className={styles.chartPanel}>
        <h2>Przyrost statystyk w czasie meczu</h2>
        {isLoadingActions ? (
          <p>Ładowanie akcji...</p>
        ) : !selectedMatch ? (
          <p>Wybierz mecz, aby zobaczyć statystyki.</p>
        ) : chartData.length === 0 ? (
          <p>Brak danych dla wybranego meczu.</p>
        ) : (
          <div>
            <p>Pokazano statystyki z {allActions.length} akcji</p>
            <p className={styles.chartInfo}>
              <strong>Uwaga:</strong> Wykres używa podwójnych osi Y - lewa oś dla xT/PxT, prawa oś dla Packing
            </p>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="minute" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left"
                    label={{ value: 'Akcje', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="actions" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="Akcje"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela z danymi liczbowymi */}
            <div className={styles.dataTable}>
              <h3>Szczegółowe dane - co 5 minut</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Czas</th>
                      <th>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((interval, index) => (
                      <tr key={index}>
                        <td>{interval.minute}</td>
                        <td>{interval.actions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 