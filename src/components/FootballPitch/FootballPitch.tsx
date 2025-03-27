// components/FootballPitch/FootballPitch.tsx
"use client";

import React, { useState, useCallback, memo } from "react";
import styles from "./FootballPitch.module.css";
import { XT_VALUES } from "./constants";
import ZoneCell from "./ZoneCell";
import ActionModal from "../ActionModal/ActionModal";
import { Player } from "@/types";

export interface FootballPitchProps {
  selectedZone: number | null;
  onZoneSelect: (
    zone: number | null,
    xT?: number,
    value1?: number,
    value2?: number
  ) => void;
  players: Player[];
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
  selectedReceiverId: string | null;
  setSelectedReceiverId: (id: string | null) => void;
  actionMinute: number;
  setActionMinute: (minute: number) => void;
  actionType: "pass" | "dribble";
  setActionType: (type: "pass" | "dribble") => void;
  currentPoints: number;
  setCurrentPoints: React.Dispatch<React.SetStateAction<number>>;
  isP3Active: boolean;
  setIsP3Active: React.Dispatch<React.SetStateAction<boolean>>;
  isShot: boolean;
  setIsShot: React.Dispatch<React.SetStateAction<boolean>>;
  isGoal: boolean;
  setIsGoal: React.Dispatch<React.SetStateAction<boolean>>;
  isPenaltyAreaEntry: boolean;
  setIsPenaltyAreaEntry: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveAction: () => void;
  resetActionState: () => void;
}

const FootballPitch = memo(function FootballPitch({
  selectedZone,
  onZoneSelect,
  players,
  selectedPlayerId,
  setSelectedPlayerId,
  selectedReceiverId,
  setSelectedReceiverId,
  actionMinute,
  setActionMinute,
  actionType,
  setActionType,
  currentPoints,
  setCurrentPoints,
  isP3Active,
  setIsP3Active,
  isShot,
  setIsShot,
  isGoal,
  setIsGoal,
  isPenaltyAreaEntry,
  setIsPenaltyAreaEntry,
  handleSaveAction,
  resetActionState,
}: FootballPitchProps) {
  const [firstClickZone, setFirstClickZone] = useState<number | null>(null);
  const [secondClickZone, setSecondClickZone] = useState<number | null>(null);
  const [firstClickValue, setFirstClickValue] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Callback do obsługi dodawania punktów
  const handleAddPoints = useCallback(
    (points: number) => {
      setCurrentPoints((prev) => prev + points);
    },
    [setCurrentPoints]
  );

  // Callback do przełączania P3
  const handleP3Toggle = useCallback(() => {
    setIsP3Active((prev) => !prev);
  }, [setIsP3Active]);

  // Callback do przełączania strzału
  const handleShotToggle = useCallback(
    (checked: boolean) => {
      setIsShot(checked);
      if (!checked) setIsGoal(false); // Jeśli odznaczamy strzał, odznaczamy też bramkę
    },
    [setIsShot, setIsGoal]
  );

  // Callback do przełączania bramki
  const handleGoalToggle = useCallback(
    (checked: boolean) => {
      setIsGoal(checked);
      if (checked) setIsShot(true); // Jeśli zaznaczamy bramkę, zaznaczamy też strzał
    },
    [setIsGoal, setIsShot]
  );

  // Callback do przełączania wejścia w pole karne
  const handlePenaltyAreaEntryToggle = useCallback(
    (checked: boolean) => {
      setIsPenaltyAreaEntry(checked);
    },
    [setIsPenaltyAreaEntry]
  );

  const handleZoneClick = useCallback(
    (zoneIndex: number) => {
      const row = Math.floor(zoneIndex / 12);
      const col = zoneIndex % 12;
      const clickedValue = XT_VALUES[row][col];

      if (!firstClickZone) {
        // Pierwszy klik - podanie
        setFirstClickZone(zoneIndex);
        setFirstClickValue(clickedValue);
        setActionType("pass"); // Ustawiamy typ akcji na podanie
        onZoneSelect(zoneIndex, 0, clickedValue, undefined); // Punkty zawsze zaczynają od 0
      } else if (!secondClickZone && zoneIndex !== firstClickZone) {
        // Drugi klik - przyjęcie
        setSecondClickZone(zoneIndex);
        if (firstClickValue !== null) {
          // Nie obliczamy różnicy - punkty zostają na 0
          onZoneSelect(zoneIndex, 0, firstClickValue, clickedValue); // Punkty zawsze zaczynają od 0
          setIsModalOpen(true); // Otwieramy modal po drugim kliknięciu
        }
      } else {
        // Reset i nowy pierwszy klik
        setSecondClickZone(null);
        setFirstClickZone(zoneIndex);
        setFirstClickValue(clickedValue);
        setActionType("pass"); // Ustawiamy typ akcji na podanie
        onZoneSelect(zoneIndex, 0, clickedValue, undefined); // Punkty zawsze zaczynają od 0
      }
    },
    [firstClickZone, secondClickZone, firstClickValue, onZoneSelect, setActionType]
  );

  // Funkcja zamykająca modal i resetująca stan
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setFirstClickZone(null);
    setSecondClickZone(null);
    setFirstClickValue(null);
  }, []);

  // Funkcja obsługująca zapisanie akcji
  const handleSaveActionAndClose = useCallback(() => {
    handleSaveAction();
    setIsModalOpen(false);
    setFirstClickZone(null);
    setSecondClickZone(null);
    setFirstClickValue(null);
  }, [handleSaveAction]);

  // Rozszerzony resetActionState, który czyści również stany kliknięć
  const handleResetState = useCallback(() => {
    // Resetujemy stany kliknięć
    setFirstClickZone(null);
    setSecondClickZone(null);
    setFirstClickValue(null);
    
    // Wywołujemy oryginalną funkcję resetującą
    resetActionState();
  }, [resetActionState]);

  // Resetowanie stanu tylko w modalu - zachowujemy wartości kliknięć
  const handleModalReset = useCallback(() => {
    // Resetujemy tylko częściowo, zachowując wartości kliknięć
    setCurrentPoints(0);
    setIsP3Active(false);
    setIsShot(false);
    setIsGoal(false);
    setIsPenaltyAreaEntry(false);
  }, [setCurrentPoints, setIsP3Active, setIsShot, setIsGoal, setIsPenaltyAreaEntry]);

  // Memoizujemy tablicę komórek, aby uniknąć zbędnego renderowania
  const cells = React.useMemo(
    () =>
      Array.from({ length: 96 }, (_, index) => {
        const row = Math.floor(index / 12);
        const col = index % 12;
        const xTValue = XT_VALUES[row][col];

        return (
          <ZoneCell
            key={index}
            zoneIndex={index}
            xTValue={xTValue}
            isSelected={selectedZone === index}
            isFirstSelection={firstClickZone === index}
            isSecondSelection={secondClickZone === index}
            onSelect={handleZoneClick}
          />
        );
      }),
    [selectedZone, firstClickZone, secondClickZone, handleZoneClick]
  );

  return (
    <>
      <div className={styles.pitchContainer}>
        <div
          className={styles.pitch}
          role="grid"
          aria-label="Boisko piłkarskie podzielone na strefy"
        >
          <div className={styles.grid}>{cells}</div>
          <div className={styles.pitchLines} aria-hidden="true">
            <div className={styles.centerLine} />
            <div className={styles.centerCircle} />
            <div className={styles.penaltyAreaLeft} />
            <div className={styles.goalAreaLeft} />
            <div className={styles.penaltyAreaRight} />
            <div className={styles.goalAreaRight} />
          </div>
        </div>
      </div>

      <ActionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        players={players}
        selectedPlayerId={selectedPlayerId}
        selectedReceiverId={selectedReceiverId}
        onSenderSelect={setSelectedPlayerId}
        onReceiverSelect={setSelectedReceiverId}
        actionMinute={actionMinute}
        onMinuteChange={setActionMinute}
        actionType={actionType}
        onActionTypeChange={setActionType}
        currentPoints={currentPoints}
        onAddPoints={handleAddPoints}
        isP3Active={isP3Active}
        onP3Toggle={handleP3Toggle}
        isShot={isShot}
        onShotToggle={handleShotToggle}
        isGoal={isGoal}
        onGoalToggle={handleGoalToggle}
        isPenaltyAreaEntry={isPenaltyAreaEntry}
        onPenaltyAreaEntryToggle={handlePenaltyAreaEntryToggle}
        onSaveAction={handleSaveActionAndClose}
        onReset={handleModalReset}
      />
    </>
  );
});

// Dla łatwiejszego debugowania w React DevTools
FootballPitch.displayName = "FootballPitch";

export default FootballPitch;
