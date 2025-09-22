"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Shot, Player, TeamInfo } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./ShotModal.module.css";

export interface ShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shot: Omit<Shot, "id" | "timestamp">) => void;
  onDelete?: (shotId: string) => void;
  editingShot?: Shot;
  x: number;
  y: number;
  xG: number;
  matchId: string;
  players: Player[];
  matchInfo?: TeamInfo | null;
}

const ShotModal: React.FC<ShotModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingShot,
  x,
  y,
  xG,
  matchId,
  players,
  matchInfo,
}) => {
  const [formData, setFormData] = useState({
    playerId: "",
    playerName: "",
    minute: 1,
    xG: 0,
    bodyPart: "foot" as "foot" | "head" | "other",
    shotType: "on_target" as "on_target" | "off_target" | "blocked" | "goal",
    teamContext: "attack" as "attack" | "defense",
    teamId: "",
    actionType: "open_play" as "open_play" | "counter" | "corner" | "free_kick" | "direct_free_kick" | "penalty" | "throw_in" | "regain",
    actionCategory: "open_play" as "open_play" | "sfg",
    sfgSubtype: "direct" as "direct" | "combination",
    actionPhase: "phase1" as "phase1" | "phase2" | "under8s" | "over8s",
    blockingPlayers: [] as string[],
    linePlayers: [] as string[],
    linePlayersCount: 0,
    pkPlayersCount: 0,
  });

  // Filtrowanie zawodników grających w danym meczu (podobnie jak w ActionModal)
  const filteredPlayers = useMemo(() => {
    if (!matchInfo) return players;

    // Filtruj zawodników należących do zespołu
    const teamPlayers = players.filter(player => 
      player.teams?.includes(matchInfo.team)
    );

    // Filtruj tylko zawodników z co najmniej 1 minutą rozegranych w tym meczu
    const playersWithMinutes = teamPlayers.filter(player => {
      const playerMinutes = matchInfo.playerMinutes?.find(pm => pm.playerId === player.id);
      
      if (!playerMinutes) {
        return false; // Jeśli brak danych o minutach, nie pokazuj zawodnika
      }

      // Oblicz czas gry
      const playTime = playerMinutes.startMinute === 0 && playerMinutes.endMinute === 0
        ? 0
        : Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute + 1);

      return playTime >= 1; // Pokazuj tylko zawodników z co najmniej 1 minutą
    });

    return playersWithMinutes;
  }, [players, matchInfo]);

  // Filtrowanie bramkarzy dla obrony
  const filteredGoalkeepers = useMemo(() => {
    if (!matchInfo || formData.teamContext !== "defense") return [];
    
    return filteredPlayers.filter(player => 
      player.position === "GK" || player.position === "Bramkarz"
    );
  }, [filteredPlayers, matchInfo, formData.teamContext]);

  // Znajdź bramkarza z największą liczbą minut
  const defaultGoalkeeper = useMemo(() => {
    if (filteredGoalkeepers.length === 0) return null;
    
    return filteredGoalkeepers.reduce((max, current) => {
      const currentMinutes = matchInfo?.playerMinutes?.find(pm => pm.playerId === current.id);
      const maxMinutes = matchInfo?.playerMinutes?.find(pm => pm.playerId === max.id);
      
      const currentTime = currentMinutes ? currentMinutes.endMinute - currentMinutes.startMinute + 1 : 0;
      const maxTime = maxMinutes ? maxMinutes.endMinute - maxMinutes.startMinute + 1 : 0;
      
      return currentTime > maxTime ? current : max;
    });
  }, [filteredGoalkeepers, matchInfo]);

  // Filtrowanie zawodników blokujących (wszyscy oprócz bramkarzy)
  const filteredBlockingPlayers = useMemo(() => {
    if (!matchInfo || formData.teamContext !== "defense") return [];
    
    return filteredPlayers.filter(player => 
      player.position !== "GK" && player.position !== "Bramkarz"
    );
  }, [filteredPlayers, matchInfo, formData.teamContext]);

  useEffect(() => {
    if (editingShot) {
      setFormData({
        playerId: editingShot.playerId || "",
        playerName: editingShot.playerName || "",
        minute: editingShot.minute,
        xG: Math.round(editingShot.xG * 100), // Konwersja z ułamka na całe procenty
        bodyPart: editingShot.bodyPart || "foot",
        shotType: editingShot.isGoal ? "goal" : (editingShot.shotType || "on_target"),
        teamContext: editingShot.teamContext || "attack",
        teamId: editingShot.teamId || "",
        actionType: editingShot.actionType || "open_play",
        actionCategory: editingShot.actionType && ["corner", "free_kick", "direct_free_kick", "penalty", "throw_in"].includes(editingShot.actionType) ? "sfg" : "open_play",
        sfgSubtype: (editingShot as any)?.sfgSubtype || "direct",
        actionPhase: (editingShot as any)?.actionPhase || (editingShot.actionType && ["corner", "free_kick", "direct_free_kick", "penalty", "throw_in"].includes(editingShot.actionType) ? "phase1" : "under8s"),
        blockingPlayers: editingShot.blockingPlayers || [],
        linePlayers: (editingShot as any)?.linePlayers || [],
        linePlayersCount: (editingShot as any)?.linePlayersCount || 0,
        pkPlayersCount: (editingShot as any)?.pkPlayersCount || 0,
      });
    } else {
      // Automatyczne wykrywanie kontekstu zespołu na podstawie pozycji
      // Lewa strona boiska (x < 50%) = obrona, prawa strona (x >= 50%) = atak
      const autoTeamContext = x < 50 ? "defense" : "attack";
      const autoTeamId = autoTeamContext === "defense" ? matchInfo?.opponent : matchInfo?.team;
      
      setFormData({
        playerId: "",
        playerName: "",
        minute: 1,
        xG: Math.round(xG * 100), // Konwersja z ułamka na całe procenty
        bodyPart: "foot",
        shotType: "on_target",
        teamContext: autoTeamContext,
        teamId: autoTeamId || "",
        actionType: "open_play",
        actionCategory: "open_play",
        sfgSubtype: "direct",
        actionPhase: "under8s",
        blockingPlayers: [],
        linePlayers: [],
        linePlayersCount: 0,
        pkPlayersCount: 0,
      });
    }
  }, [editingShot, isOpen, matchInfo, xG, x]);

  // Ustaw domyślnego bramkarza gdy zmienia się na obronę
  useEffect(() => {
    if (formData.teamContext === "defense" && defaultGoalkeeper && !formData.playerId) {
      setFormData(prev => ({
        ...prev,
        playerId: defaultGoalkeeper.id,
        playerName: `${defaultGoalkeeper.firstName} ${defaultGoalkeeper.lastName}`,
      }));
    }
  }, [formData.teamContext, defaultGoalkeeper, formData.playerId]);

  const handlePlayerSelect = (playerId: string) => {
    const player = filteredPlayers.find(p => p.id === playerId);
    setFormData({
      ...formData,
      playerId,
      playerName: player ? `${player.firstName} ${player.lastName}` : "",
    });
  };

  const handleShotTypeSelect = (shotType: "on_target" | "off_target" | "blocked" | "goal") => {
    setFormData({
      ...formData,
      shotType,
      blockingPlayers: shotType === "blocked" ? formData.blockingPlayers : [], // Reset jeśli nie zablokowany
      linePlayers: shotType === "blocked" ? formData.linePlayers : [], // Reset jeśli nie zablokowany
      linePlayersCount: shotType === "blocked" ? formData.linePlayersCount : 0, // Reset jeśli nie zablokowany
      pkPlayersCount: shotType === "blocked" ? formData.pkPlayersCount : 0, // Reset jeśli nie zablokowany
    });
  };

  const handleTeamContextChange = (teamContext: "attack" | "defense") => {
    setFormData({
      ...formData,
      teamContext,
      playerId: "", // Reset wyboru zawodnika przy zmianie kontekstu
      playerName: "",
      blockingPlayers: [], // Reset zawodników blokujących
      linePlayers: [], // Reset zawodników na linii
      linePlayersCount: 0, // Reset liczby zawodników na linii
      pkPlayersCount: 0, // Reset liczby zawodników w PK
    });
  };

  const handleBlockingPlayerToggle = (playerId: string) => {
    setFormData(prev => ({
      ...prev,
      blockingPlayers: prev.blockingPlayers.includes(playerId)
        ? [] // Usuń wybór jeśli już zaznaczony
        : [playerId] // Wybierz tylko tego zawodnika (jeden na raz)
    }));
  };

  const handleLinePlayerToggle = (playerId: string) => {
    setFormData(prev => ({
      ...prev,
      linePlayers: prev.linePlayers.includes(playerId)
        ? prev.linePlayers.filter(id => id !== playerId) // Usuń z listy
        : [...prev.linePlayers, playerId] // Dodaj do listy
    }));
  };

  // Oblicz finalny xG z uwzględnieniem zawodników na linii i SFG bezpośredni
  const calculateFinalXG = () => {
    let finalXG = formData.xG;
    
    // Każdy zawodnik na linii obniża xG o 1%
    if (formData.teamContext === "defense") {
      finalXG -= formData.linePlayers.length;
    } else if (formData.teamContext === "attack") {
      finalXG -= formData.linePlayersCount || 0;
    }
    
    // Mnożenie przez 1.65 tylko dla bezpośredni wolny + bezpośredni SFG
    if (formData.actionType === "direct_free_kick" && formData.sfgSubtype === "direct") {
      finalXG *= 1.65;
    }
    
    return Math.max(0, Math.round(finalXG)); // Minimum 0, zaokrąglij do całej liczby
  };

  const handleActionCategoryChange = (category: "open_play" | "sfg") => {
    setFormData(prev => ({
      ...prev,
      actionCategory: category,
      actionType: category === "open_play" ? "open_play" : "corner", // Reset to default for category
      actionPhase: category === "open_play" ? "under8s" : "phase1" // Reset phase based on category
    }));
  };

  const getAvailableActionTypes = (): Array<{value: string, label: string}> => {
    if (formData.actionCategory === "sfg") {
      return [
        { value: "corner", label: "Rożny" },
        { value: "free_kick", label: "Wolny" },
        { value: "direct_free_kick", label: "Bezpośredni wolny" },
        { value: "penalty", label: "Karny" },
        { value: "throw_in", label: "Rzut za autu" }
      ];
    } else {
      return [
        { value: "open_play", label: "Budowanie" },
        { value: "counter", label: "Kontra" },
        { value: "regain", label: "Regain" }
      ];
    }
  };

  const getSfgSubtypes = (): Array<{value: string, label: string}> => {
    return [
      { value: "direct", label: "Bezpośredni" },
      { value: "combination", label: "Kombinacyjny" }
    ];
  };

  const getActionPhases = (): Array<{value: string, label: string}> => {
    if (formData.actionCategory === "sfg") {
      return [
        { value: "phase1", label: "I faza" },
        { value: "phase2", label: "II faza" }
      ];
    } else {
      return [
        { value: "under8s", label: "Do 8s" },
        { value: "over8s", label: "Powyżej 8s" }
      ];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.playerId) {
      alert("Wybierz zawodnika z listy");
      return;
    }

    const finalXG = calculateFinalXG();
    
    onSave({
      x: editingShot ? editingShot.x : x,
      y: editingShot ? editingShot.y : y,
      xG: finalXG / 100, // Konwersja z procentów na ułamek
      playerId: formData.playerId,
      playerName: formData.playerName,
      minute: formData.minute,
      isGoal: formData.shotType === "goal",
      bodyPart: formData.bodyPart,
      shotType: formData.shotType === "goal" ? "on_target" : formData.shotType,
      teamContext: formData.teamContext,
      teamId: formData.teamId,
      actionType: formData.actionType,
      sfgSubtype: formData.sfgSubtype,
      actionPhase: formData.actionPhase,
      blockingPlayers: formData.blockingPlayers,
      linePlayers: formData.linePlayers,
      linePlayersCount: formData.linePlayersCount,
      pkPlayersCount: formData.pkPlayersCount,
      matchId,
    });

    onClose();
  };

  const handleDelete = () => {
    if (editingShot && onDelete) {
      if (confirm("Czy na pewno chcesz usunąć ten strzał?")) {
        onDelete(editingShot.id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{editingShot ? "Edytuj strzał" : "Dodaj strzał"}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* xG i dodatkowe pola */}
          <div className={styles.topRow}>
            <div className={styles.xgInput}>
              <label htmlFor="xg-input">xG (%):</label>
              <input
                type="number"
                id="xg-input"
                step="1"
                min="0"
                max="100"
                value={formData.xG}
                onChange={(e) => setFormData({...formData, xG: parseInt(e.target.value) || 0})}
                className={styles.input}
                required
              />
              {formData.teamContext === "attack" && (
                <div className={styles.linePlayersCountInput}>
                  <label htmlFor="line-players-count">Zawodnicy na linii strzału:</label>
                  <input
                    type="number"
                    id="line-players-count"
                    step="1"
                    min="0"
                    max="11"
                    value={formData.linePlayersCount}
                    onChange={(e) => setFormData({...formData, linePlayersCount: parseInt(e.target.value) || 0})}
                    className={styles.input}
                  />
                </div>
              )}
              <div className={styles.pkPlayersCountInput}>
                <label htmlFor="pk-players-count">Zawodnicy w PK:</label>
                <input
                  type="number"
                  id="pk-players-count"
                  step="1"
                  min="0"
                  max="11"
                  value={formData.pkPlayersCount}
                  onChange={(e) => setFormData({...formData, pkPlayersCount: parseInt(e.target.value) || 0})}
                  className={styles.input}
                />
              </div>
              <div className={styles.finalXG}>
                Finalny xG: {calculateFinalXG()}%
              </div>
            </div>
          </div>

          {/* Przełącznik atak/obrona */}
          <div className={styles.teamContextToggle}>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "attack" ? styles.active : ""}`}
              onClick={() => handleTeamContextChange("attack")}
            >
              Atak
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "defense" ? styles.active : ""}`}
              onClick={() => handleTeamContextChange("defense")}
            >
              Obrona
            </button>
          </div>

          {/* Wybór zawodnika z kafelków */}
          <div className={styles.fieldGroup}>
            <label>
              {formData.teamContext === "attack" 
                ? "Zawodnik (atak - zielony):" 
                : "Bramkarz (obrona - czerwony):"
              }
            </label>
            <div className={styles.playersGrid}>
              {(formData.teamContext === "defense" ? filteredGoalkeepers : filteredPlayers).map(player => (
                <div
                  key={player.id}
                  className={`${styles.playerTile} ${
                    formData.playerId === player.id 
                      ? (formData.teamContext === "attack" ? styles.playerAttackerTile : styles.playerDefenderTile)
                      : ''
                  } ${player.imageUrl ? styles.withImage : ''}`}
                  onClick={() => handlePlayerSelect(player.id)}
                >
                  {player.imageUrl && (
                    <>
                      <img
                        src={player.imageUrl}
                        alt=""
                        className={styles.playerTileImage}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className={styles.playerTileOverlay}></div>
                    </>
                  )}
                  <div className={styles.playerContent}>
                    <div className={styles.number}>{player.number}</div>
                    <div className={styles.playerInfo}>
                      <div className={styles.name}>{getPlayerFullName(player)}</div>
                      <div className={styles.details}>
                        {player.position && (
                          <span className={styles.position}>{player.position}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zawodnicy na linii strzału (tylko w obronie) */}
          {formData.teamContext === "defense" && (
            <div className={styles.fieldGroup}>
              <label>Zawodnicy na linii strzału:</label>
              <div className={styles.playersGrid}>
                {filteredPlayers.map(player => (
                  <div
                    key={player.id}
                    className={`${styles.playerTile} ${
                      formData.linePlayers.includes(player.id) ? styles.playerLineTile : ''
                    } ${player.imageUrl ? styles.withImage : ''}`}
                    onClick={() => handleLinePlayerToggle(player.id)}
                  >
                    {player.imageUrl && (
                      <>
                        <img
                          src={player.imageUrl}
                          alt=""
                          className={styles.playerTileImage}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className={styles.playerTileOverlay}></div>
                      </>
                    )}
                    <div className={styles.playerContent}>
                      <div className={styles.number}>{player.number}</div>
                      <div className={styles.playerInfo}>
                        <div className={styles.name}>{getPlayerFullName(player)}</div>
                        <div className={styles.details}>
                          {player.position && (
                            <span className={styles.position}>{player.position}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Kategoria akcji */}
          <div className={styles.fieldGroup}>
            <label>Kategoria akcji:</label>
            <div className={styles.actionTypeButtons}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.actionCategory === "open_play" ? styles.active : ""}`}
                onClick={() => handleActionCategoryChange("open_play")}
              >
                Otwarta gra
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.actionCategory === "sfg" ? styles.active : ""}`}
                onClick={() => handleActionCategoryChange("sfg")}
              >
                SFG
              </button>
            </div>
          </div>

          {/* Rodzaj akcji */}
          <div className={styles.fieldGroup}>
            <label>Rodzaj akcji:</label>
            <div className={styles.actionTypeButtons}>
              {getAvailableActionTypes().map((actionType) => (
                <button
                  key={actionType.value}
                  type="button"
                  className={`${styles.actionTypeButton} ${formData.actionType === actionType.value ? styles.active : ""}`}
                  onClick={() => setFormData({...formData, actionType: actionType.value as any})}
                >
                  {actionType.label}
                </button>
              ))}
            </div>
          </div>

          {/* Podrodzaj SFG */}
          {formData.actionCategory === "sfg" && formData.actionType !== "penalty" && (
            <div className={styles.fieldGroup}>
              <label>Podrodzaj SFG:</label>
              <div className={styles.actionTypeButtons}>
                {getSfgSubtypes().map((subtype) => (
                  <button
                    key={subtype.value}
                    type="button"
                    className={`${styles.actionTypeButton} ${formData.sfgSubtype === subtype.value ? styles.active : ""}`}
                    onClick={() => setFormData({...formData, sfgSubtype: subtype.value as any})}
                  >
                    {subtype.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Faza akcji */}
          {formData.actionType !== "penalty" && (
            <div className={styles.fieldGroup}>
              <label>Faza akcji:</label>
              <div className={styles.actionTypeButtons}>
                {getActionPhases().map((phase) => (
                  <button
                    key={phase.value}
                    type="button"
                    className={`${styles.actionTypeButton} ${formData.actionPhase === phase.value ? styles.active : ""}`}
                    onClick={() => setFormData({...formData, actionPhase: phase.value as any})}
                  >
                    {phase.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Typ strzału w jednej linii */}
          <div className={styles.fieldGroup}>
            <label>Typ strzału:</label>
            <div className={styles.shotTypeButtons}>
              <button
                type="button"
                className={`${styles.shotTypeButton} ${formData.shotType === "on_target" ? styles.active : ""}`}
                onClick={() => handleShotTypeSelect("on_target")}
              >
                Celny
              </button>
              <button
                type="button"
                className={`${styles.shotTypeButton} ${formData.shotType === "off_target" ? styles.active : ""}`}
                onClick={() => handleShotTypeSelect("off_target")}
              >
                Niecelny
              </button>
              <button
                type="button"
                className={`${styles.shotTypeButton} ${formData.shotType === "blocked" ? styles.active : ""}`}
                onClick={() => handleShotTypeSelect("blocked")}
              >
                Zablokowany
              </button>
              <button
                type="button"
                className={`${styles.shotTypeButton} ${styles.goalButton} ${formData.shotType === "goal" ? styles.active : ""}`}
                onClick={() => handleShotTypeSelect("goal")}
              >
                Gol ⚽
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Część ciała:</label>
            <div className={styles.bodyPartButtons}>
              <button
                type="button"
                className={`${styles.bodyPartButton} ${formData.bodyPart === "foot" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "foot"})}
              >
                Noga
              </button>
              <button
                type="button"
                className={`${styles.bodyPartButton} ${formData.bodyPart === "head" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "head"})}
              >
                Głowa
              </button>
              <button
                type="button"
                className={`${styles.bodyPartButton} ${formData.bodyPart === "other" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "other"})}
              >
                Inne
              </button>
            </div>
          </div>

          {/* Zawodnicy blokujący (tylko w obronie i gdy typ strzału to zablokowany) */}
          {formData.teamContext === "defense" && formData.shotType === "blocked" && (
            <div className={styles.fieldGroup}>
              <label>Zawodnik blokujący strzał:</label>
              <div className={styles.playersGrid}>
                {filteredPlayers.map(player => (
                  <div
                    key={player.id}
                    className={`${styles.playerTile} ${
                      formData.blockingPlayers.includes(player.id) ? styles.playerBlockingTile : ''
                    } ${player.imageUrl ? styles.withImage : ''}`}
                    onClick={() => handleBlockingPlayerToggle(player.id)}
                  >
                    {player.imageUrl && (
                      <>
                        <img
                          src={player.imageUrl}
                          alt=""
                          className={styles.playerTileImage}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className={styles.playerTileOverlay}></div>
                      </>
                    )}
                    <div className={styles.playerContent}>
                      <div className={styles.number}>{player.number}</div>
                      <div className={styles.playerInfo}>
                        <div className={styles.name}>{getPlayerFullName(player)}</div>
                        <div className={styles.details}>
                          {player.position && (
                            <span className={styles.position}>{player.position}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.buttonGroup}>
            {editingShot && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={styles.deleteButton}
              >
                Usuń strzał
              </button>
            )}
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Anuluj
            </button>
            <div className={styles.minuteAndSave}>
              <div className={styles.minuteInput}>
                <label htmlFor="minute">Minuta:</label>
                <input
                  type="number"
                  id="minute"
                  min="1"
                  max="120"
                  value={formData.minute}
                  onChange={(e) => setFormData({...formData, minute: parseInt(e.target.value)})}
                  className={styles.input}
                  required
                />
              </div>
              <button type="submit" className={styles.saveButton}>
                {editingShot ? "Zapisz zmiany" : "Dodaj strzał"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShotModal;

