// src/app/page.tsx
"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { Tab } from "@/types";
import Instructions from "@/components/Instructions/Instructions";
import PlayersGrid from "@/components/PlayersGrid/PlayersGrid";
import Tabs from "@/components/Tabs/Tabs";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useActionsState } from "@/hooks/useActionsState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import styles from "./page.module.css";

// Dynamiczny import komponentów używanych warunkowo dla lepszej wydajności
const ActionSection = dynamic(
  () => import("@/components/ActionSection/ActionSection"),
  {
    ssr: false,
  }
);
const SummarySection = dynamic(
  () => import("@/components/SummarySection/SummarySection"),
  {
    ssr: false,
  }
);
const ActionsTable = dynamic(
  () => import("@/components/ActionsTable/ActionsTable"),
  {
    ssr: false,
  }
);
const PlayerModal = dynamic(
  () => import("@/components/PlayerModal/PlayerModal"),
  {
    ssr: false,
  }
);
const MatchInfoModal = dynamic(
  () => import("@/components/MatchInfoModal/MatchInfoModal"),
  {
    ssr: false,
  }
);
const ExportButton = dynamic(
  () => import("@/components/ExportButton/ExportButton"),
  {
    ssr: false,
  }
);
const MatchInfoHeader = dynamic(
  () => import("@/components/MatchInfoHeader/MatchInfoHeader")
);

export default function Page() {
  const [activeTab, setActiveTab] = React.useState<Tab>("packing");

  // Custom hooks
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

  const {
    matchInfo,
    isMatchModalOpen,
    setIsMatchModalOpen,
    handleSaveMatchInfo,
  } = useMatchInfo();

  const {
    actions,
    selectedPlayerId,
    selectedReceiverId,
    selectedZone,
    currentPoints,
    actionMinute,
    actionType,
    isP3Active,
    isShot,
    isGoal,
    setSelectedPlayerId,
    setSelectedReceiverId,
    setCurrentPoints,
    setActionMinute,
    setActionType,
    setIsP3Active,
    setIsShot,
    setIsGoal,
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
  } = useActionsState(players);

  useEffect(() => {
    if (!matchInfo && activeTab === "packing") {
      setIsMatchModalOpen(true);
    }
  }, [activeTab, matchInfo, setIsMatchModalOpen]);

  const onDeletePlayer = (playerId: string) => {
    const wasDeleted = handleDeletePlayer(playerId);
    if (wasDeleted && selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      resetActionState();
    }
  };

  const onSaveAction = () => {
    const canSave = handleSaveAction(matchInfo);

    if (!canSave && !matchInfo) {
      setIsMatchModalOpen(true);
    }
  };

  const onDeleteAllActions = () => {
    const wasDeleted = handleDeleteAllActions();
    if (wasDeleted) {
      setIsMatchModalOpen(true);
    }
  };

  return (
    <div className={styles.container}>
      <MatchInfoHeader
        matchInfo={matchInfo}
        onChangeMatch={() => setIsMatchModalOpen(true)}
      />

      <main className={styles.content}>
        <Instructions />
        <PlayersGrid
          players={players}
          selectedPlayerId={selectedPlayerId}
          onPlayerSelect={setSelectedPlayerId}
          onAddPlayer={() => setIsModalOpen(true)}
          onEditPlayer={handleEditPlayer}
          onDeletePlayer={onDeletePlayer}
        />

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "packing" ? (
          <>
            <ActionSection
              selectedZone={selectedZone}
              handleZoneSelect={handleZoneSelect}
              players={players}
              selectedPlayerId={selectedPlayerId}
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
              handleSaveAction={onSaveAction}
              resetActionState={resetActionState}
            />
            <ActionsTable
              actions={actions}
              onDeleteAction={handleDeleteAction}
              onDeleteAllActions={onDeleteAllActions}
            />
          </>
        ) : (
          <SummarySection
            selectedPlayerId={selectedPlayerId}
            players={players}
            actions={actions}
          />
        )}

        <PlayerModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={handleSavePlayer}
          editingPlayer={
            editingPlayerId
              ? players.find((p) => p.id === editingPlayerId)
              : undefined
          }
        />

        <MatchInfoModal
          isOpen={isMatchModalOpen}
          onClose={() => setIsMatchModalOpen(false)}
          onSave={handleSaveMatchInfo}
          currentInfo={matchInfo}
        />

        <ExportButton
          players={players}
          actions={actions}
          matchInfo={matchInfo}
        />
      </main>
    </div>
  );
}
