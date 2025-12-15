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
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { Player, Action, TeamInfo } from '@/types';
import styles from './PackingChart.module.css';

interface NetworkNode {
  id: string;
  name: string;
  x: number;
  y: number;
  totalValue: number;
  radius: number;
  connectionCount: number;
  senderValue?: number;
  receiverValue?: number;
  actionCount?: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  value: number;
  thickness: number;
}

interface PackingChartProps {
  actions: Action[];
  players: Player[];
  selectedPlayerId: string | null;
  onPlayerSelect: (playerId: string | null) => void;
  matches?: TeamInfo[];
  teams?: { id: string; name: string }[];
  birthYearFilter: {from: string; to: string};
  onBirthYearFilterChange: (value: {from: string; to: string}) => void;
  selectedPositions: string[];
  onSelectedPositionsChange: (positions: string[]) => void;
  availablePositions: { value: string; label: string }[];
  showPositionsDropdown: boolean;
  setShowPositionsDropdown: (show: boolean) => void;
  handlePositionToggle: (position: string) => void;
  handleSelectAllPositions: () => void;
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
                'totalDribbling' | 'totalDribblingPxT' | 'totalDribblingXT' |
                'totalP3' | 'senderP3' | 'receiverP3' |
                'totalPenaltyArea' | 'senderPenaltyArea' | 'receiverPenaltyArea' |
                'totalShots' | 'senderShots' | 'receiverShots' |
                'totalGoals' | 'senderGoals' | 'receiverGoals' |
                'passCount' | 'senderPassCount' | 'receiverPassCount' | 'dribblingCount' |
                'averagePxT' | 'senderAveragePxT' | 'receiverAveragePxT' | 
                'dribblingAveragePxT' | 'dribblingAveragePacking' | 'dribblingAverageXT' |
                'minutesPercentage' | 'actualMinutes';

type SortDirection = 'asc' | 'desc';

export default function PackingChart({ 
  actions, 
  players, 
  selectedPlayerId, 
  onPlayerSelect, 
  matches,
  teams,
  birthYearFilter,
  onBirthYearFilterChange,
  selectedPositions,
  onSelectedPositionsChange,
  availablePositions,
  showPositionsDropdown,
  setShowPositionsDropdown,
  handlePositionToggle,
  handleSelectAllPositions
}: PackingChartProps) {
  const [selectedChart, setSelectedChart] = useState<'sender' | 'receiver'>('sender');
  const [selectedMetric, setSelectedMetric] = useState<'packing' | 'pxt'>('pxt');
  const [selectedActionType, setSelectedActionType] = useState<'pass' | 'dribble'>('pass');
  const [sortField, setSortField] = useState<SortField>('totalPacking');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showMatchChart, setShowMatchChart] = useState<boolean>(false);
  const [showNetworkChart, setShowNetworkChart] = useState<boolean>(false);
  const [isPer90Minutes, setIsPer90Minutes] = useState<boolean>(false);
  const [chartStartIndex, setChartStartIndex] = useState<number>(0);
  const [minMinutesFilter, setMinMinutesFilter] = useState<number>(0);
  const [tableMetric, setTableMetric] = useState<'packing' | 'pxt' | 'xt'>('pxt');
  const [additionalActionsRole, setAdditionalActionsRole] = useState<'sender' | 'receiver'>('sender');
  const [playerDetailsRole, setPlayerDetailsRole] = useState<'sender' | 'receiver' | 'dribbling'>('sender');
  // Pozycje są teraz zarządzane przez rodzica

  // Zunifikuj pozycje LW->LS, RW->RS
  const normalizePosition = (position: string): string => {
    if (position === 'LW') return 'LS';
    if (position === 'RW') return 'RS';
    return position;
  };

  // Funkcja do zbierania wszystkich pozycji na jakich grał zawodnik
  const getAllPlayerPositions = (playerId: string): string[] => {
    if (!matches || matches.length === 0) return [];
    
    const positions = new Set<string>();
    
    matches.forEach(match => {
      if (!match.playerMinutes) return;
      
      const playerMinutesInMatch = match.playerMinutes.find(pm => pm.playerId === playerId);
      if (playerMinutesInMatch && playerMinutesInMatch.position) {
        positions.add(playerMinutesInMatch.position);
      }
    });
    
    return Array.from(positions).sort();
  };

  // Automatycznie przełącz na 'sender' gdy wybieramy drybling
  useEffect(() => {
    if (selectedActionType === 'dribble' && selectedChart === 'receiver') {
      setSelectedChart('sender');
    }
  }, [selectedActionType, selectedChart]);

  const { chartData, tableData, matchChartData, networkData } = useMemo(() => {
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
      // Przejęcie i podanie
      totalP3: number;
      senderP3: number;
      receiverP3: number;
      totalPenaltyArea: number;
      senderPenaltyArea: number;
      receiverPenaltyArea: number;
      totalShots: number;
      senderShots: number;
      receiverShots: number;
      totalGoals: number;
      senderGoals: number;
      receiverGoals: number;
      // Minuty
      minutesPercentage: number;
      actualMinutes: number;
    }>();

    // Oblicz % możliwych minut dla każdego zawodnika (tylko na wybranej pozycji jeśli filtr aktywny)
    const calculateMinutesPercentage = (playerId: string): number => {
      if (!matches || matches.length === 0) return 0;

      let totalPlayerMinutes = 0;
      let totalMaxMinutes = 0;

      matches.forEach(match => {
        if (!match.playerMinutes) return;

        // Znajdź minuty tego zawodnika w tym meczu
        const playerMinutesInMatch = match.playerMinutes.find(pm => pm.playerId === playerId);
        if (!playerMinutesInMatch) return;

        // Jeśli mamy filtr pozycji, sprawdź czy grał na tej pozycji
        if (selectedPositions.length > 0) {
          const normalizedPosition = normalizePosition(playerMinutesInMatch.position || '');
          const matchesPosition = selectedPositions.some(pos => {
            // Mapowanie pozycji z filtrów na pozycje w danych
            if (pos === 'LW' && normalizedPosition === 'LS') return true;
            if (pos === 'RW' && normalizedPosition === 'RS') return true;
            return pos === normalizedPosition;
          });
          if (!matchesPosition) return; // Pomiń ten mecz
        }

        const playerMinutesCount = playerMinutesInMatch.endMinute - playerMinutesInMatch.startMinute;

        // Znajdź maksymalną liczbę minut w tym meczu
        const maxMinutesInMatch = Math.max(
          ...match.playerMinutes.map(pm => pm.endMinute - pm.startMinute)
        );

        totalPlayerMinutes += playerMinutesCount;
        totalMaxMinutes += maxMinutesInMatch;
      });

      return totalMaxMinutes > 0 ? (totalPlayerMinutes / totalMaxMinutes) * 100 : 0;
    };

    // Oblicz rzeczywiste minuty dla zawodnika (tylko na wybranej pozycji jeśli filtr aktywny)
    const calculateActualMinutes = (playerId: string): number => {
      if (!matches || matches.length === 0) return 0;

      let totalPlayerMinutes = 0;

      matches.forEach(match => {
        if (!match.playerMinutes) return;

        // Znajdź minuty tego zawodnika w tym meczu
        const playerMinutesInMatch = match.playerMinutes.find(pm => pm.playerId === playerId);
        if (!playerMinutesInMatch) return;

        // Jeśli mamy filtr pozycji, sprawdź czy grał na tej pozycji
        if (selectedPositions.length > 0) {
          const normalizedPosition = normalizePosition(playerMinutesInMatch.position || '');
          const matchesPosition = selectedPositions.some(pos => {
            // Mapowanie pozycji z filtrów na pozycje w danych
            if (pos === 'LW' && normalizedPosition === 'LS') return true;
            if (pos === 'RW' && normalizedPosition === 'RS') return true;
            return pos === normalizedPosition;
          });
          if (!matchesPosition) return; // Pomiń ten mecz
        }

        const playerMinutesCount = playerMinutesInMatch.endMinute - playerMinutesInMatch.startMinute;
        totalPlayerMinutes += playerMinutesCount;
      });

      return totalPlayerMinutes;
    };

    // Sprawdź czy akcja powinna być uwzględniona dla wybranej pozycji
    const shouldIncludeAction = (action: any, playerId: string): boolean => {
      // Jeśli nie ma filtra pozycji, uwzględnij wszystkie akcje
      if (selectedPositions.length === 0) return true;

      // Znajdź mecz dla tej akcji
      const matchForAction = matches?.find(match => match.matchId === action.matchId);
      if (!matchForAction || !matchForAction.playerMinutes) return false;

      // Sprawdź czy zawodnik grał na wybranej pozycji w tym meczu
      const playerInMatch = matchForAction.playerMinutes.find(pm => pm.playerId === playerId);
      if (!playerInMatch || !playerInMatch.position) return false;

      // Sprawdź czy pozycja pasuje (z normalizacją)
      const normalizedPosition = normalizePosition(playerInMatch.position);
      return selectedPositions.some(pos => {
        // Mapowanie pozycji z filtrów na pozycje w danych
        if (pos === 'LW' && normalizedPosition === 'LS') return true;
        if (pos === 'RW' && normalizedPosition === 'RS') return true;
        return pos === normalizedPosition;
      });
    };

    actions.forEach(action => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      
      // Pomiń akcje z ujemną lub zerową wartością xT
      if (xTDifference <= 0) {
        return;
      }
      
      const pxtValue = xTDifference * packingPoints;
      const isDribble = action.actionType === 'dribble';
      
      // Dodatkowe statystyki
      const isP3 = action.isP3 || false;
      const isPenaltyArea = action.isPenaltyAreaEntry || false;
      const isShot = action.isShot || false;
      const isGoal = action.isGoal || false;

      // Dodajemy punkty dla nadawcy
      if (action.senderId && shouldIncludeAction(action, action.senderId)) {
        const current = playerStats.get(action.senderId) || ({ 
          name: action.senderName || 'Nieznany zawodnik', 
          totalPacking: 0, senderPacking: 0, receiverPacking: 0,
          totalPxT: 0, senderPxT: 0, receiverPxT: 0,
          totalXT: 0, senderXT: 0, receiverXT: 0,
          totalDribbling: 0, senderDribbling: 0,
          totalDribblingPxT: 0, senderDribblingPxT: 0,
          totalDribblingXT: 0, senderDribblingXT: 0,
          totalP3: 0, senderP3: 0, receiverP3: 0,
          totalPenaltyArea: 0, senderPenaltyArea: 0, receiverPenaltyArea: 0,
          totalShots: 0, senderShots: 0, receiverShots: 0,
          totalGoals: 0, senderGoals: 0, receiverGoals: 0,
          passCount: 0, // Liczba podań łącznie
          senderPassCount: 0, // Liczba podań jako podający
          receiverPassCount: 0, // Liczba podań jako przyjmujący
          dribblingCount: 0, // Liczba dryblingu
          minutesPercentage: calculateMinutesPercentage(action.senderId),
          actualMinutes: calculateActualMinutes(action.senderId)
        } as any);
        
        if (isDribble) {
          playerStats.set(action.senderId, {
            ...current,
            totalDribbling: current.totalDribbling + packingPoints,
            senderDribbling: current.senderDribbling + packingPoints,
            dribblingCount: current.dribblingCount + 1, // Zlicz drybling
            totalDribblingPxT: current.totalDribblingPxT + pxtValue,
            senderDribblingPxT: current.senderDribblingPxT + pxtValue,
            totalDribblingXT: current.totalDribblingXT + xTDifference,
            senderDribblingXT: current.senderDribblingXT + xTDifference,
            totalP3: current.totalP3 + (isP3 ? 1 : 0),
            senderP3: current.senderP3 + (isP3 ? 1 : 0),
            totalPenaltyArea: current.totalPenaltyArea + (isPenaltyArea ? 1 : 0),
            senderPenaltyArea: current.senderPenaltyArea + (isPenaltyArea ? 1 : 0),
            totalShots: current.totalShots + (isShot ? 1 : 0),
            senderShots: current.senderShots + (isShot ? 1 : 0),
            totalGoals: current.totalGoals + (isGoal ? 1 : 0),
            senderGoals: current.senderGoals + (isGoal ? 1 : 0)
          });
        } else {
          playerStats.set(action.senderId, {
            ...current,
            totalPacking: current.totalPacking + packingPoints,
            senderPacking: current.senderPacking + packingPoints,
            totalPxT: current.totalPxT + pxtValue,
            senderPxT: current.senderPxT + pxtValue,
            totalXT: current.totalXT + xTDifference,
            senderXT: current.senderXT + xTDifference,
            passCount: current.passCount + 1, // Zlicz podanie łącznie
            senderPassCount: current.senderPassCount + 1, // Zlicz podanie jako sender
            totalP3: current.totalP3 + (isP3 ? 1 : 0),
            senderP3: current.senderP3 + (isP3 ? 1 : 0),
            totalPenaltyArea: current.totalPenaltyArea + (isPenaltyArea ? 1 : 0),
            senderPenaltyArea: current.senderPenaltyArea + (isPenaltyArea ? 1 : 0),
            totalShots: current.totalShots + (isShot ? 1 : 0),
            senderShots: current.senderShots + (isShot ? 1 : 0),
            totalGoals: current.totalGoals + (isGoal ? 1 : 0),
            senderGoals: current.senderGoals + (isGoal ? 1 : 0)
          });
        }
      }

      // Dodajemy punkty dla odbiorcy (tylko dla podań)
      if (action.receiverId && !isDribble && shouldIncludeAction(action, action.receiverId)) {
        const current = playerStats.get(action.receiverId) || ({ 
          name: action.receiverName || 'Nieznany zawodnik', 
          totalPacking: 0, senderPacking: 0, receiverPacking: 0,
          totalPxT: 0, senderPxT: 0, receiverPxT: 0,
          totalXT: 0, senderXT: 0, receiverXT: 0,
          totalDribbling: 0, senderDribbling: 0,
          totalDribblingPxT: 0, senderDribblingPxT: 0,
          totalDribblingXT: 0, senderDribblingXT: 0,
          totalP3: 0, senderP3: 0, receiverP3: 0,
          totalPenaltyArea: 0, senderPenaltyArea: 0, receiverPenaltyArea: 0,
          totalShots: 0, senderShots: 0, receiverShots: 0,
          totalGoals: 0, senderGoals: 0, receiverGoals: 0,
          passCount: 0, // Liczba podań łącznie
          senderPassCount: 0, // Liczba podań jako podający
          receiverPassCount: 0, // Liczba podań jako przyjmujący
          dribblingCount: 0, // Liczba dryblingu
          minutesPercentage: calculateMinutesPercentage(action.receiverId),
          actualMinutes: calculateActualMinutes(action.receiverId)
        } as any);
        playerStats.set(action.receiverId, {
          ...current,
          totalPacking: current.totalPacking + packingPoints,
          receiverPacking: current.receiverPacking + packingPoints,
          totalPxT: current.totalPxT + pxtValue,
          receiverPxT: current.receiverPxT + pxtValue,
          totalXT: current.totalXT + xTDifference,
          receiverXT: current.receiverXT + xTDifference,
          receiverPassCount: current.receiverPassCount + 1, // Zlicz podanie jako receiver
          totalP3: current.totalP3 + (isP3 ? 1 : 0),
          receiverP3: current.receiverP3 + (isP3 ? 1 : 0),
          totalPenaltyArea: current.totalPenaltyArea + (isPenaltyArea ? 1 : 0),
          receiverPenaltyArea: current.receiverPenaltyArea + (isPenaltyArea ? 1 : 0),
          totalShots: current.totalShots + (isShot ? 1 : 0),
          receiverShots: current.receiverShots + (isShot ? 1 : 0),
          totalGoals: current.totalGoals + (isGoal ? 1 : 0),
          receiverGoals: current.receiverGoals + (isGoal ? 1 : 0)
        });
      }
    });

    // Dane dla diagramu - sortowane od największej do najmniejszej wartości
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
          value: value,
          totalPacking: data.totalPacking,
          totalPxT: data.totalPxT,
          totalXT: data.totalXT,
          totalDribbling: data.totalDribbling,
          totalDribblingPxT: data.totalDribblingPxT,
          totalDribblingXT: data.totalDribblingXT,
          actualMinutes: data.actualMinutes,
          passCount: (data as any).passCount || 0,
          senderPassCount: (data as any).senderPassCount || 0,
          receiverPassCount: (data as any).receiverPassCount || 0,
          dribblingCount: (data as any).dribblingCount || 0
        };
      })
      .filter(item => Math.abs(item.value) > 0.001 || item.value > 0) // Złagodzone filtrowanie
      .sort((a, b) => b.value - a.value); // Sortowanie od największej do najmniejszej

    // Oblicz całkowite wartości zespołu dla procentów
    const teamTotals = {
      totalPacking: chartData.reduce((sum, player) => sum + player.totalPacking, 0),
      totalPxT: chartData.reduce((sum, player) => sum + player.totalPxT, 0),
      totalXT: chartData.reduce((sum, player) => sum + player.totalXT, 0),
      totalDribbling: chartData.reduce((sum, player) => sum + player.totalDribbling, 0),
      totalDribblingPxT: chartData.reduce((sum, player) => sum + player.totalDribblingPxT, 0),
      totalDribblingXT: chartData.reduce((sum, player) => sum + player.totalDribblingXT, 0)
    };

    // Dodaj procenty do danych wykresu
    const chartDataWithPercentages = chartData.map(player => {
      let percentage = 0;
      if (selectedActionType === 'pass') {
        if (selectedMetric === 'packing') {
          percentage = teamTotals.totalPacking > 0 ? (player.value / teamTotals.totalPacking) * 100 : 0;
        } else {
          percentage = teamTotals.totalPxT > 0 ? (player.value / teamTotals.totalPxT) * 100 : 0;
        }
      } else {
        if (selectedMetric === 'packing') {
          percentage = teamTotals.totalDribbling > 0 ? (player.value / teamTotals.totalDribbling) * 100 : 0;
        } else {
          percentage = teamTotals.totalDribblingPxT > 0 ? (player.value / teamTotals.totalDribblingPxT) * 100 : 0;
        }
      }
      
      return {
        ...player,
        percentage: percentage
      };
    });
      
    // Jeśli brak danych z akcjami, pokaż zawodników z minutami
    if (chartData.length === 0) {
      const playersWithMinutes = Array.from(playerStats.entries())
        .filter(([id, data]) => data.actualMinutes > 0)
        .map(([id, data]) => ({
          id,
          name: data.name,
          value: data.actualMinutes // Pokaż minuty jako wartość
        }))
        .slice(0, 10); // Tylko top 10
        
      if (playersWithMinutes.length > 0) {
        chartData.push(...playersWithMinutes);
      }
    }

    // Dane dla tabeli
    let unsortedTableData = Array.from(playerStats.entries())
      .map(([id, data]) => {
        // Znajdź pozycje zawodnika z meczów (jeśli filtr aktywny, pokaż tylko wybraną pozycję)
        let position = 'Nieznana';
        if (selectedPositions.length > 0) {
          // Jeśli filtr aktywny, sprawdź czy grał na którejś z pozycji
          const playedPositions: string[] = [];
          matches?.forEach(match => {
            if (!match.playerMinutes) return;
            const playerInMatch = match.playerMinutes.find(pm => pm.playerId === id);
            if (!playerInMatch || !playerInMatch.position) return;
            const normalizedPosition = normalizePosition(playerInMatch.position);
            const matchesPosition = selectedPositions.some(pos => {
              // Mapowanie pozycji z filtrów na pozycje w danych
              if (pos === 'LW' && normalizedPosition === 'LS') return true;
              if (pos === 'RW' && normalizedPosition === 'RS') return true;
              return pos === normalizedPosition;
            });
            if (matchesPosition && !playedPositions.includes(normalizedPosition)) {
              playedPositions.push(normalizedPosition);
            }
          });
          position = playedPositions.length > 0 ? playedPositions.join(', ') : 'Nieznana';
        } else {
          // Bez filtra, pokaż wszystkie pozycje
          const matchPositions: string[] = [];
          if (matches) {
            matches.forEach(match => {
              if (match.playerMinutes) {
                match.playerMinutes.forEach(pm => {
                  if (pm.playerId === id && pm.position) {
                    matchPositions.push(normalizePosition(pm.position));
                  }
                });
              }
            });
          }
          const uniquePositions = [...new Set(matchPositions)];
          position = uniquePositions.length > 0 ? uniquePositions.join(', ') : 'Nieznana';
        }
        
        // Znajdź zawodnika żeby pobrać rok urodzenia
        const playerData = players.find(p => p.id === id);
        const birthYear = playerData?.birthYear;

        return {
          id,
          name: data.name,
          birthYear,
          position,
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
        totalP3: data.totalP3,
        senderP3: data.senderP3,
        receiverP3: data.receiverP3,
        totalPenaltyArea: data.totalPenaltyArea,
        senderPenaltyArea: data.senderPenaltyArea,
        receiverPenaltyArea: data.receiverPenaltyArea,
        totalShots: data.totalShots,
        senderShots: data.senderShots,
        receiverShots: data.receiverShots,
        totalGoals: data.totalGoals,
        senderGoals: data.senderGoals,
        receiverGoals: data.receiverGoals,
                  passCount: (data as any).passCount,
          senderPassCount: (data as any).senderPassCount,
          receiverPassCount: (data as any).receiverPassCount,
          dribblingCount: (data as any).dribblingCount,
          senderAveragePxT: (data as any).senderPassCount > 0 ? (data as any).senderPxT / (data as any).senderPassCount : 0,
          receiverAveragePxT: (data as any).receiverPassCount > 0 ? (data as any).receiverPxT / (data as any).receiverPassCount : 0,
          dribblingAveragePxT: (data as any).dribblingCount > 0 ? (data as any).totalDribblingPxT / (data as any).dribblingCount : 0,
          dribblingAveragePacking: (data as any).dribblingCount > 0 ? (data as any).totalDribbling / (data as any).dribblingCount : 0,
          dribblingAverageXT: (data as any).dribblingCount > 0 ? (data as any).totalDribblingXT / (data as any).dribblingCount : 0,
          averagePxT: (data as any).passCount > 0 ? (data as any).totalPxT / (data as any).passCount : 0,
          minutesPercentage: data.minutesPercentage,
          actualMinutes: data.actualMinutes
        } as any;
      });

    // Debug: sprawdź wybrane pozycje

    // Filtruj zawodników - pokaż tylko tych z akcjami lub z minutami gry
    const filteredTableData = unsortedTableData.filter(item => {
      // Debug: sprawdź każdego zawodnika
      
      return (item.totalPacking > 0 || Math.abs(item.totalPxT) > 0.01 ||
        item.totalDribbling > 0 || Math.abs(item.totalDribblingPxT) > 0.01 ||
        item.actualMinutes > 0) && 
        item.actualMinutes >= minMinutesFilter &&
        (selectedPositions.length === 0 || selectedPositions.some(pos => {
          // Mapowanie pozycji z filtrów na pozycje w danych
          const matches = (() => {
            if (pos === 'LW' && item.position.includes('LS')) return true;
            if (pos === 'RW' && item.position.includes('RS')) return true;
            return item.position.includes(pos);
          })();
          
          
          return matches;
        })) &&
        (!birthYearFilter.from.trim() && !birthYearFilter.to.trim() || 
         (item.birthYear && 
          (!birthYearFilter.from.trim() || item.birthYear >= parseInt(birthYearFilter.from.trim())) &&
          (!birthYearFilter.to.trim() || item.birthYear <= parseInt(birthYearFilter.to.trim()))));
    });


    unsortedTableData = filteredTableData;

    // Sortowanie tabeli
    const tableData = [...unsortedTableData].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Jeśli sortujemy po wartościach liczbowych w trybie /90 min, przelicz je
      // Specjalne przypadki: passCount i dribblingCount zawsze per 90 minut
      if ((isPer90Minutes || sortField === 'passCount' || sortField === 'dribblingCount') && 
          typeof aValue === 'number' && typeof bValue === 'number' && 
          sortField !== 'name' && sortField !== 'minutesPercentage' && sortField !== 'actualMinutes') {
        aValue = a.actualMinutes > 0 ? (aValue / a.actualMinutes) * 90 : 0;
        bValue = b.actualMinutes > 0 ? (bValue / b.actualMinutes) * 90 : 0;
      }
      
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
          
          // Pomiń akcje z ujemną lub zerową wartością xT
          if (xTDifference <= 0) {
            return;
          }
          
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

        // Znajdź minuty zawodnika w tym meczu
        const playerMinutes = match.playerMinutes?.find(pm => pm.playerId === selectedPlayerId);
        const minutesPlayed = playerMinutes ? Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute) : 0;
        const position = playerMinutes?.position || 'Nieznana';

        // Oblicz całkowite punkty zespołu w meczu
        const teamActions = actions.filter(action => action.matchId === match.matchId);
        let teamTotalPacking = 0;
        let teamTotalPxT = 0;
        let teamTotalXt = 0;

        teamActions.forEach(action => {
          const packingPoints = action.packingPoints || 0;
          const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
          if (xTDifference > 0) { // Tylko pozytywne xT
            teamTotalPacking += packingPoints;
            teamTotalPxT += xTDifference * packingPoints;
            teamTotalXt += xTDifference;
          }
        });

        // Oblicz procent zawodnika w zespole
        const packingPercent = teamTotalPacking > 0 ? (packingValue / teamTotalPacking * 100) : 0;
        const pxtPercent = teamTotalPxT > 0 ? (pxtValue / teamTotalPxT * 100) : 0;
        const xtPercent = teamTotalXt > 0 ? (xtValue / teamTotalXt * 100) : 0;

        return {
          matchName: `${match.opponent} (${match.date})`,
          Packing: packingValue,
          PxT: pxtValue,
          xT: xtValue,
          actionsCount: matchActions.length,
          minutesPlayed,
          position,
          packingPercent,
          pxtPercent,
          xtPercent
        };
      })
      .filter(item => item.minutesPlayed > 0) // Zachowaj wszystkie mecze gdzie zawodnik grał, aby utrzymać ciągłość linii
      : [];

    // Dane dla wykresu sieciowego (ego network dla wybranego zawodnika)
    const networkConnections = new Map<string, {
      senderValue: number; // PxT gdy wybrany zawodnik podaje
      receiverValue: number; // PxT gdy wybrany zawodnik otrzymuje
    }>(); 

    // Analizuj tylko podania wybranego zawodnika
    if (selectedPlayerId) {
      actions.forEach(action => {
        if (action.actionType === 'pass' && 
            (action.senderId === selectedPlayerId || action.receiverId === selectedPlayerId)) {
          
          const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
          if (xTDifference <= 0) return; // Pomiń akcje z ujemną lub zerową wartością xT
          
          const packingPoints = action.packingPoints || 0;
          const pxtValue = xTDifference * packingPoints;
          
          // Sprawdź filtry pozycji
          if (!action.senderId || !action.receiverId ||
              !shouldIncludeAction(action, action.senderId) || 
              !shouldIncludeAction(action, action.receiverId)) return;
          
          // Znajdź drugiego zawodnika (nie wybranego)
          const otherPlayerId = action.senderId === selectedPlayerId ? action.receiverId : action.senderId;
          if (!otherPlayerId) return;
          
          const current = networkConnections.get(otherPlayerId) || { senderValue: 0, receiverValue: 0 };
          
          if (action.senderId === selectedPlayerId) {
            // Wybrany zawodnik podaje
            current.senderValue += pxtValue;
          } else {
            // Wybrany zawodnik otrzymuje
            current.receiverValue += pxtValue;
          }
          
          networkConnections.set(otherPlayerId, current);
        }
      });
    }

    // Stwórz węzły tylko jeśli jest wybrany zawodnik
    const networkNodes: NetworkNode[] = [];
    const networkEdges: NetworkEdge[] = [];

    if (selectedPlayerId && networkConnections.size > 0) {
      // Dodaj centralny węzeł (wybrany zawodnik)
      const selectedPlayer = players.find(p => p.id === selectedPlayerId);
      networkNodes.push({
        id: selectedPlayerId,
        name: selectedPlayer?.name || 'Nieznany',
        x: 300, // Środek
        y: 300,
        totalValue: Array.from(networkConnections.values()).reduce((sum, conn) => sum + conn.senderValue + conn.receiverValue, 0),
        radius: 40, // Jeszcze większy centralny węzeł
        connectionCount: networkConnections.size
      });

      // Dodaj węzły partnerów wokół środka
      const partners = Array.from(networkConnections.entries())
        .sort(([, a], [, b]) => {
          // Sortuj według aktywnej metryki (sender/receiver)
          const aValue = selectedChart === 'sender' ? a.senderValue : a.receiverValue;
          const bValue = selectedChart === 'sender' ? b.senderValue : b.receiverValue;
          return bValue - aValue;
        })
        .slice(0, 10); // Maksymalnie 10 partnerów

      partners.forEach(([partnerId, connection], index) => {
        const player = players.find(p => p.id === partnerId);
        const angle = (index / partners.length) * 2 * Math.PI;
        const radius = 180; // Promień okręgu wokół środka
        
        const currentValue = selectedChart === 'sender' ? connection.senderValue : connection.receiverValue;
        
        // Policz liczbę podań między zawodnikami
        const actionCount = actions.filter(a => 
          a.actionType === 'pass' && 
          ((a.senderId === selectedPlayerId && a.receiverId === partnerId) ||
           (a.receiverId === selectedPlayerId && a.senderId === partnerId))
        ).length;
        
        networkNodes.push({
          id: partnerId,
          name: player?.name || 'Nieznany',
          x: 300 + radius * Math.cos(angle),
          y: 300 + radius * Math.sin(angle),
          totalValue: currentValue,
          radius: Math.max(15, Math.min(35, 15 + currentValue * 2)), // Większe węzły
          connectionCount: 1,
          senderValue: connection.senderValue,
          receiverValue: connection.receiverValue,
          actionCount
        });

        // Dodaj krawędź
        if (currentValue > 0) {
          networkEdges.push({
            source: selectedPlayerId,
            target: partnerId,
            value: currentValue,
            thickness: Math.max(4, Math.min(20, 4 + currentValue * 3)) // Jeszcze grubsze linie
          });
        }
      });
    }

    const networkData = {
      nodes: networkNodes,
      edges: networkEdges
    };

    return { chartData: chartDataWithPercentages, tableData, matchChartData, networkData };
  }, [actions, players, selectedChart, selectedMetric, selectedActionType, sortField, sortDirection, selectedPlayerId, matches, isPer90Minutes, minMinutesFilter, tableMetric, additionalActionsRole, selectedPositions, birthYearFilter]);

  // availablePositions są przekazywane jako prop

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
    if (sortField !== field) {
      return <span className={styles.sortIcon}>⊡</span>;
    }
    return sortDirection === 'asc' 
      ? <span className={`${styles.sortIcon} ${styles.sortAsc}`}>▴</span>
      : <span className={`${styles.sortIcon} ${styles.sortDesc}`}>▾</span>;
  };

  // Pomocnicza funkcja do konwersji team id na nazwę
  const getTeamName = (teamId: string) => {
    if (!teams) return teamId;
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : teamId;
  };

  // Oblicz statystyki zawodnika per mecz
  const getPlayerMatchStats = useMemo(() => {
    if (!selectedPlayerId || !matches) return [];

    return matches.map(match => {
      const matchActions = actions.filter(action => action.matchId === match.matchId);
      let totalPacking = 0;
      let totalPxT = 0;
      let totalXT = 0;
      let senderPacking = 0;
      let senderPxT = 0;
      let senderXT = 0;
      let receiverPacking = 0;
      let receiverPxT = 0;
      let receiverXT = 0;
      let dribblingPacking = 0;
      let dribblingPxT = 0;
      let dribblingXT = 0;
      let actionsCount = 0;

      matchActions.forEach(action => {
        const packingPoints = action.packingPoints || 0;
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
        
        // Pomiń akcje z ujemną lub zerową wartością xT
        if (xTDifference <= 0) return;
        
        const pxtValue = xTDifference * packingPoints;
        const isDribble = action.actionType === 'dribble';

        if (action.senderId === selectedPlayerId) {
          if (isDribble) {
            dribblingPacking += packingPoints;
            dribblingPxT += pxtValue;
            dribblingXT += xTDifference;
          } else {
            senderPacking += packingPoints;
            senderPxT += pxtValue;
            senderXT += xTDifference;
          }
          actionsCount++;
        }
        if (action.receiverId === selectedPlayerId && action.actionType === 'pass') {
          receiverPacking += packingPoints;
          receiverPxT += pxtValue;
          receiverXT += xTDifference;
          actionsCount++;
        }
      });

      totalPacking = senderPacking + receiverPacking + dribblingPacking;
      totalPxT = senderPxT + receiverPxT + dribblingPxT;
      totalXT = senderXT + receiverXT + dribblingXT;

      // Znajdź minuty zawodnika w tym meczu i pozycję
      const playerMinutes = match.playerMinutes?.find(pm => pm.playerId === selectedPlayerId);
      const minutesPlayed = playerMinutes ? Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute) : 0;
      const position = playerMinutes?.position || null;

      return {
        match,
        totalPacking,
        totalPxT,
        totalXT,
        senderPacking,
        senderPxT,
        senderXT,
        receiverPacking,
        receiverPxT,
        receiverXT,
        dribblingPacking,
        dribblingPxT,
        dribblingXT,
        actionsCount,
        minutesPlayed,
        position
      };
    }).filter(stat => stat.actionsCount > 0 || stat.minutesPlayed > 0); // Tylko mecze gdzie grał lub miał akcje
  }, [selectedPlayerId, actions, matches]);


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

  // Funkcja do przeliczania wartości na 90 minut
  const formatValuePer90 = (value: number, actualMinutes: number, decimals: number = 2) => {
    if (actualMinutes === 0) return formatValue(0, decimals);
    const per90Value = (value / actualMinutes) * 90;
    return formatValue(per90Value, decimals);
  };

  // Custom tooltip dla wykresu meczowego
  const MatchTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipLabel}>{label}</p>
          <p>Minuty: {data.minutesPlayed} min</p>
          <p>Pozycja: {data.position}</p>
          <hr style={{margin: '6px 0', border: 'none', borderTop: '1px solid #ddd'}} />
          <p>Packing: {formatValue(data.Packing, 0)} ({formatValue(data.packingPercent, 1)}%)</p>
          <p>PxT: {formatValue(data.PxT, 2)} ({formatValue(data.pxtPercent, 1)}%)</p>
          <p>xT: {formatValue(data.xT, 3)} ({formatValue(data.xtPercent, 1)}%)</p>
          <p>Akcji: {data.actionsCount}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.chartContainer}>
      {/* Zgrupowane kontrolki */}
      <div className={styles.controlsContainer}>
        <h4 className={styles.controlsTitle}>Ustawienia wykresu</h4>
        
        <div className={styles.controlsRow}>
          <div className={styles.controlGroup}>
            <span className={styles.controlGroupLabel}>Typ akcji</span>
            <div className={styles.actionTypeControls}>
              <button 
                className={`${styles.actionTypeButton} ${selectedActionType === 'pass' ? styles.active : ''}`}
                onClick={() => setSelectedActionType('pass')}
              >
                ⚽ Podania
              </button>
              <button 
                className={`${styles.actionTypeButton} ${selectedActionType === 'dribble' ? styles.active : ''}`}
                onClick={() => setSelectedActionType('dribble')}
              >
                🏃 Drybling
              </button>
            </div>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlGroupLabel}>Metryka</span>
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
          </div>

          {selectedActionType === 'pass' && (
            <div className={styles.controlGroup}>
              <span className={styles.controlGroupLabel}>Widok</span>
              <div className={styles.viewControls}>
                <button 
                  className={`${styles.viewButton} ${selectedChart === 'sender' ? styles.active : ''}`}
                  onClick={() => setSelectedChart('sender')}
                >
                  📤 Podający
                </button>
                <button 
                  className={`${styles.viewButton} ${selectedChart === 'receiver' ? styles.active : ''}`}
                  onClick={() => setSelectedChart('receiver')}
                >
                  📥 Przyjmujący
                </button>
              </div>
            </div>
          )}

          <div className={styles.controlGroup}>
            <span className={styles.controlGroupLabel}>Rola</span>
            <div className={styles.chartControls}>
              <button 
                className={`${styles.controlButton} ${selectedChart === 'sender' ? styles.active : ''}`}
                onClick={() => setSelectedChart('sender')}
              >
                📤 Podający
              </button>
              {selectedActionType === 'pass' && (
                <button 
                  className={`${styles.controlButton} ${selectedChart === 'receiver' ? styles.active : ''}`}
                  onClick={() => setSelectedChart('receiver')}
                >
                  📥 Przyjmujący
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.controlsRow}>
          <div className={styles.controlGroup}>
            <span className={styles.controlGroupLabel}>Typ wykresu</span>
            <div className={styles.chartTypeControls}>
              <button 
                className={`${styles.chartTypeButton} ${!showMatchChart && !showNetworkChart ? styles.active : ''}`}
                onClick={() => {setShowMatchChart(false); setShowNetworkChart(false);}}
              >
                📊 Statystyki ogólne
              </button>
              <button 
                className={`${styles.chartTypeButton} ${showMatchChart ? styles.active : ''}`}
                onClick={() => {setShowMatchChart(true); setShowNetworkChart(false);}}
                disabled={!selectedPlayerId}
              >
                📈 Mecz po meczu
              </button>
              <button 
                className={`${styles.chartTypeButton} ${showNetworkChart ? styles.active : ''}`}
                onClick={() => {setShowNetworkChart(true); setShowMatchChart(false);}}
              >
                ⚛️ Sieć połączeń
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <h3>{showNetworkChart ? (selectedPlayerId ? `Sieć połączeń - ${chartData.find(d => d.id === selectedPlayerId)?.name || players.find(p => p.id === selectedPlayerId)?.name || 'Nieznany'}` : 'Sieć połączeń - wybierz zawodnika') : showMatchChart ? `Statystyki mecz po mecz - ${chartData.find(d => d.id === selectedPlayerId)?.name || 'Wybierz zawodnika'}` : getChartTitle()}</h3>
      
      {showNetworkChart ? (
        // Wykres sieciowy (pajęczyna połączeń)
        networkData.nodes.length > 0 ? (
          <div className={styles.chart}>
            <svg width="600" height="600" viewBox="0 0 600 600" className={styles.networkChart}>
              {/* Rysuj krawędzie (połączenia) */}
              {networkData.edges.map((edge, index) => {
                const sourceNode = networkData.nodes.find(n => n.id === edge.source);
                const targetNode = networkData.nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;
                
                // Oblicz środek linii dla etykiety
                const midX = (sourceNode.x + targetNode.x) / 2;
                const midY = (sourceNode.y + targetNode.y) / 2;
                
                // Oblicz kąt linii dla obrotu tekstu
                const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x) * 180 / Math.PI;
                const rotation = Math.abs(angle) > 90 ? angle + 180 : angle;
                
                return (
                  <g key={`edge-${index}`}>
                    <line
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke="#82ca9d"
                      strokeWidth={edge.thickness}
                      opacity={0.7}
                    >
                      <title>{`${sourceNode.name} ↔ ${targetNode.name}: ${edge.value.toFixed(2)} PxT`}</title>
                    </line>
                    
                    {/* Etykieta na linii z wartością PxT */}
                    <text
                      x={midX}
                      y={midY - 3}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#2d7a2d"
                      fontWeight="bold"
                      transform={`rotate(${rotation} ${midX} ${midY})`}
                      style={{ 
                        textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                        filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.8))'
                      }}
                    >
                      {edge.value.toFixed(1)}
                    </text>
                  </g>
                );
              })}
              
              {/* Rysuj węzły (zawodnicy) */}
              {networkData.nodes.map((node) => {
                const isCenter = node.id === selectedPlayerId;
                const senderValue = node.senderValue || 0;
                const receiverValue = node.receiverValue || 0;
                const totalActions = node.actionCount || node.connectionCount;
                
                return (
                  <g key={node.id}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill={isCenter ? "#ff6b6b" : "#0088FE"}
                      stroke={isCenter ? "#000" : "#fff"}
                      strokeWidth={isCenter ? 3 : 2}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleClick({ id: node.id })}
                    >
                      <title>{isCenter ? 
                        `${node.name}: Centrum sieci, ${node.connectionCount} połączeń` :
                        `${node.name}: PxT: ${node.totalValue.toFixed(2)}, Podania: ${totalActions}, Podający: ${senderValue.toFixed(1)}, Przyjmujący: ${receiverValue.toFixed(1)}`
                      }</title>
                    </circle>
                    
                    {/* Nazwa zawodnika */}
                    <text
                      x={node.x}
                      y={node.y - node.radius - 25}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="bold"
                      fill="#333"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleClick({ id: node.id })}
                    >
                      {node.name}
                    </text>
                    
                    {/* Dane w środku koła */}
                    <text
                      x={node.x}
                      y={node.y + 3}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#fff"
                      fontWeight="bold"
                    >
                      {isCenter ? node.connectionCount : totalActions}
                    </text>
                    
                    {/* Statystyki pod węzłem */}
                    {!isCenter && (
                      <>
                        <text
                          x={node.x}
                          y={node.y + node.radius + 15}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#333"
                          fontWeight="600"
                        >
                          PxT: {node.totalValue.toFixed(1)}
                        </text>
                        <text
                          x={node.x}
                          y={node.y + node.radius + 27}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#666"
                        >
                          P: {senderValue.toFixed(1)} | O: {receiverValue.toFixed(1)}
                        </text>
                      </>
                    )}
                    
                    {/* Statystyki centrum */}
                    {isCenter && (
                      <text
                        x={node.x}
                        y={node.y + node.radius + 15}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#333"
                        fontWeight="600"
                      >
                        {node.connectionCount} partnerów
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            
            {/* Legenda i opis */}
            <div className={styles.networkLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendCircle} style={{ backgroundColor: '#0088FE' }}></div>
                <span>Partner (rozmiar = siła połączenia)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendLine} style={{ backgroundColor: '#82ca9d' }}></div>
                <span>Połączenie PxT (grubość = siła)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendCircle} style={{ backgroundColor: '#ff6b6b' }}></div>
                <span>Wybrany zawodnik</span>
              </div>
            </div>

          </div>
        ) : (
          <div className={styles.noData}>
            <p>{!selectedPlayerId ? 'Wybierz zawodnika, aby zobaczyć jego sieć połączeń' : 'Brak połączeń dla wybranego zawodnika'}</p>
            <p style={{fontSize: '14px', color: '#666', marginTop: '10px'}}>
              {!selectedPlayerId 
                ? 'Kliknij na zawodnika w tabeli lub wykresie aby zobaczyć jego partnerów' 
                : 'Sprawdź czy zawodnik ma podania w wybranych meczach'}
            </p>
          </div>
        )
      ) : !showMatchChart ? (
        // Wykres słupkowy pionowy zamiast kołowego
        chartData.length > 0 ? (
          <div className={styles.chart}>
            {/* Informacja o przewijalnym wykresie */}
            {chartData.length > 10 && (
              <div className={styles.chartInfo}>
                <span>📊 Przewijalny wykres - {chartData.length} zawodników (przewiń w prawo/lewo)</span>
              </div>
            )}
            <div className={styles.scrollableChart}>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  barCategoryGap="10%"
                >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12, fill: '#666' }}
                  axisLine={{ stroke: '#ddd' }}
                  tickLine={{ stroke: '#ddd' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#666' }}
                  axisLine={{ stroke: '#ddd' }}
                  tickLine={{ stroke: '#ddd' }}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const passesCount = selectedActionType === 'pass' 
                        ? (selectedChart === 'sender' ? data.senderPassCount : data.receiverPassCount)
                        : data.dribblingCount;
                      const valuePerAction = passesCount > 0 ? (data.value / passesCount) : 0;
                      const passesPer90 = data.actualMinutes > 0 ? (passesCount / data.actualMinutes) * 90 : 0;
                      const pxtPer90 = data.actualMinutes > 0 ? (data.value / data.actualMinutes) * 90 : 0;
                      
                      return (
                        <div className={styles.simpleTooltip}>
                          <div className={styles.tooltipName}>{label}</div>
                          <div className={styles.tooltipRow}>
                            <span>{selectedMetric === 'packing' ? 'Packing' : 'PxT'}:</span>
                            <span className={styles.tooltipValue}>{getValueLabel(data.value)}</span>
                          </div>
                          <div className={styles.tooltipRow}>
                            <span>Udział:</span>
                            <span className={styles.tooltipValue}>{data.percentage.toFixed(1)}%</span>
                          </div>
                          <div className={styles.tooltipRow}>
                            <span>Minuty:</span>
                            <span className={styles.tooltipValue}>{data.actualMinutes}</span>
                          </div>
                          <div className={styles.tooltipRow}>
                            <span>{selectedActionType === 'pass' ? 'Podań' : 'Dryblingów'}:</span>
                            <span className={styles.tooltipValue}>{passesCount}</span>
                          </div>
                          <div className={styles.tooltipRow}>
                            <span>PxT/podanie:</span>
                            <span className={styles.tooltipValue}>{getValueLabel(valuePerAction)}</span>
                          </div>
                          <div className={styles.tooltipRow}>
                            <span>Podania/90min:</span>
                            <span className={styles.tooltipValue}>{passesPer90.toFixed(1)}</span>
                          </div>
                          <div className={styles.tooltipRow}>
                            <span>PxT/90min:</span>
                            <span className={styles.tooltipValue}>{getValueLabel(pxtPer90)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  onClick={handleClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={selectedPlayerId === entry.id ? '#ef4444' : COLORS[index % COLORS.length]}
                      stroke={selectedPlayerId === entry.id ? '#000' : 'none'}
                      strokeWidth={selectedPlayerId === entry.id ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className={styles.noData}>
            <p>Brak danych dla wybranej kategorii</p>
            <p style={{fontSize: '14px', color: '#666', marginTop: '10px'}}>
              Wybierz mecze i zawodników z akcjami lub sprawdź ustawienia filtrów
            </p>
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
                  connectNulls={true}
                  name="xT"
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="PxT" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={{ fill: '#82ca9d', strokeWidth: 2, r: 4 }}
                  connectNulls={true}
                  name="PxT"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Packing" 
                  stroke="#ffc658" 
                  strokeWidth={2}
                  dot={{ fill: '#ffc658', strokeWidth: 2, r: 4 }}
                  connectNulls={true}
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
        <div className={styles.tableHeader}>
          <h4>Szczegółowe statystyki ({tableData.length} zawodników)</h4>
          <div className={styles.tableControls}>
            <div className={styles.metricToggle}>
              <button
                className={`${styles.metricButton} ${tableMetric === 'packing' ? styles.active : ''}`}
                onClick={() => setTableMetric('packing')}
              >
                Packing
              </button>
              <button
                className={`${styles.metricButton} ${tableMetric === 'pxt' ? styles.active : ''}`}
                onClick={() => setTableMetric('pxt')}
              >
                PxT
              </button>
              <button
                className={`${styles.metricButton} ${tableMetric === 'xt' ? styles.active : ''}`}
                onClick={() => setTableMetric('xt')}
              >
                xT
              </button>
            </div>


            
            <label className={styles.per90Checkbox}>
              <input
                type="checkbox"
                checked={isPer90Minutes}
                onChange={(e) => setIsPer90Minutes(e.target.checked)}
              />
              /90 min
            </label>
            <div className={styles.filterItem}>
              <label htmlFor="minMinutes">Min. minut:</label>
              <input
                id="minMinutes"
                type="number"
                min="0"
                max="90"
                value={minMinutesFilter}
                onChange={(e) => setMinMinutesFilter(Number(e.target.value))}
                className={styles.filterInput}
                placeholder="0"
              />
            </div>
            <div className={styles.filterItem}>
              <label>Rocznik urodzenia:</label>
              <div className={styles.yearRangeContainer}>
                <input
                  type="number"
                  value={birthYearFilter.from}
                  onChange={(e) => onBirthYearFilterChange({...birthYearFilter, from: e.target.value})}
                  placeholder="od"
                  className={styles.filterInput}
                  min="1990"
                  max="2020"
                />
                <span className={styles.yearRangeSeparator}>-</span>
                <input
                  type="number"
                  value={birthYearFilter.to}
                  onChange={(e) => onBirthYearFilterChange({...birthYearFilter, to: e.target.value})}
                  placeholder="do"
                  className={styles.filterInput}
                  min="1990"
                  max="2020"
                />
              </div>
            </div>
            <div className={styles.filterItem}>
              <div className={styles.label}>
                Wybierz pozycje ({selectedPositions.length}/{availablePositions.length}):
              </div>
              <div className={`${styles.dropdownContainer} dropdownContainer`}>
                <div 
                  className={styles.dropdownToggle}
                  onClick={() => setShowPositionsDropdown(!showPositionsDropdown)}
                >
                  <span>
                    {selectedPositions.length === 0 ? 'Brak wybranych pozycji' : 
                     selectedPositions.length === availablePositions.length ? 'Wszystkie pozycje' :
                     `${selectedPositions.length} pozycji`}
                  </span>
                  <span className={styles.dropdownArrow}>{showPositionsDropdown ? '▲' : '▼'}</span>
                </div>
                {showPositionsDropdown && (
                  <div className={styles.dropdownMenu}>
                    <div 
                      className={styles.dropdownItem}
                      onClick={handleSelectAllPositions}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedPositions.length === availablePositions.length}
                        onChange={() => {}}
                      />
                      <span>Wszystkie pozycje</span>
                    </div>
                    {availablePositions.map(position => (
                      <div 
                        key={position.value}
                        className={styles.dropdownItem}
                        onClick={() => handlePositionToggle(position.value)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedPositions.includes(position.value)}
                          onChange={() => {}}
                        />
                        <span>{position.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th rowSpan={2} onClick={() => handleSort('name')} className={styles.sortableHeader}>
                  Zawodnik {getSortIcon('name')}
                </th>
                <th colSpan={tableMetric === 'packing' ? 2 : 4}>
                  Podania - {tableMetric === 'packing' ? 'Packing' : tableMetric === 'pxt' ? 'PxT' : 'xT'}
                </th>
                <th colSpan={tableMetric === 'packing' ? 1 : 2}>
                  Drybling - {tableMetric === 'packing' ? 'Packing' : tableMetric === 'pxt' ? 'PxT' : 'xT'}
                </th>
                <th colSpan={3}>Aktywność</th>
                <th colSpan={4}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                    <span>Dodatkowe akcje -</span>
                    <select 
                      value={additionalActionsRole} 
                      onChange={(e) => setAdditionalActionsRole(e.target.value as 'sender' | 'receiver')}
                      style={{padding: '2px 4px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '3px'}}
                    >
                      <option value="sender">Podający</option>
                      <option value="receiver">Przyjmujący</option>
                    </select>
                  </div>
                </th>
                <th rowSpan={2} onClick={() => handleSort('minutesPercentage')} className={styles.sortableHeader}>
                  % {getSortIcon('minutesPercentage')}
                </th>
                <th rowSpan={2} onClick={() => handleSort('actualMinutes')} className={styles.sortableHeader}>
                  Minuty {getSortIcon('actualMinutes')}
                </th>
              </tr>
              <tr className={styles.subHeader}>
                {/* Kolumny dla wybranej metryki podań */}
                {tableMetric === 'packing' && (
                  <>
                    <th onClick={() => handleSort('senderPacking')} className={styles.sortableHeader}>
                      Podający {getSortIcon('senderPacking')}
                    </th>
                    <th onClick={() => handleSort('receiverPacking')} className={styles.sortableHeader}>
                      Przyjmujący {getSortIcon('receiverPacking')}
                    </th>
                  </>
                )}
                {tableMetric === 'pxt' && (
                  <>
                    <th onClick={() => handleSort('senderPxT')} className={styles.sortableHeader}>
                      Podający {getSortIcon('senderPxT')}
                    </th>
                    <th onClick={() => handleSort('senderAveragePxT')} className={styles.sortableHeader}>
                      Śr. PxT/podanie (P) {getSortIcon('senderAveragePxT')}
                    </th>
                    <th onClick={() => handleSort('receiverPxT')} className={styles.sortableHeader}>
                      Przyjmujący {getSortIcon('receiverPxT')}
                    </th>
                    <th onClick={() => handleSort('receiverAveragePxT')} className={styles.sortableHeader}>
                      Śr. PxT/podanie (O) {getSortIcon('receiverAveragePxT')}
                    </th>
                  </>
                )}
                {tableMetric === 'xt' && (
                  <>
                    <th onClick={() => handleSort('senderXT')} className={styles.sortableHeader}>
                      Podający {getSortIcon('senderXT')}
                    </th>
                    <th onClick={() => handleSort('senderAveragePxT')} className={styles.sortableHeader}>
                      Śr. PxT/podanie (P) {getSortIcon('senderAveragePxT')}
                    </th>
                    <th onClick={() => handleSort('receiverXT')} className={styles.sortableHeader}>
                      Przyjmujący {getSortIcon('receiverXT')}
                    </th>
                    <th onClick={() => handleSort('receiverAveragePxT')} className={styles.sortableHeader}>
                      Śr. PxT/podanie (O) {getSortIcon('receiverAveragePxT')}
                    </th>
                  </>
                )}
                                {tableMetric === 'packing' && (
                  <th onClick={() => handleSort('totalDribbling')} className={styles.sortableHeader}>
                    Packing {getSortIcon('totalDribbling')}
                  </th>
                )}
                {tableMetric === 'pxt' && (
                  <>
                    <th onClick={() => handleSort('totalDribblingPxT')} className={styles.sortableHeader}>
                      PxT {getSortIcon('totalDribblingPxT')}
                    </th>
                    <th onClick={() => handleSort('dribblingAveragePxT')} className={styles.sortableHeader}>
                      Śr. PxT/drybling {getSortIcon('dribblingAveragePxT')}
                    </th>
                  </>
                )}
                {tableMetric === 'xt' && (
                  <>
                    <th onClick={() => handleSort('totalDribblingXT')} className={styles.sortableHeader}>
                      xT {getSortIcon('totalDribblingXT')}
                    </th>
                    <th onClick={() => handleSort('dribblingAverageXT')} className={styles.sortableHeader}>
                      Śr. xT/drybling {getSortIcon('dribblingAverageXT')}
                    </th>
                  </>
                )}
                <th onClick={() => handleSort('passCount')} className={styles.sortableHeader}>
                  Podania/90 {getSortIcon('passCount')}
                </th>
                <th onClick={() => handleSort('dribblingCount')} className={styles.sortableHeader}>
                  Drybling/90 {getSortIcon('dribblingCount')}
                </th>
                <th onClick={() => handleSort('receiverPassCount')} className={styles.sortableHeader}>
                  Przyjęć/90 {getSortIcon('receiverPassCount')}
                </th>
                <th onClick={() => handleSort(additionalActionsRole === 'sender' ? 'senderP3' : 'receiverP3')} className={styles.sortableHeader}>
                  P3 {getSortIcon(additionalActionsRole === 'sender' ? 'senderP3' : 'receiverP3')}
                </th>
                <th onClick={() => handleSort(additionalActionsRole === 'sender' ? 'senderPenaltyArea' : 'receiverPenaltyArea')} className={styles.sortableHeader}>
                  PK {getSortIcon(additionalActionsRole === 'sender' ? 'senderPenaltyArea' : 'receiverPenaltyArea')}
                </th>
                <th onClick={() => handleSort(additionalActionsRole === 'sender' ? 'senderShots' : 'receiverShots')} className={styles.sortableHeader}>
                  Strzał {getSortIcon(additionalActionsRole === 'sender' ? 'senderShots' : 'receiverShots')}
                </th>
                <th onClick={() => handleSort(additionalActionsRole === 'sender' ? 'senderGoals' : 'receiverGoals')} className={styles.sortableHeader}>
                  Br {getSortIcon(additionalActionsRole === 'sender' ? 'senderGoals' : 'receiverGoals')}
                </th>

              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={tableMetric === 'packing' ? 12 : 14} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    Brak danych do wyświetlenia
                  </td>
                </tr>
              ) : (
                tableData.map((player, index) => (
                <tr 
                  key={player.id} 
                  className={`${styles.tableRow} ${selectedPlayerId === player.id ? styles.selectedRow : ''}`}
                  onClick={() => handleTableRowClick(player.id)}
                >
                  <td className={styles.playerName}>
                    <div className={styles.playerInfo}>
                      <div className={styles.playerNameRow}>
                        <span className={styles.playerNameText}>
                          {player.name}
                        </span>
                        {(player as any).birthYear && (
                          <span className={styles.birthYear}> ({(player as any).birthYear})</span>
                        )}
                      </div>
                      <div className={styles.playerPositions}>
                        {getAllPlayerPositions(player.id).map((position, idx) => (
                          <span key={idx} className={styles.positionBadge}>
                            {position}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  {/* Podania - dynamiczne w zależności od wybranej metryki */}
                  {tableMetric === 'packing' && (
                    <>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.senderPacking, player.actualMinutes, 1) : formatValue(player.senderPacking, 0)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90((player as any).senderPassCount, player.actualMinutes, 0) : (player as any).senderPassCount})
                        </small>
                      </td>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.receiverPacking, player.actualMinutes, 1) : formatValue(player.receiverPacking, 0)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90((player as any).receiverPassCount, player.actualMinutes, 0) : (player as any).receiverPassCount})
                        </small>
                      </td>
                    </>
                  )}
                  {tableMetric === 'pxt' && (
                    <>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.senderPxT, player.actualMinutes, 2) : formatValue(player.senderPxT, 2)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90(player.senderPassCount, player.actualMinutes, 0) : player.senderPassCount})
                        </small>
                      </td>
                      <td>{formatValue(player.senderAveragePxT, 3)}</td>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.receiverPxT, player.actualMinutes, 2) : formatValue(player.receiverPxT, 2)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90(player.receiverPassCount, player.actualMinutes, 0) : player.receiverPassCount})
                        </small>
                      </td>
                      <td>{formatValue(player.receiverAveragePxT, 3)}</td>
                    </>
                  )}
                  {tableMetric === 'xt' && (
                    <>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.senderXT, player.actualMinutes, 3) : formatValue(player.senderXT, 3)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90(player.senderPassCount, player.actualMinutes, 0) : player.senderPassCount})
                        </small>
                      </td>
                      <td>{formatValue(player.senderAveragePxT, 3)}</td>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.receiverXT, player.actualMinutes, 3) : formatValue(player.receiverXT, 3)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90(player.receiverPassCount, player.actualMinutes, 0) : player.receiverPassCount})
                        </small>
                      </td>
                      <td>{formatValue(player.receiverAveragePxT, 3)}</td>
                    </>
                  )}
                  {/* Drybling */}
                  {tableMetric === 'packing' && (
                    <td>
                      {isPer90Minutes ? formatValuePer90(player.totalDribbling, player.actualMinutes, 1) : formatValue(player.totalDribbling, 0)}
                      <small style={{color: '#666', marginLeft: '4px'}}>
                        ({isPer90Minutes ? formatValuePer90((player as any).dribblingCount, player.actualMinutes, 0) : (player as any).dribblingCount})
                      </small>
                    </td>
                  )}
                  {tableMetric === 'pxt' && (
                    <>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.totalDribblingPxT, player.actualMinutes, 2) : formatValue(player.totalDribblingPxT, 2)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90((player as any).dribblingCount, player.actualMinutes, 0) : (player as any).dribblingCount})
                        </small>
                      </td>
                      <td>{formatValue((player as any).dribblingAveragePxT, 3)}</td>
                    </>
                  )}
                  {tableMetric === 'xt' && (
                    <>
                      <td>
                        {isPer90Minutes ? formatValuePer90(player.totalDribblingXT, player.actualMinutes, 3) : formatValue(player.totalDribblingXT, 3)}
                        <small style={{color: '#666', marginLeft: '4px'}}>
                          ({isPer90Minutes ? formatValuePer90((player as any).dribblingCount, player.actualMinutes, 0) : (player as any).dribblingCount})
                        </small>
                      </td>
                      <td>{formatValue((player as any).dribblingAverageXT, 3)}</td>
                    </>
                  )}
                  {/* Aktywność */}
                  <td>{formatValuePer90((player as any).passCount, player.actualMinutes, 1)}</td>
                  <td>{formatValuePer90((player as any).dribblingCount, player.actualMinutes, 1)}</td>
                  <td>{formatValuePer90((player as any).receiverPassCount, player.actualMinutes, 1)}</td>
                  {/* Dodatkowe akcje - dynamiczne w zależności od roli */}
                  <td>
                    {additionalActionsRole === 'sender' 
                      ? (isPer90Minutes ? formatValuePer90(player.senderP3, player.actualMinutes, 1) : formatValue(player.senderP3, 0))
                      : (isPer90Minutes ? formatValuePer90(player.receiverP3, player.actualMinutes, 1) : formatValue(player.receiverP3, 0))
                    }
                  </td>
                  <td>
                    {additionalActionsRole === 'sender' 
                      ? (isPer90Minutes ? formatValuePer90(player.senderPenaltyArea, player.actualMinutes, 1) : formatValue(player.senderPenaltyArea, 0))
                      : (isPer90Minutes ? formatValuePer90(player.receiverPenaltyArea, player.actualMinutes, 1) : formatValue(player.receiverPenaltyArea, 0))
                    }
                  </td>
                  <td>
                    {additionalActionsRole === 'sender' 
                      ? (isPer90Minutes ? formatValuePer90(player.senderShots, player.actualMinutes, 1) : formatValue(player.senderShots, 0))
                      : (isPer90Minutes ? formatValuePer90(player.receiverShots, player.actualMinutes, 1) : formatValue(player.receiverShots, 0))
                    }
                  </td>
                  <td>
                    {additionalActionsRole === 'sender' 
                      ? (isPer90Minutes ? formatValuePer90(player.senderGoals, player.actualMinutes, 1) : formatValue(player.senderGoals, 0))
                      : (isPer90Minutes ? formatValuePer90(player.receiverGoals, player.actualMinutes, 1) : formatValue(player.receiverGoals, 0))
                    }
                  </td>
                  <td>{formatValue(player.minutesPercentage, 0)}</td>
                  <td>{formatValue(player.actualMinutes, 0)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Szczegółowe statystyki wybranego zawodnika */}
        {selectedPlayerId && getPlayerMatchStats.length > 0 && (
          <div className={styles.playerDetails}>
            <div className={styles.playerDetailsHeader}>
              <h5>Szczegóły meczów - {tableData.find(p => p.id === selectedPlayerId)?.name}</h5>
              <div className={styles.roleToggle}>
                <button
                  className={`${styles.roleButton} ${playerDetailsRole === 'sender' ? styles.active : ''}`}
                  onClick={() => setPlayerDetailsRole('sender')}
                >
                  Podający
                </button>
                <button
                  className={`${styles.roleButton} ${playerDetailsRole === 'receiver' ? styles.active : ''}`}
                  onClick={() => setPlayerDetailsRole('receiver')}
                >
                  Przyjmujący
                </button>
                <button
                  className={`${styles.roleButton} ${playerDetailsRole === 'dribbling' ? styles.active : ''}`}
                  onClick={() => setPlayerDetailsRole('dribbling')}
                >
                  Drybling
                </button>
              </div>
            </div>
            
            <div className={styles.matchStatsTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Mecz</th>
                    <th>Pozycja</th>
                    <th>Minuty</th>
                    <th>Packing</th>
                    <th>PxT</th>
                    <th>xT</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {getPlayerMatchStats.map((stat, index) => (
                    <tr key={stat.match.matchId}>
                      <td>{new Date(stat.match.date).toLocaleDateString('pl-PL')}</td>
                      <td>{getTeamName(stat.match.team)} vs {stat.match.opponent}</td>
                      <td>{stat.position || '-'}</td>
                      <td>{stat.minutesPlayed}'</td>
                      <td>
                        {playerDetailsRole === 'sender' 
                          ? formatValue(stat.senderPacking, 0)
                          : playerDetailsRole === 'receiver'
                          ? formatValue(stat.receiverPacking, 0)
                          : formatValue(stat.dribblingPacking, 0)
                        }
                      </td>
                      <td>
                        {playerDetailsRole === 'sender' 
                          ? formatValue(stat.senderPxT, 2)
                          : playerDetailsRole === 'receiver'
                          ? formatValue(stat.receiverPxT, 2)
                          : formatValue(stat.dribblingPxT, 2)
                        }
                      </td>
                      <td>
                        {playerDetailsRole === 'sender' 
                          ? formatValue(stat.senderXT, 3)
                          : playerDetailsRole === 'receiver'
                          ? formatValue(stat.receiverXT, 3)
                          : formatValue(stat.dribblingXT, 3)
                        }
                      </td>
                      <td>
                        {playerDetailsRole === 'sender' 
                          ? actions.filter(a => a.matchId === stat.match.matchId && a.senderId === selectedPlayerId && a.actionType === 'pass').length
                          : playerDetailsRole === 'receiver'
                          ? actions.filter(a => a.matchId === stat.match.matchId && a.receiverId === selectedPlayerId && a.actionType === 'pass').length
                          : actions.filter(a => a.matchId === stat.match.matchId && a.senderId === selectedPlayerId && a.actionType === 'dribble').length
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 