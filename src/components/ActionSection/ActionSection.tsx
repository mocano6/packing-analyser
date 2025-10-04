// components/ActionSection/ActionSection.tsx
"use client";

import React, { memo, useEffect } from "react";
import FootballPitch from "../FootballPitch/FootballPitch";
import ActionModal from "../ActionModal/ActionModal";
import styles from "./ActionSection.module.css";
import { Player, TeamInfo } from "@/types";

export interface ActionSectionProps {
  selectedZone: string | number | null;
  handleZoneSelect: (
    zone: number,
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
  isP1Active: boolean;
  setIsP1Active: React.Dispatch<React.SetStateAction<boolean>>;
  isP2Active: boolean;
  setIsP2Active: React.Dispatch<React.SetStateAction<boolean>>;
  isP3Active: boolean;
  setIsP3Active: React.Dispatch<React.SetStateAction<boolean>>;
  isContact1Active: boolean;
  setIsContact1Active: React.Dispatch<React.SetStateAction<boolean>>;
  isContact2Active: boolean;
  setIsContact2Active: React.Dispatch<React.SetStateAction<boolean>>;
  isContact3PlusActive: boolean;
  setIsContact3PlusActive: React.Dispatch<React.SetStateAction<boolean>>;
  isShot: boolean;
  setIsShot: React.Dispatch<React.SetStateAction<boolean>>;
  isGoal: boolean;
  setIsGoal: React.Dispatch<React.SetStateAction<boolean>>;
  isPenaltyAreaEntry: boolean;
  setIsPenaltyAreaEntry: React.Dispatch<React.SetStateAction<boolean>>;
  isSecondHalf: boolean;
  setIsSecondHalf: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveAction: () => void;
  resetActionState: () => void;
  resetActionPoints: () => void;
  startZone: number | null;
  endZone: number | null;
  isActionModalOpen: boolean;
  setIsActionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  matchInfo?: TeamInfo | null;
  // Nowe propsy dla trybu unpacking
  mode?: "attack" | "defense";
  onModeChange?: (mode: "attack" | "defense") => void;
  selectedDefensePlayers?: string[];
  onDefensePlayersChange?: (playerIds: string[]) => void;
}

const ActionSection = memo(function ActionSection({
  selectedZone,
  handleZoneSelect,
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
  isP1Active,
  setIsP1Active,
  isP2Active,
  setIsP2Active,
  isP3Active,
  setIsP3Active,
  isContact1Active,
  setIsContact1Active,
  isContact2Active,
  setIsContact2Active,
  isContact3PlusActive,
  setIsContact3PlusActive,
  isShot,
  setIsShot,
  isGoal,
  setIsGoal,
  isPenaltyAreaEntry,
  setIsPenaltyAreaEntry,
  isSecondHalf,
  setIsSecondHalf,
  handleSaveAction,
  resetActionState,
  resetActionPoints,
  startZone,
  endZone,
  isActionModalOpen,
  setIsActionModalOpen,
  matchInfo,
  // Nowe propsy dla trybu unpacking
  mode = "attack",
  onModeChange,
  selectedDefensePlayers = [],
  onDefensePlayersChange,
}: ActionSectionProps) {
  // Dodajemy efekt, który będzie monitorował wartości stref
  useEffect(() => {
    if (isActionModalOpen) {

    }
  }, [isActionModalOpen, startZone, endZone]);

  const handleAddPoints = (points: number) => {
    setCurrentPoints((prev) => prev + points);
  };


  const handleSecondHalfToggle = (value: boolean) => {
    // Zapisujemy również w localStorage dla spójności w całej aplikacji
    localStorage.setItem('currentHalf', value ? 'P2' : 'P1');
    
    // Aktualizujemy stan w komponencie nadrzędnym
    setIsSecondHalf(value);
  };

  // Modyfikujemy funkcję obsługującą zapisywanie akcji
  const handleSaveActionWrapper = () => {
    // Dodatkowe sprawdzenie stref przed zapisem
    if (startZone === null || startZone === undefined) {
      alert("Wybierz strefę początkową akcji!");
      return;
    }

    if (endZone === null || endZone === undefined) {
      alert("Wybierz strefę końcową akcji!");
      return;
    }
    
    // Jeśli obie strefy są zdefiniowane, wywołaj funkcję zapisu
    handleSaveAction();
  };

  const handlePitchZoneSelect = (zone: number | null, xT?: number, value1?: number, value2?: number) => {
    if (zone !== null) {
      // Wywołujemy funkcję handleZoneSelect w komponencie nadrzędnym
      return handleZoneSelect(zone, xT, value1, value2);
    }
  };

  return (
    <section className={styles.actionContainer}>
      <FootballPitch
        selectedZone={selectedZone}
        onZoneSelect={handlePitchZoneSelect}
        startZone={startZone}
        endZone={endZone}
      />
      
      <ActionModal
        isOpen={isActionModalOpen}
        onClose={() => {
          setIsActionModalOpen(false);
          resetActionState();
        }}
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
        isP1Active={isP1Active}
        onP1Toggle={() => {
          setIsP1Active(!isP1Active);
          if (!isP1Active) {
            setIsP2Active(false);
            setIsP3Active(false);
          }
        }}
        isP2Active={isP2Active}
        onP2Toggle={() => {
          setIsP2Active(!isP2Active);
          if (!isP2Active) {
            setIsP1Active(false);
            setIsP3Active(false);
          }
        }}
        isP3Active={isP3Active}
        onP3Toggle={() => {
          setIsP3Active(!isP3Active);
          if (!isP3Active) {
            setIsP1Active(false);
            setIsP2Active(false);
          }
        }}
        isContact1Active={isContact1Active}
        onContact1Toggle={() => {
          setIsContact1Active(!isContact1Active);
          if (!isContact1Active) {
            setIsContact2Active(false);
            setIsContact3PlusActive(false);
          }
        }}
        isContact2Active={isContact2Active}
        onContact2Toggle={() => {
          setIsContact2Active(!isContact2Active);
          if (!isContact2Active) {
            setIsContact1Active(false);
            setIsContact3PlusActive(false);
          }
        }}
        isContact3PlusActive={isContact3PlusActive}
        onContact3PlusToggle={() => {
          setIsContact3PlusActive(!isContact3PlusActive);
          if (!isContact3PlusActive) {
            setIsContact1Active(false);
            setIsContact2Active(false);
          }
        }}
        isShot={isShot}
        onShotToggle={setIsShot}
        isGoal={isGoal}
        onGoalToggle={setIsGoal}
        isPenaltyAreaEntry={isPenaltyAreaEntry}
        onPenaltyAreaEntryToggle={setIsPenaltyAreaEntry}
        isSecondHalf={isSecondHalf}
        onSecondHalfToggle={handleSecondHalfToggle}
        onSaveAction={handleSaveActionWrapper}
        onReset={resetActionState}
        onResetPoints={resetActionPoints}
        matchInfo={matchInfo}
        // Nowe propsy dla trybu unpacking
        mode={mode}
        onModeChange={onModeChange}
        selectedDefensePlayers={selectedDefensePlayers}
        onDefensePlayersChange={onDefensePlayersChange}
      />
    </section>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ActionSection.displayName = "ActionSection";

export default ActionSection;
