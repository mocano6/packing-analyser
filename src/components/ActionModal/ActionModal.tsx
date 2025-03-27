"use client";

import React, { useState } from "react";
import styles from "./ActionModal.module.css";
import { Player } from "@/types";
import ActionTypeToggle from "../ActionTypeToggle/ActionTypeToggle";
import { ACTION_BUTTONS } from "../PointsButtons/constants";
import PlayerCard from "./PlayerCard";

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  selectedPlayerId: string | null;
  selectedReceiverId: string | null;
  onSenderSelect: (id: string | null) => void;
  onReceiverSelect: (id: string | null) => void;
  actionMinute: number;
  onMinuteChange: (minute: number) => void;
  actionType: "pass" | "dribble";
  onActionTypeChange: (type: "pass" | "dribble") => void;
  currentPoints: number;
  onAddPoints: (points: number) => void;
  isP3Active: boolean;
  onP3Toggle: () => void;
  isShot: boolean;
  onShotToggle: (checked: boolean) => void;
  isGoal: boolean;
  onGoalToggle: (checked: boolean) => void;
  isPenaltyAreaEntry: boolean;
  onPenaltyAreaEntryToggle: (checked: boolean) => void;
  onSaveAction: () => void;
  onReset: () => void;
}

const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  players,
  selectedPlayerId,
  selectedReceiverId,
  onSenderSelect,
  onReceiverSelect,
  actionMinute,
  onMinuteChange,
  actionType,
  onActionTypeChange,
  currentPoints,
  onAddPoints,
  isP3Active,
  onP3Toggle,
  isShot,
  onShotToggle,
  isGoal,
  onGoalToggle,
  isPenaltyAreaEntry,
  onPenaltyAreaEntryToggle,
  onSaveAction,
  onReset,
}) => {
  if (!isOpen) return null;

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onMinuteChange(parseInt(e.target.value) || 0);
  };

  const handleActionTypeChange = (type: "pass" | "dribble") => {
    onActionTypeChange(type);
    
    // Jeśli zmieniamy na drybling, usuwamy odbiorcę
    if (type === "dribble" && selectedReceiverId) {
      onReceiverSelect(null);
    }
  };

  const handlePlayerClick = (playerId: string) => {
    // Cykliczny wybór: zawodnik podający -> zawodnik przyjmujący -> usunięcie wyboru
    
    if (actionType === "dribble") {
      // Dla dryblingu - umożliwiamy zaznaczenie i odznaczenie zawodnika
      if (playerId === selectedPlayerId) {
        // Jeśli klikamy na już zaznaczonego zawodnika, odznaczamy go
        onSenderSelect(null);
      } else {
        // W przeciwnym razie zaznaczamy nowego zawodnika
        onSenderSelect(playerId);
      }
      
      // Upewniamy się, że nie ma odbiorcy przy dryblingu
      if (selectedReceiverId) {
        onReceiverSelect(null);
      }
    } else {
      // Dla podania implementujemy cykliczny wybór
      
      // Przypadek 1: Kliknięty zawodnik jest obecnie podającym - usuwamy go
      if (playerId === selectedPlayerId) {
        onSenderSelect(null);
        return;
      }
      
      // Przypadek 2: Kliknięty zawodnik jest obecnie przyjmującym - usuwamy go 
      if (playerId === selectedReceiverId) {
        onReceiverSelect(null);
        return;
      }
      
      // Przypadek 3: Nie mamy jeszcze podającego - ustawiamy go
      if (!selectedPlayerId) {
        onSenderSelect(playerId);
        return;
      }
      
      // Przypadek 4: Mamy podającego, ale nie mamy przyjmującego - ustawiamy go
      if (selectedPlayerId && !selectedReceiverId) {
        onReceiverSelect(playerId);
        return;
      }
      
      // Przypadek 5: Mamy obu i klikamy na nowego - zmieniamy podającego
      onSenderSelect(playerId);
      onReceiverSelect(null);
    }
  };

  const handlePointsAdd = (points: number) => {
    onAddPoints(points);
  };

  const handleShotToggle = () => {
    onShotToggle(!isShot);
  };

  const handleGoalToggle = () => {
    onGoalToggle(!isGoal);
  };

  const handlePenaltyAreaEntryToggle = () => {
    onPenaltyAreaEntryToggle(!isPenaltyAreaEntry);
  };

  const handleSave = () => {
    onSaveAction();
    onClose();
  };

  const handleCancel = () => {
    onReset();
    onClose();
  };

  const handleReset = () => {
    // Zapisz aktualną wartość minuty
    const currentMinute = actionMinute;
    
    // Zresetuj tylko częściowo - selektor punktów, przełączniki P3, strzał, bramka, wejście w PK
    onReset();
    
    // Przywróć zapisaną wartość minuty
    onMinuteChange(currentMinute);
  };

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Dodaj akcję</h2>
        <div className={styles.form}>
          {/* Typ akcji */}
          <div className={styles.formGroup}>
            <label>Typ akcji:</label>
            <ActionTypeToggle
              actionType={actionType}
              onActionTypeChange={handleActionTypeChange}
            />
          </div>

          {/* Lista zawodników */}
          <div className={styles.formGroup}>
            <label className={styles.playerTitle}>
              {actionType === "dribble" ? "Wybierz zawodnika dryblującego:" : "Wybierz zawodników:"}
            </label>
            <div className={styles.playersGrid}>
              {players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isSender={actionType === "pass" ? player.id === selectedPlayerId : false}
                  isReceiver={actionType === "pass" ? player.id === selectedReceiverId : false}
                  isDribbler={actionType === "dribble" ? player.id === selectedPlayerId : false}
                  onSelect={handlePlayerClick}
                />
              ))}
            </div>
          </div>

          {/* Wyświetlanie punktów */}
          <div className={styles.pointsDisplay}>
            <span className={styles.pointsLabel}>Punkty:</span>
            <span className={styles.pointsValue}>{currentPoints}</span>
          </div>

          {/* Przyciski punktów */}
          <div className={styles.buttonsGrid}>
            {ACTION_BUTTONS.map((button, index) =>
              button.type === "toggle" ? (
                <button
                  key={index}
                  className={`${styles.actionButton} ${
                    isP3Active ? styles.activeButton : ""
                  }`}
                  onClick={onP3Toggle}
                  title={button.description}
                  aria-pressed={isP3Active}
                  type="button"
                >
                  <span className={styles.buttonLabel}>{button.label}</span>
                  <span className={styles.buttonDescription}>
                    {button.description}
                  </span>
                </button>
              ) : (
                <button
                  key={index}
                  className={styles.actionButton}
                  onClick={() => handlePointsAdd(button.points)}
                  title={button.description}
                  type="button"
                >
                  <span className={styles.buttonLabel}>{button.label}</span>
                  <span className={styles.buttonDescription}>
                    {button.description}
                  </span>
                </button>
              )
            )}

            {/* Przycisk "Wejście w PK" */}
            <button
              className={`${styles.actionButton} ${
                isPenaltyAreaEntry ? styles.activeButton : ""
              }`}
              onClick={handlePenaltyAreaEntryToggle}
              aria-pressed={isPenaltyAreaEntry}
              type="button"
            >
              <span className={styles.buttonLabel}>Wejście w PK</span>
              <span className={styles.buttonDescription}>
                Zaznacz jeśli akcja zakończyła się wejściem w pole karne
              </span>
            </button>

            {/* Przycisk "Strzał" */}
            <button
              className={`${styles.actionButton} ${
                isShot ? styles.activeButton : ""
              }`}
              onClick={handleShotToggle}
              aria-pressed={isShot}
              type="button"
            >
              <span className={styles.buttonLabel}>Strzał</span>
              <span className={styles.buttonDescription}>
                Zaznacz jeśli akcja zakończyła się strzałem
              </span>
            </button>

            {/* Przycisk "Bramka" */}
            <button
              className={`${styles.actionButton} ${
                isGoal ? styles.activeButton : ""
              }`}
              onClick={handleGoalToggle}
              disabled={!isShot}
              aria-pressed={isGoal}
              aria-disabled={!isShot}
              type="button"
              style={{
                opacity: !isShot ? 0.5 : 1,
                cursor: !isShot ? "not-allowed" : "pointer",
              }}
            >
              <span className={styles.buttonLabel}>Bramka</span>
              <span className={styles.buttonDescription}>
                Zaznacz jeśli strzał zakończył się bramką
              </span>
            </button>
          </div>

          {/* Przyciski kontrolne z polem minuty pomiędzy */}
          <div className={styles.controlButtons}>
            <button
              className={`${styles.controlButton} ${styles.resetButton}`}
              onClick={handleCancel}
              type="button"
            >
              Anuluj
            </button>
            
            <button
              className={`${styles.controlButton} ${styles.clearButton}`}
              onClick={handleReset}
              type="button"
            >
              ⌫ Resetuj
            </button>
            
            <div className={styles.minuteInput}>
              <label htmlFor="action-minute-modal">Minuta:</label>
              <input
                id="action-minute-modal"
                type="number"
                value={actionMinute}
                onChange={handleMinuteChange}
                min="0"
                max="130"
              />
            </div>
            
            <button
              className={`${styles.controlButton} ${styles.saveButton}`}
              onClick={handleSave}
              type="button"
            >
              Zapisz akcję
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionModal; 