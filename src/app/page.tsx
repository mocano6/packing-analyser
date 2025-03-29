// src/app/page.tsx
"use client";

import React, { useMemo, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Tab, Player, TeamInfo, PlayerMinutes, Action } from "@/types";
import Instructions from "@/components/Instructions/Instructions";
import PlayersGrid from "@/components/PlayersGrid/PlayersGrid";
import Tabs from "@/components/Tabs/Tabs";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useActionsState } from "@/hooks/useActionsState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { TEAMS } from "@/constants/teams";
import { getXTValueFromMatrix } from "@/constants/xtValues";
import styles from "./page.module.css";
import OfflineStatus from '@/components/OfflineStatus/OfflineStatus';

// Dynamiczny import komponentów używanych warunkowo dla lepszej wydajności
const ActionSection = dynamic(
  () => import("@/components/ActionSection/ActionSection"),
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
const ImportButton = dynamic(
  () => import("@/components/ImportButton/ImportButton"),
  { ssr: false }
);

export default function Page() {
  const [activeTab, setActiveTab] = React.useState<Tab>("packing");
  const [selectedTeam, setSelectedTeam] = React.useState<string>(TEAMS.REZERWY.id);
  const [isPlayerMinutesModalOpen, setIsPlayerMinutesModalOpen] = React.useState(false);
  const [editingMatch, setEditingMatch] = React.useState<TeamInfo | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false);
  const [startZone, setStartZone] = React.useState<number | null>(null);
  const [endZone, setEndZone] = React.useState<number | null>(null);
  const [isNewMatchModalOpen, setIsNewMatchModalOpen] = React.useState(false);
  const [isSecondHalf, setIsSecondHalf] = React.useState(false);

  const useActionsStateRef = useRef<any>(null);

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
    isPenaltyAreaEntry,
    setSelectedPlayerId,
    setSelectedReceiverId,
    setCurrentPoints,
    setActionMinute,
    setActionType,
    setIsP3Active,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState: hookResetActionState,
  } = useActionsState(players, matchInfo);

  const filteredPlayers = useMemo(() => {
    // Filtruj graczy na podstawie wybranego zespołu
    return players.filter(player => {
      return player.teams && player.teams.includes(selectedTeam);
    });
  }, [players, selectedTeam]);

  React.useEffect(() => {
    // Sprawdzamy, czy w localStorage jest zapisana wartość połowy
    const savedHalf = localStorage.getItem('currentHalf');
    if (savedHalf) {
      const isP2 = savedHalf === 'P2';
      console.log(`page.tsx: Wczytano wartość połowy z localStorage: ${savedHalf}`);
      setIsSecondHalf(isP2);
    }
  }, []);

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

  const onDeletePlayer = async (playerId: string) => {
    const wasDeleted = await handleDeletePlayer(playerId);
    if (wasDeleted && selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      resetActionState();
    }
  };

  // Funkcja przygotowująca strefy do zapisu akcji
  const prepareZonesForAction = () => {
    console.log("prepareZonesForAction - wartości wejściowe:", { startZone, endZone });
    
    if (!startZone || !endZone) {
      console.error("Brak wartości startZone lub endZone!");
      return false;
    }
    
    try {
      // Pobierz wartości xT dla stref
      const row1 = Math.floor(startZone / 12);
      const col1 = startZone % 12;
      const startXT = getXTValueFromMatrix(row1, col1);
      
      const row2 = Math.floor(endZone / 12);
      const col2 = endZone % 12;
      const endXT = getXTValueFromMatrix(row2, col2);
      
      // Zapisz wartości stref przed wywołaniem handleZoneSelect
      const isDrybling = startZone === endZone;
      
      if (isDrybling) {
        // To jest drybling - dla dryblingu potrzebujemy przekazać te same wartości dla value1 i value2
        setActionType("dribble");
        console.log("Ustawiamy drybling:", { startZone, startXT });
        
        // Najpierw czyścimy poprzednie wartości
        handleZoneSelect(null); // reset
        
        // Teraz ustawiamy strefy z odpowiednimi wartościami
        handleZoneSelect(startZone, startXT, startXT, startXT);
      } else {
        // To jest podanie
        setActionType("pass");
        console.log("Ustawiamy podanie:", { startZone, endZone, startXT, endXT });
        
        // Najpierw czyścimy poprzednie wartości
        handleZoneSelect(null); // reset
        
        // Teraz ustawiamy strefę początkową
        handleZoneSelect(startZone, startXT);
        
        // Potem ustawiamy strefę końcową z wartościami startXT i endXT
        handleZoneSelect(endZone, endXT, startXT, endXT);
      }
      
      // Upewnij się, że strefy zostały prawidłowo ustawione
      console.log("Po ustawieniu stref:", { 
        isDrybling,
        actionType
      });
      
      // Nie mamy bezpośredniego dostępu do selectedZone i receiverZoneValue w tej funkcji,
      // ale wiemy, że jeśli doszliśmy do tego miejsca, to strefy zostały ustawione
      return true;
    } catch (error) {
      console.error("Błąd podczas przygotowywania stref:", error);
      return false;
    }
  };

  const onSaveAction = async () => {
    // Sprawdzamy czy matchInfo istnieje przed wywołaniem handleSaveAction
    if (!matchInfo) {
      setIsMatchModalOpen(true);
      return;
    }
    
    // Sprawdzamy, czy wszystkie wymagane dane są ustawione
    if (!selectedPlayerId) {
      alert("Wybierz zawodnika rozpoczynającego akcję!");
      return;
    }
    
    // W przypadku podania sprawdzamy, czy wybrany jest odbiorca
    if (actionType === "pass" && !selectedReceiverId) {
      alert("Wybierz zawodnika kończącego podanie!");
      return;
    }
    
    // Sprawdzamy czy strefy są wybrane
    if (!startZone || !endZone) {
      console.log("Brak wybranych stref - nie można zapisać akcji");
      return;
    }
    
    // Przygotujemy wartości xT dla stref
    const row1 = Math.floor(startZone / 12);
    const col1 = startZone % 12;
    const startXT = getXTValueFromMatrix(row1, col1);
    
    const row2 = Math.floor(endZone / 12);
    const col2 = endZone % 12;
    const endXT = getXTValueFromMatrix(row2, col2);
    
    // Ustawimy odpowiedni typ akcji
    const isDrybling = startZone === endZone;
    if (isDrybling) {
      setActionType("dribble");
    }
    
    // Logujemy stan przed wywołaniem handleSaveAction
    console.log("Stan przed zapisem:", {
      selectedPlayerId,
      selectedReceiverId,
      actionType: isDrybling ? "dribble" : "pass",
      startZone,
      endZone,
      startXT,
      endXT
    });
    
    // Wywołujemy handleSaveAction z matchInfo i wartościami stref
    try {
      const success = await handleSaveAction(matchInfo, startZone, endZone);
      if (success) {
        // Resetujemy stan tylko jeśli zapis się powiódł
        setEndZone(null);
        setStartZone(null);
        setIsActionModalOpen(false);
      }
    } catch (error) {
      console.error("Błąd podczas zapisywania akcji:", error);
      alert("Wystąpił błąd podczas zapisywania akcji: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const onDeleteAllActions = () => {
    handleDeleteAllActions();
    setEditingMatch(null);
    setSelectedTeam(TEAMS.REZERWY.id);
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

  // Funkcja do otwierania modalu nowego meczu
  const openNewMatchModal = () => {
    setIsNewMatchModalOpen(true);
  };

  // Dodaj funkcję obsługi sukcesu importu
  const handleImportSuccess = (data: { players: Player[], actions: Action[], matchInfo: any }) => {
    // Aktualizuj graczy
    const newPlayers = data.players.filter(
      importedPlayer => !players.some(p => p.id === importedPlayer.id)
    );
    if (newPlayers.length > 0) {
      // Używamy handleSavePlayerWithTeams dla każdego nowego gracza
      newPlayers.forEach(player => {
        // Tworzymy kopię bez pola id, aby funkcja mogła wygenerować nowe id
        const { id, ...playerData } = player;
        handleSavePlayerWithTeams(playerData as Omit<Player, "id">);
      });
    }
    
    // Aktualizuj akcje
    const newActions = data.actions.filter(
      importedAction => !actions.some(a => a.id === importedAction.id)
    );
    if (newActions.length > 0) {
      // Dodajemy nowe akcje do lokalnego stanu - będą pobrane przez hook useActionsState
      console.log(`Dodano ${newActions.length} nowych akcji`);
    }
    
    // Aktualizuj informacje o meczu, jeśli to nowy mecz
    if (data.matchInfo && !allMatches.some(m => m.matchId === data.matchInfo.matchId)) {
      setActiveTab("packing");
      setEditingMatch(data.matchInfo);
      setIsMatchModalOpen(true);
    }
    
    alert(`Import zakończony sukcesem! Zaimportowano ${newPlayers.length} graczy i ${newActions.length} akcji.`);
  };

  // Dodaj funkcję obsługi błędu importu
  const handleImportError = (error: string) => {
    alert(`Błąd importu: ${error}`);
  };

  // Nowa funkcja do obsługi wyboru strefy
  const handleZoneSelection = (zoneId: number, xT?: number) => {
    // Jeśli nie mamy startZone, to ustawiamy ją
    if (startZone === null) {
      setStartZone(zoneId);
      return;
    }
    
    // Jeśli mamy startZone, ale nie mamy endZone, to ustawiamy ją
    if (endZone === null) {
      setEndZone(zoneId);
      
      // Resetujemy wybór zawodnika i otwieramy ActionModal
      setSelectedPlayerId(null);
      setSelectedReceiverId(null);
      setIsActionModalOpen(true);
      return;
    }
    
    // Jeśli mamy obie strefy, resetujemy je i zaczynamy od nowa
    setStartZone(zoneId);
    setEndZone(null);
    setSelectedPlayerId(null);
    setSelectedReceiverId(null);
  };

  // Niestandardowa funkcja resetująca stan akcji zachowująca wybrane wartości
  const resetActionState = () => {
    // Wykonujemy tylko resetowanie stanu z hooka, która już została zmodyfikowana
    // aby zachowywać potrzebne wartości (strefy, zawodników, isSecondHalf, xT)
    hookResetActionState();
    
    console.log("Wykonano resetowanie stanu akcji przy zachowaniu stref i zawodników");
  };

  // Modyfikujemy funkcję obsługi przełącznika half
  const handleSecondHalfToggle = React.useCallback((value: React.SetStateAction<boolean>) => {
    // Określamy nową wartość niezależnie od typu value (funkcja lub wartość bezpośrednia)
    const newValue = typeof value === 'function' ? value(isSecondHalf) : value;
    
    console.log("page.tsx - zmiana połowy na:", newValue ? "P2" : "P1", "obecna wartość:", isSecondHalf);
    
    // Zapisujemy wartość w stanie lokalnym
    setIsSecondHalf(newValue);
    
    // Zapisujemy wartość w localStorage
    localStorage.setItem('currentHalf', newValue ? 'P2' : 'P1');
    
    // Przekazujemy wartość do hooka useActionsState
    if (useActionsStateRef.current?.setIsSecondHalf) {
      useActionsStateRef.current.setIsSecondHalf(newValue);
    }
  }, [isSecondHalf]);

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
        onAddNewMatch={openNewMatchModal}
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

        <ActionSection
          selectedZone={selectedZone}
          handleZoneSelect={handleZoneSelection}
          players={filteredPlayers}
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
          isSecondHalf={isSecondHalf}
          setIsSecondHalf={handleSecondHalfToggle}
          handleSaveAction={onSaveAction}
          resetActionState={resetActionState}
          startZone={startZone}
          endZone={endZone}
          isActionModalOpen={isActionModalOpen}
          setIsActionModalOpen={setIsActionModalOpen}
        />
        <ActionsTable
          actions={actions}
          onDeleteAction={handleDeleteAction}
          onDeleteAllActions={onDeleteAllActions}
        />

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
          allTeams={Object.values(TEAMS)}
        />

        <MatchInfoModal
          isOpen={isMatchModalOpen}
          onClose={() => setIsMatchModalOpen(false)}
          onSave={handleSaveMatchInfo}
          currentInfo={matchInfo}
        />

        {/* Modal dla nowego meczu */}
        <MatchInfoModal
          isOpen={isNewMatchModalOpen}
          onClose={() => setIsNewMatchModalOpen(false)}
          onSave={(matchInfo) => {
            handleSaveMatchInfo(matchInfo);
            setIsNewMatchModalOpen(false);
          }}
          currentInfo={null}
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
            match={editingMatch as TeamInfo}
            players={players.filter(
              (player) => player.teams && player.teams.includes(editingMatch.team)
            )}
          />
        )}

        {/* Przyciski eksportu i importu */}
        <div className={styles.buttonsContainer}>
          <ExportButton
            players={players}
            actions={actions}
            matchInfo={matchInfo}
          />
          <ImportButton 
            onImportSuccess={handleImportSuccess}
            onImportError={handleImportError}
          />
        </div>

        <OfflineStatus />
      </main>
    </div>
  );
}
