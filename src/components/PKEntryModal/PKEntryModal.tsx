"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PKEntry, Player, TeamInfo } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./PKEntryModal.module.css";

export interface PKEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<PKEntry, "id" | "timestamp">) => void;
  onDelete?: (entryId: string) => void;
  editingEntry?: PKEntry;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  matchId: string;
  players: Player[];
  matchInfo?: TeamInfo | null;
}

const PKEntryModal: React.FC<PKEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingEntry,
  startX,
  startY,
  endX,
  endY,
  matchId,
  players,
  matchInfo,
}) => {
  const [formData, setFormData] = useState({
    senderId: "",
    senderName: "",
    receiverId: "",
    receiverName: "",
    minute: 1,
    isSecondHalf: false,
    entryType: "pass" as "pass" | "dribble" | "sfg" | "regain",
    teamContext: "attack" as "attack" | "defense",
  });

  // Filtrowanie zawodników grających w danym meczu (podobnie jak w ShotModal)
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

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        senderId: editingEntry.senderId || "",
        senderName: editingEntry.senderName || "",
        receiverId: editingEntry.receiverId || "",
        receiverName: editingEntry.receiverName || "",
        minute: editingEntry.minute,
        isSecondHalf: editingEntry.isSecondHalf,
        entryType: editingEntry.entryType || "pass",
        teamContext: editingEntry.teamContext || "attack",
      });
    } else {
      // Pobierz aktualną połowę z localStorage
      const savedHalf = typeof window !== 'undefined' ? localStorage.getItem('currentHalf') : null;
      const isP2 = savedHalf === 'P2';
      
      // Automatyczne wykrywanie kontekstu zespołu na podstawie pozycji
      // Lewa strona boiska (startX < 50%) = obrona, prawa strona (startX >= 50%) = atak
      const autoTeamContext = startX < 50 ? "defense" : "attack";
      
      setFormData({
        senderId: "",
        senderName: "",
        receiverId: "",
        receiverName: "",
        minute: 1,
        isSecondHalf: isP2,
        entryType: "pass",
        teamContext: autoTeamContext,
      });
    }
  }, [editingEntry, isOpen, startX]);

  const handlePlayerClick = (playerId: string) => {
    const player = filteredPlayers.find(p => p.id === playerId);
    const playerName = player ? `${player.firstName} ${player.lastName}` : "";
    
    // Dla dryblingu - tylko jeden zawodnik (sender)
    if (formData.entryType === "dribble") {
      if (playerId === formData.senderId) {
        // Jeśli klikamy na już zaznaczonego zawodnika, odznaczamy go
        setFormData({
          ...formData,
          senderId: "",
          senderName: "",
        });
      } else {
        // W przeciwnym razie zaznaczamy nowego zawodnika jako sender
        setFormData({
          ...formData,
          senderId: playerId,
          senderName: playerName,
          receiverId: "", // Upewniamy się, że nie ma odbiorcy przy dryblingu
          receiverName: "",
        });
      }
      return;
    }
    
    // Dla podania i SFG - zawsze dwóch zawodników
    if (formData.entryType === "pass" || formData.entryType === "sfg") {
      // Przypadek 1: Kliknięty zawodnik jest obecnie podającym - usuwamy go
      if (playerId === formData.senderId) {
        setFormData({
          ...formData,
          senderId: "",
          senderName: "",
        });
        return;
      }
      
      // Przypadek 2: Kliknięty zawodnik jest obecnie przyjmującym - usuwamy go
      if (playerId === formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: "",
          receiverName: "",
        });
        return;
      }
      
      // Przypadek 3: Nie mamy jeszcze podającego - ustawiamy go
      if (!formData.senderId) {
        setFormData({
          ...formData,
          senderId: playerId,
          senderName: playerName,
        });
        return;
      }
      
      // Przypadek 4: Mamy podającego, ale nie mamy przyjmującego - ustawiamy go
      if (formData.senderId && !formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: playerId,
          receiverName: playerName,
        });
        return;
      }
      
      // Przypadek 5: Mamy obu zawodników - zamieniamy podającego
      setFormData({
        ...formData,
        senderId: playerId,
        senderName: playerName,
        receiverId: "",
        receiverName: "",
      });
      return;
    }
    
    // Dla regain - może być jeden lub dwóch zawodników
    if (formData.entryType === "regain") {
      // Przypadek 1: Kliknięty zawodnik jest obecnie podającym - usuwamy go
      if (playerId === formData.senderId) {
        setFormData({
          ...formData,
          senderId: formData.receiverId || "",
          senderName: formData.receiverName || "",
          receiverId: "",
          receiverName: "",
        });
        return;
      }
      
      // Przypadek 2: Kliknięty zawodnik jest obecnie przyjmującym - usuwamy go
      if (playerId === formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: "",
          receiverName: "",
        });
        return;
      }
      
      // Przypadek 3: Nie mamy jeszcze podającego - ustawiamy go
      if (!formData.senderId) {
        setFormData({
          ...formData,
          senderId: playerId,
          senderName: playerName,
        });
        return;
      }
      
      // Przypadek 4: Mamy podającego, ale nie mamy przyjmującego - ustawiamy go jako otrzymującego
      if (formData.senderId && !formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: playerId,
          receiverName: playerName,
        });
        return;
      }
      
      // Przypadek 5: Mamy obu zawodników - zamieniamy podającego
      setFormData({
        ...formData,
        senderId: playerId,
        senderName: playerName,
        receiverId: "",
        receiverName: "",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Walidacja w zależności od typu akcji
    if (!formData.senderId || formData.senderId.trim() === "") {
      alert("Wybierz zawodnika podającego z listy");
      return;
    }
    
    // Dla podania i SFG wymagamy dwóch zawodników
    if (formData.entryType === "pass" || formData.entryType === "sfg") {
      if (!formData.receiverId || formData.receiverId.trim() === "") {
        alert("Wybierz zawodnika otrzymującego z listy");
        return;
      }
    }
    
    // Dla dryblingu i regain - receiverId jest opcjonalne
    // Jeśli jest pusty string, ustawiamy na undefined
    const receiverId = formData.receiverId && formData.receiverId.trim() !== "" 
      ? formData.receiverId 
      : undefined;
    const receiverName = formData.receiverName && formData.receiverName.trim() !== "" 
      ? formData.receiverName 
      : undefined;

    // Dla dryblingu - upewniamy się, że nie ma odbiorcy
    if (formData.entryType === "dribble") {
      onSave({
        matchId,
        teamId: matchInfo?.team || "",
        startX: editingEntry ? editingEntry.startX : startX,
        startY: editingEntry ? editingEntry.startY : startY,
        endX: editingEntry ? editingEntry.endX : endX,
        endY: editingEntry ? editingEntry.endY : endY,
        minute: formData.minute,
        isSecondHalf: formData.isSecondHalf,
        senderId: formData.senderId,
        senderName: formData.senderName,
        receiverId: undefined,
        receiverName: undefined,
        entryType: formData.entryType,
        teamContext: formData.teamContext,
      });
    } else {
      // Dla pozostałych typów (pass, sfg, regain)
      onSave({
        matchId,
        teamId: matchInfo?.team || "",
        startX: editingEntry ? editingEntry.startX : startX,
        startY: editingEntry ? editingEntry.startY : startY,
        endX: editingEntry ? editingEntry.endX : endX,
        endY: editingEntry ? editingEntry.endY : endY,
        minute: formData.minute,
        isSecondHalf: formData.isSecondHalf,
        senderId: formData.senderId,
        senderName: formData.senderName,
        receiverId: receiverId,
        receiverName: receiverName,
        entryType: formData.entryType,
        teamContext: formData.teamContext,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (editingEntry && onDelete) {
      if (confirm("Czy na pewno chcesz usunąć to wejście PK?")) {
        onDelete(editingEntry.id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{editingEntry ? "Edytuj wejście PK" : "Dodaj wejście PK"}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Przełącznik atak/obrona */}
          <div className={styles.teamContextToggle}>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "attack" ? styles.active : ""}`}
              onClick={() => setFormData({...formData, teamContext: "attack"})}
            >
              Atak
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "defense" ? styles.active : ""}`}
              onClick={() => setFormData({...formData, teamContext: "defense"})}
            >
              Obrona
            </button>
          </div>

          {/* Przełącznik połowy */}
          <div className={styles.teamContextToggle}>
            <button
              type="button"
              className={`${styles.toggleButton} ${!formData.isSecondHalf ? styles.active : ""}`}
              onClick={() => setFormData({...formData, isSecondHalf: false})}
            >
              P1
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.isSecondHalf ? styles.active : ""}`}
              onClick={() => setFormData({...formData, isSecondHalf: true})}
            >
              P2
            </button>
          </div>

          {/* Typ akcji - kolor strzałki */}
          <div className={styles.fieldGroup}>
            <label>Typ akcji:</label>
            <div className={styles.actionTypeButtons}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "pass" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "pass",
                  receiverId: formData.receiverId || "", // Zachowaj odbiorcę jeśli istnieje
                  receiverName: formData.receiverName || "",
                })}
                style={formData.entryType === "pass" ? { borderColor: "#ef4444", background: "#ef4444", color: "white" } : {}}
              >
                Podanie
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "dribble" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "dribble",
                  receiverId: "", // Usuń odbiorcę przy dryblingu
                  receiverName: "",
                })}
                style={formData.entryType === "dribble" ? { borderColor: "#1e40af", background: "#1e40af", color: "white" } : {}}
              >
                Drybling
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "sfg" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "sfg",
                  receiverId: formData.receiverId || "", // Zachowaj odbiorcę jeśli istnieje
                  receiverName: formData.receiverName || "",
                })}
                style={formData.entryType === "sfg" ? { borderColor: "#10b981", background: "#10b981", color: "white" } : {}}
              >
                SFG
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "regain" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "regain",
                  receiverId: formData.receiverId || "", // Zachowaj odbiorcę jeśli istnieje (opcjonalny)
                  receiverName: formData.receiverName || "",
                })}
                style={formData.entryType === "regain" ? { borderColor: "#f59e0b", background: "#f59e0b", color: "white" } : {}}
              >
                Regain
              </button>
            </div>
          </div>

          {/* Lista zawodników - jedna lista z zielonym i czerwonym obramowaniem */}
          <div className={styles.fieldGroup}>
            <label className={styles.playerTitle}>
              {formData.entryType === "dribble" 
                ? "Wybierz zawodnika dryblującego:" 
                : formData.entryType === "regain"
                ? "Wybierz zawodników (regain - może być jeden lub dwóch):"
                : "Wybierz zawodników:"
              }
            </label>
            <div className={styles.playerSelectionInfo}>
              {formData.entryType === "dribble" ? (
                <p>Kliknij, aby wybrać zawodnika dryblującego.</p>
              ) : formData.entryType === "regain" ? (
                <p>Kliknij, aby wybrać zawodnika podającego (zielone obramowanie). Opcjonalnie kliknij drugi raz, aby wybrać zawodnika otrzymującego (czerwone obramowanie).</p>
              ) : (
                <p>Kliknij, aby wybrać zawodnika podającego (zielone obramowanie), następnie kliknij drugi raz, aby wybrać zawodnika otrzymującego (czerwone obramowanie).</p>
              )}
            </div>
            <div className={styles.playersGrid}>
              {filteredPlayers.map(player => (
                <div
                  key={player.id}
                  className={`${styles.playerTile} ${
                    formData.senderId === player.id 
                      ? styles.playerSenderTile
                      : formData.receiverId === player.id
                      ? styles.playerReceiverTile
                      : ''
                  } ${player.imageUrl ? styles.withImage : ''}`}
                  onClick={() => handlePlayerClick(player.id)}
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

          <div className={styles.buttonGroup}>
            {editingEntry && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={styles.deleteButton}
              >
                Usuń wejście
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
                  onChange={(e) => setFormData({...formData, minute: parseInt(e.target.value) || 1})}
                  className={styles.input}
                  required
                />
              </div>
              <button type="submit" className={styles.saveButton}>
                {editingEntry ? "Zapisz zmiany" : "Dodaj wejście"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PKEntryModal;
