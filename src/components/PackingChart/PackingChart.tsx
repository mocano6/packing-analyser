'use client';

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Player, Action } from '@/types';
import styles from './PackingChart.module.css';

interface PackingChartProps {
  actions: Action[];
  players: Player[];
  selectedPlayerId: string | null;
  onPlayerSelect: (playerId: string | null) => void;
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
                'totalDribblingXT' | 'senderDribblingXT';

type SortDirection = 'asc' | 'desc';

export default function PackingChart({ actions, players, selectedPlayerId, onPlayerSelect }: PackingChartProps) {
  const [selectedChart, setSelectedChart] = useState<'total' | 'sender' | 'receiver'>('total');
  const [selectedMetric, setSelectedMetric] = useState<'packing' | 'pxt'>('packing');
  const [selectedActionType, setSelectedActionType] = useState<'pass' | 'dribble'>('pass');
  const [sortField, setSortField] = useState<SortField>('totalPacking');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { chartData, tableData } = useMemo(() => {
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
    }>();

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
          totalDribblingXT: 0, senderDribblingXT: 0
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
          totalDribblingXT: 0, senderDribblingXT: 0
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
            value = selectedChart === 'total' ? data.totalPacking : 
                    selectedChart === 'sender' ? data.senderPacking : 
                    data.receiverPacking;
          } else {
            value = selectedChart === 'total' ? data.totalPxT : 
                    selectedChart === 'sender' ? data.senderPxT : 
                    data.receiverPxT;
          }
        } else {
          if (selectedMetric === 'packing') {
            value = selectedChart === 'total' ? data.totalDribbling : 
                    data.senderDribbling;
          } else {
            value = selectedChart === 'total' ? data.totalDribblingPxT : 
                    data.senderDribblingPxT;
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
        senderDribblingXT: data.senderDribblingXT
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

    return { chartData, tableData };
  }, [actions, selectedChart, selectedMetric, selectedActionType, sortField, sortDirection]);

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
        return `${actionTypeName} - Całkowity ${metricName}`;
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
          className={`${styles.controlButton} ${selectedChart === 'total' ? styles.active : ''}`}
          onClick={() => setSelectedChart('total')}
        >
          Łącznie
        </button>
        <button 
          className={`${styles.controlButton} ${selectedChart === 'sender' ? styles.active : ''}`}
          onClick={() => setSelectedChart('sender')}
        >
          Jako wykonujący
        </button>
        {selectedActionType === 'pass' && (
          <button 
            className={`${styles.controlButton} ${selectedChart === 'receiver' ? styles.active : ''}`}
            onClick={() => setSelectedChart('receiver')}
          >
            Jako przyjmujący
          </button>
        )}
      </div>
      
      <h3>{getChartTitle()}</h3>
      
      {chartData.length > 0 ? (
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
      )}
      
      {selectedPlayerId && (
        <div className={styles.selectedPlayer}>
          <p>
            Wybrany zawodnik: {chartData.find(d => d.id === selectedPlayerId)?.name || 'Nieznany'}
            {chartData.find(d => d.id === selectedPlayerId) && (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className={styles.metricInfo}>
        <p>
          <strong>{selectedMetric === 'packing' ? 'Packing' : 'PxT'}:</strong> {' '}
          {selectedMetric === 'packing' 
            ? 'Punkty przyznawane za ominięcie zawodników przeciwnika' 
            : 'Packing × różnica Expected Threat (xT końcowe - xT początkowe)'
          }
        </p>
      </div>
    </div>
  );
} 