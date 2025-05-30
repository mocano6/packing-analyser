"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import PackingChart from '@/components/PackingChart/PackingChart';
import PlayerModal from "@/components/PlayerModal/PlayerModal";
import { TEAMS } from "@/constants/teamsLoader";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import styles from "./zawodnicy.module.css";

export default function ZawodnicyPage() {
  const [selectedTeam, setSelectedTeam] = useState<string>(TEAMS.REZERWY.id);
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const {
    players,
    isModalOpen,
    editingPlayerId,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
  } = usePlayersState();

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

  // Zaznacz wszystkie mecze domyślnie przy zmianie zespołu
  useEffect(() => {
    if (teamMatches.length > 0) {
      const validMatchIds = teamMatches
        .map(match => match.matchId)
        .filter((id): id is string => id !== undefined);
      setSelectedMatches(validMatchIds);
    }
  }, [teamMatches]);

  // Pobierz akcje ze wszystkich meczów zespołu
  useEffect(() => {
    const loadAllActionsForTeam = async () => {
      if (teamMatches.length === 0) {
        setAllActions([]);
        return;
      }

      // Sprawdź czy Firebase jest dostępne
      if (!db) {
        console.error("Firebase nie jest zainicjalizowane");
        setAllActions([]);
        return;
      }

      setIsLoadingActions(true);
      try {
        const allActionsPromises = teamMatches.map(async (match) => {
          if (!match.matchId) return [];
          
          try {
            const matchRef = doc(db!, "matches", match.matchId);
            const matchDoc = await getDoc(matchRef);
            
            if (matchDoc.exists()) {
              const matchData = matchDoc.data() as TeamInfo;
              const matchActions = matchData.actions_packing || [];
              
              // Uzupełnij dane zawodników w akcjach
              return matchActions.map(action => {
                const enrichedAction = { ...action };
                
                // Dodaj dane nadawcy
                if (action.senderId && (!action.senderName || !action.senderNumber)) {
                  const senderPlayer = players.find(p => p.id === action.senderId);
                  if (senderPlayer) {
                    enrichedAction.senderName = senderPlayer.name;
                    enrichedAction.senderNumber = senderPlayer.number;
                  }
                }
                
                // Dodaj dane odbiorcy
                if (action.receiverId && (!action.receiverName || !action.receiverNumber)) {
                  const receiverPlayer = players.find(p => p.id === action.receiverId);
                  if (receiverPlayer) {
                    enrichedAction.receiverName = receiverPlayer.name;
                    enrichedAction.receiverNumber = receiverPlayer.number;
                  }
                }
                
                return enrichedAction;
              });
            }
            return [];
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji dla meczu ${match.matchId}:`, error);
            return [];
          }
        });

        const allActionsArrays = await Promise.all(allActionsPromises);
        const flatActions = allActionsArrays.flat();
        setAllActions(flatActions);
        console.log(`Pobrano ${flatActions.length} akcji ze wszystkich meczów zespołu ${selectedTeam}`);
      } catch (error) {
        console.error("Błąd podczas pobierania akcji:", error);
        setAllActions([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadAllActionsForTeam();
  }, [teamMatches, players, selectedTeam]);

  // Filtruj zawodników według wybranego zespołu
  const filteredPlayers = useMemo(() => {
    const teamFiltered = players.filter(player => 
      player.teams && player.teams.includes(selectedTeam)
    );
    
    // Sortowanie alfabetyczne po nazwisku
    return teamFiltered.sort((a, b) => {
      // Wyciągnij nazwisko (ostatnie słowo) z pełnej nazwy
      const getLastName = (fullName: string) => {
        const words = fullName.trim().split(/\s+/);
        return words[words.length - 1].toLowerCase();
      };
      
      const lastNameA = getLastName(a.name);
      const lastNameB = getLastName(b.name);
      
      return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
    });
  }, [players, selectedTeam]);

  // Filtruj akcje według zaznaczonych meczów
  const filteredActions = useMemo(() => {
    if (selectedMatches.length === 0) return [];
    
    return allActions.filter(action => 
      action.matchId && selectedMatches.includes(action.matchId)
    );
  }, [allActions, selectedMatches]);

  // Funkcja do zapisywania zawodnika z zespołami
  const handleSavePlayerWithTeams = (playerData: Omit<Player, "id">) => {
    let teams = playerData.teams || [];
    
    if (editingPlayerId) {
      const existingPlayer = players.find(p => p.id === editingPlayerId);
      
      if (existingPlayer && !existingPlayer.teams && 'team' in existingPlayer) {
        const oldTeam = (existingPlayer as any).team;
        if (oldTeam && !teams.includes(oldTeam)) {
          teams = [...teams, oldTeam];
        }
      }
    }
    
    handleSavePlayer({
      ...playerData,
      teams: teams,
    });
  };

  const onDeletePlayer = async (playerId: string) => {
    const wasDeleted = await handleDeletePlayer(playerId);
    if (wasDeleted && selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
    }
  };

  // Obsługa zmiany zaznaczenia meczu
  const handleMatchToggle = (matchId: string) => {
    setSelectedMatches(prev => 
      prev.includes(matchId) 
        ? prev.filter(id => id !== matchId)
        : [...prev, matchId]
    );
  };

  // Obsługa zaznaczenia/odznaczenia wszystkich meczów
  const handleSelectAllMatches = () => {
    if (selectedMatches.length === teamMatches.length) {
      setSelectedMatches([]);
    } else {
      const validMatchIds = teamMatches
        .map(match => match.matchId)
        .filter((id): id is string => id !== undefined);
      setSelectedMatches(validMatchIds);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/" className={styles.backButton}>
          ← Powrót do głównej
        </Link>
        <h1>Statystyki zawodników</h1>
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

      {/* Sekcja wyboru meczów - tabela */}
      <div className={styles.matchSelector}>
        <div className={styles.matchSelectorHeader}>
          <h3>Wybierz mecze do analizy ({selectedMatches.length}/{teamMatches.length})</h3>
          <button 
            onClick={handleSelectAllMatches}
            className={styles.selectAllButton}
          >
            {selectedMatches.length === teamMatches.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
          </button>
        </div>
        
        <div className={styles.matchesTable}>
          {teamMatches.length === 0 ? (
            <p className={styles.noMatches}>Brak meczów dla wybranego zespołu</p>
          ) : (
            <>
              <div className={styles.tableHeader}>
                <div className={styles.headerCell}>Wybierz</div>
                <div className={styles.headerCell}>Przeciwnik</div>
                <div className={styles.headerCell}>Data</div>
                <div className={styles.headerCell}>Rozgrywki</div>
                <div className={styles.headerCell}>Dom/Wyjazd</div>
              </div>
              <div className={styles.tableBody}>
                {teamMatches.map(match => (
                  <div key={match.matchId || match.opponent} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <input
                        type="checkbox"
                        checked={match.matchId ? selectedMatches.includes(match.matchId) : false}
                        onChange={() => match.matchId && handleMatchToggle(match.matchId)}
                        className={styles.matchCheckbox}
                      />
                    </div>
                    <div className={styles.tableCell}>
                      <strong>{match.opponent}</strong>
                    </div>
                    <div className={styles.tableCell}>
                      {match.date}
                    </div>
                    <div className={styles.tableCell}>
                      {match.competition}
                    </div>
                    <div className={styles.tableCell}>
                      {match.isHome ? 'Dom' : 'Wyjazd'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.playersPanel}>
        <h2>Statystyki zawodników</h2>
        {isLoadingActions ? (
          <p>Ładowanie akcji...</p>
        ) : selectedMatches.length === 0 ? (
          <p>Wybierz co najmniej jeden mecz, aby zobaczyć statystyki zawodników.</p>
        ) : filteredPlayers.length === 0 ? (
          <p>Brak zawodników w wybranym zespole.</p>
        ) : (
          <div>
            <p>Pokazano statystyki z {filteredActions.length} akcji z {selectedMatches.length} meczów</p>
            <PackingChart
              actions={filteredActions}
              players={filteredPlayers}
              selectedPlayerId={selectedPlayerId}
              onPlayerSelect={setSelectedPlayerId}
              matches={teamMatches.filter(match => 
                match.matchId && selectedMatches.includes(match.matchId)
              )}
            />
          </div>
        )}
      </div>

      <PlayerModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSavePlayerWithTeams}
        editingPlayer={
          editingPlayerId
            ? players.find((p) => p.id === editingPlayerId)
            : undefined
        }
        currentTeam={selectedTeam}
        allTeams={Object.values(TEAMS)}
      />
    </div>
  );
} 