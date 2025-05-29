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
        <p>{`${payload[0].name}: ${Math.round(payload[0].value)} punktów`}</p>
      </div>
    );
  }
  return null;
};

export default function PackingChart({ actions, players, selectedPlayerId, onPlayerSelect }: PackingChartProps) {
  const [selectedChart, setSelectedChart] = useState<'total' | 'sender' | 'receiver'>('total');

  const chartData = useMemo(() => {
    const playerStats = new Map<string, { 
      name: string; 
      totalValue: number; 
      senderValue: number; 
      receiverValue: number; 
    }>();

    actions.forEach(action => {
      const packingPoints = action.packingPoints || 0;

      // Dodajemy punkty dla nadawcy
      if (action.senderId) {
        const current = playerStats.get(action.senderId) || { 
          name: action.senderName || 'Nieznany zawodnik', 
          totalValue: 0, 
          senderValue: 0, 
          receiverValue: 0 
        };
        playerStats.set(action.senderId, {
          ...current,
          totalValue: current.totalValue + packingPoints,
          senderValue: current.senderValue + packingPoints
        });
      }

      // Dodajemy punkty dla odbiorcy
      if (action.receiverId) {
        const current = playerStats.get(action.receiverId) || { 
          name: action.receiverName || 'Nieznany zawodnik', 
          totalValue: 0, 
          senderValue: 0, 
          receiverValue: 0 
        };
        playerStats.set(action.receiverId, {
          ...current,
          totalValue: current.totalValue + packingPoints,
          receiverValue: current.receiverValue + packingPoints
        });
      }
    });

    // Zwracamy dane w zależności od wybranego typu diagramu
    return Array.from(playerStats.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        value: selectedChart === 'total' ? data.totalValue : 
               selectedChart === 'sender' ? data.senderValue : 
               data.receiverValue
      }))
      .filter(item => item.value > 0); // Filtrujemy zawodników bez punktów w danej kategorii
  }, [actions, selectedChart]);

  const handleClick = (data: any) => {
    if (selectedPlayerId === data.id) {
      onPlayerSelect(null);
    } else {
      onPlayerSelect(data.id);
    }
  };

  const getChartTitle = () => {
    switch (selectedChart) {
      case 'sender':
        return 'Packing jako podający';
      case 'receiver':
        return 'Packing jako przyjmujący';
      default:
        return 'Całkowity udział w packingu';
    }
  };

  return (
    <div className={styles.chartContainer}>
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
                  `${name}: ${Math.round(value)} (${(percent * 100).toFixed(1)}%)`
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
          </p>
          <button 
            className={styles.clearSelection}
            onClick={() => onPlayerSelect(null)}
          >
            Wyczyść wybór
          </button>
        </div>
      )}
    </div>
  );
} 