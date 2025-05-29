"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Action, TeamInfo } from "@/types";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { TEAMS } from "@/constants/teamsLoader";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import styles from "./statystyki-zespolu.module.css";

export default function StatystykiZespoluPage() {
  const [selectedTeam, setSelectedTeam] = useState<string>(TEAMS.REZERWY.id);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);

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
      if (!selectedMatch || !db) {
        setAllActions([]);
        return;
      }

      setIsLoadingActions(true);
      try {
        const matchRef = doc(db!, "matches", selectedMatch);
        const matchDoc = await getDoc(matchRef);
        
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
          const matchActions = matchData.actions_packing || [];
          setAllActions(matchActions);
          console.log(`Pobrano ${matchActions.length} akcji dla meczu ${selectedMatch}`);
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

  // Oblicz dane dla wykresu - przyrost wartości w czasie meczu
  const chartData = useMemo(() => {
    if (allActions.length === 0) return [];

    // Sortuj akcje według czasu
    const sortedActions = [...allActions].sort((a, b) => {
      const minuteA = a.minute || 0;
      const minuteB = b.minute || 0;
      return minuteA - minuteB;
    });

    // Grupuj akcje w 5-minutowe przedziały
    const timeIntervals: {
      interval: number;
      label: string;
      actions: Action[];
    }[] = [];
    
    for (let i = 0; i <= 90; i += 5) {
      timeIntervals.push({
        interval: i,
        label: `${i}-${i + 5}'`,
        actions: []
      });
    }

    // Przypisz akcje do przedziałów czasowych
    sortedActions.forEach(action => {
      const minute = action.minute || 0;
      const intervalIndex = Math.floor(minute / 5);
      if (intervalIndex < timeIntervals.length) {
        timeIntervals[intervalIndex].actions.push(action);
      }
    });

    // Oblicz skumulowane wartości
    let cumulativeXt = 0;
    let cumulativePxT = 0;
    let cumulativePacking = 0;

    const data = timeIntervals.map(interval => {
      // Oblicz wartości dla tego przedziału
      let intervalXt = 0;
      let intervalPxT = 0;
      let intervalPacking = 0;

      interval.actions.forEach(action => {
        const packingPoints = action.packingPoints || 0;
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
        const pxtValue = xTDifference * packingPoints;

        intervalXt += xTDifference;
        intervalPxT += pxtValue;
        intervalPacking += packingPoints;
      });

      // Dodaj do skumulowanych wartości
      cumulativeXt += intervalXt;
      cumulativePxT += intervalPxT;
      cumulativePacking += intervalPacking;

      return {
        time: interval.label,
        minute: interval.interval,
        xT: Math.round(cumulativeXt * 1000) / 1000,
        PxT: Math.round(cumulativePxT * 100) / 100,
        Packing: cumulativePacking,
        intervalXt: Math.round(intervalXt * 1000) / 1000,
        intervalPxT: Math.round(intervalPxT * 100) / 100,
        intervalPacking: intervalPacking,
        actionsCount: interval.actions.length
      };
    });

    // Usuń przedziały z końca, które mają zerowe wartości skumulowane
    let lastNonZeroIndex = data.length - 1;
    while (lastNonZeroIndex >= 0 && 
           data[lastNonZeroIndex].xT === 0 && 
           data[lastNonZeroIndex].PxT === 0 && 
           data[lastNonZeroIndex].Packing === 0) {
      lastNonZeroIndex--;
    }

    return data.slice(0, lastNonZeroIndex + 1);
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
          <p>Akcji w przedziale: {data.actionsCount}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
              {entry.dataKey === 'xT' && data.intervalXt !== 0 && ` (+${data.intervalXt})`}
              {entry.dataKey === 'PxT' && data.intervalPxT !== 0 && ` (+${data.intervalPxT})`}
              {entry.dataKey === 'Packing' && data.intervalPacking !== 0 && ` (+${data.intervalPacking})`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

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
                    dataKey="time" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
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
                    dataKey="xT" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="Skumulowany xT"
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="PxT" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="Skumulowany PxT"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="Packing" 
                    stroke="#ffc658" 
                    strokeWidth={2}
                    name="Skumulowany Packing"
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
                      <th>xT +</th>
                      <th>PxT +</th>
                      <th>Packing +</th>
                      <th>xT skumulowany</th>
                      <th>PxT skumulowany</th>
                      <th>Packing skumulowany</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((interval, index) => (
                      <tr key={index}>
                        <td>{interval.time}</td>
                        <td>{interval.actionsCount}</td>
                        <td>{interval.intervalXt}</td>
                        <td>{interval.intervalPxT}</td>
                        <td>{interval.intervalPacking}</td>
                        <td>{interval.xT}</td>
                        <td>{interval.PxT}</td>
                        <td>{interval.Packing}</td>
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