'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { Player, Action, TeamInfo } from '@/types';
import styles from './PackingChart.module.css';

interface PackingChartProps {
  actions: Action[];
  players: Player[];
  selectedPlayerId: string | null;
  onPlayerSelect: (playerId: string | null) => void;
  matches?: TeamInfo[];
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p>{`${payload[0].name}: ${Math.round(payload[0].value * 100) / 100}`}</p>
      </div>
    );
  }
  return null;
};

type SortField = 'name' | 'totalPacking' | 'senderPacking' | 'receiverPacking' | 
                'totalPxT' | 'senderPxT' | 'receiverPxT' | 
                'totalXT' | 'senderXT' | 'receiverXT' |
                'totalDribbling' | 'senderDribbling' |
                'totalDribblingPxT' | 'senderDribblingPxT' |
                'totalDribblingXT' | 'senderDribblingXT' |
                'minutesPercentage';

type SortDirection = 'asc' | 'desc';

export default function PackingChart({ actions, players, selectedPlayerId, onPlayerSelect, matches }: PackingChartProps) {
  const [selectedChart, setSelectedChart] = useState<'sender' | 'receiver'>('sender');
  const [selectedMetric, setSelectedMetric] = useState<'packing' | 'pxt'>('packing');
  const [selectedActionType, setSelectedActionType] = useState<'pass' | 'dribble'>('pass');
  const [sortField, setSortField] = useState<SortField>('totalPacking');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showMatchChart, setShowMatchChart] = useState<boolean>(false);

  // Automatycznie przełącz na 'sender' gdy wybieramy drybling
  useEffect(() => {
    if (selectedActionType === 'dribble' && selectedChart === 'receiver') {
      setSelectedChart('sender');
    }
  }, [selectedActionType, selectedChart]);

  const { chartData, tableData, matchChartData } = useMemo(() => {
    const playerStats = new Map<string, { 
      name: string; 
      // Podania
      totalPacking: number; 
      senderPacking: number; 
      receiverPacking: number;
      totalPxT: number;
      senderPxT: number;
      receiverPxT: number;
      totalXT: number;
      senderXT: number;
      receiverXT: number;
      // Drybling
      totalDribbling: number;
      senderDribbling: number;
      totalDribblingPxT: number;
      senderDribblingPxT: number;
      totalDribblingXT: number;
      senderDribblingXT: number;
      // Minuty
      minutesPercentage: number;
    }>();

    // Oblicz % możliwych minut dla każdego zawodnika
    const calculateMinutesPercentage = (playerId: string): number => {
      if (!matches || matches.length === 0) return 0;

      let totalPlayerMinutes = 0;
      let totalMaxMinutes = 0;

      matches.forEach(match => {
        if (!match.playerMinutes) return;

        // Znajdź maksymalną liczbę minut w tym meczu
        const maxMinutesInMatch = Math.max(
          ...match.playerMinutes.map(pm => pm.endMinute - pm.startMinute)
        );

        // Znajdź minuty tego zawodnika w tym meczu
        const playerMinutesInMatch = match.playerMinutes.find(pm => pm.playerId === playerId);
        const playerMinutesCount = playerMinutesInMatch 
          ? playerMinutesInMatch.endMinute - playerMinutesInMatch.startMinute 
          : 0;

        totalPlayerMinutes += playerMinutesCount;
        totalMaxMinutes += maxMinutesInMatch;
      });

      return totalMaxMinutes > 0 ? (totalPlayerMinutes / totalMaxMinutes) * 100 : 0;
    };

    actions.forEach(action => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;
      const isDribble = action.actionType === 'dribble';

      // Dodajemy punkty dla nadawcy
      if (action.senderId) {
        const current = playerStats.get(action.senderId) || { 
          name: action.senderName || 'Nieznany zawodnik', 
          totalPacking: 0, senderPacking: 0, receiverPacking: 0,
          totalPxT: 0, senderPxT: 0, receiverPxT: 0,
          totalXT: 0, senderXT: 0, receiverXT: 0,
          totalDribbling: 0, senderDribbling: 0,
          totalDribblingPxT: 0, senderDribblingPxT: 0,
          totalDribblingXT: 0, senderDribblingXT: 0,
          minutesPercentage: calculateMinutesPercentage(action.senderId)
        };
        
        if (isDribble) {
          playerStats.set(action.senderId, {
            ...current,
            totalDribbling: current.totalDribbling + packingPoints,
            senderDribbling: current.senderDribbling + packingPoints,
            totalDribblingPxT: current.totalDribblingPxT + pxtValue,
            senderDribblingPxT: current.senderDribblingPxT + pxtValue,
            totalDribblingXT: current.totalDribblingXT + xTDifference,
            senderDribblingXT: current.senderDribblingXT + xTDifference
          });
        } else {
          playerStats.set(action.senderId, {
            ...current,
            totalPacking: current.totalPacking + packingPoints,
            senderPacking: current.senderPacking + packingPoints,
            totalPxT: current.totalPxT + pxtValue,
            senderPxT: current.senderPxT + pxtValue,
            totalXT: current.totalXT + xTDifference,
            senderXT: current.senderXT + xTDifference
          });
        }
      }

      // Dodajemy punkty dla odbiorcy (tylko dla podań)
      if (action.receiverId && !isDribble) {
        const current = playerStats.get(action.receiverId) || { 
          name: action.receiverName || 'Nieznany zawodnik', 
          totalPacking: 0, senderPacking: 0, receiverPacking: 0,
          totalPxT: 0, senderPxT: 0, receiverPxT: 0,
          totalXT: 0, senderXT: 0, receiverXT: 0,
          totalDribbling: 0, senderDribbling: 0,
          totalDribblingPxT: 0, senderDribblingPxT: 0,
          totalDribblingXT: 0, senderDribblingXT: 0,
          minutesPercentage: calculateMinutesPercentage(action.receiverId)
        };
        playerStats.set(action.receiverId, {
          ...current,
          totalPacking: current.totalPacking + packingPoints,
          receiverPacking: current.receiverPacking + packingPoints,
          totalPxT: current.totalPxT + pxtValue,
          receiverPxT: current.receiverPxT + pxtValue,
          totalXT: current.totalXT + xTDifference,
          receiverXT: current.receiverXT + xTDifference
        });
      }
    });

    // Dane dla diagramu
    const chartData = Array.from(playerStats.entries())
      .map(([id, data]) => {
        let value = 0;
        
        if (selectedActionType === 'pass') {
          if (selectedMetric === 'packing') {
            value = selectedChart === 'sender' ? data.senderPacking : 
                    data.receiverPacking;
          } else {
            value = selectedChart === 'sender' ? data.senderPxT : 
                    data.receiverPxT;
          }
        } else {
          if (selectedMetric === 'packing') {
            value = data.senderDribbling; // Dla dryblingu zawsze sender
          } else {
            value = data.senderDribblingPxT; // Dla dryblingu zawsze sender
          }
        }
        
        return {
          id,
          name: data.name,
          value: value
        };
      })
      .filter(item => Math.abs(item.value) > 0.01);

    // Dane dla tabeli
    let unsortedTableData = Array.from(playerStats.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        totalPacking: data.totalPacking,
        senderPacking: data.senderPacking,
        receiverPacking: data.receiverPacking,
        totalPxT: data.totalPxT,
        senderPxT: data.senderPxT,
        receiverPxT: data.receiverPxT,
        totalXT: data.totalXT,
        senderXT: data.senderXT,
        receiverXT: data.receiverXT,
        totalDribbling: data.totalDribbling,
        senderDribbling: data.senderDribbling,
        totalDribblingPxT: data.totalDribblingPxT,
        senderDribblingPxT: data.senderDribblingPxT,
        totalDribblingXT: data.totalDribblingXT,
        senderDribblingXT: data.senderDribblingXT,
        minutesPercentage: data.minutesPercentage
      }))
      .filter(item => 
        item.totalPacking > 0 || Math.abs(item.totalPxT) > 0.01 ||
        item.totalDribbling > 0 || Math.abs(item.totalDribblingPxT) > 0.01
      );

    // Sortowanie tabeli
    const tableData = [...unsortedTableData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        const numA = Number(aValue) || 0;
        const numB = Number(bValue) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
    });

    // Dane dla wykresu mecz po mecz (tylko dla wybranego zawodnika)
    const matchChartData = selectedPlayerId && matches ? matches
      .filter(match => match.matchId)
      .sort((a, b) => {
        // Sortujemy według daty - najstarsze pierwszy, najnowsze ostatni (po prawej)
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      })
      .map(match => {
        // Pobierz akcje dla tego meczu i zawodnika
        const matchActions = actions.filter(action => 
          action.matchId === match.matchId && 
          (action.senderId === selectedPlayerId || 
           (action.receiverId === selectedPlayerId && selectedActionType === 'pass'))
        );

        let packingValue = 0;
        let pxtValue = 0;
        let xtValue = 0;
        
        matchActions.forEach(action => {
          const packingPoints = action.packingPoints || 0;
          const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
          const pxtCalculated = xTDifference * packingPoints;
          const isDribble = action.actionType === 'dribble';

          // Sprawdź czy uwzględnić akcję zgodnie z wybranym typem
          let shouldInclude = false;
          
          if (selectedActionType === 'dribble' && isDribble && action.senderId === selectedPlayerId) {
            shouldInclude = true;
          } else if (selectedActionType === 'pass' && !isDribble) {
            if (selectedChart === 'sender' && action.senderId === selectedPlayerId) {
              shouldInclude = true;
            } else if (selectedChart === 'receiver' && action.receiverId === selectedPlayerId) {
              shouldInclude = true;
            }
          }

          if (shouldInclude) {
            packingValue += packingPoints;
            pxtValue += pxtCalculated;
            xtValue += xTDifference;
          }
        });

        return {
          matchName: `${match.opponent} (${match.date})`,
          Packing: packingValue,
          PxT: pxtValue,
          xT: xtValue,
          actionsCount: matchActions.length
        };
      })
      .filter(item => Math.abs(item.Packing) > 0.01 || Math.abs(item.PxT) > 0.01 || Math.abs(item.xT) > 0.01 || item.actionsCount > 0)
      : [];

    return { chartData, tableData, matchChartData };
  }, [actions, selectedChart, selectedMetric, selectedActionType, sortField, sortDirection, selectedPlayerId, matches]);

  const handleClick = (data: any) => {
    if (selectedPlayerId === data.id) {
      onPlayerSelect(null);
    } else {
      onPlayerSelect(data.id);
    }
  };

  const handleTableRowClick = (playerId: string) => {
    if (selectedPlayerId === playerId) {
      onPlayerSelect(null);
    } else {
      onPlayerSelect(playerId);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const getChartTitle = () => {
    const actionTypeName = selectedActionType === 'pass' ? 'Podania' : 'Drybling';
    const metricName = selectedMetric === 'packing' ? 'Packing' : 'PxT';
    switch (selectedChart) {
      case 'sender':
        return `${actionTypeName} - ${metricName} jako podający`;
      case 'receiver':
        return `${actionTypeName} - ${metricName} jako przyjmujący`;
      default:
        return `${actionTypeName} - ${metricName}`;
    }
  };

  const getValueLabel = (value: number) => {
    if (selectedMetric === 'packing') {
      return Math.round(value).toString();
    } else {
      return (Math.round(value * 100) / 100).toFixed(2);
    }
  };

  const formatValue = (value: number, decimals: number = 2) => {
    return decimals === 0 ? Math.round(value).toString() : value.toFixed(decimals);
  };

  // Custom tooltip dla wykresu meczowego
  const MatchTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipLabel}>{label}</p>
          <p>Packing: {formatValue(data.Packing, 0)}</p>
          <p>PxT: {formatValue(data.PxT, 2)}</p>
          <p>xT: {formatValue(data.xT, 3)}</p>
          <p>Akcji: {data.actionsCount}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.actionTypeControls}>
        <button 
          className={`${styles.actionTypeButton} ${selectedActionType === 'pass' ? styles.active : ''}`}
          onClick={() => setSelectedActionType('pass')}
        >
          Podania
        </button>
        <button 
          className={`${styles.actionTypeButton} ${selectedActionType === 'dribble' ? styles.active : ''}`}
          onClick={() => setSelectedActionType('dribble')}
        >
          Drybling
        </button>
      </div>

      <div className={styles.metricControls}>
        <button 
          className={`${styles.metricButton} ${selectedMetric === 'packing' ? styles.active : ''}`}
          onClick={() => setSelectedMetric('packing')}
        >
          Packing
        </button>
        <button 
          className={`${styles.metricButton} ${selectedMetric === 'pxt' ? styles.active : ''}`}
          onClick={() => setSelectedMetric('pxt')}
        >
          PxT
        </button>
      </div>

      <div className={styles.chartControls}>
        <button 
          className={`${styles.controlButton} ${selectedChart === 'sender' ? styles.active : ''}`}
          onClick={() => setSelectedChart('sender')}
        >
          Podający
        </button>
        {selectedActionType === 'pass' && (
          <button 
            className={`${styles.controlButton} ${selectedChart === 'receiver' ? styles.active : ''}`}
            onClick={() => setSelectedChart('receiver')}
          >
            Przyjmujący
          </button>
        )}
      </div>

      {/* Przycisk do przełączania między wykresami */}
      <div className={styles.chartTypeControls}>
        <button 
          className={`${styles.chartTypeButton} ${!showMatchChart ? styles.active : ''}`}
          onClick={() => setShowMatchChart(false)}
        >
          📊 Statystyki ogólne
        </button>
        <button 
          className={`${styles.chartTypeButton} ${showMatchChart ? styles.active : ''}`}
          onClick={() => setShowMatchChart(true)}
          disabled={!selectedPlayerId}
        >
          📈 Mecz po meczu
        </button>
      </div>
      
      <h3>{showMatchChart ? `Statystyki mecz po mecz - ${chartData.find(d => d.id === selectedPlayerId)?.name || 'Wybierz zawodnika'}` : getChartTitle()}</h3>
      
      {!showMatchChart ? (
        // Oryginalny wykres kołowy
        chartData.length > 0 ? (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                  onClick={handleClick}
                  label={({ name, value, percent }) => 
                    `${name}: ${getValueLabel(value)} (${(percent * 100).toFixed(1)}%)`
                  }
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke={selectedPlayerId === entry.id ? '#000' : 'none'}
                      strokeWidth={selectedPlayerId === entry.id ? 3 : 0}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.noData}>
            <p>Brak danych dla wybranej kategorii</p>
          </div>
        )
      ) : (
        // Wykres meczowy (mecz po mecz) - pokazuje wszystkie metryki jednocześnie
        selectedPlayerId && matchChartData.length > 0 ? (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={matchChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="matchName" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
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
                <Tooltip content={<MatchTooltip />} />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="xT" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                  name="xT"
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="PxT" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={{ fill: '#82ca9d', strokeWidth: 2, r: 4 }}
                  name="PxT"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Packing" 
                  stroke="#ffc658" 
                  strokeWidth={2}
                  dot={{ fill: '#ffc658', strokeWidth: 2, r: 4 }}
                  name="Packing"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.noData}>
            <p>{!selectedPlayerId ? 'Wybierz zawodnika, aby zobaczyć wykres mecz po mecz' : 'Brak danych meczowych dla wybranego zawodnika'}</p>
          </div>
        )
      )}
      
      {selectedPlayerId && (
        <div className={styles.selectedPlayer}>
          <p>
            Wybrany zawodnik: {chartData.find(d => d.id === selectedPlayerId)?.name || 'Nieznany'}
            {chartData.find(d => d.id === selectedPlayerId) && !showMatchChart && (
              <span className={styles.playerValue}>
                {' '}({getValueLabel(chartData.find(d => d.id === selectedPlayerId)!.value)} {selectedMetric === 'packing' ? 'pkt' : 'PxT'})
              </span>
            )}
          </p>
          <button 
            className={styles.clearSelection}
            onClick={() => onPlayerSelect(null)}
          >
            Wyczyść wybór
          </button>
        </div>
      )}

      {/* Tabela ze statystykami */}
      <div className={styles.statsTable}>
        <h4>Szczegółowe statystyki</h4>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th rowSpan={2} onClick={() => handleSort('name')} className={styles.sortableHeader}>
                  Zawodnik {getSortIcon('name')}
                </th>
                <th colSpan={3}>Podania - Packing</th>
                <th colSpan={3}>Podania - PxT</th>
                <th colSpan={3}>Podania - xT</th>
                <th colSpan={2}>Drybling - Packing</th>
                <th colSpan={2}>Drybling - PxT</th>
                <th colSpan={2}>Drybling - xT</th>
                <th rowSpan={2} onClick={() => handleSort('minutesPercentage')} className={styles.sortableHeader}>
                  % minut {getSortIcon('minutesPercentage')}
                </th>
              </tr>
              <tr className={styles.subHeader}>
                <th onClick={() => handleSort('totalPacking')} className={styles.sortableHeader}>
                  Łącznie {getSortIcon('totalPacking')}
                </th>
                <th onClick={() => handleSort('senderPacking')} className={styles.sortableHeader}>
                  Podający {getSortIcon('senderPacking')}
                </th>
                <th onClick={() => handleSort('receiverPacking')} className={styles.sortableHeader}>
                  Przyjmujący {getSortIcon('receiverPacking')}
                </th>
                <th onClick={() => handleSort('totalPxT')} className={styles.sortableHeader}>
                  Łącznie {getSortIcon('totalPxT')}
                </th>
                <th onClick={() => handleSort('senderPxT')} className={styles.sortableHeader}>
                  Podający {getSortIcon('senderPxT')}
                </th>
                <th onClick={() => handleSort('receiverPxT')} className={styles.sortableHeader}>
                  Przyjmujący {getSortIcon('receiverPxT')}
                </th>
                <th onClick={() => handleSort('totalXT')} className={styles.sortableHeader}>
                  Łącznie {getSortIcon('totalXT')}
                </th>
                <th onClick={() => handleSort('senderXT')} className={styles.sortableHeader}>
                  Podający {getSortIcon('senderXT')}
                </th>
                <th onClick={() => handleSort('receiverXT')} className={styles.sortableHeader}>
                  Przyjmujący {getSortIcon('receiverXT')}
                </th>
                <th onClick={() => handleSort('totalDribbling')} className={styles.sortableHeader}>
                  Łącznie {getSortIcon('totalDribbling')}
                </th>
                <th onClick={() => handleSort('senderDribbling')} className={styles.sortableHeader}>
                  Wykonujący {getSortIcon('senderDribbling')}
                </th>
                <th onClick={() => handleSort('totalDribblingPxT')} className={styles.sortableHeader}>
                  Łącznie {getSortIcon('totalDribblingPxT')}
                </th>
                <th onClick={() => handleSort('senderDribblingPxT')} className={styles.sortableHeader}>
                  Wykonujący {getSortIcon('senderDribblingPxT')}
                </th>
                <th onClick={() => handleSort('totalDribblingXT')} className={styles.sortableHeader}>
                  Łącznie {getSortIcon('totalDribblingXT')}
                </th>
                <th onClick={() => handleSort('senderDribblingXT')} className={styles.sortableHeader}>
                  Wykonujący {getSortIcon('senderDribblingXT')}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((player, index) => (
                <tr 
                  key={player.id} 
                  className={`${styles.tableRow} ${selectedPlayerId === player.id ? styles.selectedRow : ''}`}
                  onClick={() => handleTableRowClick(player.id)}
                >
                  <td className={styles.playerName}>{player.name}</td>
                  {/* Podania */}
                  <td>{formatValue(player.totalPacking, 0)}</td>
                  <td>{formatValue(player.senderPacking, 0)}</td>
                  <td>{formatValue(player.receiverPacking, 0)}</td>
                  <td>{formatValue(player.totalPxT, 2)}</td>
                  <td>{formatValue(player.senderPxT, 2)}</td>
                  <td>{formatValue(player.receiverPxT, 2)}</td>
                  <td>{formatValue(player.totalXT, 3)}</td>
                  <td>{formatValue(player.senderXT, 3)}</td>
                  <td>{formatValue(player.receiverXT, 3)}</td>
                  {/* Drybling */}
                  <td>{formatValue(player.totalDribbling, 0)}</td>
                  <td>{formatValue(player.senderDribbling, 0)}</td>
                  <td>{formatValue(player.totalDribblingPxT, 2)}</td>
                  <td>{formatValue(player.senderDribblingPxT, 2)}</td>
                  <td>{formatValue(player.totalDribblingXT, 3)}</td>
                  <td>{formatValue(player.senderDribblingXT, 3)}</td>
                  <td>{formatValue(player.minutesPercentage, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 