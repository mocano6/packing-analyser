"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { PlayerMinutesModalProps, PlayerMinutes } from "@/types";
import styles from "./PlayerMinutesModal.module.css";
import { POSITIONS, getDefaultPosition } from "@/constants/positions";
import { TEAMS } from "@/constants/teams";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import { parseLaczyMatchIdFromUrl } from "@/utils/laczyTeamUrl";
import {
  applyLnpMinutesToRoster,
  pickLnpMatchSquadSide,
  squadForSide,
  type LnpMatchMinutesPayload,
} from "@/utils/lnpMatchMinutes";

const lnpMatchUrlStorageKey = (matchId: string) => `player_minutes_lnp_match_url_${matchId}`;

const PlayerMinutesModal: React.FC<PlayerMinutesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  match,
  players,
  currentPlayerMinutes = [],
}) => {
  const [playerMinutes, setPlayerMinutes] = useState<PlayerMinutes[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lnpMatchUrl, setLnpMatchUrl] = useState("");
  const [isFetchingLnp, setIsFetchingLnp] = useState(false);
  const [lnpError, setLnpError] = useState<string | null>(null);
  const [lnpInfo, setLnpInfo] = useState<string | null>(null);
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);
  const matchStorageId = match.matchId || `${match.team}_${match.date}_${match.opponent}`;

  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    // Znajdź zespół w obiekcie TEAMS
    const team = Object.values(TEAMS).find(team => team.id === teamId);
    return team ? team.name : teamId; // Jeśli nie znaleziono, zwróć ID jako fallback
  };

  // Inicjalizacja stanu przy otwarciu modalu
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
      setLnpError(null);
      setLnpInfo(null);
      setIsFetchingLnp(false);
      return;
    }

    if (!initialized) {
      const teamPlayers = players.filter(player => 
        player.teams && player.teams.includes(match.team)
      );
      
      // Jeśli mamy zapisane minuty, używamy ich bezpośrednio
      if (currentPlayerMinutes && currentPlayerMinutes.length > 0) {
        // Filtrujemy tylko minuty dla zawodników z aktualnego zespołu
        const filteredMinutes = currentPlayerMinutes.filter(pm => 
          teamPlayers.some(player => player.id === pm.playerId)
        );
        
        // Dodajemy brakujących zawodników z domyślnymi wartościami
        const missingPlayers = teamPlayers.filter(player => 
          !filteredMinutes.some(pm => pm.playerId === player.id)
        ).map(player => ({
            playerId: player.id,
          startMinute: 0,
          endMinute: 0,
          position: getDefaultPosition(player.position),
          status: 'dostepny' as const
        }));

        setPlayerMinutes([...filteredMinutes, ...missingPlayers]);
      } else {
        // Jeśli nie mamy zapisanych minut, inicjalizujemy domyślne wartości
        const initialPlayerMinutes = teamPlayers.map(player => ({
          playerId: player.id,
          startMinute: 0,
          endMinute: 0,
          position: getDefaultPosition(player.position),
          status: 'dostepny' as const
          }));
      setPlayerMinutes(initialPlayerMinutes);
      }
      
      setInitialized(true);
    }
  }, [isOpen, players, currentPlayerMinutes, match.team, initialized]);

  useEffect(() => {
    if (!isOpen) return;
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(lnpMatchUrlStorageKey(matchStorageId)) || ""
        : "";
    setLnpMatchUrl(saved);
  }, [isOpen, matchStorageId]);

  const handleFetchLnpMinutes = useCallback(async () => {
    const matchId = parseLaczyMatchIdFromUrl(lnpMatchUrl);
    if (!matchId) {
      setLnpError("Wklej link do meczu ŁNP (…/rozgrywki/mecz/…) albo UUID.");
      setLnpInfo(null);
      return;
    }
    setIsFetchingLnp(true);
    setLnpError(null);
    setLnpInfo(null);
    try {
      const res = await fetch("/api/microcycle/match-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lnpMatchUrl.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        payload?: LnpMatchMinutesPayload | null;
      };
      if (!res.ok || !data.ok || !data.payload) {
        setLnpError(data.error || data.message || "Nie udało się pobrać minut z ŁNP.");
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(lnpMatchUrlStorageKey(matchStorageId), lnpMatchUrl.trim());
      }
      const teamPlayers = players.filter(
        (player) => player.teams && player.teams.includes(match.team)
      );
      const side = pickLnpMatchSquadSide(data.payload, teamPlayers, {
        isHome: match.isHome,
        opponent: match.opponent,
      });
      const applied = applyLnpMinutesToRoster(
        playerMinutes,
        teamPlayers,
        squadForSide(data.payload, side)
      );
      setPlayerMinutes(applied.next);
      const sideLabel = side === "host" ? data.payload.hostName : data.payload.guestName;
      if (applied.matched === 0) {
        setLnpError(
          `Nie udało się dopasować składu ${sideLabel} do kadry LOOKBALL (sprawdź imiona i nazwiska).`
        );
        return;
      }
      const unmatched =
        applied.unmatchedLnpNames.length > 0
          ? ` Nie dopasowano: ${applied.unmatchedLnpNames.slice(0, 6).join(", ")}${
              applied.unmatchedLnpNames.length > 6 ? "…" : ""
            }.`
          : "";
      setLnpInfo(`Dopasowano ${applied.matched} zawodnik(ów) ze składu ${sideLabel}.${unmatched}`);
    } catch (e) {
      setLnpError(e instanceof Error ? e.message : "Błąd sieci podczas pobierania minut z ŁNP.");
    } finally {
      setIsFetchingLnp(false);
    }
  }, [
    lnpMatchUrl,
    matchStorageId,
    players,
    match.team,
    match.isHome,
    match.opponent,
    playerMinutes,
  ]);

  // Aktualizacja minut konkretnego zawodnika
  const handleMinuteChange = (
    playerId: string, 
    field: 'startMinute' | 'endMinute', 
    value: number
  ) => {
    const minValue = 0;
    const newValue = Math.max(minValue, Math.min(130, value));
    
    setPlayerMinutes(prev => 
      prev.map(pm => 
        pm.playerId === playerId 
          ? { ...pm, [field]: newValue } 
          : pm
      )
    );
  };

  // Aktualizacja pozycji konkretnego zawodnika
  const handlePositionChange = (
    playerId: string,
    position: string
  ) => {
    setPlayerMinutes(prev => 
      prev.map(pm => 
        pm.playerId === playerId 
          ? { ...pm, position } 
          : pm
      )
    );
  };

  // Aktualizacja statusu zawodnika (z automatycznym zerowaniem minut)
  const handleStatusChange = (playerId: string, status: 'dostepny' | 'kontuzja' | 'brak_powolania' | 'inny_zespol') => {
    setPlayerMinutes(prev => 
      prev.map(pm => 
        pm.playerId === playerId 
          ? { 
              ...pm, 
              status,
              // Automatycznie zeruj minuty jeśli zawodnik nie jest dostępny
              startMinute: status !== 'dostepny' ? 0 : pm.startMinute,
              endMinute: status !== 'dostepny' ? 0 : pm.endMinute
            }
          : pm
      )
    );
  };

  // Obliczenie czasu gry zawodnika na podstawie przedziału minut
  const calculatePlayTime = (startMinute: number, endMinute: number) => {
    if (startMinute === 0 && endMinute === 0) {
      return 0;
    }
    return Math.max(0, endMinute - startMinute + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    // Sprawdź, czy wartości są poprawne
    const validPlayerMinutes = playerMinutes.filter(pm => 
      pm.startMinute >= 0 &&
      pm.endMinute >= pm.startMinute && 
      pm.endMinute <= 130
    );
    
    // Czekamy na zapis i zamykamy modal dopiero po sukcesie (bez "fałszywego sukcesu").
    setIsSaving(true);
    try {
      const result = await onSave(validPlayerMinutes);
      if (result === null || result === false) {
        throw new Error("Zapis minut nie powiódł się.");
      }
      onClose();
    } catch (error) {
      console.error("Błąd podczas zapisywania minut zawodników:", error);
      alert("Nie udało się zapisać minut zawodników. Spróbuj ponownie.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Filtruj i grupuj graczy z wybranego zespołu według pozycji
  const teamPlayersByPosition = useMemo(() => {
    const teamPlayers = players.filter(player => 
      player.teams && player.teams.includes(match.team)
    );
    
    // Grupuj według pozycji - łączymy LW i RW w jedną grupę
    const byPosition = teamPlayers.reduce((acc, player) => {
      let position = player.position || 'Brak pozycji';
      
      // Łączymy LW i RW w jedną grupę "Skrzydłowi"
      if (position === 'LW' || position === 'RW') {
        position = 'Skrzydłowi';
      }
      
      if (!acc[position]) {
        acc[position] = [];
      }
      acc[position].push(player);
      return acc;
    }, {} as Record<string, typeof teamPlayers>);
    
    // Kolejność pozycji: jak przy dodawaniu zawodnika (LW/RW razem jako skrzydłowi)
    const positionOrder = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'Skrzydłowi', 'AM', 'ST'];
    
    // Sortuj pozycje według określonej kolejności
    const sortedPositions = Object.keys(byPosition).sort((a, b) => {
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
      byPosition[position].sort((a, b) => {
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
        
        const getLastName = (fullName: string) => {
          const words = fullName.trim().split(/\s+/);
          return words[words.length - 1].toLowerCase();
        };
        const lastNameA = getLastName(a.name || `${a.firstName} ${a.lastName}`);
        const lastNameB = getLastName(b.name || `${b.firstName} ${b.lastName}`);
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });
    
    return { byPosition, sortedPositions };
  }, [players, match.team]);

  return (
    <div className={styles.modalOverlay} onClick={isSaving || isFetchingLnp ? undefined : onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              Minuty zawodników: {getTeamName(match.team)} vs {match.opponent}
            </h2>
            <p className={styles.modalSubtitle}>
              Wpisz czas rozpoczęcia i zakończenia gry albo pobierz skład z Łączy Nas Piłka.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Zamknij"
            title="Zamknij"
            disabled={isSaving || isFetchingLnp}
          >
            ×
          </button>
        </div>
        
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.lnpFetchBar}>
            <label className={styles.lnpFetchLabel} htmlFor="lnp-match-url">
              Mecz ŁNP
            </label>
            <input
              id="lnp-match-url"
              type="text"
              className={styles.lnpUrlInput}
              value={lnpMatchUrl}
              onChange={(e) => setLnpMatchUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!isFetchingLnp && !isSaving) void handleFetchLnpMinutes();
                }
              }}
              placeholder="https://www.laczynaspilka.pl/rozgrywki/mecz/…"
              disabled={isFetchingLnp || isSaving}
              aria-label="Link do meczu z Łączy Nas Piłka"
            />
            <button
              type="button"
              className={styles.lnpFetchButton}
              onClick={() => void handleFetchLnpMinutes()}
              disabled={isFetchingLnp || isSaving}
              aria-busy={isFetchingLnp}
            >
              {isFetchingLnp ? "Pobieranie…" : "Pobierz z ŁNP"}
            </button>
          </div>
          {lnpError ? (
            <p className={styles.lnpError} role="alert">
              {lnpError}
            </p>
          ) : null}
          {lnpInfo ? (
            <p className={styles.lnpInfo} role="status">
              {lnpInfo}
            </p>
          ) : null}
          <div className={styles.tableHeader}>
            <div className={styles.headerCell}>Zawodnik</div>
            <div className={styles.headerCell}>Pozycja</div>
            <div className={styles.headerCell}>Od</div>
            <div className={styles.headerCell}>Do</div>
            <div className={styles.headerCell}>Status</div>
            <div className={styles.headerCell}>Czas gry</div>
          </div>
          <div className={styles.playersList}>
            {teamPlayersByPosition.sortedPositions.map(position => {
              const positionPlayers = teamPlayersByPosition.byPosition[position];
              
              return (
                <div key={position} className={styles.positionGroup}>
                  <div className={styles.positionGroupHeader}>
                    {position === 'Skrzydłowi' ? 'W' : position}
                  </div>
                  <div className={styles.positionGroupContent}>
                    {positionPlayers.map(player => {
              // Znajdź zapisane minuty dla tego zawodnika
              const minutes = playerMinutes.find(pm => pm.playerId === player.id) || {
                playerId: player.id,
                startMinute: 0,
                endMinute: 0,
                position: player.position || "CB", // Domyślna pozycja z danych zawodnika
                status: 'dostepny' as const
              };
              
              const playTime = calculatePlayTime(minutes.startMinute, minutes.endMinute);
              
              return (
                <div key={player.id} className={styles.playerRow}>
                      <div className={styles.playerName}>
                        <span className={styles.playerNumber}>{player.number}</span>
                        <span>{getPlayerLabel(player.id, playersIndex)}</span>
                        {player.isTestPlayer && (
                          <span className={styles.testPlayerBadge}>T</span>
                        )}
                      </div>
                      <div className={styles.positionInput}>
                        <select
                          value={minutes.position || getDefaultPosition(player.position)}
                          onChange={(e) => handlePositionChange(
                            player.id,
                            e.target.value
                          )}
                          className={styles.positionSelect}
                        >
                          {POSITIONS.map(pos => (
                            <option key={pos.value} value={pos.value}>
                              {pos.value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.timeInput}>
                        <input
                          type="number"
                          min="0"
                          max="130"
                          value={minutes.startMinute}
                          onChange={(e) => handleMinuteChange(
                            player.id, 
                            'startMinute', 
                            parseInt(e.target.value) || 0
                          )}
                          className={styles.numberInput}
                          disabled={minutes.status === 'kontuzja' || minutes.status === 'brak_powolania' || minutes.status === 'inny_zespol'}
                        />
                      </div>
                      <div className={styles.timeInput}>
                        <input
                          type="number"
                          min="0"
                          max="130"
                          value={minutes.endMinute}
                          onChange={(e) => handleMinuteChange(
                            player.id, 
                            'endMinute', 
                            parseInt(e.target.value) || 0
                          )}
                          className={styles.numberInput}
                          disabled={minutes.status === 'kontuzja' || minutes.status === 'brak_powolania' || minutes.status === 'inny_zespol'}
                        />
                      </div>
                      <div className={styles.statusInput}>
                        <select
                          value={minutes.status || 'dostepny'}
                          onChange={(e) => handleStatusChange(
                            player.id,
                            e.target.value as 'dostepny' | 'kontuzja' | 'brak_powolania' | 'inny_zespol'
                          )}
                          className={styles.statusSelect}
                        >
                          <option value="dostepny">Dostępny</option>
                          <option value="kontuzja">Kontuzja</option>
                          <option value="brak_powolania">Brak powołania</option>
                          <option value="inny_zespol">Inny zespół</option>
                        </select>
                      </div>
                      <div className={styles.playTime}>
                        {playTime} min
                      </div>
                    </div>
                  );
                })}
                  </div>
                </div>
              );
            })}

            {teamPlayersByPosition.sortedPositions.length === 0 && (
              <div className={styles.noPlayers}>
                Brak zawodników przypisanych do zespołu {getTeamName(match.team)}
              </div>
            )}
          </div>
          
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSaving || isFetchingLnp}
            >
              Anuluj
            </button>
            <button type="submit" className={styles.saveButton} disabled={isSaving || isFetchingLnp}>
              {isSaving ? "Zapisywanie…" : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerMinutesModal; 