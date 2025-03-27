// components/ActionSection/ActionSection.tsx
"use client";

import React, { memo } from "react";
import FootballPitch from "../FootballPitch/FootballPitch";
import styles from "./ActionSection.module.css";
import { Player } from "@/types";

export interface ActionSectionProps {
  selectedZone: number | null;
  handleZoneSelect: (
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
  handleSaveAction,
  resetActionState,
}: ActionSectionProps) {
  return (
    <section className={styles.actionContainer}>
      <FootballPitch
        selectedZone={selectedZone}
        onZoneSelect={handleZoneSelect}
        players={players}
        selectedPlayerId={selectedPlayerId}
        setSelectedPlayerId={setSelectedPlayerId}
        selectedReceiverId={selectedReceiverId}
        setSelectedReceiverId={setSelectedReceiverId}
        actionMinute={actionMinute}
        setActionMinute={setActionMinute}
        actionType={actionType}
        setActionType={setActionType}
        currentPoints={currentPoints}
        setCurrentPoints={setCurrentPoints}
        isP3Active={isP3Active}
        setIsP3Active={setIsP3Active}
        isShot={isShot}
        setIsShot={setIsShot}
        isGoal={isGoal}
        setIsGoal={setIsGoal}
        isPenaltyAreaEntry={isPenaltyAreaEntry}
        setIsPenaltyAreaEntry={setIsPenaltyAreaEntry}
        handleSaveAction={handleSaveAction}
        resetActionState={resetActionState}
      />
    </section>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ActionSection.displayName = "ActionSection";

export default ActionSection;
