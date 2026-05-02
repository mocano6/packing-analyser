// src/components/MatchInfoHeader/MatchInfoHeader.tsx
"use client";

import React, { useState, KeyboardEvent, useEffect, useMemo } from "react";
import { TeamInfo, Player, Action } from "@/types";
import { TEAMS } from "@/constants/teams";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";
import { filterMatchesBySeason, getAvailableSeasonsFromMatches } from "@/utils/seasonUtils";
import MatchDataModal from "@/components/MatchDataModal/MatchDataModal";
import { getDB } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "@/lib/firestoreWithMetrics";
import { mergeMatchDataForFirestoreWrite } from "@/lib/matchDocumentMergeForSave";
import styles from "./MatchInfoHeader.module.css";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { getActionCategory } from "@/utils/actionCategory";

// Nowy komponent do wyświetlania informacji o bieżącym meczu
interface CurrentMatchInfoProps {
  matchInfo: TeamInfo | null;
  players: Player[];
  allAvailableTeams?: { id: string; name: string }[];
}

const CurrentMatchInfo: React.FC<CurrentMatchInfoProps> = ({ matchInfo, players, allAvailableTeams = [] }) => {
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);
  const { isPresentationMode } = usePresentationMode();
  if (!matchInfo || !matchInfo.matchId) {
    return null;
  }

  // Pobierz informacje o pozycji i minutach dla aktualnie zalogowanego zawodnika
  const renderPlayerMinutes = () => {
    if (!matchInfo.playerMinutes || matchInfo.playerMinutes.length === 0) {
      return null;
    }

    // Filtruj zawodników z co najmniej 1 minutą rozegrana
    const filteredPlayerMinutes = matchInfo.playerMinutes
      .map(playerMinute => {
        const player = players.find(p => p.id === playerMinute.playerId);
        if (!player) return null;
        
        const playTime = playerMinute.startMinute === 0 && playerMinute.endMinute === 0 
          ? 0 
          : playerMinute.endMinute - playerMinute.startMinute + 1;
        
        if (playTime < 1) return null;
        
        return {
          playerMinute,
          player,
          playTime,
          position: playerMinute.position || player.position || 'Brak pozycji'
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (filteredPlayerMinutes.length === 0) {
      return null;
    }

    // Grupuj zawodników według pozycji - łączymy LW i RW w jedną grupę
    const playersByPosition = filteredPlayerMinutes.reduce((acc, item) => {
      let position = item.position;
      
      // Łączymy LW i RW w jedną grupę "Skrzydłowi"
      if (position === 'LW' || position === 'RW') {
        position = 'Skrzydłowi';
      }
      
      if (!acc[position]) {
        acc[position] = [];
      }
      acc[position].push(item);
      return acc;
    }, {} as Record<string, typeof filteredPlayerMinutes>);

    // Kolejność pozycji: GK, CB, DM, Skrzydłowi (LW/RW), AM, ST
    const positionOrder = ['GK', 'CB', 'DM', 'Skrzydłowi', 'AM', 'ST'];
    
    // Sortuj pozycje według określonej kolejności
    const sortedPositions = Object.keys(playersByPosition).sort((a, b) => {
      const indexA = positionOrder.indexOf(a);
      const indexB = positionOrder.indexOf(b);
      
      // Jeśli obie pozycje są w liście, sortuj według kolejności
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // Jeśli tylko jedna jest w liście, ta w liście idzie pierwsza
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Jeśli żadna nie jest w liście, sortuj alfabetycznie
      return a.localeCompare(b, 'pl', { sensitivity: 'base' });
    });

    // Sortuj zawodników w każdej pozycji alfabetycznie po nazwisku
    // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji (LW przed RW), potem po nazwisku
    sortedPositions.forEach(position => {
      playersByPosition[position].sort((a, b) => {
        // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji
        if (position === 'Skrzydłowi') {
          const posA = a.position || '';
          const posB = b.position || '';
          if (posA !== posB) {
            // LW przed RW
            if (posA === 'LW') return -1;
            if (posB === 'LW') return 1;
          }
        }
        
        const getLastName = (name: string) => {
          const words = name.trim().split(/\s+/);
          return words[words.length - 1].toLowerCase();
        };
        const lastNameA = getLastName(getPlayerLabel(a.player.id, playersIndex));
        const lastNameB = getLastName(getPlayerLabel(b.player.id, playersIndex));
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });

    return (
      <div className={styles.playerMinutesInfo}>
        <h4 className={styles.playerMinutesTitle}>Czas gry zawodników ({filteredPlayerMinutes.length})</h4>
        <div className={styles.playerMinutesGroups}>
          {sortedPositions.map((position) => (
            <div key={position} className={styles.playerPositionGroup}>
              <h5 className={styles.positionGroupTitle}>
                {position === 'Skrzydłowi' ? 'W' : position}
              </h5>
              <div className={styles.playerMinutesList}>
                {playersByPosition[position].map((item) => (
                  <div key={item.playerMinute.playerId} className={styles.playerMinuteItem}>
                    <span className={styles.playerName}>
                      {getPlayerLabel(item.player.id, playersIndex)}
                      {item.player.isTestPlayer && (
                        <span className={styles.testPlayerBadge}>T</span>
                      )}
                    </span>
                    <span className={styles.playerMinutes}>
                      {item.playTime} min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    if (isPresentationMode) {
      return "Zespół";
    }
    
    // Najpierw sprawdź w zespołach z Firebase
    const team = allAvailableTeams.find(team => team.id === teamId);
    if (team) {
      return team.name;
    }
    
    // Fallback do domyślnych zespołów
    const defaultTeam = Object.values(TEAMS).find(team => team.id === teamId);
    if (defaultTeam) {
      return defaultTeam.name;
    }
    
    return teamId;
  };

  return (
    <div className={styles.currentMatchInfo}>
      <div className={styles.matchTitle}>
        <h3>
          {matchInfo.isHome 
            ? `${getTeamName(matchInfo.team)} vs ${isPresentationMode ? "Zespół" : matchInfo.opponent}` 
            : `${isPresentationMode ? "Zespół" : matchInfo.opponent} vs ${getTeamName(matchInfo.team)}`}
        </h3>
        <div className={styles.matchMeta}>
          <span className={styles.matchDate}>{matchInfo.date}</span>
          <span className={styles.competition}>{matchInfo.competition}</span>
          <span className={matchInfo.isHome ? styles.home : styles.away}>
            {matchInfo.isHome ? "Dom" : "Wyjazd"}
          </span>
        </div>
      </div>
      {renderPlayerMinutes()}
    </div>
  );
};

interface MatchInfoHeaderProps {
  matchInfo: TeamInfo | null;
  onChangeMatch: () => void;
  allMatches: TeamInfo[];
  onSelectMatch: (match: TeamInfo | null) => void;
  onDeleteMatch: (matchId: string) => void;
  selectedTeam: string;
  onChangeTeam: (team: string) => void;
  onManagePlayerMinutes: (match: TeamInfo) => void;
  onAddNewMatch: () => void;
  refreshCounter?: number;
  isOfflineMode?: boolean;
  players?: Player[]; // Dodajemy players jako nową właściwość
  availableTeams?: any[]; // Zespoły dostępne dla użytkownika
  isAdmin?: boolean; // Czy użytkownik jest administratorem
  allAvailableTeams?: { id: string; name: string; logo?: string }[]; // Dodajemy allAvailableTeams do props
  selectedSeason?: string; // Dodajemy selectedSeason do props
  onChangeSeason?: (season: string) => void; // Dodajemy callback do zmiany sezonu
}

const MatchInfoHeader: React.FC<MatchInfoHeaderProps> = ({
  matchInfo,
  onChangeMatch,
  allMatches,
  onSelectMatch,
  onDeleteMatch,
  selectedTeam,
  onChangeTeam,
  onManagePlayerMinutes,
  onAddNewMatch,
  refreshCounter = 0,
  isOfflineMode = false,
  players = [],
  availableTeams = [],
  isAdmin = false,
  allAvailableTeams = [], // Domyślna wartość to pusta tablica
  selectedSeason,
  onChangeSeason,
}) => {
  const [sortKey, setSortKey] = useState<keyof TeamInfo>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isMatchesTableExpanded, setIsMatchesTableExpanded] = useState(false);
  const [deletingMatchIds, setDeletingMatchIds] = useState<Set<string>>(new Set());
  const [isMatchDataModalOpen, setIsMatchDataModalOpen] = useState(false);
  const [selectedMatchForData, setSelectedMatchForData] = useState<TeamInfo | null>(null);
  const [isCurrentMatchInfoModalOpen, setIsCurrentMatchInfoModalOpen] = useState(false);
  const { isPresentationMode } = usePresentationMode();

  // Automatycznie aktywuj tryb deweloperski (obejście uwierzytelniania)
  React.useEffect(() => {
    localStorage.setItem('packing_app_bypass_auth', 'true');
  }, []);
  
  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    if (isPresentationMode) {
      return "Zespół";
    }
    
    // Najpierw sprawdź w zespołach z Firebase
    if (allAvailableTeams && allAvailableTeams.length > 0) {
      const firebaseTeam = allAvailableTeams.find(team => team.id === teamId);
      if (firebaseTeam) {
        return firebaseTeam.name;
      }
    }
    
    // Następnie sprawdź w domyślnych zespołach
    const defaultTeam = Object.values(TEAMS).find(team => team.id === teamId);
    if (defaultTeam) {
      return defaultTeam.name;
    }
    
    return teamId;
  };

  // Filtrowanie meczów wybranego zespołu i sezonu - używamy useMemo dla optymalizacji
  const teamMatches = React.useMemo(() => {
    // Najpierw filtruj według zespołu
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    
    // Następnie filtruj według sezonu (jeśli sezon jest wybrany)
    const seasonFiltered = selectedSeason ? filterMatchesBySeason(teamFiltered, selectedSeason) : teamFiltered;
    
    return seasonFiltered.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      if (aValue !== undefined && bValue !== undefined) {
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [allMatches, selectedTeam, selectedSeason, sortKey, sortDirection, refreshCounter]);

  // Oblicz dostępne sezony na podstawie meczów wybranego zespołu
  const availableSeasons = React.useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    return getAvailableSeasonsFromMatches(teamFiltered);
  }, [allMatches, selectedTeam]);
    
  // Oblicz mecze do wyświetlenia na podstawie stanu collapse/expand
  const { displayedMatches, hasMoreMatches, needsScroll } = React.useMemo(() => {
    const totalMatches = teamMatches.length;
    
    if (totalMatches === 0) {
      return { displayedMatches: [], hasMoreMatches: false, needsScroll: false };
    }
    
    // Jeśli tabela jest zwinięta, pokazuj maksymalnie 2 mecze
    if (!isMatchesTableExpanded) {
      return {
        displayedMatches: teamMatches.slice(0, 2),
        hasMoreMatches: totalMatches > 2,
        needsScroll: false
      };
    }
    
    // Jeśli tabela jest rozwinięta, pokazuj wszystkie mecze z suwakiem jeśli potrzeba
    return {
      displayedMatches: teamMatches, // Pokazuj wszystkie mecze
      hasMoreMatches: false,
      needsScroll: totalMatches > 5 // Suwak pojawi się gdy więcej niż 5 meczów
    };
  }, [teamMatches, isMatchesTableExpanded]);

  // Funkcja do dodania nowego meczu
  const handleAddMatch = () => {
    onAddNewMatch();
  };

  // Obsługa klawiszy dla przycisków edycji i usunięcia
  const handleEditKeyDown = (e: KeyboardEvent, match: TeamInfo) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectMatch(match);
      onChangeMatch();
    }
  };

  const handleDeleteKeyDown = (e: KeyboardEvent, matchId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
        onDeleteMatch(matchId);
      }
    }
  };

  // Funkcja zmiany sortowania
  const handleSort = (key: keyof TeamInfo) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Funkcja otwierania modala z danymi meczu
  const handleOpenMatchDataModal = (e: React.MouseEvent, match: TeamInfo) => {
    e.stopPropagation();
    setSelectedMatchForData(match);
    setIsMatchDataModalOpen(true);
  };

  /** Po kliknięciu w komórkę „Przeciwnik”: lista akcji + rozkład kształtu (packing/regain/loses) vs tablica w Firestore. */
  const logMatchActionsWithCategories = async (match: TeamInfo) => {
    try {
      if (!match.matchId) return;
      const db = getDB();
      if (!db) {
        console.warn("[MatchInfoHeader] Brak połączenia z bazą – nie można wczytać akcji.");
        return;
      }
      const matchRef = doc(db, "matches", match.matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) {
        console.warn(`[MatchInfoHeader] Brak dokumentu meczu: ${match.matchId}`);
        return;
      }
      const data = snap.data() as TeamInfo;
      const sources = [
        { key: "actions_packing" as const, list: data.actions_packing ?? [] },
        { key: "actions_unpacking" as const, list: data.actions_unpacking ?? [] },
        { key: "actions_regain" as const, list: data.actions_regain ?? [] },
        { key: "actions_loses" as const, list: data.actions_loses ?? [] },
      ];
      const podsumowanieTablic = sources.map(({ key, list }) => ({
        tablica: key,
        liczba: list.length,
      }));
      const wszystkieAkcje = sources.flatMap(({ key, list }) =>
        (list as Action[]).map((a) => ({
          zrodloTablicy: key,
          kategoriaKsztaltu: getActionCategory(a),
          id: a.id,
          minute: a.minute,
          actionType: a.actionType,
          packingPoints: a.packingPoints,
        }))
      );
      const rozkladKsztaltuWTablicach = sources.map(({ key, list }) => {
        const counts = { packing: 0, regain: 0, loses: 0 };
        for (const a of list as Action[]) {
          counts[getActionCategory(a)] += 1;
        }
        return { tablica: key, ...counts, razem: list.length };
      });
      const regainWPacking = rozkladKsztaltuWTablicach.find((r) => r.tablica === "actions_packing")?.regain ?? 0;
      const uwaga =
        regainWPacking > 0
          ? `UWAGA: W actions_packing jest ${regainWPacking} rekordów z polami typu regain — statystyki PxT liczą tylko pola packing (fromZone/toZone, xT start/koniec, packingPoints). Stąd zerowe/niskie PxT mimo wpisów w tej tablicy.`
          : "Rozkład kształtu rekordu vs nazwa tablicy — patrz rozkladKsztaltuWTablicach.";

      console.warn(
        `[MatchInfoHeader] ${uwaga}\nMecz ${match.matchId} | ${match.date} | ${getTeamName(match.team)} vs ${match.opponent}`,
        {
          rozkladKsztaltuWTablicach,
          podsumowanieTablic,
          wszystkieAkcje,
        }
      );
    } catch (err) {
      console.error("[MatchInfoHeader] Błąd przy odczycie akcji meczu:", err);
    }
  };

  // Funkcja do usuwania wartości undefined z obiektu (Firestore nie akceptuje undefined)
  const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (value !== undefined) {
            cleaned[key] = removeUndefinedValues(value);
          }
        }
      }
      return cleaned;
    }
    
    return obj;
  };

  // Funkcja zapisywania danych meczu
  const handleSaveMatchData = async (matchData: TeamInfo['matchData']) => {
    if (!selectedMatchForData?.matchId) {
      throw new Error("Brak ID meczu. Nie można zapisać danych.");
    }
    const firestoreMatchId = String((selectedMatchForData as any).id || selectedMatchForData.matchId);

    try {
      const db = getDB();
      if (!db) {
        throw new Error("Brak połączenia z bazą danych. Sprawdź połączenie internetowe.");
      }
      
      // Usuń wszystkie wartości undefined przed zapisem
      const cleanedMatchData = removeUndefinedValues(matchData);
      
      const matchRef = doc(db, "matches", firestoreMatchId);
      const snap = await getDoc(matchRef);
      const existingRoot = snap.exists() ? (snap.data() as TeamInfo) : null;
      const mergedMatchData = mergeMatchDataForFirestoreWrite(
        existingRoot?.matchData,
        cleanedMatchData as TeamInfo["matchData"]
      );
      const cleanedMergedMatchData = removeUndefinedValues(mergedMatchData);
      await updateDoc(matchRef, {
        matchData: cleanedMergedMatchData,
      });
      
      // Aktualizuj lokalny stan (używamy wyczyszczonych danych)
      const updatedMatch = {
        ...selectedMatchForData,
        matchData: cleanedMergedMatchData,
      };
      setSelectedMatchForData(updatedMatch);
      
      // Aktualizuj matchInfo jeśli to jest aktualnie wybrany mecz
      if (matchInfo?.matchId === selectedMatchForData.matchId) {
        // Wywołaj callback do odświeżenia danych (jeśli istnieje)
        // Możesz dodać callback do props jeśli potrzebujesz odświeżenia
      }
    } catch (error) {
      console.error("Błąd podczas zapisywania danych meczu:", error);
      
      // Rzucamy błąd dalej, aby MatchDataModal mógł go obsłużyć
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Wystąpił błąd podczas zapisywania danych meczu. Spróbuj ponownie.";
      throw new Error(errorMessage);
    }
  };

  return (
    <div className={styles.matchInfoContainer}>
      <div className={styles.matchesTable}>
        <div className={styles.tableHeader}>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("date")}
          >
            Data {sortKey === "date" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("team")}
          >
            Zespół {sortKey === "team" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("opponent")}
          >
            Przeciwnik {sortKey === "opponent" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("competition")}
          >
            Rozgrywki {sortKey === "competition" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("isHome")}
          >
            Lokalizacja {sortKey === "isHome" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div className={styles.headerCell}>Akcje</div>
        </div>

        <div className={`${styles.tableBody} ${needsScroll ? styles.scrollableTable : ''}`}>
          {displayedMatches.length > 0 ? (
            displayedMatches.map((match) => {
              const isSelected = matchInfo?.matchId === match.matchId;
              const isHomeMatch = match.isHome === true;
              const isBeingDeleted = deletingMatchIds.has(match.matchId);
              
              return (
                <div 
                  key={match.matchId}
                  className={`${styles.matchRow} ${isSelected ? styles.selected : ""} ${isHomeMatch ? styles.homeRow : styles.awayRow} ${isBeingDeleted ? styles.deleteInProgress : ""}`}
                  onClick={() => onSelectMatch(match)}
                >
                  <div className={styles.cell}>
                    {match.date}
                  </div>
                  <div className={styles.cell}>
                    <div
                      className={`${styles.teamCell} ${isSelected ? styles.clickableDate : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelected && matchInfo) {
                          setSelectedMatchForData(matchInfo);
                          setIsCurrentMatchInfoModalOpen(true);
                        }
                      }}
                      style={{ cursor: isSelected ? 'pointer' : 'default' }}
                    >
                      {(() => {
                        const team = allAvailableTeams.find(t => t.id === match.team);
                        return team?.logo ? (
                          <img 
                            src={team.logo} 
                            alt={`Logo ${getTeamName(match.team)}`}
                            className={styles.teamLogo}
                          />
                        ) : null;
                      })()}
                      <span>{getTeamName(match.team)}</span>
                    </div>
                  </div>
                  <div
                    className={styles.cell}
                    onClick={() => {
                      void logMatchActionsWithCategories(match);
                    }}
                    title="Kliknij: w konsoli (DevTools) lista akcji z tablicy Firestore i kategoria z kształtu rekordu"
                  >
                    <div className={styles.opponentCell}>
                      {match.opponentLogo && !isPresentationMode && (
                        <img 
                          src={match.opponentLogo} 
                          alt={`Logo ${match.opponent}`}
                          className={styles.opponentLogo}
                        />
                      )}
                      <span>{isPresentationMode ? "Zespół" : match.opponent}</span>
                    </div>
                  </div>
                  <div className={styles.cell}>
                    <span className={styles.competition}>{match.competition}</span>
                  </div>
                  <div className={styles.cell}>
                    <span className={isHomeMatch ? styles.home : styles.away}>
                      {isHomeMatch ? "Dom" : "Wyjazd"}
                    </span>
                  </div>
                  <div className={styles.cellActions}>
                    {isSelected && (
                      <>
                        <button
                          className={styles.editBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMatch(match);
                            onChangeMatch();
                          }}
                          onKeyDown={(e) => handleEditKeyDown(e, match)}
                          title="Edytuj"
                          aria-label={`Edytuj mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ✎
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.minutesBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onManagePlayerMinutes(match);
                          }}
                          title="Minuty zawodników"
                          aria-label={`Zarządzaj minutami zawodników w meczu: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ⌚
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.dataBtn}`}
                          onClick={(e) => handleOpenMatchDataModal(e, match)}
                          title="Dane meczu"
                          aria-label={`Dane meczu: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          📊
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Zabezpieczenie przed wielokrotnym kliknięciem
                            if (match.matchId && !isBeingDeleted) {
                              if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
                                // Ustawienie flagi usuwania
                                setDeletingMatchIds(prev => new Set([...prev, match.matchId]));
                                // Wywołujemy funkcję usuwania, a funkcja ta zajmie się także odświeżeniem listy
                                onDeleteMatch(match.matchId);
                              }
                            }
                          }}
                          onKeyDown={(e) => match.matchId && !isBeingDeleted ? handleDeleteKeyDown(e, match.matchId) : undefined}
                          title="Usuń"
                          aria-label={`Usuń mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          {isBeingDeleted ? "⌛" : "✕"}
                        </button>
                      </>
                    )}
                    {!isSelected && (
                      <>
                        <button
                          className={styles.editBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMatch(match);
                            onChangeMatch();
                          }}
                          onKeyDown={(e) => handleEditKeyDown(e, match)}
                          title="Edytuj"
                          aria-label={`Edytuj mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ✎
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.minutesBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onManagePlayerMinutes(match);
                          }}
                          title="Minuty zawodników"
                          aria-label={`Zarządzaj minutami zawodników w meczu: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ⌚
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.dataBtn}`}
                          onClick={(e) => handleOpenMatchDataModal(e, match)}
                          title="Dane meczu"
                          aria-label={`Dane meczu: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          📊
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Zabezpieczenie przed wielokrotnym kliknięciem
                            if (match.matchId && !isBeingDeleted) {
                              if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
                                // Ustawienie flagi usuwania
                                setDeletingMatchIds(prev => new Set([...prev, match.matchId]));
                                // Wywołujemy funkcję usuwania, a funkcja ta zajmie się także odświeżeniem listy
                                onDeleteMatch(match.matchId);
                              }
                            }
                          }}
                          onKeyDown={(e) => match.matchId && !isBeingDeleted ? handleDeleteKeyDown(e, match.matchId) : undefined}
                          title="Usuń"
                          aria-label={`Usuń mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          {isBeingDeleted ? "⌛" : "✕"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.noMatches}>
              Brak zapisanych meczów dla tego zespołu
            </div>
          )}
        </div>
        
        {/* Modal z danymi meczu */}
        {isMatchDataModalOpen && selectedMatchForData && (
          <MatchDataModal
            isOpen={isMatchDataModalOpen}
            onClose={() => {
              setIsMatchDataModalOpen(false);
              setSelectedMatchForData(null);
            }}
            onSave={handleSaveMatchData}
            currentMatch={selectedMatchForData}
            allAvailableTeams={allAvailableTeams}
          />
        )}
        
        {/* Modal z informacjami o bieżącym meczu */}
        {isCurrentMatchInfoModalOpen && matchInfo && (
          <div className={styles.modalOverlay} onClick={() => setIsCurrentMatchInfoModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.modalCloseButton}
                onClick={() => setIsCurrentMatchInfoModalOpen(false)}
                aria-label="Zamknij"
              >
                ×
              </button>
              <CurrentMatchInfo matchInfo={matchInfo} players={players} allAvailableTeams={allAvailableTeams} />
            </div>
          </div>
        )}
        
        {/* Przycisk rozwijania/zwijania tabeli meczów */}
        {(hasMoreMatches || isMatchesTableExpanded) && (
          <div className={styles.tableExpandButton}>
            <button 
              className={styles.expandBtn}
              onClick={() => setIsMatchesTableExpanded(!isMatchesTableExpanded)}
              aria-label={isMatchesTableExpanded ? "Zwiń listę meczów" : "Rozwiń listę meczów"}
            >
              {isMatchesTableExpanded ? (
                <>
                  <span>Pokaż mniej</span>
                  <span className={styles.expandIcon}>▲</span>
                </>
              ) : (
                <>
                  <span>Pokaż więcej ({teamMatches.length - 2})</span>
                  <span className={styles.expandIcon}>▼</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchInfoHeader;
