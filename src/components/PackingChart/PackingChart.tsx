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

export default function PackingChart({ actions, players, selectedPlayerId, onPlayerSelect }: PackingChartProps) {
  const [selectedChart, setSelectedChart] = useState<'total' | 'sender' | 'receiver'>('total');
  const [selectedMetric, setSelectedMetric] = useState<'packing' | 'pxt'>('packing');

  const chartData = useMemo(() => {
    const playerStats = new Map<string, { 
      name: string; 
      totalPacking: number; 
      senderPacking: number; 
      receiverPacking: number;
      totalPxT: number;
      senderPxT: number;
      receiverPxT: number;
    }>();

    actions.forEach(action => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;

      // Dodajemy punkty dla nadawcy
      if (action.senderId) {
        const current = playerStats.get(action.senderId) || { 
          name: action.senderName || 'Nieznany zawodnik', 
          totalPacking: 0, 
          senderPacking: 0, 
          receiverPacking: 0,
          totalPxT: 0,
          senderPxT: 0,
          receiverPxT: 0
        };
        playerStats.set(action.senderId, {
          ...current,
          totalPacking: current.totalPacking + packingPoints,
          senderPacking: current.senderPacking + packingPoints,
          totalPxT: current.totalPxT + pxtValue,
          senderPxT: current.senderPxT + pxtValue
        });
      }

      // Dodajemy punkty dla odbiorcy
      if (action.receiverId) {
        const current = playerStats.get(action.receiverId) || { 
          name: action.receiverName || 'Nieznany zawodnik', 
          totalPacking: 0, 
          senderPacking: 0, 
          receiverPacking: 0,
          totalPxT: 0,
          senderPxT: 0,
          receiverPxT: 0
        };
        playerStats.set(action.receiverId, {
          ...current,
          totalPacking: current.totalPacking + packingPoints,
          receiverPacking: current.receiverPacking + packingPoints,
          totalPxT: current.totalPxT + pxtValue,
          receiverPxT: current.receiverPxT + pxtValue
        });
      }
    });

    // Zwracamy dane w zależności od wybranego typu diagramu i metryki
    return Array.from(playerStats.entries())
      .map(([id, data]) => {
        let value = 0;
        
        if (selectedMetric === 'packing') {
          value = selectedChart === 'total' ? data.totalPacking : 
                  selectedChart === 'sender' ? data.senderPacking : 
                  data.receiverPacking;
        } else {
          value = selectedChart === 'total' ? data.totalPxT : 
                  selectedChart === 'sender' ? data.senderPxT : 
                  data.receiverPxT;
        }
        
        return {
          id,
          name: data.name,
          value: value
        };
      })
      .filter(item => Math.abs(item.value) > 0.01); // Filtrujemy zawodników bez znaczących wartości
  }, [actions, selectedChart, selectedMetric]);

  const handleClick = (data: any) => {
    if (selectedPlayerId === data.id) {
      onPlayerSelect(null);
    } else {
      onPlayerSelect(data.id);
    }
  };

  const getChartTitle = () => {
    const metricName = selectedMetric === 'packing' ? 'Packing' : 'PxT';
    switch (selectedChart) {
      case 'sender':
        return `${metricName} jako podający`;
      case 'receiver':
        return `${metricName} jako przyjmujący`;
      default:
        return `Całkowity ${metricName}`;
    }
  };

  const getValueLabel = (value: number) => {
    if (selectedMetric === 'packing') {
      return Math.round(value).toString();
    } else {
      return (Math.round(value * 100) / 100).toFixed(2);
    }
  };

  return (
    <div className={styles.chartContainer}>
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
          Jako podający
        </button>
        <button 
          className={`${styles.controlButton} ${selectedChart === 'receiver' ? styles.active : ''}`}
          onClick={() => setSelectedChart('receiver')}
        >
          Jako przyjmujący
        </button>
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