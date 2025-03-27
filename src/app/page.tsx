// src/app/page.tsx
"use client";

import React, { useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { Tab, Player, TeamInfo, PlayerMinutes } from "@/types";
import Instructions from "@/components/Instructions/Instructions";
import PlayersGrid from "@/components/PlayersGrid/PlayersGrid";
import Tabs from "@/components/Tabs/Tabs";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useActionsState } from "@/hooks/useActionsState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { TEAMS } from "@/constants/teams";
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
const PlayerMinutesModal = dynamic(
  () => import("@/components/PlayerMinutesModal/PlayerMinutesModal"),
  {
    ssr: false,
  }
);

export default function Page() {
  const [activeTab, setActiveTab] = React.useState<Tab>("packing");
  const [selectedTeam, setSelectedTeam] = React.useState<string>("Rezerwy");
  const [isPlayerMinutesModalOpen, setIsPlayerMinutesModalOpen] = React.useState(false);
  const [editingMatch, setEditingMatch] = React.useState<TeamInfo | null>(null);

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
    allMatches,
    isMatchModalOpen,
    setIsMatchModalOpen,
    handleSaveMatchInfo,
    handleSelectMatch,
    handleDeleteMatch,
    handleSavePlayerMinutes
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

  const filteredPlayers = useMemo(() => {
    // Filtruj graczy na podstawie wybranego zespołu
    return players.filter(player => {
      return player.teams && player.teams.includes(selectedTeam);
    });
  }, [players, selectedTeam]);

  // Funkcja do zapisywania zawodnika
  const handleSavePlayerWithTeams = (playerData: Omit<Player, "id">) => {
    // Upewnij się, że teams jest tablicą (dla wstecznej kompatybilności)
    let teams = playerData.teams || [];
    
    // Jeśli edytujemy istniejącego zawodnika
    if (editingPlayerId) {
      const existingPlayer = players.find(p => p.id === editingPlayerId);
      
      // Dla wstecznej kompatybilności: jeśli zawodnik miał pojedynczy team zamiast tablicy teams
      if (existingPlayer && !existingPlayer.teams && 'team' in existingPlayer) {
        const oldTeam = (existingPlayer as any).team;
        if (oldTeam && !teams.includes(oldTeam)) {
          teams = [...teams, oldTeam];
        }
      }
    }
    
    handleSavePlayer({
      ...playerData,
      teams: teams,
    });
  };

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

  // Obsługa otwarcia modalu minut zawodników
  const handleOpenPlayerMinutesModal = (match: TeamInfo) => {
    setEditingMatch(match);
    setIsPlayerMinutesModalOpen(true);
  };

  // Obsługa zapisywania minut zawodników
  const handleSaveMinutes = (playerMinutes: PlayerMinutes[]) => {
    if (editingMatch) {
      handleSavePlayerMinutes(editingMatch, playerMinutes);
    }
    setIsPlayerMinutesModalOpen(false);
    setEditingMatch(null);
  };

  return (
    <div className={styles.container}>
        <Instructions />
      <MatchInfoHeader
        matchInfo={matchInfo}
        onChangeMatch={() => setIsMatchModalOpen(true)}
        allMatches={allMatches}
        onSelectMatch={handleSelectMatch}
        onDeleteMatch={handleDeleteMatch}
        selectedTeam={selectedTeam}
        onChangeTeam={setSelectedTeam}
        onManagePlayerMinutes={handleOpenPlayerMinutesModal}
      />

      <main className={styles.content}>
        <PlayersGrid
          players={filteredPlayers}
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
              players={filteredPlayers}
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
            players={filteredPlayers}
            actions={actions}
          />
        )}

        <PlayerModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={handleSavePlayerWithTeams}
          editingPlayer={
            editingPlayerId
              ? players.find((p) => p.id === editingPlayerId)
              : undefined
          }
          currentTeam={selectedTeam}
          allTeams={TEAMS}
        />

        <MatchInfoModal
          isOpen={isMatchModalOpen}
          onClose={() => setIsMatchModalOpen(false)}
          onSave={handleSaveMatchInfo}
          currentInfo={matchInfo}
        />

        {/* Modal minut zawodników */}
        {editingMatch && (
          <PlayerMinutesModal
            isOpen={isPlayerMinutesModalOpen}
            onClose={() => {
              setIsPlayerMinutesModalOpen(false);
              setEditingMatch(null);
            }}
            onSave={handleSaveMinutes}
            match={editingMatch}
            players={players}
            currentPlayerMinutes={editingMatch.playerMinutes}
          />
        )}

        <ExportButton
          players={players}
          actions={actions}
          matchInfo={matchInfo}
        />
      </main>
    </div>
  );
}
