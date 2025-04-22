// components/ActionSection/ActionSection.tsx
"use client";

import React, { memo, useEffect } from "react";
import FootballPitch from "../FootballPitch/FootballPitch";
import ActionModal from "../ActionModal/ActionModal";
import styles from "./ActionSection.module.css";
import { Player } from "@/types";

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
  isP3Active: boolean;
  setIsP3Active: React.Dispatch<React.SetStateAction<boolean>>;
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
  startZone: number | null;
  endZone: number | null;
  isActionModalOpen: boolean;
  setIsActionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  isP3Active,
  setIsP3Active,
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
  startZone,
  endZone,
  isActionModalOpen,
  setIsActionModalOpen,
}: ActionSectionProps) {
  // Dodajemy efekt, który będzie monitorował wartości stref
  useEffect(() => {
    if (isActionModalOpen) {
      console.log("ActionSection: Modal otwarty, aktualne strefy:", { startZone, endZone });
    }
  }, [isActionModalOpen, startZone, endZone]);

  const handleAddPoints = (points: number) => {
    setCurrentPoints((prev) => prev + points);
  };

  const handleP3Toggle = () => {
    setIsP3Active((prevState) => !prevState);
  };

  const handleSecondHalfToggle = (value: boolean) => {
    console.log("ActionSection - zmiana połowy na:", value ? "P2" : "P1", "poprzednia wartość:", isSecondHalf);
    
    // Zapisujemy również w localStorage dla spójności w całej aplikacji
    localStorage.setItem('currentHalf', value ? 'P2' : 'P1');
    
    // Aktualizujemy stan w komponencie nadrzędnym
    setIsSecondHalf(value);
    
    // Dodatkowe sprawdzenie
    setTimeout(() => {
      const storedValue = localStorage.getItem('currentHalf');
      console.log("ActionSection - po zmianie, wartość w localStorage:", storedValue);
    }, 50);
  };

  // Modyfikujemy funkcję obsługującą zapisywanie akcji
  const handleSaveActionWrapper = () => {
    console.log("ActionSection: handleSaveActionWrapper wywołane, wartości stref:", { startZone, endZone });
    
    // Dodatkowe sprawdzenie stref przed zapisem
    if (startZone === null || startZone === undefined) {
      console.error("ActionSection: Brak strefy początkowej - nie można zapisać akcji");
      alert("Wybierz strefę początkową akcji!");
      return;
    }

    if (endZone === null || endZone === undefined) {
      console.error("ActionSection: Brak strefy końcowej - nie można zapisać akcji");
      alert("Wybierz strefę końcową akcji!");
      return;
    }
    
    // Jeśli obie strefy są zdefiniowane, wywołaj funkcję zapisu
    handleSaveAction();
  };

  const handlePitchZoneSelect = (zone: number | null, xT?: number, value1?: number, value2?: number) => {
    if (zone !== null) {
      console.log("ActionSection: handlePitchZoneSelect wywołane z:", { zone, xT });
      
      // Wywołujemy funkcję handleZoneSelect w komponencie nadrzędnym
      const result = handleZoneSelect(zone, xT, value1, value2);
      
      // Po zaktualizowaniu stref, sprawdzamy czy ActionModal powinien zostać otwarty
      // Jest to dodatkowe zabezpieczenie, gdyby w handleZoneSelect nie działało otwieranie modalu
      setTimeout(() => {
        if (startZone !== null && endZone !== null && !isActionModalOpen) {
          console.log("ActionSection: Wykryto obie strefy ustawione, można otworzyć ActionModal", {
            startZone,
            endZone
          });
        }
      }, 100);
      
      return result;
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
          console.log("ActionSection: Zamykanie modalu akcji");
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
        isP3Active={isP3Active}
        onP3Toggle={handleP3Toggle}
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
      />
    </section>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ActionSection.displayName = "ActionSection";

export default ActionSection;
