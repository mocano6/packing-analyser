'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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

export default function PackingChart({ actions, players, selectedPlayerId, onPlayerSelect }: PackingChartProps) {
  const chartData = useMemo(() => {
    // Grupowanie akcji według zawodników
    const playerStats = new Map<string, { name: string; value: number }>();

    actions.forEach(action => {
      // Dodajemy punkty dla nadawcy
      if (action.senderId) {
        const currentValue = playerStats.get(action.senderId)?.value || 0;
        playerStats.set(action.senderId, {
          name: action.senderName || 'Nieznany zawodnik',
          value: currentValue + (action.packingPoints || 0)
        });
      }

      // Dodajemy punkty dla odbiorcy
      if (action.receiverId) {
        const currentValue = playerStats.get(action.receiverId)?.value || 0;
        playerStats.set(action.receiverId, {
          name: action.receiverName || 'Nieznany zawodnik',
          value: currentValue + (action.packingPoints || 0)
        });
      }
    });

    return Array.from(playerStats.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }, [actions]);

  const handleClick = (data: any) => {
    if (selectedPlayerId === data.id) {
      onPlayerSelect(null);
    } else {
      onPlayerSelect(data.id);
    }
  };

  return (
    <div className={styles.chartContainer}>
      <h3>Udział zawodników w packingu</h3>
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
              label={({ name, value }) => `${name}: ${Math.round(value)}`}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke={selectedPlayerId === entry.id ? '#000' : 'none'}
                  strokeWidth={selectedPlayerId === entry.id ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${Math.round(value)} punktów`, 'Packing']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 