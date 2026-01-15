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
  onCalculateMinuteFromVideo?: () => Promise<{ minute: number; isSecondHalf: boolean } | null>;
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
  onCalculateMinuteFromVideo,
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
    isP1Active: true,
    isP2Active: false,
    isContact1: false,
    isContact2: false,
    isContact3Plus: false,
    assistantId: "",
    assistantName: "",
    isControversial: false,
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

  // Funkcja do grupowania zawodników według pozycji
  const getPlayersByPosition = (playersList: Player[]) => {
    const byPosition = playersList.reduce((acc, player) => {
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
    }, {} as Record<string, typeof playersList>);
    
    // Kolejność pozycji: GK, CB, DM, Skrzydłowi (LW/RW), AM, ST
    const positionOrder = ['GK', 'CB', 'DM', 'Skrzydłowi', 'AM', 'ST'];
    
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
    sortedPositions.forEach(position => {
      byPosition[position].sort((a, b) => {
        const getLastName = (name: string) => {
          const words = name.trim().split(/\s+/);
          return words[words.length - 1].toLowerCase();
        };
        const lastNameA = getLastName(a.name);
        const lastNameB = getLastName(b.name);
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });
    
    return { byPosition, sortedPositions };
  };

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

  // Automatycznie ustaw sugerowaną wartość minuty i połowy na podstawie czasu wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen && !editingShot && onCalculateMinuteFromVideo) {
      console.log('ShotModal: wywołuję onCalculateMinuteFromVideo');
      onCalculateMinuteFromVideo().then((result) => {
        console.log('ShotModal: wynik obliczenia:', result);
        if (result !== null && result.minute > 0) {
          setFormData(prev => ({
            ...prev,
            minute: result.minute,
            isP1Active: !result.isSecondHalf,
            isP2Active: result.isSecondHalf,
          }));
        }
      }).catch((error) => {
        console.warn('Nie udało się obliczyć minuty z wideo:', error);
      });
    }
  }, [isOpen, editingShot, onCalculateMinuteFromVideo]);

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
        pkPlayersCount: (editingShot as any)?.pkPlayersCount || 1,
        isP1Active: (editingShot as any)?.pkPlayersCount === 1 || (editingShot as any)?.pkPlayersCount === 2 ? false : true,
        isP2Active: (editingShot as any)?.pkPlayersCount === 2 || false,
        isContact1: editingShot.isContact1 || false,
        isContact2: editingShot.isContact2 || false,
        isContact3Plus: editingShot.isContact3Plus || false,
        assistantId: (editingShot as any)?.assistantId || "",
        assistantName: (editingShot as any)?.assistantName || "",
        isControversial: editingShot.isControversial || false,
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
        pkPlayersCount: 1,
        isP1Active: true,
        isP2Active: false,
        isContact1: false,
        isContact2: false,
        isContact3Plus: false,
        assistantId: "",
        assistantName: "",
        isControversial: false,
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

  const handleAssistantSelect = (playerId: string) => {
    const player = filteredPlayers.find(p => p.id === playerId);
    setFormData({
      ...formData,
      assistantId: playerId,
      assistantName: player ? `${player.firstName} ${player.lastName}` : "",
    });
  };

  const handleShotTypeSelect = (shotType: "on_target" | "off_target" | "blocked" | "goal") => {
    setFormData(prev => ({
      ...prev,
      shotType,
      blockingPlayers: shotType === "blocked" ? prev.blockingPlayers : [], // Reset jeśli nie zablokowany
      linePlayers: shotType === "blocked" ? prev.linePlayers : [], // Reset jeśli nie zablokowany
      linePlayersCount: shotType === "blocked" ? prev.linePlayersCount : 0, // Reset jeśli nie zablokowany
      pkPlayersCount: shotType === "blocked" ? prev.pkPlayersCount : 1, // Reset jeśli nie zablokowany
      isP1Active: shotType === "blocked" ? prev.isP1Active : true,
      isP2Active: shotType === "blocked" ? prev.isP2Active : false,
    }));
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
      pkPlayersCount: 1, // Reset liczby zawodników w PK
      isP1Active: true,
      isP2Active: false,
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
      pkPlayersCount: formData.isP1Active ? 1 : formData.isP2Active ? 2 : 0,
      isContact1: formData.isContact1,
      isContact2: formData.isContact2,
      isContact3Plus: formData.isContact3Plus,
      assistantId: formData.assistantId || undefined,
      assistantName: formData.assistantName || undefined,
      isControversial: formData.isControversial,
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
                <div className={styles.pkToggle}>
                  <button
                    type="button"
                    className={`${styles.pkButton} ${formData.isP1Active ? styles.activeP1 : ''}`}
                    onClick={() => setFormData({
                      ...formData,
                      isP1Active: true,
                      isP2Active: false,
                    })}
                  >
                    1P
                  </button>
                  <button
                    type="button"
                    className={`${styles.pkButton} ${formData.isP2Active ? styles.activeP2 : ''}`}
                    onClick={() => setFormData({
                      ...formData,
                      isP1Active: false,
                      isP2Active: true,
                    })}
                  >
                    2P
                  </button>
                </div>
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
          <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
            <label>
              {formData.teamContext === "attack" 
                ? "Zawodnik (atak - zielony):" 
                : "Bramkarz (obrona - czerwony):"
              }
            </label>
            <div className={styles.playersGridContainer}>
              {(() => {
                const playersToShow = formData.teamContext === "defense" ? filteredGoalkeepers : filteredPlayers;
                const playersByPosition = getPlayersByPosition(playersToShow);
                return playersByPosition.sortedPositions.map((position) => (
                  <div key={position} className={styles.positionGroup}>
                    <div className={styles.playersGrid}>
                      <div className={styles.positionLabel}>
                        {position === 'Skrzydłowi' ? 'W' : position}
                      </div>
                      <div className={styles.playersGridItems}>
                        {playersByPosition.byPosition[position].map(player => (
                          <div
                            key={player.id}
                            className={`${styles.playerTile} ${
                              formData.playerId === player.id 
                                ? (formData.teamContext === "attack" ? styles.playerAttackerTile : styles.playerDefenderTile)
                                : ''
                            }`}
                            onClick={() => handlePlayerSelect(player.id)}
                          >
                            <div className={styles.playerContent}>
                              <div className={styles.number}>{player.number}</div>
                              <div className={styles.playerInfo}>
                                <div className={styles.name}>{getPlayerFullName(player)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Zawodnicy na linii strzału (tylko w obronie) */}
          {formData.teamContext === "defense" && (
            <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
              <label>Zawodnicy na linii strzału:</label>
              <div className={styles.playersGridContainer}>
                {(() => {
                  // Filtruj bramkarzy - w obronie bramkarz nie liczy się w linii strzału
                  const playersWithoutGK = filteredPlayers.filter(player => 
                    player.position !== "GK" && player.position !== "Bramkarz"
                  );
                  const playersByPosition = getPlayersByPosition(playersWithoutGK);
                  return playersByPosition.sortedPositions.map((position) => (
                    <div key={position} className={styles.positionGroup}>
                      <div className={styles.playersGrid}>
                        <div className={styles.positionLabel}>
                          {position === 'Skrzydłowi' ? 'W' : position}
                        </div>
                        <div className={styles.playersGridItems}>
                          {playersByPosition.byPosition[position].map(player => (
                            <div
                              key={player.id}
                              className={`${styles.playerTile} ${
                                formData.linePlayers.includes(player.id) ? styles.playerLineTile : ''
                              }`}
                              onClick={() => handleLinePlayerToggle(player.id)}
                            >
                              <div className={styles.playerContent}>
                                <div className={styles.number}>{player.number}</div>
                                <div className={styles.playerInfo}>
                                  <div className={styles.name}>{getPlayerFullName(player)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}


          {/* Kategoria akcji */}
          <div className={styles.fieldGroup}>
            <label>Kategoria akcji:</label>
            <div className={styles.actionTypeSelector}>
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
            <div className={styles.actionTypeSelector}>
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
              <div className={styles.actionTypeSelector}>
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
              <div className={styles.actionTypeSelector}>
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
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.shotType === "on_target" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("on_target");
                }}
              >
                Celny
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.shotType === "off_target" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("off_target");
                }}
              >
                Niecelny
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.shotType === "blocked" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("blocked");
                }}
              >
                Zablokowany
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${styles.goalButton} ${formData.shotType === "goal" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("goal");
                }}
              >
                Gol ⚽
              </button>
            </div>
          </div>

          {/* Wybór asystenta (tylko gdy gol) */}
          {formData.shotType === "goal" && formData.teamContext === "attack" && (
            <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
              <label>Asystent:</label>
              <div className={styles.playersGridContainer}>
                <div className={styles.positionGroup}>
                  <div className={styles.playersGrid}>
                    <div className={styles.positionLabel} style={{ visibility: 'hidden' }}>
                      GK
                    </div>
                    <div className={styles.playersGridItems}>
                      <div
                        className={`${styles.playerTile} ${
                          formData.assistantId === "" ? styles.playerAttackerTile : ''
                        }`}
                        onClick={() => handleAssistantSelect("")}
                      >
                        <div className={styles.playerContent}>
                          <div className={styles.playerInfo}>
                            <div className={styles.name}>Brak asysty</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {(() => {
                  const assistantPlayers = filteredPlayers.filter(player => player.id !== formData.playerId);
                  const playersByPosition = getPlayersByPosition(assistantPlayers);
                  return playersByPosition.sortedPositions.map((position) => (
                    <div key={position} className={styles.positionGroup}>
                      <div className={styles.playersGrid}>
                        <div className={styles.positionLabel}>
                          {position === 'Skrzydłowi' ? 'W' : position}
                        </div>
                        <div className={styles.playersGridItems}>
                          {playersByPosition.byPosition[position].map(player => (
                            <div
                              key={player.id}
                              className={`${styles.playerTile} ${
                                formData.assistantId === player.id 
                                  ? styles.playerAttackerTile
                                  : ''
                              }`}
                              onClick={() => handleAssistantSelect(player.id)}
                            >
                              <div className={styles.playerContent}>
                                <div className={styles.number}>{player.number}</div>
                                <div className={styles.playerInfo}>
                                  <div className={styles.name}>{getPlayerFullName(player)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Liczba kontaktów */}
          <div className={styles.fieldGroup}>
            <label>Liczba kontaktów:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.isContact1 ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFormData(prev => {
                    const newIsContact1 = !prev.isContact1;
                    return {
                      ...prev,
                      isContact1: newIsContact1,
                      // Wyłącz inne opcje kontaktów gdy włączamy 1T
                      isContact2: newIsContact1 ? false : prev.isContact2,
                      isContact3Plus: newIsContact1 ? false : prev.isContact3Plus,
                    };
                  });
                }}
                title="Aktywuj/Dezaktywuj 1T"
                aria-pressed={formData.isContact1}
              >
                1T
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.isContact2 ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFormData(prev => {
                    const newIsContact2 = !prev.isContact2;
                    return {
                      ...prev,
                      isContact2: newIsContact2,
                      // Wyłącz inne opcje kontaktów gdy włączamy 2T
                      isContact1: newIsContact2 ? false : prev.isContact1,
                      isContact3Plus: newIsContact2 ? false : prev.isContact3Plus,
                    };
                  });
                }}
                title="Aktywuj/Dezaktywuj 2T"
                aria-pressed={formData.isContact2}
              >
                2T
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.isContact3Plus ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFormData(prev => {
                    const newIsContact3Plus = !prev.isContact3Plus;
                    return {
                      ...prev,
                      isContact3Plus: newIsContact3Plus,
                      // Wyłącz inne opcje kontaktów gdy włączamy 3T+
                      isContact1: newIsContact3Plus ? false : prev.isContact1,
                      isContact2: newIsContact3Plus ? false : prev.isContact2,
                    };
                  });
                }}
                title="Aktywuj/Dezaktywuj 3T+"
                aria-pressed={formData.isContact3Plus}
              >
                3T+
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Część ciała:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.bodyPart === "foot" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "foot"})}
              >
                Noga
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.bodyPart === "head" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "head"})}
              >
                Głowa
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.bodyPart === "other" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "other"})}
              >
                Inne
              </button>
            </div>
          </div>

          {/* Zawodnicy blokujący (tylko w obronie i gdy typ strzału to zablokowany) */}
          {formData.teamContext === "defense" && formData.shotType === "blocked" && (
            <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
              <label>Zawodnik blokujący strzał:</label>
              <div className={styles.playersGridContainer}>
                {(() => {
                  // Filtruj bramkarzy - bramkarz nie liczy się w blokowaniu strzału
                  const playersWithoutGK = filteredPlayers.filter(player => 
                    player.position !== "GK" && player.position !== "Bramkarz"
                  );
                  const playersByPosition = getPlayersByPosition(playersWithoutGK);
                  return playersByPosition.sortedPositions.map((position) => (
                    <div key={position} className={styles.positionGroup}>
                      <div className={styles.playersGrid}>
                        <div className={styles.positionLabel}>
                          {position === 'Skrzydłowi' ? 'W' : position}
                        </div>
                        <div className={styles.playersGridItems}>
                          {playersByPosition.byPosition[position].map(player => (
                            <div
                              key={player.id}
                              className={`${styles.playerTile} ${
                                formData.blockingPlayers.includes(player.id) ? styles.playerBlockingTile : ''
                              }`}
                              onClick={() => handleBlockingPlayerToggle(player.id)}
                            >
                              <div className={styles.playerContent}>
                                <div className={styles.number}>{player.number}</div>
                                <div className={styles.playerInfo}>
                                  <div className={styles.name}>{getPlayerFullName(player)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
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
            <button
              type="button"
              className={`${styles.controversyButton} ${styles.tooltipTrigger} ${formData.isControversial ? styles.controversyButtonActive : ""}`}
              onClick={() => setFormData({ ...formData, isControversial: !formData.isControversial })}
              aria-pressed={formData.isControversial}
              aria-label="Oznacz jako kontrowersja"
              data-tooltip="Sytuacja kontrowersyjna - zaznacz, aby omówić później."
            >
              !
            </button>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Anuluj
            </button>
            <div className={styles.minuteAndSave}>
              <div className={styles.minuteInput}>
                <label htmlFor="minute">Minuta:</label>
                <div className={styles.minuteControls}>
                  <button
                    type="button"
                    className={styles.minuteButton}
                    onClick={() => {
                      const newMinute = Math.max(1, formData.minute - 1);
                      setFormData({...formData, minute: newMinute});
                    }}
                    title="Zmniejsz minutę"
                  >
                    −
                  </button>
                  <input
                    id="minute"
                    type="number"
                    value={formData.minute}
                    onChange={(e) => {
                      const newMinute = parseInt(e.target.value) || 1;
                      setFormData({...formData, minute: Math.max(1, Math.min(120, newMinute))});
                    }}
                    min="1"
                    max="120"
                    className={styles.minuteField}
                    required
                  />
                  <button
                    type="button"
                    className={styles.minuteButton}
                    onClick={() => {
                      const newMinute = Math.min(120, formData.minute + 1);
                      setFormData({...formData, minute: newMinute});
                    }}
                    title="Zwiększ minutę"
                  >
                    +
                  </button>
                </div>
              </div>
              <button type="submit" className={styles.saveButton}>
                {editingShot ? "Zapisz zmiany" : "Zapisz akcję"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShotModal;

