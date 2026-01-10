// src/app/page.tsx
"use client";

import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Tab, Player, TeamInfo, PlayerMinutes, Action, Shot } from "@/types";
import Instructions from "@/components/Instructions/Instructions";
import PlayersGrid from "@/components/PlayersGrid/PlayersGrid";
import PlayerTile from "@/components/PlayersGrid/PlayerTile";
import Tabs from "@/components/Tabs/Tabs";
import { usePlayersState } from "@/hooks/usePlayersState";

import { usePackingActions } from "@/hooks/usePackingActions";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { TEAMS, fetchTeams, getTeamsArray, Team } from "@/constants/teamsLoader";
import { getXTValueFromMatrix } from "@/constants/xtValues";
import styles from "./page.module.css";
import OfflineStatus from '@/components/OfflineStatus/OfflineStatus';
import ExportButton from "@/components/ExportButton/ExportButton";
import ImportButton from "@/components/ImportButton/ImportButton";
import { initializeTeams, checkTeamsCollection } from "@/utils/initializeTeams";
import { useAuth } from "@/hooks/useAuth";
import toast from 'react-hot-toast';
import OfflineStatusBanner from "@/components/OfflineStatusBanner/OfflineStatusBanner";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { getDB } from "@/lib/firebase";
import PlayerModal from "@/components/PlayerModal/PlayerModal";
import PlayerMinutesModal from "@/components/PlayerMinutesModal/PlayerMinutesModal";
import MatchInfoModal from "@/components/MatchInfoModal/MatchInfoModal";
import Link from "next/link";
import ActionModal from "@/components/ActionModal/ActionModal";
import RegainActionModal from "@/components/RegainActionModal/RegainActionModal";
import LosesActionModal from "@/components/LosesActionModal/LosesActionModal";
import MatchInfoHeader from "@/components/MatchInfoHeader/MatchInfoHeader";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";
import { filterMatchesBySeason, getAvailableSeasonsFromMatches } from "@/utils/seasonUtils";
import { sortPlayersByLastName, getPlayerFullName } from "@/utils/playerUtils";
import SidePanel from "@/components/SidePanel/SidePanel";
import YouTubeVideo, { YouTubeVideoRef } from "@/components/YouTubeVideo/YouTubeVideo";
import CustomVideoPlayer, { CustomVideoPlayerRef } from "@/components/CustomVideoPlayer/CustomVideoPlayer";
import XGPitch from "@/components/XGPitch/XGPitch";
import ShotModal from "@/components/ShotModal/ShotModal";
import ShotsTable from "@/components/ShotsTable/ShotsTable";
import { useShots } from "@/hooks/useShots";
import { getCurrentSeason } from "@/utils/seasonUtils";
import PKEntriesPitch from "@/components/PKEntriesPitch/PKEntriesPitch";
import { usePKEntries } from "@/hooks/usePKEntries";
import { PKEntry } from "@/types";
import PKEntryModal from "@/components/PKEntryModal/PKEntryModal";
import PKEntriesTable from "@/components/PKEntriesTable/PKEntriesTable";
import { useAcc8sEntries } from "@/hooks/useAcc8sEntries";
import { Acc8sEntry } from "@/types";
import Acc8sModal from "@/components/Acc8sModal/Acc8sModal";
import Acc8sTable from "@/components/Acc8sTable/Acc8sTable";


// Rozszerzenie interfejsu Window
declare global {
  interface Window {
    _isRefreshingMatches?: boolean;
  }
}

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


// Funkcja pomocnicza do usuwania undefined z obiektów, zachowująca typ
function removeUndefinedFields<T extends object>(obj: T): T {
  const result = { ...obj };
  
  Object.keys(result).forEach(key => {
    if (result[key as keyof T] === undefined) {
      delete result[key as keyof T];
    }
  });
  
  return result;
}

export default function Page() {
  const [activeTab, setActiveTab] = React.useState<"packing" | "acc8s" | "xg" | "regain" | "loses" | "pk_entries">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('activeTab');
      if (saved && ['packing', 'acc8s', 'xg', 'regain', 'loses', 'pk_entries'].includes(saved)) {
        return saved as "packing" | "acc8s" | "xg" | "regain" | "loses" | "pk_entries";
      }
    }
    return "packing";
  });
  
  // Zapisz aktywną kartę do localStorage przy każdej zmianie
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab]);
  // Inicjalizuj selectedTeam z localStorage lub pustym stringiem
  const [selectedTeam, setSelectedTeam] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedTeam') || "";
    }
    return "";
  });
  
  const [isPlayerMinutesModalOpen, setIsPlayerMinutesModalOpen] = React.useState(false);
  const [editingMatch, setEditingMatch] = React.useState<TeamInfo | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false);
  const [startZone, setStartZone] = React.useState<number | null>(null);
  const [endZone, setEndZone] = React.useState<number | null>(null);
  const [isNewMatchModalOpen, setIsNewMatchModalOpen] = React.useState(false);
  const [isSecondHalf, setIsSecondHalf] = React.useState(false);
  const [matchesListRefreshCounter, setMatchesListRefreshCounter] = useState(0);
  const [selectedZone, setSelectedZone] = React.useState<string | number | null>(null);
  const [isActionEditModalOpen, setIsActionEditModalOpen] = React.useState(false);
  const [editingAction, setEditingAction] = React.useState<Action | null>(null);
  const [allTeams, setAllTeams] = React.useState<Team[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  // Ref do YouTube Video
  const youtubeVideoRef = useRef<YouTubeVideoRef>(null);
  // Ref do Custom Video Player
  const customVideoRef = useRef<CustomVideoPlayerRef>(null);

  // Funkcja pomocnicza do pobierania czasu z aktywnego odtwarzacza
  const getActiveVideoTime = async (): Promise<number> => {
    // Najpierw sprawdź własny odtwarzacz
    if (customVideoRef.current) {
      try {
        const time = await customVideoRef.current.getCurrentTime();
        console.log('getActiveVideoTime - customVideoRef:', time);
        if (time > 0) {
          return time;
        }
      } catch (error) {
        console.warn('Nie udało się pobrać czasu z własnego odtwarzacza:', error);
      }
    }
    // Następnie sprawdź YouTube
    if (youtubeVideoRef.current) {
      try {
        const time = await youtubeVideoRef.current.getCurrentTime();
        console.log('getActiveVideoTime - youtubeVideoRef:', time);
        if (time > 0) {
          return time;
        }
      } catch (error) {
        console.warn('Nie udało się pobrać czasu z YouTube:', error);
      }
    }
    console.log('getActiveVideoTime - zwracam 0 (brak aktywnego playera lub czas = 0)');
    return 0;
  };

  // Funkcja pomocnicza do przewijania aktywnego odtwarzacza
  const seekActiveVideo = async (seconds: number): Promise<void> => {
    if (customVideoRef.current) {
      try {
        await customVideoRef.current.seekTo(seconds);
        return;
      } catch (error) {
        console.warn('Nie udało się przewinąć własnego odtwarzacza:', error);
      }
    }
    if (youtubeVideoRef.current) {
      try {
        await youtubeVideoRef.current.seekTo(seconds);
      } catch (error) {
        console.warn('Nie udało się przewinąć YouTube:', error);
      }
    }
  };

  // State do przechowywania aktualnego czasu z zewnętrznego wideo
  const [externalVideoTime, setExternalVideoTime] = useState<number>(0);
  const [isVideoVisible, setIsVideoVisible] = useState<boolean>(false);
  const [isVideoFullscreen, setIsVideoFullscreen] = React.useState<boolean>(false);
  const [isPlayersGridExpanded, setIsPlayersGridExpanded] = useState<boolean>(false);
  const [isTeamsSelectorExpanded, setIsTeamsSelectorExpanded] = useState<boolean>(false);

  // Funkcja do otwierania ActionModal z zapisaniem czasu YouTube
  const openActionModalWithVideoTime = async () => {
    
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo
    // Używamy localStorage do sprawdzenia czy okno jest otwarte
    const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
    
    // Jeśli otrzymujemy czas z zewnętrznego okna (externalVideoTime > 0), to znaczy że okno jest faktycznie otwarte
    const hasExternalVideoTime = externalVideoTime > 0;
    
    if (isExternalWindowOpen || hasExternalVideoTime) {
      // Wyślij wiadomość do zewnętrznego okna o pobranie aktualnego czasu
      const externalWindow = (window as any).externalVideoWindow;
      if (externalWindow && !externalWindow.closed) {
        externalWindow.postMessage({
          type: 'GET_CURRENT_TIME'
        }, '*');
      } else {
        window.postMessage({
          type: 'GET_CURRENT_TIME'
        }, '*');
      }
      
      // Czekaj na odpowiedź z zewnętrznego okna
      const waitForTime = new Promise<number | null>((resolve) => {
        const handleTimeResponse = (event: MessageEvent) => {
          if (event.data.type === 'CURRENT_TIME_RESPONSE') {
            window.removeEventListener('message', handleTimeResponse);
            resolve(event.data.time);
          }
        };
        window.addEventListener('message', handleTimeResponse);
        setTimeout(() => {
          window.removeEventListener('message', handleTimeResponse);
          resolve(null); // null oznacza timeout
        }, 1000);
      });
      
      const time = await waitForTime;
      
      if (time === null) {
        if (hasExternalVideoTime) {
          // Użyj ostatniego znanego czasu z zewnętrznego okna, cofnij o 10s
          const adjustedTime = Math.max(0, externalVideoTime - 10);
          localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
        } else {
          const proceed = window.confirm('Nie udało się pobrać czasu z wideo. Czy zapisać akcję bez czasu?');
          if (!proceed) return;
          localStorage.setItem('tempVideoTimestamp', '0');
        }
      } else if (time > 0) {
        // Cofnij czas o 10 sekund
        const adjustedTime = Math.max(0, time - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      } else if (externalVideoTime > 0) {
        // Fallback do ostatniego znanego czasu, cofnij o 10s
        const adjustedTime = Math.max(0, externalVideoTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      }
    } else {
      // Spróbuj kilka razy pobrać czas (YouTube player może potrzebować czasu na załadowanie)
      let currentTime = 0;
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        currentTime = await getActiveVideoTime();
        if (currentTime > 0) {
          break;
        }
        // Poczekaj 200ms przed kolejną próbą
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      if (currentTime > 0) {
        const adjustedTime = Math.max(0, currentTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      }
    }
    setIsActionModalOpen(true);
  };

  const openAcc8sModalWithVideoTime = async () => {
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo
    // Używamy localStorage do sprawdzenia czy okno jest otwarte
    const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
    
    // Jeśli otrzymujemy czas z zewnętrznego okna (externalVideoTime > 0), to znaczy że okno jest faktycznie otwarte
    const hasExternalVideoTime = externalVideoTime > 0;
    
    if (isExternalWindowOpen || hasExternalVideoTime) {
      // Wyślij wiadomość do zewnętrznego okna o pobranie aktualnego czasu
      const externalWindow = (window as any).externalVideoWindow;
      if (externalWindow && !externalWindow.closed) {
        externalWindow.postMessage({
          type: 'GET_CURRENT_TIME'
        }, '*');
      } else {
        window.postMessage({
          type: 'GET_CURRENT_TIME'
        }, '*');
      }
      
      // Czekaj na odpowiedź z zewnętrznego okna
      const waitForTime = new Promise<number | null>((resolve) => {
        const handleTimeResponse = (event: MessageEvent) => {
          if (event.data.type === 'CURRENT_TIME_RESPONSE') {
            window.removeEventListener('message', handleTimeResponse);
            resolve(event.data.time);
          }
        };
        window.addEventListener('message', handleTimeResponse);
        setTimeout(() => {
          window.removeEventListener('message', handleTimeResponse);
          resolve(null); // null oznacza timeout
        }, 1000);
      });
      
      const time = await waitForTime;
      
      if (time === null) {
        if (hasExternalVideoTime) {
          // Użyj ostatniego znanego czasu z zewnętrznego okna, cofnij o 10s
          const adjustedTime = Math.max(0, externalVideoTime - 10);
          localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
        } else {
          const proceed = window.confirm('Nie udało się pobrać czasu z wideo. Czy zapisać akcję bez czasu?');
          if (!proceed) return;
          localStorage.setItem('tempVideoTimestamp', '0');
        }
      } else if (time > 0) {
        // Cofnij czas o 10 sekund
        const adjustedTime = Math.max(0, time - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      } else if (externalVideoTime > 0) {
        // Fallback do ostatniego znanego czasu, cofnij o 10s
        const adjustedTime = Math.max(0, externalVideoTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      }
    } else {
      console.log('openAcc8sModalWithVideoTime - sprawdzam getActiveVideoTime()');
      // Spróbuj kilka razy pobrać czas (YouTube player może potrzebować czasu na załadowanie)
      let currentTime = 0;
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        currentTime = await getActiveVideoTime();
        console.log(`openAcc8sModalWithVideoTime - attempt ${attempt + 1}/${maxAttempts}, currentTime:`, currentTime);
        if (currentTime > 0) {
          break;
        }
        // Poczekaj 200ms przed kolejną próbą (więcej czasu na załadowanie playera)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      if (currentTime > 0) {
        const adjustedTime = Math.max(0, currentTime - 10);
        console.log('openAcc8sModalWithVideoTime - adjustedTime (currentTime - 15):', adjustedTime, 'z currentTime:', currentTime);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      } else {
        console.warn('openAcc8sModalWithVideoTime - nie udało się pobrać czasu z playera po', maxAttempts, 'próbach');
        // Ustaw 0 jako fallback, aby modal mógł się otworzyć
        localStorage.setItem('tempVideoTimestamp', '0');
      }
    }
    setAcc8sModalData({});
    setIsAcc8sModalOpen(true);
  };

  const [externalVideoState, setExternalVideoState] = useState<number>(-1); // -1 = unstarted, 1 = playing, 2 = paused, etc.

  // Nasłuchuj wiadomości z zewnętrznego wideo
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'VIDEO_TIME_UPDATE') {
        setExternalVideoTime(event.data.time);
      } else if (event.data.type === 'VIDEO_STATE_UPDATE') {
        setExternalVideoState(event.data.state);
      } else if (event.data.type === 'CURRENT_TIME_RESPONSE') {
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Custom hooks
  const {
    players,
    isModalOpen,
    editingPlayerId,
    editingPlayer, // Dodano editingPlayer ze świeżymi danymi z Firebase
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
    refetchPlayers,
    migratePlayersFromTeamsToPlayers
  } = usePlayersState();

  const {
    matchInfo,
    allMatches,
    isMatchModalOpen,
    toggleMatchModal,
    handleSaveMatchInfo,
    handleSelectMatch,
    handleDeleteMatch,
    handleSavePlayerMinutes,
    fetchMatches,
    forceRefreshFromFirebase,
    isOfflineMode
  } = useMatchInfo();

  // Stany dla trybu unpacking - muszą być przed usePackingActions
  const [actionMode, setActionMode] = useState<"attack" | "defense">("attack");
  const [selectedDefensePlayers, setSelectedDefensePlayers] = useState<string[]>([]);

  // Określamy kategorię akcji na podstawie aktywnej zakładki
  const actionCategory = activeTab === "regain" ? "regain" : activeTab === "loses" ? "loses" : "packing";
  const packingActions = usePackingActions(players, matchInfo, actionMode, selectedDefensePlayers, actionCategory);
  
  // Wyciągnij funkcje z hooka
  const { resetActionPoints } = packingActions;

  // Hook do zarządzania strzałami
  const { shots, addShot, updateShot, deleteShot, refetch: refetchShots } = useShots(matchInfo?.matchId || "");
  
  // Hook do zarządzania wejściami PK
  const { pkEntries, addPKEntry, updatePKEntry, deletePKEntry } = usePKEntries(matchInfo?.matchId || "");

  // Hook do zarządzania akcjami 8s ACC
  const { acc8sEntries, addAcc8sEntry, updateAcc8sEntry, deleteAcc8sEntry } = useAcc8sEntries(matchInfo?.matchId || "");

  // Stan dla filtrowania strzałów

  // Stan dla modalki strzałów
  const [isShotModalOpen, setIsShotModalOpen] = useState(false);
  const [shotModalData, setShotModalData] = useState<{
    x: number;
    y: number;
    xG: number;
    editingShot?: Shot;
  } | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>();
  
  // Stan dla wejść PK
  const [selectedPKEntryId, setSelectedPKEntryId] = useState<string | undefined>();
  const [isPKEntryModalOpen, setIsPKEntryModalOpen] = useState(false);
  const [pkEntryModalData, setPkEntryModalData] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    editingEntry?: PKEntry;
  } | null>(null);

  // Stan dla akcji 8s ACC
  const [isAcc8sModalOpen, setIsAcc8sModalOpen] = useState(false);
  const [acc8sModalData, setAcc8sModalData] = useState<{
    editingEntry?: Acc8sEntry;
  } | null>(null);

  // Funkcje obsługi strzałów
  const handleShotAdd = async (x: number, y: number, xG: number) => {
    // Pobierz czas wideo przed otwarciem modala (podobnie jak w openActionModalWithVideoTime)
    const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
    const hasExternalVideoTime = externalVideoTime > 0;
    
    if (isExternalWindowOpen || hasExternalVideoTime) {
      // Wyślij wiadomość do zewnętrznego okna o pobranie aktualnego czasu
      const externalWindow = (window as any).externalVideoWindow;
      if (externalWindow && !externalWindow.closed) {
        externalWindow.postMessage({
          type: 'GET_CURRENT_TIME'
        }, '*');
      } else {
        window.postMessage({
          type: 'GET_CURRENT_TIME'
        }, '*');
      }
      
      // Czekaj na odpowiedź z zewnętrznego okna
      const waitForTime = new Promise<number | null>((resolve) => {
        const handleTimeResponse = (event: MessageEvent) => {
          if (event.data.type === 'CURRENT_TIME_RESPONSE') {
            window.removeEventListener('message', handleTimeResponse);
            resolve(event.data.time);
          }
        };
        window.addEventListener('message', handleTimeResponse);
        setTimeout(() => {
          window.removeEventListener('message', handleTimeResponse);
          resolve(null); // null oznacza timeout
        }, 1000);
      });
      
      const time = await waitForTime;
      if (time === null) {
        if (hasExternalVideoTime) {
          // Użyj ostatniego znanego czasu z zewnętrznego okna, cofnij o 10s
          const adjustedTime = Math.max(0, externalVideoTime - 10);
          localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
        } else {
          localStorage.setItem('tempVideoTimestamp', '0');
        }
      } else if (time > 0) {
        // Cofnij czas o 10 sekund
        const adjustedTime = Math.max(0, time - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      } else if (externalVideoTime > 0) {
        // Fallback do ostatniego znanego czasu, cofnij o 10s
        const adjustedTime = Math.max(0, externalVideoTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      }
    } else {
      const currentTime = await getActiveVideoTime();
      if (currentTime > 0) {
        const adjustedTime = Math.max(0, currentTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      }
    }
    
    setShotModalData({ x, y, xG });
    setIsShotModalOpen(true);
  };

  const handleShotClick = (shot: Shot) => {
    setShotModalData({
      x: shot.x,
      y: shot.y,
      xG: shot.xG,
      editingShot: shot
    });
    setSelectedShotId(shot.id);
    setIsShotModalOpen(true);
  };

  const handleShotSave = async (shotData: Omit<Shot, "id" | "timestamp">) => {
    if (!matchInfo?.matchId) {
      alert("Brak ID meczu. Nie można zapisać strzału.");
      return;
    }

    try {
      // Pobierz czas z YouTube z localStorage
      const videoTimestamp = localStorage.getItem('tempVideoTimestamp');
      const parsedVideoTimestamp = videoTimestamp ? parseInt(videoTimestamp) : undefined;
      const isValidTimestamp = parsedVideoTimestamp !== undefined && !isNaN(parsedVideoTimestamp) && parsedVideoTimestamp > 0;
      
      // Dodaj videoTimestamp do danych strzału
      // Przy edycji zachowaj istniejący videoTimestamp, jeśli nowy nie jest dostępny
      const finalVideoTimestamp = isValidTimestamp 
        ? parsedVideoTimestamp 
        : (shotModalData?.editingShot?.videoTimestamp);
      
      const shotDataWithTimestamp = {
        ...shotData,
        ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
      };
      
      // Debug: sprawdź czy videoTimestamp jest zapisywany
      console.log('handleShotSave - videoTimestamp z localStorage:', videoTimestamp);
      console.log('handleShotSave - parsedVideoTimestamp:', parsedVideoTimestamp);
      console.log('handleShotSave - isValidTimestamp:', isValidTimestamp);
      console.log('handleShotSave - finalVideoTimestamp:', finalVideoTimestamp);
      console.log('handleShotSave - shotDataWithTimestamp:', shotDataWithTimestamp);

      if (shotModalData?.editingShot) {
        const success = await updateShot(shotModalData.editingShot.id, shotDataWithTimestamp);
        if (!success) {
          alert("Nie udało się zaktualizować strzału. Spróbuj ponownie.");
          return;
        }
      } else {
        const newShot = await addShot(shotDataWithTimestamp);
        if (!newShot) {
          alert("Nie udało się dodać strzału. Spróbuj ponownie.");
          return;
        }
      }
      
      // Odśwież listę strzałów
      await refetchShots();
      
      setIsShotModalOpen(false);
      setShotModalData(null);
      setSelectedShotId(undefined);
    } catch (error) {
      console.error("Błąd podczas zapisywania strzału:", error);
      alert("Wystąpił błąd podczas zapisywania strzału. Spróbuj ponownie.");
    }
  };

  const handleShotDelete = async (shotId: string) => {
    if (!matchInfo?.matchId) {
      alert("Brak ID meczu. Nie można usunąć strzału.");
      return;
    }

    try {
      const success = await deleteShot(shotId);
      if (!success) {
        alert("Nie udało się usunąć strzału. Spróbuj ponownie.");
        return;
      }
      
      // Odśwież listę strzałów
      await refetchShots();
      
      setIsShotModalOpen(false);
      setShotModalData(null);
      setSelectedShotId(undefined);
    } catch (error) {
      console.error("Błąd podczas usuwania strzału:", error);
      alert("Wystąpił błąd podczas usuwania strzału. Spróbuj ponownie.");
    }
  };

  const handleShotModalClose = () => {
    setIsShotModalOpen(false);
    setShotModalData(null);
    setSelectedShotId(undefined);
  };
  
  const {
    actions,
    selectedPlayerId,
    selectedReceiverId,
    selectedZone: hookSelectedZone,
    currentPoints,
    actionMinute,
    actionType,
    isP0StartActive,
    isP1StartActive,
    isP2StartActive,
    isP3StartActive,
    isP0Active,
    isP1Active,
    isP2Active,
    isP3Active,
    isContact1Active,
    isContact2Active,
    isContact3PlusActive,
    isShot,
    isGoal,
    isPenaltyAreaEntry,
    setSelectedPlayerId,
    setSelectedReceiverId,
    setCurrentPoints,
    setActionMinute,
    setActionType,
    setIsP0StartActive,
    setIsP1StartActive,
    setIsP2StartActive,
    setIsP3StartActive,
    setIsP0Active,
    setIsP1Active,
    setIsP2Active,
    setIsP3Active,
    setIsContact1Active,
    setIsContact2Active,
    setIsContact3PlusActive,
    setIsShot,
    setIsGoal,
    setIsPenaltyAreaEntry,
    isBelow8sActive,
    setIsBelow8sActive,
    isReaction5sActive,
    setIsReaction5sActive,
    isAutActive,
    setIsAutActive,
    isReaction5sNotApplicableActive,
    setIsReaction5sNotApplicableActive,
    isPMAreaActive,
    setIsPMAreaActive,
    playersBehindBall,
    setPlayersBehindBall,
    opponentsBeforeBall,
    setOpponentsBeforeBall,
    playersLeftField,
    setPlayersLeftField,
    opponentsLeftField,
    setOpponentsLeftField,
    handleZoneSelect,
    handleSaveAction,
    handleDeleteAction,
    handleDeleteAllActions,
    resetActionState,
    setActions,
  } = packingActions;

  // Filtruj akcje według kategorii
  const filteredActions = useMemo(() => {
    if (actionCategory === "regain") {
      // Regain: ma playersBehindBall lub opponentsBeforeBall, ale NIE ma isReaction5s
      // Kluczowa różnica: regain NIE ma isReaction5s
      return actions.filter(action => 
        (action.playersBehindBall !== undefined || 
         action.opponentsBeforeBall !== undefined ||
         action.totalPlayersOnField !== undefined ||
         action.totalOpponentsOnField !== undefined ||
         action.playersLeftField !== undefined ||
         action.opponentsLeftField !== undefined) &&
        action.isReaction5s === undefined
      );
    } else if (actionCategory === "loses") {
      // Loses: ma isReaction5s (to jest główny wskaźnik dla loses)
      return actions.filter(action => 
        action.isReaction5s !== undefined
      );
    } else {
      // Packing: nie ma pól charakterystycznych dla regain/loses
      return actions.filter(action => 
        action.isBelow8s === undefined &&
        action.playersBehindBall === undefined &&
        action.opponentsBeforeBall === undefined &&
        action.isReaction5s === undefined &&
        action.totalPlayersOnField === undefined &&
        action.totalOpponentsOnField === undefined &&
        action.playersLeftField === undefined &&
        action.opponentsLeftField === undefined
      );
    }
  }, [actions, actionCategory]);

  const { isAuthenticated, isLoading, userTeams, isAdmin, logout } = useAuth();

  // Pobierz zespoły z Firebase
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teams = await getTeamsArray();
        setAllTeams(teams);
      } catch (error) {
        console.error("Błąd podczas pobierania zespołów:", error);
        // Jeśli nie udało się pobrać, użyj domyślnych zespołów
        setAllTeams(Object.values(TEAMS));
      }
    };

    loadTeams();

    // Słuchaj na zmiany w zespołach (np. po dodaniu/usunięciu w panelu admin)
    const handleTeamsChanged = () => {

      loadTeams();
    };

    // Dodaj słuchacza na custom event
    window.addEventListener('teamsChanged', handleTeamsChanged);

    return () => {
      window.removeEventListener('teamsChanged', handleTeamsChanged);
    };
  }, []);

  // Filtruj dostępne zespoły na podstawie uprawnień użytkownika
  const availableTeams = useMemo(() => {
    if (isAdmin) {
      // Administratorzy mają dostęp do wszystkich zespołów
      return allTeams;
    }
    
    if (!userTeams || userTeams.length === 0) {
      return [];
    }
    
    // Filtruj zespoły na podstawie uprawnień użytkownika
    const filtered = allTeams.filter(team => userTeams.includes(team.id));
    return filtered;
  }, [userTeams, isAdmin, allTeams]);

  // Użyj tylko stanu ładowania z useAuth - nie dodawaj własnej logiki
  // Hook useAuth już obsługuje kombinację ładowania uwierzytelniania i danych użytkownika
  const isAppLoading = isLoading;

  // Ustaw domyślny zespół na pierwszy dostępny i zapisz w localStorage
  useEffect(() => {
    if (availableTeams.length > 0) {
      const teamExists = availableTeams.find(team => team.id === selectedTeam);
      
      if (!teamExists) {
        const firstTeamId = availableTeams[0].id;
        setSelectedTeam(firstTeamId);
        localStorage.setItem('selectedTeam', firstTeamId);
      }
    }
  }, [availableTeams, selectedTeam]);

  // Zapisuj wybrany zespół w localStorage przy każdej zmianie
  useEffect(() => {
    if (selectedTeam) {
      localStorage.setItem('selectedTeam', selectedTeam);
    }
  }, [selectedTeam]);

  // Inicjalizuj selectedSeason na najnowszy sezon na podstawie meczów
  useEffect(() => {
    if (selectedSeason === null && allMatches.length > 0) {
      const availableSeasons = getAvailableSeasonsFromMatches(allMatches);
      if (availableSeasons.length > 0) {
        // Wybierz najnowszy sezon (pierwszy w posortowanej liście)
        setSelectedSeason(availableSeasons[0].id);
      } else {
        setSelectedSeason("all");
      }
    }
  }, [selectedSeason, allMatches]);

  // Gdy hookSelectedZone się zmienia, aktualizujemy lokalny selectedZone
  useEffect(() => {
    setSelectedZone(hookSelectedZone);
  }, [hookSelectedZone]);

  const filteredPlayers = useMemo(() => {
    // Filtruj graczy na podstawie wybranego zespołu z normalizacją
    const teamFiltered = players.filter(player => {
      // Normalizuj teams - upewnij się że to zawsze tablica
      let teams = player.teams;
      
      if (typeof teams === 'string') {
        teams = [teams];
      } else if (!Array.isArray(teams)) {
        teams = [];
      }
      
      const hasTeam = teams.includes(selectedTeam);
      return hasTeam;
    });
    
    // Sortowanie alfabetyczne po nazwisku
    return sortPlayersByLastName(teamFiltered);
  }, [players, selectedTeam]);

  // Posegregowani zawodnicy według pozycji dla rozwiniętej listy
  const playersByPosition = useMemo(() => {
    const byPosition = filteredPlayers.reduce((acc, player) => {
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
    }, {} as Record<string, typeof filteredPlayers>);
    
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
    // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji (LW przed RW), potem po nazwisku
    sortedPositions.forEach(position => {
      byPosition[position].sort((a, b) => {
        // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji
        if (position === 'Skrzydłowi') {
          const posA = a.position || '';
          const posB = b.position || '';
          if (posA !== posB) {
            // LW przed RW
            if (posA === 'LW') return -1;
            if (posB === 'LW') return 1;
          }
        }
        
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
  }, [filteredPlayers]);

  React.useEffect(() => {
    // Sprawdzamy, czy w localStorage jest zapisana wartość połowy
    const savedHalf = localStorage.getItem('currentHalf');
    if (savedHalf) {
      const isP2 = savedHalf === 'P2';
      setIsSecondHalf(isP2);
    }
    
    // Dodaj funkcję migracji do konsoli przeglądarki dla ręcznego użycia
    if (typeof window !== 'undefined') {
      (window as any).migratePlayers = migratePlayersFromTeamsToPlayers;
    }
  }, [migratePlayersFromTeamsToPlayers]);

  // Dodajemy useCallback dla fetchMatches, aby można było bezpiecznie używać go w efektach
  const refreshMatchesList = useCallback(async (teamId?: string) => {
    const targetTeamId = teamId || selectedTeam;
    
    try {
      // Używamy blokady, aby zapobiec wielokrotnym wywołaniom
      if (window._isRefreshingMatches) {
        return;
      }
      
      window._isRefreshingMatches = true;
      
      const matches = await fetchMatches(targetTeamId);
      
      // Używamy funkcji aktualizującej, aby uniknąć uzależnienia od bieżącej wartości
      if (matches) {
        // Opóźniamy aktualizację licznika, aby uniknąć pętli renderowania
        setTimeout(() => {
          setMatchesListRefreshCounter(prev => prev + 1);
        }, 50);
      }
    } catch (error) {
      console.error("❌ PAGE.TSX refreshMatchesList błąd:", error);
    } finally {
      // Resetujemy blokadę po zakończeniu
      setTimeout(() => {
        window._isRefreshingMatches = false;
      }, 500);
    }
  }, [fetchMatches, selectedTeam]);
  
  // Dodajemy useRef, aby śledzić, czy efekt już został wykonany
  const initEffectExecutedRef = useRef(false);
  
  // Dodajemy efekt inicjalizujący, który odświeży listę meczów przy pierwszym renderowaniu
  React.useEffect(() => {
    if (initEffectExecutedRef.current) return;
    initEffectExecutedRef.current = true;
    
    // Używamy setTimeout, aby zapewnić, że Firebase jest w pełni zainicjalizowany
    const timer = setTimeout(async () => {
      try {
        // Wywołuj fetchMatches tylko jeśli selectedTeam jest ustawiony
        if (selectedTeam) {
          await fetchMatches(selectedTeam);
        } else {
        }
        // Nie aktualizujemy licznika tutaj - to tylko inicjalne pobranie danych
      } catch (error) {
        console.error("Błąd podczas inicjalizacji listy meczów:", error);
      }
    }, 300);
    
    return () => {
      clearTimeout(timer);
    };
  }, [fetchMatches, selectedTeam]);

  // Nasłuchuj na zmiany w hashu URL, aby ewentualnie obsłużyć odświeżenie strony
  React.useEffect(() => {
    // Używamy zmiennej do śledzenia, czy komponent jest zamontowany
    let isMounted = true;
    
    const handleHashChange = () => {
      if (!isMounted) return;
      
      const hash = window.location.hash;
      
      // Jeśli hash zawiera informację o odświeżeniu dla konkretnego zespołu
      if (hash.startsWith('#refresh=')) {
        const teamId = hash.replace('#refresh=', '');
  
        
        // Wyczyść hash
        window.location.hash = '';
        
        // Odśwież listę meczów dla tego zespołu
        if (teamId && isMounted) {
          // Zamiast wywoływać refreshMatchesList, bezpośrednio wywołujemy fetchMatches
          // i aktualizujemy selectedTeam jeśli potrzeba
          if (teamId !== selectedTeam) {
            setSelectedTeam(teamId);
          }
          
          // Używamy setTimeout, aby oddzielić zmianę stanu od renderowania i uniknąć niepotrzebnych wywołań
          setTimeout(async () => {
            if (!isMounted) return;
            
            // Unikamy nakładających się operacji
            if (window._isRefreshingMatches) {
              return;
            }
            
            window._isRefreshingMatches = true;
            
            try {
              const matches = await fetchMatches(teamId);
              if (isMounted && matches) {
                setTimeout(() => {
                  if (isMounted) {
                    setMatchesListRefreshCounter(prev => prev + 1);
                  }
                  window._isRefreshingMatches = false;
                }, 100);
              } else {
                window._isRefreshingMatches = false;
              }
            } catch (error) {
              console.error("❌ Błąd podczas pobierania meczów z URL hash:", error);
              window._isRefreshingMatches = false;
            }
          }, 500);
        }
      }
    };
    
    // Wywołaj raz przy montowaniu, aby obsłużyć sytuację po odświeżeniu
    handleHashChange();
    
    // Nasłuchuj na zmiany
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      isMounted = false;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [fetchMatches, selectedTeam]);

  // Modyfikujemy efekt nasłuchujący na zdarzenie odświeżenia listy meczów
  useEffect(() => {
    // Używamy zmiennej do śledzenia, czy komponent jest zamontowany
    let isMounted = true;
    // Używamy zmiennej do śledzenia ostatniego timestampu, aby ignorować zdublowane zdarzenia
    let lastEventTimestamp = 0;
    
    const handleRefreshMatchesList = (event: Event) => {
      if (!isMounted) return;
      
      const customEvent = event as CustomEvent<{teamId?: string, timestamp?: number}>;
      const teamId = customEvent.detail?.teamId;
      const timestamp = customEvent.detail?.timestamp || 0;
      
      // Ignoruj zdarzenia starsze niż ostatnie przetworzone lub gdy trwa już odświeżanie
      if (timestamp <= lastEventTimestamp || window._isRefreshingMatches) {
        return;
      }
      
      lastEventTimestamp = timestamp;
      
      // Ustawiamy zespół, jeśli został przekazany i różni się od obecnego
      if (teamId && teamId !== selectedTeam) {
        setSelectedTeam(teamId);
        // Nie wykonujemy żadnych dodatkowych akcji - zmiana selectedTeam
        // spowoduje ponowne pobranie danych przez efekt zależny od selectedTeam
      } else if (isMounted) {
        // Odświeżamy listę tylko jeśli teamId jest taki sam jak obecny lub nie został podany
        // Zamiast wywoływać refreshMatchesList, tylko zwiększamy licznik
        window._isRefreshingMatches = true;
        
        setTimeout(() => {
          if (isMounted) {
            setMatchesListRefreshCounter(prev => prev + 1);
          }
          window._isRefreshingMatches = false;
        }, 100);
      }
    };
    
    // Dodajemy nasłuchiwanie na zdarzenie odświeżenia listy
    document.addEventListener('matchesListRefresh', handleRefreshMatchesList);
    
    // Usuwamy nasłuchiwanie przy odmontowaniu komponentu
    return () => {
      isMounted = false;
      document.removeEventListener('matchesListRefresh', handleRefreshMatchesList);
    };
  }, [selectedTeam]); // Usuwamy wszelkie zależności od funkcji, które mogą powodować pętlę

  // Dodajemy efekt, który reaguje na zmianę selectedTeam
  React.useEffect(() => {
    // Wywołuj refreshMatchesList tylko gdy selectedTeam jest ustawiony (nie pusty)
    if (selectedTeam) {
      refreshMatchesList(selectedTeam);
    }
  }, [selectedTeam, refreshMatchesList]);

  // Dodajemy efekt, który sprawdzi wartości stref w localStorage przy renderowaniu
  useEffect(() => {
    // Sprawdzamy, czy w localStorage są zapisane tymczasowe strefy
    const savedStartZone = localStorage.getItem('tempStartZone');
    const savedEndZone = localStorage.getItem('tempEndZone');
    
    // Jeśli są strefy w localStorage, a stan jest pusty, wczytujemy je
    if (savedStartZone && startZone === null) {
      setStartZone(Number(savedStartZone));
    }
    
    if (savedEndZone && endZone === null) {
      setEndZone(Number(savedEndZone));
      
      // Jeśli mamy obie strefy, otwieramy ActionModal
      if (savedStartZone && !isActionModalOpen) {
        setTimeout(() => openActionModalWithVideoTime(), 100);
      }
    }
  }, []);  // Wykonaj tylko raz przy montowaniu komponentu

  // Dodajemy efekt, który sprawdzi i zainicjalizuje kolekcję teams
  useEffect(() => {
    const setupTeamsCollection = async () => {
      try {
        // Najpierw sprawdzamy, czy aplikacja jest już w trybie offline
        const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('firestore_offline_mode') === 'true';
        if (isOfflineMode) {
          return;
        }
        
        const teamsExist = await checkTeamsCollection();
        if (!teamsExist) {
          const initialized = await initializeTeams();
          if (initialized) {
            // Po inicjalizacji pobierz zespoły, aby zaktualizować pamięć podręczną
            await fetchTeams();
          }
        } else {
          // Pobierz zespoły do pamięci podręcznej
          await fetchTeams();
        }
      } catch (error) {
        console.error("Błąd podczas sprawdzania/inicjalizacji kolekcji teams:", error);
        
        // Sprawdzamy, czy to błąd uprawnień
        if (error instanceof Error && error.message.includes("Missing or insufficient permissions")) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('firestore_offline_mode', 'true');
            toast.error("Brak uprawnień do kolekcji teams. Aplikacja działa w trybie offline.");
          }
        }
      }
    };

    // Wywołanie funkcji inicjalizującej
    setupTeamsCollection();
  }, []); // Wykonaj tylko raz przy montowaniu komponentu

  // Modyfikujemy funkcję obsługi przełącznika half
  const handleSecondHalfToggle = React.useCallback((value: React.SetStateAction<boolean>) => {
    // Określamy nową wartość niezależnie od typu value (funkcja lub wartość bezpośrednia)
    const newValue = typeof value === 'function' ? value(isSecondHalf) : value;
    
    // Zapisujemy wartość w stanie lokalnym
    setIsSecondHalf(newValue);
    
    // Ustawiamy isSecondHalf w hooku usePackingActions
    if (typeof packingActions.setIsSecondHalf === 'function') {
      packingActions.setIsSecondHalf(newValue);
    }
    
    // Zapisujemy wartość w localStorage
    localStorage.setItem('currentHalf', newValue ? 'P2' : 'P1');
    

  }, [isSecondHalf, packingActions]);

  // Oblicz dostępne sezony na podstawie meczów wybranego zespołu
  // MUSI być przed WSZYSTKIMI warunkowymi returnami, aby hook był zawsze wywoływany
  const availableSeasons = React.useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    return getAvailableSeasonsFromMatches(teamFiltered);
  }, [allMatches, selectedTeam]);

  // Sprawdź czy użytkownik ma dostęp do aplikacji
  if (isAppLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Brak dostępu</h1>
        <p>Musisz być zalogowany, aby uzyskać dostęp do aplikacji.</p>
        <Link href="/login" style={{
          padding: "10px 20px",
          backgroundColor: "#4a90e2",
          color: "white",
          textDecoration: "none",
          borderRadius: "4px",
          display: "inline-block"
        }}>
          Przejdź do logowania
        </Link>
      </div>
    );
  }

  if (availableTeams.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Brak uprawnień</h1>
        <p>Nie masz dostępu do żadnych zespołów. Skontaktuj się z administratorem.</p>
        <p>Status: {isAdmin ? 'Administrator' : 'Użytkownik'}</p>
        <p>Przypisane zespoły: {userTeams && userTeams.length > 0 ? userTeams.join(', ') : 'Brak'}</p>
        <button
          onClick={logout}
          style={{
            padding: "10px 20px",
            backgroundColor: "#e74c3c",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Wyloguj się
        </button>
      </div>
    );
  }

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
    
    const finalPlayerData = {
      ...playerData,
      teams: teams,
    };
    
    handleSavePlayer(finalPlayerData);
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
    if (!startZone || !endZone) {
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
        
        // Najpierw czyścimy poprzednie wartości
        handleZoneSelect(null); // reset
        
        // Teraz ustawiamy strefę dla dryblingu
        if (startZone !== null) {
          // Przekazujemy startZone jako number, co jest teraz zgodne z typem funkcji
          handleZoneSelect(startZone, startXT);
        }
      } else {
        // To jest podanie
        setActionType("pass");
        
        // Najpierw czyścimy poprzednie wartości
        handleZoneSelect(null); // reset
        
        // Teraz ustawiamy strefę początkową
        if (startZone !== null) {
          // Przekazujemy startZone jako number, co jest teraz zgodne z typem funkcji
          handleZoneSelect(startZone, startXT);
        }
        
        // Potem ustawiamy strefę końcową
        if (endZone !== null) {
          // Przekazujemy endZone jako number, co jest teraz zgodne z typem funkcji
          handleZoneSelect(endZone, endXT);
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  };

  const onSaveAction = async () => {
    // Sprawdzamy czy matchInfo istnieje przed wywołaniem handleSaveAction
    if (!matchInfo) {
      alert("Wybierz mecz, aby zapisać akcję!");
      toggleMatchModal(true);
      return;
    }
    
    // Walidacja w zależności od kategorii i trybu
    if (actionCategory === "regain") {
      // W akcjach regain sprawdzamy tylko jednego zawodnika (odbiorcę piłki)
      if (!selectedPlayerId) {
        alert("Wybierz zawodnika odbierającego piłkę!");
        return;
      }
    } else if (actionCategory === "loses") {
      // W akcjach loses sprawdzamy tylko jednego zawodnika (zawodnika, który stracił piłkę)
      if (!selectedPlayerId) {
        alert("Wybierz zawodnika, który stracił piłkę!");
        return;
      }
    } else if (actionMode === "defense") {
      // W trybie obrony sprawdzamy czy są wybrani zawodnicy obrony
      if (!selectedDefensePlayers || selectedDefensePlayers.length === 0) {
        alert("Wybierz co najmniej jednego zawodnika miniętego przez przeciwnika!");
        return;
      }
    } else {
      // W trybie ataku sprawdzamy standardowe warunki
      if (!selectedPlayerId) {
        alert("Wybierz zawodnika rozpoczynającego akcję!");
        return;
      }
      
      // W przypadku podania sprawdzamy, czy wybrany jest odbiorca
      if (actionType === "pass" && !selectedReceiverId) {
        alert("Wybierz zawodnika kończącego podanie!");
        return;
      }
    }
    
    // Pobieramy wartości stref z localStorage, jeśli są tam zapisane
    let finalStartZone = startZone;
    let finalEndZone = endZone;
    
    // Jeśli startZone jest null, próbujemy pobrać z localStorage
    if (finalStartZone === null || finalStartZone === undefined) {
      const savedStartZone = localStorage.getItem('tempStartZone');
      if (savedStartZone) {
        finalStartZone = Number(savedStartZone);
      }
    }
    
    // Jeśli endZone jest null, próbujemy pobrać z localStorage
    if (finalEndZone === null || finalEndZone === undefined) {
      const savedEndZone = localStorage.getItem('tempEndZone');
      if (savedEndZone) {
        finalEndZone = Number(savedEndZone);
      }
    }
    
    // Sprawdzamy czy startZone jest zdefiniowane (nawet jeśli jest zerem)
    if (finalStartZone === null || finalStartZone === undefined) {
      alert("Wybierz strefę początkową akcji!");
      return;
    }

    // Sprawdzamy czy endZone jest zdefiniowane (nawet jeśli jest zerem)
    if (finalEndZone === null || finalEndZone === undefined) {
      alert("Wybierz strefę końcową akcji!");
      return;
    }
    
    // Przygotujemy wartości xT dla stref
    try {
      const row1 = Math.floor(finalStartZone / 12);
      const col1 = finalStartZone % 12;
      const startXT = getXTValueFromMatrix(row1, col1);
      
      const row2 = Math.floor(finalEndZone / 12);
      const col2 = finalEndZone % 12;
      const endXT = getXTValueFromMatrix(row2, col2);
      
      // Ustawimy odpowiedni typ akcji
      const isDrybling = finalStartZone === finalEndZone;
      if (isDrybling) {
        setActionType("dribble");
      }
      
      // Wywołujemy handleSaveAction z matchInfo, wartościami stref i wartościami xT
      try {
        const success = await handleSaveAction(
          matchInfo, 
          finalStartZone, 
          finalEndZone,   
          startXT,   
          endXT,     
          currentPoints,
          isSecondHalf
        );
        
        if (success) {
          // Resetujemy stan tylko jeśli zapis się powiódł
          // Usuwamy wartości stref z localStorage
          localStorage.removeItem('tempStartZone');
          localStorage.removeItem('tempEndZone');
          
          // Resetujemy stan komponentu
          setEndZone(null);
          setStartZone(null);
          
          // DODANO: Zamykamy modal i resetujemy wybór zawodników po zapisaniu akcji
          setIsActionModalOpen(false);
          setSelectedPlayerId(null);
          setSelectedReceiverId(null);
          setSelectedDefensePlayers([]);
          
          // DODANO: Przenieś focus do okna z wideo po zapisaniu akcji (tylko jeśli jest otwarte)
          const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
          if (isExternalWindowOpen) {
            // Możemy wysłać wiadomość do zewnętrznego okna, ale nie otwieramy nowego
            window.postMessage({ type: 'FOCUS_WINDOW' }, '*');
          }
        }
      } catch (error) {
        alert("Wystąpił błąd podczas zapisywania akcji: " + (error instanceof Error ? error.message : String(error)));
      }
    } catch (error) {
      console.error("Błąd podczas przygotowywania danych stref:", error);
      alert("Wystąpił błąd podczas przygotowywania danych: " + (error instanceof Error ? error.message : String(error)));
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

  // Funkcja do otwierania modalu nowego meczu
  const openNewMatchModal = () => {
    setIsNewMatchModalOpen(true);
  };

  // Funkcja do zamykania modalu nowego meczu
  const closeNewMatchModal = () => {
    setIsNewMatchModalOpen(false);
  };
  
  // Funkcja do otwierania modalu edycji meczu
  const openEditMatchModal = () => {
    toggleMatchModal(true);
  };

  // Funkcja do zamykania modalu edycji meczu
  const closeEditMatchModal = () => {
    toggleMatchModal(false);
  };

  // Modyfikujemy funkcje obsługi zapisywania, aby odświeżały listę meczów po zapisie
  const handleSaveNewMatch = async (matchInfo: TeamInfo) => {
    try {
      // Zapisujemy mecz
      const savedMatch = await handleSaveMatchInfo(matchInfo);
      return savedMatch;
    } catch (error) {
      alert("Wystąpił błąd przy zapisywaniu meczu. Spróbuj ponownie.");
      return null;
    }
  };

  // Obsługa zapisywania edytowanego meczu
  const handleSaveEditedMatch = async (matchInfo: TeamInfo) => {
    try {
      // Zapisujemy mecz
      const savedMatch = await handleSaveMatchInfo(matchInfo);
      return savedMatch;
    } catch (error) {
      alert("Wystąpił błąd przy zapisywaniu meczu. Spróbuj ponownie.");
      return null;
    }
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
    
    // Aktualizuj informacje o meczu, jeśli to nowy mecz
    if (data.matchInfo && !allMatches.some(m => m.matchId === data.matchInfo.matchId)) {
      setEditingMatch(data.matchInfo);
      toggleMatchModal(true);
    }
    
    alert(`Import zakończony sukcesem! Zaimportowano ${newPlayers.length} graczy i ${newActions.length} akcji.`);
  };

  // Dodaj funkcję obsługi błędu importu
  const handleImportError = (error: string) => {
    alert(`Błąd importu: ${error}`);
  };

  // Funkcja do obsługi wyboru strefy dla zakładki regain (pojedynczy klik)
  const handleRegainZoneSelection = (zoneId: number, xT?: number) => {
    if (zoneId === null || zoneId === undefined) {
      return;
    }
    
    // W regain ustawiamy strefę i od razu otwieramy modal
    setStartZone(zoneId);
    setEndZone(zoneId); // Dla regain używamy tej samej strefy jako start i end
    localStorage.setItem('tempStartZone', String(zoneId));
    localStorage.setItem('tempEndZone', String(zoneId));
    setActionType("pass"); // Domyślnie pass, ale można zmienić w modalu
    
    // Odczekaj chwilę przed otwarciem modalu, aby stan się zaktualizował
    setTimeout(() => {
      openActionModalWithVideoTime();
    }, 100);
  };

  // Funkcja do obsługi wyboru strefy dla zakładki loses (pojedynczy klik)
  const handleLosesZoneSelection = (zoneId: number, xT?: number) => {
    if (zoneId === null || zoneId === undefined) {
      return;
    }
    
    // W loses ustawiamy strefę i od razu otwieramy modal
    setStartZone(zoneId);
    setEndZone(zoneId); // Dla loses używamy tej samej strefy jako start i end
    localStorage.setItem('tempStartZone', String(zoneId));
    localStorage.setItem('tempEndZone', String(zoneId));
    setActionType("pass"); // Domyślnie pass, ale można zmienić w modalu
    
    // Odczekaj chwilę przed otwarciem modalu, aby stan się zaktualizował
    setTimeout(() => {
      openActionModalWithVideoTime();
    }, 100);
  };

  // Funkcja do obsługi wyboru strefy dla zakładki packing (podwójny klik)
  const handlePackingZoneSelection = (zoneId: number, xT?: number) => {
    if (zoneId === null || zoneId === undefined) {
      return;
    }
    
    // Jeśli nie mamy startZone, to ustawiamy ją
    if (startZone === null) {
      setStartZone(zoneId);
      localStorage.setItem('tempStartZone', String(zoneId));
      return;
    }
    
    // Jeśli mamy startZone, sprawdzamy czy to ta sama strefa (drybling)
    if (startZone === zoneId) {
      // To jest drybling - ustawiamy endZone na tę samą wartość
      setEndZone(zoneId);
      localStorage.setItem('tempEndZone', String(zoneId));
      setActionType("dribble");
      
      // Odczekaj chwilę przed otwarciem modalu, aby stan się zaktualizował
      setTimeout(() => {
        openActionModalWithVideoTime();
      }, 100);
      
      return;
    }
    
    // Jeśli mamy startZone, ale nie mamy endZone i to inna strefa - to podanie
    if (endZone === null) {
      setEndZone(zoneId);
      localStorage.setItem('tempEndZone', String(zoneId));
      setActionType("pass");
      
      // Odczekaj chwilę przed otwarciem modalu, aby stan się zaktualizował
      setTimeout(() => {
        openActionModalWithVideoTime();
      }, 100);
      
      return;
    }
    
    // Jeśli mamy obie strefy, resetujemy je i zaczynamy od nowa
    // Najpierw resetujemy strefy
    setEndZone(null);
    localStorage.removeItem('tempEndZone');
    
    // Dajemy czas na zaktualizowanie stanu
    setTimeout(() => {
      // Ustawiamy nową strefę początkową
      setStartZone(zoneId);
      localStorage.setItem('tempStartZone', String(zoneId));
    }, 50);
  };

  // Funkcja wyboru strefy - wybiera odpowiednią logikę na podstawie aktywnej zakładki
  const handleZoneSelection = (zoneId: number, xT?: number) => {
    if (activeTab === "regain") {
      return handleRegainZoneSelection(zoneId, xT);
    } else if (activeTab === "loses") {
      return handleLosesZoneSelection(zoneId, xT);
    } else {
      return handlePackingZoneSelection(zoneId, xT);
    }
  };

  // Modyfikujemy funkcję resetActionState, aby nie odwoływała się do hookResetActionState
  // Niestandardowa funkcja resetująca stan akcji zachowująca wybrane wartości
  const resetCustomActionState = () => {
    // Używamy funkcji z nowego hooka
    resetActionState();
    
    // DODANO: Resetujemy także strefy na boisku i selectedZone
    setStartZone(null);
    setEndZone(null);
    setSelectedZone(null);
    
    // Resetujemy stan obrony
    setActionMode("attack");
    setSelectedDefensePlayers([]);
    
    // Czyścimy również localStorage ze stref
    localStorage.removeItem('tempStartZone');
    localStorage.removeItem('tempEndZone');
  };

  // Modyfikacja funkcji usuwania meczu
  const handleMatchDelete = async (matchId: string) => {
    try {
      await handleDeleteMatch(matchId);
      
      // Hook useMatchInfo sam zajmuje się odświeżeniem listy meczów
      // Nie ma potrzeby dodatkowego wywoływania refreshMatchesList
    } catch (error) {
      console.error("❌ Błąd podczas usuwania meczu:", error);
      alert("Wystąpił błąd podczas usuwania meczu. Spróbuj ponownie.");
    }
  };

  // Funkcja obsługująca wylogowanie
  const handleLogout = () => {
    if (window.confirm("Czy na pewno chcesz się wylogować?")) {
      logout();
      // Router przekieruje do strony logowania automatycznie przez AuthGuard
    }
  };

  // Funkcja do odświeżania danych z Firebase
  const handleRefreshData = async () => {
    await forceRefreshFromFirebase(selectedTeam);
  };

  // Przekażę informację do ActionsTable, aby można było zaktualizować dane akcji o imiona graczy
  const handleRefreshPlayersData = () => {
    if (!players || !matchInfo?.matchId) return;
    
    // Uzupełniamy dane graczy w akcjach
    const enrichedActions = actions.map(action => {
      const updatedAction = { ...action };
      
      // Dodaj dane nadawcy (sender)
      if (action.senderId && (!action.senderName || !action.senderNumber)) {
        const senderPlayer = players.find(p => p.id === action.senderId);
        if (senderPlayer) {
          updatedAction.senderName = senderPlayer.name;
          updatedAction.senderNumber = senderPlayer.number;
        }
      }
      
      // Dodaj dane odbiorcy (receiver)
      if (action.receiverId && (!action.receiverName || !action.receiverNumber)) {
        const receiverPlayer = players.find(p => p.id === action.receiverId);
        if (receiverPlayer) {
          updatedAction.receiverName = receiverPlayer.name;
          updatedAction.receiverNumber = receiverPlayer.number;
        }
      }
      
      return updatedAction;
    });
    
    // Jeśli dokonano jakichkolwiek zmian, zapisz do Firebase
    const hasChanges = enrichedActions.some((updatedAction, index) => 
      updatedAction.senderName !== actions[index].senderName || 
      updatedAction.senderNumber !== actions[index].senderNumber ||
      updatedAction.receiverName !== actions[index].receiverName ||
      updatedAction.receiverNumber !== actions[index].receiverNumber
    );
    
    if (hasChanges) {
      // Synchronizuj z bazą danych
      if (syncEnrichedActions) {
        syncEnrichedActions(matchInfo.matchId, enrichedActions);
      }
      
      // Aktualizuj lokalny stan akcji
      setActions(enrichedActions);
    }
  };

  // Obsługa synchronizacji wzbogaconych akcji z Firebase
  const syncEnrichedActions = async (matchId: string, updatedActions: Action[]) => {
    try {
      const db = getDB();
      
      // Pobierz referencję do dokumentu meczu
      const matchRef = doc(db, "matches", matchId);
      
      // Aktualizuj dokument z wzbogaconymi akcjami
      await updateDoc(matchRef, {
        actions_packing: updatedActions.map(action => removeUndefinedFields(action))
      });
      
      return true;
    } catch (error) {
      console.error("Błąd podczas synchronizacji wzbogaconych akcji:", error);
      return false;
    }
  };

  // Obsługa edycji akcji
  // Funkcja do określenia kategorii akcji
  const getActionCategory = (action: Action): "packing" | "regain" | "loses" => {
    // Loses: ma isReaction5s (to jest główny wskaźnik dla loses)
    if (action.isReaction5s !== undefined) {
      return "loses";
    }
    // Regain: ma playersBehindBall lub opponentsBeforeBall, ale NIE ma isReaction5s
    if (action.playersBehindBall !== undefined || 
        action.opponentsBeforeBall !== undefined ||
        action.totalPlayersOnField !== undefined ||
        action.totalOpponentsOnField !== undefined ||
        action.playersLeftField !== undefined ||
        action.opponentsLeftField !== undefined) {
      return "regain";
    }
    // Packing: domyślnie
    return "packing";
  };

  const handleEditAction = (action: Action) => {
    setEditingAction(action);
    setIsActionEditModalOpen(true);
  };

  // Obsługa zapisania edytowanej akcji
  const handleSaveEditedAction = async (editedAction: Action) => {
    try {
      if (!editedAction.matchId) {
        console.error("Brak matchId w edytowanej akcji");
        alert("Nie można zapisać akcji bez przypisania do meczu");
        return;
      }

      const db = getDB();

      // Określamy kategorię akcji i odpowiednią kolekcję
      const actionCategory = getActionCategory(editedAction);
      let collectionField: string;
      if (actionCategory === "regain") {
        collectionField = "actions_regain";
      } else if (actionCategory === "loses") {
        collectionField = "actions_loses";
      } else {
        // Dla packing sprawdzamy tryb (attack/defense)
        const isDefense = editedAction.mode === "defense";
        collectionField = isDefense ? "actions_unpacking" : "actions_packing";
      }

      // Znajdź oryginalną akcję, żeby sprawdzić czy zmieniał się mecz
      const originalAction = actions.find(a => a.id === editedAction.id);
      const originalMatchId = originalAction?.matchId;
      
      // Określamy kategorię oryginalnej akcji
      const originalActionCategory = originalAction ? getActionCategory(originalAction) : actionCategory;
      let originalCollectionField: string;
      if (originalActionCategory === "regain") {
        originalCollectionField = "actions_regain";
      } else if (originalActionCategory === "loses") {
        originalCollectionField = "actions_loses";
      } else {
        const isDefense = originalAction?.mode === "defense";
        originalCollectionField = isDefense ? "actions_unpacking" : "actions_packing";
      }

      // Czy akcja została przeniesiona do innego meczu?
      const isMovedToNewMatch = originalMatchId && originalMatchId !== editedAction.matchId;

      if (isMovedToNewMatch) {
        // 1. Usuń akcję ze starego meczu
        const oldMatchRef = doc(db, "matches", originalMatchId);
        const oldMatchDoc = await getDoc(oldMatchRef);
        
        if (oldMatchDoc.exists()) {
          const oldMatchData = oldMatchDoc.data() as TeamInfo;
          const oldActions = (oldMatchData[originalCollectionField as keyof TeamInfo] as Action[] | undefined) || [];
          const filteredOldActions = oldActions.filter(a => a.id !== editedAction.id);
          
          await updateDoc(oldMatchRef, {
            [originalCollectionField]: filteredOldActions
          });
        }

        // 2. Dodaj akcję do nowego meczu
        const newMatchRef = doc(db, "matches", editedAction.matchId);
        const newMatchDoc = await getDoc(newMatchRef);
        
        if (!newMatchDoc.exists()) {
          console.error("❌ Nowy mecz nie istnieje:", editedAction.matchId);
          alert("Wybrany mecz nie istnieje");
          return;
        }

        const newMatchData = newMatchDoc.data() as TeamInfo;
        const newActions = (newMatchData[collectionField as keyof TeamInfo] as Action[] | undefined) || [];
        
        const updatedNewActions = [...newActions, removeUndefinedFields(editedAction)];
        
        await updateDoc(newMatchRef, {
          [collectionField]: updatedNewActions
        });

        // Aktualizuj lokalny stan jeśli dotknięty jest aktualny mecz
        if (matchInfo?.matchId === originalMatchId) {
          // Usuń akcję z lokalnego stanu (stary mecz)
          const filteredActions = actions.filter(a => a.id !== editedAction.id);
          setActions(filteredActions);
        } else if (matchInfo?.matchId === editedAction.matchId) {
          // Dodaj akcję do lokalnego stanu (nowy mecz)
          setActions([...actions, editedAction]);
        }
      } else {
        // Aktualizacja akcji w tym samym meczu
        const matchRef = doc(db, "matches", editedAction.matchId);
        const matchDoc = await getDoc(matchRef);

        if (!matchDoc.exists()) {
          console.error("❌ Mecz nie istnieje:", editedAction.matchId);
          alert("Wybrany mecz nie istnieje");
          return;
        }

        const matchData = matchDoc.data() as TeamInfo;
        const currentActions = (matchData[collectionField as keyof TeamInfo] as Action[] | undefined) || [];
        
        const actionIndex = currentActions.findIndex(a => a.id === editedAction.id);
        if (actionIndex === -1) {
          console.error("❌ Nie znaleziono akcji do edycji:", editedAction.id, "w kolekcji:", collectionField);
          alert("Nie znaleziono akcji do edycji");
          return;
        }

        const updatedActions = [...currentActions];
        updatedActions[actionIndex] = removeUndefinedFields(editedAction);

        await updateDoc(matchRef, {
          [collectionField]: updatedActions
        });

        // Aktualizuj lokalny stan jeśli to aktualny mecz
        if (matchInfo && editedAction.matchId === matchInfo.matchId) {
          // Dla regain/loses musimy załadować akcje z odpowiedniej kolekcji
          if (actionCategory === "regain" || actionCategory === "loses") {
            // Odśwież akcje z bazy dla odpowiedniej kategorii
            const refreshedMatchDoc = await getDoc(matchRef);
            if (refreshedMatchDoc.exists()) {
              const refreshedMatchData = refreshedMatchDoc.data() as TeamInfo;
              const refreshedActions = (refreshedMatchData[collectionField as keyof TeamInfo] as Action[] | undefined) || [];
              setActions(refreshedActions);
            }
          } else {
            setActions(updatedActions);
          }
        }
      }


      setIsActionEditModalOpen(false);
      setEditingAction(null);
      
      // Wywołaj event odświeżenia dla innych komponentów
      const refreshEvent = new CustomEvent('matchesListRefresh', {
        detail: { timestamp: Date.now() }
      });
      document.dispatchEvent(refreshEvent);
      
    } catch (error) {
      console.error("❌ Błąd podczas zapisywania edytowanej akcji:", error);
      alert("Wystąpił błąd podczas zapisywania akcji: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Obsługa zamknięcia modalu edycji akcji
  const handleCloseActionEditModal = () => {
    setIsActionEditModalOpen(false);
    setEditingAction(null);
  };

  // Najpierw sprawdź czy aplikacja się ładuje
  if (isAppLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Ładowanie aplikacji...</p>
        </div>
      </div>
    );
  }

  // Sprawdź czy użytkownik ma dostęp do jakichkolwiek zespołów
  if (isAuthenticated && !isAdmin && (!userTeams || userTeams.length === 0)) {
    return (
      <div className={styles.container}>
        <div className={styles.noTeamsAccess}>
          <h2>🚫 Brak dostępu do zespołów</h2>
          <p>Twoje konto nie ma uprawnień do żadnego zespołu. Skontaktuj się z administratorem, aby uzyskać dostęp.</p>
          <button 
            onClick={handleLogout}
            className={styles.logoutButton}
          >
            Wyloguj się
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <OfflineStatusBanner />
      <div className={styles.topHeader}>
        <div className={styles.headerControlsWrapper}>
          <div className={styles.selectorsGroup}>
            <TeamsSelector
              selectedTeam={selectedTeam}
              onChange={setSelectedTeam}
              className={styles.teamDropdown}
              availableTeams={availableTeams}
              showLabel={true}
              isExpanded={isTeamsSelectorExpanded}
              onToggle={() => setIsTeamsSelectorExpanded(!isTeamsSelectorExpanded)}
            />
            {selectedSeason && (
              <SeasonSelector
                selectedSeason={selectedSeason}
                onChange={setSelectedSeason}
                className={styles.seasonDropdown}
                showLabel={true}
                availableSeasons={availableSeasons}
              />
            )}
            <div className={styles.playersGridWrapper}>
              <PlayersGrid
                players={filteredPlayers}
                selectedPlayerId={selectedPlayerId}
                onPlayerSelect={setSelectedPlayerId}
                onAddPlayer={() => setIsModalOpen(true)}
                onEditPlayer={handleEditPlayer}
                onDeletePlayer={onDeletePlayer}
                isExpanded={isPlayersGridExpanded}
                onToggle={() => setIsPlayersGridExpanded(!isPlayersGridExpanded)}
              />
              <div className={styles.videoIconsHeader}>
                <div 
                  className={`${styles.youtubeLogoHeader} ${isVideoFullscreen ? styles.youtubeLogoHeaderActive : ''}`}
                  onClick={() => {
                    if (!isVideoVisible) {
                      // Jeśli wideo jest ukryte, pokaż je w trybie fullscreen
                      setIsVideoVisible(true);
                      setIsVideoFullscreen(true);
                    } else if (isVideoFullscreen) {
                      // Jeśli wideo jest w trybie fullscreen, całkowicie je ukryj
                      setIsVideoVisible(false);
                      setIsVideoFullscreen(false);
                    } else {
                      // Jeśli wideo jest widoczne ale nie w fullscreen, przełącz na fullscreen
                      setIsVideoFullscreen(true);
                    }
                  }}
                >
                  <svg className={styles.youtubeLogoIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
                  </svg>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (matchInfo) {
                      localStorage.setItem('externalVideoMatchInfo', JSON.stringify(matchInfo));
                      const externalWindow = window.open(
                        '/video-external',
                        'youtube-video',
                        'width=1200,height=800,scrollbars=yes,resizable=yes'
                      );
                      if (externalWindow) {
                        (window as any).externalVideoWindow = externalWindow;
                        localStorage.setItem('externalVideoWindowOpen', 'true');
                      }
                    }
                  }}
                  className={styles.externalButtonHeader}
                  title="Otwórz wideo w nowym oknie (dla drugiego monitora)"
                >
                  <span>🖥️</span>
                </button>
              </div>
            </div>
          </div>
          <div className={styles.controlsContainer}>
            {isOfflineMode && (
              <div className={styles.offlineBadge}>
                Tryb offline 📴
              </div>
            )}
            <button 
              className={styles.addButton}
              onClick={openNewMatchModal}
            >
              + Dodaj mecz
            </button>
          </div>
        </div>
        <Instructions />
      </div>
      {isPlayersGridExpanded && (
        <div className={styles.playersGridOverlay} onClick={() => setIsPlayersGridExpanded(false)}>
          <div className={styles.playersGridModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.playersGridHeader}>
              <h3 className={styles.playersGridTitle}>Zawodnicy</h3>
              <div className={styles.playersGridHeaderActions}>
                <button
                  className={styles.addPlayerButton}
                  onClick={() => setIsModalOpen(true)}
                  aria-label="Dodaj nowego zawodnika"
                  title="Dodaj nowego zawodnika"
                >
                  +
                </button>
                <button
                  className={styles.closePlayersGridButton}
                  onClick={() => setIsPlayersGridExpanded(false)}
                  aria-label="Zamknij"
                  title="Zamknij"
                >
                  ×
                </button>
              </div>
            </div>
            <div className={styles.playersGridContentWrapper}>
              {playersByPosition.sortedPositions.map((position) => (
                <div key={position} className={styles.positionGroup}>
                  <div className={styles.playersGridContent}>
                    <div className={styles.positionLabel}>
                      {position === 'Skrzydłowi' ? 'W' : position}
                    </div>
                    <div className={styles.playersGridContainer}>
                      {playersByPosition.byPosition[position].map((player) => (
                        <PlayerTile
                          key={player.id}
                          player={player}
                          isSelected={player.id === selectedPlayerId}
                          onSelect={setSelectedPlayerId}
                          onEdit={handleEditPlayer}
                          onDelete={onDeletePlayer}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <MatchInfoHeader
        matchInfo={matchInfo}
        onChangeMatch={openEditMatchModal}
        allMatches={allMatches}
        onSelectMatch={handleSelectMatch}
        onDeleteMatch={handleMatchDelete}
        selectedTeam={selectedTeam}
        onChangeTeam={setSelectedTeam}
        onManagePlayerMinutes={handleOpenPlayerMinutesModal}
        onAddNewMatch={openNewMatchModal}
        refreshCounter={matchesListRefreshCounter}
        isOfflineMode={isOfflineMode}
        players={players}
        availableTeams={availableTeams}
        isAdmin={isAdmin}
        allAvailableTeams={allTeams}
        selectedSeason={selectedSeason || undefined}
        onChangeSeason={setSelectedSeason}
      />

      <main className={styles.content}>
        <div className={styles.controls}>
          <div className={styles.leftControls}>
          </div>
        </div>
        <div className={styles.videoPlayersContainer}>
        <YouTubeVideo 
          ref={youtubeVideoRef} 
          matchInfo={matchInfo} 
          isVisible={isVideoVisible}
          onToggleVisibility={() => setIsVideoVisible(!isVideoVisible)}
          isFullscreen={isVideoFullscreen}
          onToggleFullscreen={() => setIsVideoFullscreen(!isVideoFullscreen)}
        />
          <CustomVideoPlayer 
            ref={customVideoRef} 
            matchInfo={matchInfo} 
            isVisible={isVideoVisible}
            onToggleVisibility={() => setIsVideoVisible(!isVideoVisible)}
          />
        </div>

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "packing" && (
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
            isP0StartActive={isP0StartActive}
            setIsP0StartActive={setIsP0StartActive}
            isP1StartActive={isP1StartActive}
            setIsP1StartActive={setIsP1StartActive}
            isP2StartActive={isP2StartActive}
            setIsP2StartActive={setIsP2StartActive}
            isP3StartActive={isP3StartActive}
            setIsP3StartActive={setIsP3StartActive}
            isP0Active={isP0Active}
            setIsP0Active={setIsP0Active}
            isP1Active={isP1Active}
            setIsP1Active={setIsP1Active}
            isP2Active={isP2Active}
            setIsP2Active={setIsP2Active}
            isP3Active={isP3Active}
            setIsP3Active={setIsP3Active}
            isContact1Active={isContact1Active}
            setIsContact1Active={setIsContact1Active}
            isContact2Active={isContact2Active}
            setIsContact2Active={setIsContact2Active}
            isContact3PlusActive={isContact3PlusActive}
            setIsContact3PlusActive={setIsContact3PlusActive}
            isShot={isShot}
            setIsShot={setIsShot}
            isGoal={isGoal}
            setIsGoal={setIsGoal}
            isPenaltyAreaEntry={isPenaltyAreaEntry}
            setIsPenaltyAreaEntry={setIsPenaltyAreaEntry}
            isSecondHalf={isSecondHalf}
            setIsSecondHalf={handleSecondHalfToggle}
            isBelow8sActive={isBelow8sActive}
            setIsBelow8sActive={setIsBelow8sActive}
            isReaction5sActive={isReaction5sActive}
            setIsReaction5sActive={setIsReaction5sActive}
            isPMAreaActive={isPMAreaActive}
            setIsPMAreaActive={setIsPMAreaActive}
            playersBehindBall={playersBehindBall}
            setPlayersBehindBall={setPlayersBehindBall}
            opponentsBeforeBall={opponentsBeforeBall}
            setOpponentsBeforeBall={setOpponentsBeforeBall}
            playersLeftField={playersLeftField}
            setPlayersLeftField={setPlayersLeftField}
            opponentsLeftField={opponentsLeftField}
            setOpponentsLeftField={setOpponentsLeftField}
            handleSaveAction={onSaveAction}
            resetActionState={resetCustomActionState}
            resetActionPoints={resetActionPoints}
            startZone={startZone}
            endZone={endZone}
            isActionModalOpen={isActionModalOpen}
            setIsActionModalOpen={setIsActionModalOpen}
            matchInfo={matchInfo}
            // Nowe propsy dla trybu unpacking
            mode={actionMode}
            onModeChange={setActionMode}
            selectedDefensePlayers={selectedDefensePlayers}
            onDefensePlayersChange={setSelectedDefensePlayers}
            // Kategoria akcji
            actionCategory="packing"
          />
        )}

        {activeTab === "regain" && (
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
            isP1Active={isP1Active}
            setIsP1Active={setIsP1Active}
            isP2Active={isP2Active}
            setIsP2Active={setIsP2Active}
            isP3Active={isP3Active}
            setIsP3Active={setIsP3Active}
            isContact1Active={isContact1Active}
            setIsContact1Active={setIsContact1Active}
            isContact2Active={isContact2Active}
            setIsContact2Active={setIsContact2Active}
            isContact3PlusActive={isContact3PlusActive}
            setIsContact3PlusActive={setIsContact3PlusActive}
            isShot={isShot}
            setIsShot={setIsShot}
            isGoal={isGoal}
            setIsGoal={setIsGoal}
            isPenaltyAreaEntry={isPenaltyAreaEntry}
            setIsPenaltyAreaEntry={setIsPenaltyAreaEntry}
            isSecondHalf={isSecondHalf}
            setIsSecondHalf={handleSecondHalfToggle}
            isBelow8sActive={isBelow8sActive}
            setIsBelow8sActive={setIsBelow8sActive}
            isReaction5sActive={isReaction5sActive}
            setIsReaction5sActive={setIsReaction5sActive}
            isPMAreaActive={isPMAreaActive}
            setIsPMAreaActive={setIsPMAreaActive}
            playersBehindBall={playersBehindBall}
            setPlayersBehindBall={setPlayersBehindBall}
            opponentsBeforeBall={opponentsBeforeBall}
            setOpponentsBeforeBall={setOpponentsBeforeBall}
            playersLeftField={playersLeftField}
            setPlayersLeftField={setPlayersLeftField}
            opponentsLeftField={opponentsLeftField}
            setOpponentsLeftField={setOpponentsLeftField}
            handleSaveAction={onSaveAction}
            resetActionState={resetCustomActionState}
            resetActionPoints={resetActionPoints}
            startZone={startZone}
            endZone={endZone}
            isActionModalOpen={isActionModalOpen}
            setIsActionModalOpen={setIsActionModalOpen}
            matchInfo={matchInfo}
            // Nowe propsy dla trybu regain
            mode={actionMode}
            onModeChange={setActionMode}
            selectedDefensePlayers={selectedDefensePlayers}
            onDefensePlayersChange={setSelectedDefensePlayers}
            // Kategoria akcji
            actionCategory="regain"
          />
        )}

        {activeTab === "loses" && (
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
            isP1Active={isP1Active}
            setIsP1Active={setIsP1Active}
            isP2Active={isP2Active}
            setIsP2Active={setIsP2Active}
            isP3Active={isP3Active}
            setIsP3Active={setIsP3Active}
            isContact1Active={isContact1Active}
            setIsContact1Active={setIsContact1Active}
            isContact2Active={isContact2Active}
            setIsContact2Active={setIsContact2Active}
            isContact3PlusActive={isContact3PlusActive}
            setIsContact3PlusActive={setIsContact3PlusActive}
            isShot={isShot}
            setIsShot={setIsShot}
            isGoal={isGoal}
            setIsGoal={setIsGoal}
            isPenaltyAreaEntry={isPenaltyAreaEntry}
            setIsPenaltyAreaEntry={setIsPenaltyAreaEntry}
            isSecondHalf={isSecondHalf}
            setIsSecondHalf={handleSecondHalfToggle}
            isBelow8sActive={isBelow8sActive}
            setIsBelow8sActive={setIsBelow8sActive}
            isReaction5sActive={isReaction5sActive}
            setIsReaction5sActive={setIsReaction5sActive}
            isPMAreaActive={isPMAreaActive}
            setIsPMAreaActive={setIsPMAreaActive}
            playersBehindBall={playersBehindBall}
            setPlayersBehindBall={setPlayersBehindBall}
            opponentsBeforeBall={opponentsBeforeBall}
            setOpponentsBeforeBall={setOpponentsBeforeBall}
            playersLeftField={playersLeftField}
            setPlayersLeftField={setPlayersLeftField}
            opponentsLeftField={opponentsLeftField}
            setOpponentsLeftField={setOpponentsLeftField}
            handleSaveAction={onSaveAction}
            resetActionState={resetCustomActionState}
            resetActionPoints={resetActionPoints}
            startZone={startZone}
            endZone={endZone}
            isActionModalOpen={isActionModalOpen}
            setIsActionModalOpen={setIsActionModalOpen}
            matchInfo={matchInfo}
            mode={actionMode}
            onModeChange={setActionMode}
            selectedDefensePlayers={selectedDefensePlayers}
            onDefensePlayersChange={setSelectedDefensePlayers}
            // Kategoria akcji
            actionCategory="loses"
          />
        )}

        {activeTab === "acc8s" && (
          <div className={styles.acc8sSection}>
            <div className={styles.acc8sHeader}>
              <h3>Akcje 8s ACC</h3>
              <button
                onClick={async () => {
                  if (!matchInfo?.matchId || !matchInfo?.team) {
                    alert("Wybierz mecz, aby dodać akcję 8s ACC!");
                    return;
                  }
                  await openAcc8sModalWithVideoTime();
                }}
                className={styles.acc8sAddButton}
                title="Dodaj akcję 8s ACC"
              >
                +
              </button>
            </div>
            <Acc8sTable
              entries={acc8sEntries}
              onDeleteEntry={async (entryId) => {
                if (confirm("Czy na pewno chcesz usunąć tę akcję 8s ACC?")) {
                  await deleteAcc8sEntry(entryId);
                }
              }}
              onEditEntry={(entry) => {
                setAcc8sModalData({ editingEntry: entry });
                setIsAcc8sModalOpen(true);
              }}
              onVideoTimeClick={async (timestamp) => {
                // Sprawdź czy mamy otwarte zewnętrzne okno wideo (tak jak w ShotsTable)
                const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
                const externalWindow = (window as any).externalVideoWindow;
                
                if (isExternalWindowOpen && externalWindow && !externalWindow.closed) {
                  // Wyślij wiadomość do zewnętrznego okna
                  externalWindow.postMessage({
                    type: 'SEEK_TO_TIME',
                    time: timestamp
                  }, '*');
                } else {
                  await seekActiveVideo(timestamp);
                }
              }}
              youtubeVideoRef={youtubeVideoRef}
              customVideoRef={customVideoRef}
            />
          </div>
        )}

        {activeTab === "xg" && (
          <XGPitch
            shots={shots}
            onShotAdd={handleShotAdd}
            onShotClick={handleShotClick}
            selectedShotId={selectedShotId}
            matchInfo={matchInfo || undefined}
            allTeams={allTeams}
          />
        )}

        {activeTab === "pk_entries" && (
          <PKEntriesPitch
            pkEntries={pkEntries}
            onEntryAdd={async (startX, startY, endX, endY) => {
              if (!matchInfo?.matchId || !matchInfo?.team) {
                alert("Wybierz mecz, aby dodać wejście PK!");
                return;
              }
              
              // Pobierz czas wideo przed otwarciem modala (podobnie jak w openActionModalWithVideoTime)
              const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
              const hasExternalVideoTime = externalVideoTime > 0;
              
              if (isExternalWindowOpen || hasExternalVideoTime) {
                // Jeśli mamy zewnętrzne okno lub externalVideoTime, użyj tego i odejmij 10s
                const timestamp = hasExternalVideoTime ? externalVideoTime : 0;
                const adjustedTime = Math.max(0, timestamp - 10);
                localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
              } else {
                // Spróbuj pobrać czas z aktywnego playera
                const currentTime = await getActiveVideoTime();
                if (currentTime > 0) {
                  // Odejmij 15 sekund od czasu wideo
                  const adjustedTime = Math.max(0, currentTime - 10);
                  localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
                } else {
                  // Fallback - ustaw 0
                  localStorage.setItem('tempVideoTimestamp', '0');
                }
              }
              
              // Otwórz modal z danymi wejścia PK
              setPkEntryModalData({ startX, startY, endX, endY });
              setIsPKEntryModalOpen(true);
            }}
            onEntryClick={(entry) => {
              setSelectedPKEntryId(entry.id);
              setPkEntryModalData({
                startX: entry.startX,
                startY: entry.startY,
                endX: entry.endX,
                endY: entry.endY,
                editingEntry: entry,
              });
              setIsPKEntryModalOpen(true);
            }}
            selectedEntryId={selectedPKEntryId}
            matchInfo={matchInfo || undefined}
            allTeams={allTeams}
          />
        )}

        {activeTab === "pk_entries" && pkEntryModalData && (
          <PKEntryModal
            isOpen={isPKEntryModalOpen}
            onClose={() => {
              setIsPKEntryModalOpen(false);
              setPkEntryModalData(null);
              setSelectedPKEntryId(undefined);
            }}
            onSave={async (entryData) => {
              if (pkEntryModalData.editingEntry) {
                await updatePKEntry(pkEntryModalData.editingEntry.id, entryData);
              } else {
                await addPKEntry(entryData);
              }
              setIsPKEntryModalOpen(false);
              setPkEntryModalData(null);
              setSelectedPKEntryId(undefined);
            }}
            onDelete={async (entryId) => {
              await deletePKEntry(entryId);
              setIsPKEntryModalOpen(false);
              setPkEntryModalData(null);
              setSelectedPKEntryId(undefined);
            }}
            editingEntry={pkEntryModalData.editingEntry}
            startX={pkEntryModalData.startX}
            startY={pkEntryModalData.startY}
            endX={pkEntryModalData.endX}
            endY={pkEntryModalData.endY}
            matchId={matchInfo?.matchId || ""}
            players={players}
            matchInfo={matchInfo}
          />
        )}

        {activeTab === "acc8s" && acc8sModalData && (
          <Acc8sModal
            isOpen={isAcc8sModalOpen}
            onClose={() => {
              setIsAcc8sModalOpen(false);
              setAcc8sModalData(null);
            }}
            onSave={async (entryData) => {
              console.log('Page onSave - entryData:', entryData);
              if (acc8sModalData.editingEntry) {
                const success = await updateAcc8sEntry(acc8sModalData.editingEntry.id, entryData);
                console.log('Page onSave - updateAcc8sEntry success:', success);
              } else {
                const result = await addAcc8sEntry(entryData);
                console.log('Page onSave - addAcc8sEntry result:', result);
              }
              setIsAcc8sModalOpen(false);
              setAcc8sModalData(null);
            }}
            onDelete={async (entryId) => {
              await deleteAcc8sEntry(entryId);
              setIsAcc8sModalOpen(false);
              setAcc8sModalData(null);
            }}
            editingEntry={acc8sModalData.editingEntry}
            matchId={matchInfo?.matchId || ""}
            matchInfo={matchInfo}
            players={players}
          />
        )}

        {activeTab === "packing" || activeTab === "regain" || activeTab === "loses" ? (
          <ActionsTable
            actions={filteredActions}
            players={players}
            onDeleteAction={handleDeleteAction}
            onEditAction={handleEditAction}
            onRefreshPlayersData={handleRefreshPlayersData}
            youtubeVideoRef={youtubeVideoRef}
            customVideoRef={customVideoRef}
            actionCategory={actionCategory}
          />
        ) : activeTab === "pk_entries" ? (
          <PKEntriesTable
            pkEntries={pkEntries}
            players={players}
            onDeleteEntry={async (entryId) => {
              await deletePKEntry(entryId);
            }}
            onEditEntry={(entry) => {
              setSelectedPKEntryId(entry.id);
              setPkEntryModalData({
                startX: entry.startX,
                startY: entry.startY,
                endX: entry.endX,
                endY: entry.endY,
                editingEntry: entry,
              });
              setIsPKEntryModalOpen(true);
            }}
            onVideoTimeClick={(timestamp) => {
              seekActiveVideo(timestamp);
            }}
            youtubeVideoRef={youtubeVideoRef}
            customVideoRef={customVideoRef}
          />
        ) : activeTab === "xg" ? (
          <ShotsTable
            shots={shots}
            players={players}
            onDeleteShot={handleShotDelete}
            onEditShot={(shot) => {
              setShotModalData({
                x: shot.x,
                y: shot.y,
                xG: shot.xG,
                editingShot: shot
              });
              setIsShotModalOpen(true);
            }}
            onVideoTimeClick={async (timestamp) => {
              // Sprawdź czy mamy otwarte zewnętrzne okno wideo
              const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
              const externalWindow = (window as any).externalVideoWindow;
              
              if (isExternalWindowOpen && externalWindow && !externalWindow.closed) {
                // Wyślij wiadomość do zewnętrznego okna
                externalWindow.postMessage({
                  type: 'SEEK_TO_TIME',
                  time: timestamp
                }, '*');
              } else {
                await seekActiveVideo(timestamp);
              }
            }}
          />
        ) : null}

        <PlayerModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={handleSavePlayerWithTeams}
          editingPlayer={editingPlayer || undefined} // Użyj editingPlayer z usePlayersState (ze świeżymi danymi z Firebase)
          currentTeam={selectedTeam}
          allTeams={availableTeams}
          existingPlayers={players}
        />

        {/* Modal dla nowego meczu */}
        <MatchInfoModal
          isOpen={isNewMatchModalOpen}
          onClose={closeNewMatchModal}
          onSave={handleSaveNewMatch}
          currentInfo={null}
          availableTeams={availableTeams}
          selectedTeam={selectedTeam}
        />

        {/* Modal dla edycji meczu */}
        <MatchInfoModal
          isOpen={isMatchModalOpen}
          onClose={closeEditMatchModal}
          onSave={handleSaveEditedMatch}
          currentInfo={matchInfo}
          availableTeams={availableTeams}
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
            currentPlayerMinutes={editingMatch.playerMinutes || []}
          />
        )}

        {/* Modal edycji akcji - warunkowo wyświetlamy odpowiedni modal */}
        {editingAction && getActionCategory(editingAction) === "loses" ? (
          <LosesActionModal
          isOpen={isActionEditModalOpen}
          onClose={handleCloseActionEditModal}
          players={players}
          selectedPlayerId={editingAction?.senderId || null}
          selectedReceiverId={editingAction?.receiverId || null}
          onSenderSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                senderId: id || '',
                senderName: player?.name || '',
                senderNumber: player?.number || 0
              });
            }
          }}
          onReceiverSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                receiverId: id || '',
                receiverName: player?.name || '',
                receiverNumber: player?.number || 0
              });
            }
          }}
          actionMinute={editingAction?.minute || 0}
          onMinuteChange={(minute) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                minute
              });
            }
          }}
          actionType={editingAction?.actionType as "pass" | "dribble" || 'pass'}
          onActionTypeChange={(type) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                actionType: type
              });
            }
          }}
          currentPoints={editingAction?.packingPoints || 0}
          onAddPoints={(points) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                packingPoints: (editingAction.packingPoints || 0) + points
              });
            }
          }}
          isP1Active={editingAction?.isP1 || false}
          onP1Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP1: !editingAction.isP1
              });
            }
          }}
          isP2Active={editingAction?.isP2 || false}
          onP2Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP2: !editingAction.isP2
              });
            }
          }}
          isP3Active={editingAction?.isP3 || false}
          onP3Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP3: !editingAction.isP3
              });
            }
          }}
          isContact1Active={editingAction?.isContact1 || false}
          onContact1Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact1: !editingAction.isContact1
              });
            }
          }}
          isContact2Active={editingAction?.isContact2 || false}
          onContact2Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact2: !editingAction.isContact2
              });
            }
          }}
          isContact3PlusActive={editingAction?.isContact3Plus || false}
          onContact3PlusToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact3Plus: !editingAction.isContact3Plus
              });
            }
          }}
          isShot={editingAction?.isShot || false}
          onShotToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isShot: checked
              });
            }
          }}
          isGoal={editingAction?.isGoal || false}
          onGoalToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isGoal: checked
              });
            }
          }}
          isPenaltyAreaEntry={editingAction?.isPenaltyAreaEntry || false}
          onPenaltyAreaEntryToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isPenaltyAreaEntry: checked
              });
            }
          }}
          isSecondHalf={editingAction?.isSecondHalf || false}
          onSecondHalfToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isSecondHalf: checked
              });
            }
          }}
          onSaveAction={() => {
            if (editingAction) {
              handleSaveEditedAction(editingAction);
            }
          }}
          onReset={() => {
            if (editingAction) {
              const originalAction = actions.find(a => a.id === editingAction.id);
              if (originalAction) {
                setEditingAction({ ...originalAction });
              }
            }
          }}
          onResetPoints={resetActionPoints}
          editingAction={editingAction}
          allMatches={allMatches}
          selectedMatchId={editingAction?.matchId || null}
          onMatchSelect={(matchId) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                matchId
              });
            }
          }}
          matchInfo={matchInfo}
          isBelow8sActive={editingAction?.isBelow8s || false}
          onBelow8sToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isBelow8s: !editingAction.isBelow8s
              });
            }
          }}
          isReaction5sActive={editingAction?.isReaction5s || false}
          onReaction5sToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isReaction5s: !editingAction.isReaction5s
              });
            }
          }}
          isAutActive={editingAction?.isAut || false}
          onAutToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isAut: !editingAction.isAut
              });
            }
          }}
          isReaction5sNotApplicableActive={editingAction?.isReaction5sNotApplicable || false}
          onReaction5sNotApplicableToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isReaction5sNotApplicable: !editingAction.isReaction5sNotApplicable
              });
            }
          }}
          playersBehindBall={editingAction?.playersBehindBall || 0}
          onPlayersBehindBallChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                playersBehindBall: count
              });
            }
          }}
          opponentsBeforeBall={editingAction?.opponentsBeforeBall || 0}
          onOpponentsBeforeBallChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                opponentsBeforeBall: count
              });
            }
          }}
          playersLeftField={editingAction?.playersLeftField || (editingAction?.totalPlayersOnField !== undefined ? 11 - editingAction.totalPlayersOnField : 0)}
          onPlayersLeftFieldChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                playersLeftField: count,
                totalPlayersOnField: 11 - count
              });
            }
          }}
          opponentsLeftField={editingAction?.opponentsLeftField || (editingAction?.totalOpponentsOnField !== undefined ? 11 - editingAction.totalOpponentsOnField : 0)}
          onOpponentsLeftFieldChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                opponentsLeftField: count,
                totalOpponentsOnField: 11 - count
              });
            }
          }}
        />
      ) : editingAction && getActionCategory(editingAction) === "regain" ? (
        <RegainActionModal
          isOpen={isActionEditModalOpen}
          onClose={handleCloseActionEditModal}
          players={players}
          selectedPlayerId={editingAction?.senderId || null}
          selectedReceiverId={editingAction?.receiverId || null}
          onSenderSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                senderId: id || '',
                senderName: player?.name || '',
                senderNumber: player?.number || 0
              });
            }
          }}
          onReceiverSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                receiverId: id || '',
                receiverName: player?.name || '',
                receiverNumber: player?.number || 0
              });
            }
          }}
          actionMinute={editingAction?.minute || 0}
          onMinuteChange={(minute) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                minute
              });
            }
          }}
          actionType={editingAction?.actionType as "pass" | "dribble" || 'pass'}
          onActionTypeChange={(type) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                actionType: type
              });
            }
          }}
          currentPoints={editingAction?.packingPoints || 0}
          onAddPoints={(points) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                packingPoints: (editingAction.packingPoints || 0) + points
              });
            }
          }}
          isP1Active={editingAction?.isP1 || false}
          onP1Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP1: !editingAction.isP1
              });
            }
          }}
          isP2Active={editingAction?.isP2 || false}
          onP2Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP2: !editingAction.isP2
              });
            }
          }}
          isP3Active={editingAction?.isP3 || false}
          onP3Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP3: !editingAction.isP3
              });
            }
          }}
          isContact1Active={editingAction?.isContact1 || false}
          onContact1Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact1: !editingAction.isContact1
              });
            }
          }}
          isContact2Active={editingAction?.isContact2 || false}
          onContact2Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact2: !editingAction.isContact2
              });
            }
          }}
          isContact3PlusActive={editingAction?.isContact3Plus || false}
          onContact3PlusToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact3Plus: !editingAction.isContact3Plus
              });
            }
          }}
          isShot={editingAction?.isShot || false}
          onShotToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isShot: checked
              });
            }
          }}
          isGoal={editingAction?.isGoal || false}
          onGoalToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isGoal: checked
              });
            }
          }}
          isPenaltyAreaEntry={editingAction?.isPenaltyAreaEntry || false}
          onPenaltyAreaEntryToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isPenaltyAreaEntry: checked
              });
            }
          }}
          isSecondHalf={editingAction?.isSecondHalf || false}
          onSecondHalfToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isSecondHalf: checked
              });
            }
          }}
          onSaveAction={() => {
            if (editingAction) {
              handleSaveEditedAction(editingAction);
            }
          }}
          onReset={() => {
            if (editingAction) {
              const originalAction = actions.find(a => a.id === editingAction.id);
              if (originalAction) {
                setEditingAction({ ...originalAction });
              }
            }
          }}
          onResetPoints={resetActionPoints}
          editingAction={editingAction}
          allMatches={allMatches}
          selectedMatchId={editingAction?.matchId || null}
          onMatchSelect={(matchId) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                matchId
              });
            }
          }}
          matchInfo={matchInfo}
          isBelow8sActive={editingAction?.isBelow8s || false}
          onBelow8sToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isBelow8s: !editingAction.isBelow8s
              });
            }
          }}
          playersBehindBall={editingAction?.playersBehindBall || 0}
          onPlayersBehindBallChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                playersBehindBall: count
              });
            }
          }}
          opponentsBeforeBall={editingAction?.opponentsBeforeBall || 0}
          onOpponentsBeforeBallChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                opponentsBeforeBall: count
              });
            }
          }}
          playersLeftField={editingAction?.playersLeftField || (editingAction?.totalPlayersOnField !== undefined ? 11 - editingAction.totalPlayersOnField : 0)}
          onPlayersLeftFieldChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                playersLeftField: count,
                totalPlayersOnField: 11 - count
              });
            }
          }}
          opponentsLeftField={editingAction?.opponentsLeftField || (editingAction?.totalOpponentsOnField !== undefined ? 11 - editingAction.totalOpponentsOnField : 0)}
          onOpponentsLeftFieldChange={(count) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                opponentsLeftField: count,
                totalOpponentsOnField: 11 - count
              });
            }
          }}
        />
      ) : (
        <ActionModal
          isOpen={isActionEditModalOpen}
          onClose={handleCloseActionEditModal}
          players={players}
          selectedPlayerId={editingAction?.senderId || null}
          selectedReceiverId={editingAction?.receiverId || null}
          onSenderSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                senderId: id || '',
                senderName: player?.name || '',
                senderNumber: player?.number || 0
              });
            }
          }}
          onReceiverSelect={(id) => {
            if (editingAction) {
              const player = players.find(p => p.id === id);
              setEditingAction({
                ...editingAction,
                receiverId: id || '',
                receiverName: player?.name || '',
                receiverNumber: player?.number || 0
              });
            }
          }}
          actionMinute={editingAction?.minute || 0}
          onMinuteChange={(minute) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                minute
              });
            }
          }}
          actionType={editingAction?.actionType as "pass" | "dribble" || 'pass'}
          onActionTypeChange={(type) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                actionType: type
              });
            }
          }}
          currentPoints={editingAction?.packingPoints || 0}
          onAddPoints={(points) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                packingPoints: (editingAction.packingPoints || 0) + points
              });
            }
          }}
          isP0StartActive={editingAction?.isP0Start || false}
          onP0StartToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP0Start: !editingAction.isP0Start
              });
            }
          }}
          isP1StartActive={editingAction?.isP1Start || false}
          onP1StartToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP1Start: !editingAction.isP1Start
              });
            }
          }}
          isP2StartActive={editingAction?.isP2Start || false}
          onP2StartToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP2Start: !editingAction.isP2Start
              });
            }
          }}
          isP3StartActive={editingAction?.isP3Start || false}
          onP3StartToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP3Start: !editingAction.isP3Start
              });
            }
          }}
          isP0Active={editingAction?.isP0 || false}
          onP0Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP0: !editingAction.isP0
              });
            }
          }}
          isP1Active={editingAction?.isP1 || false}
          onP1Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP1: !editingAction.isP1
              });
            }
          }}
          isP2Active={editingAction?.isP2 || false}
          onP2Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP2: !editingAction.isP2
              });
            }
          }}
          isP3Active={editingAction?.isP3 || false}
          onP3Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isP3: !editingAction.isP3
              });
            }
          }}
          isContact1Active={editingAction?.isContact1 || false}
          onContact1Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact1: !editingAction.isContact1
              });
            }
          }}
          isContact2Active={editingAction?.isContact2 || false}
          onContact2Toggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact2: !editingAction.isContact2
              });
            }
          }}
          isContact3PlusActive={editingAction?.isContact3Plus || false}
          onContact3PlusToggle={() => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isContact3Plus: !editingAction.isContact3Plus
              });
            }
          }}
          isShot={editingAction?.isShot || false}
          onShotToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isShot: checked
              });
            }
          }}
          isGoal={editingAction?.isGoal || false}
          onGoalToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isGoal: checked
              });
            }
          }}
          isPenaltyAreaEntry={editingAction?.isPenaltyAreaEntry || false}
          onPenaltyAreaEntryToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isPenaltyAreaEntry: checked
              });
            }
          }}
          isSecondHalf={editingAction?.isSecondHalf || false}
          onSecondHalfToggle={(checked) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                isSecondHalf: checked
              });
            }
          }}
          onSaveAction={() => {
            if (editingAction) {
              handleSaveEditedAction(editingAction);
            }
          }}
          onReset={() => {
            if (editingAction) {
              const originalAction = actions.find(a => a.id === editingAction.id);
              if (originalAction) {
                setEditingAction({ ...originalAction });
              }
            }
          }}
          onResetPoints={resetActionPoints}
          editingAction={editingAction}
          allMatches={allMatches}
          selectedMatchId={editingAction?.matchId || null}
          onMatchSelect={(matchId) => {
            if (editingAction) {
              setEditingAction({
                ...editingAction,
                matchId
              });
            }
          }}
          matchInfo={matchInfo}
        />
      )}

        <SidePanel
          players={players}
          actions={actions}
          matchInfo={matchInfo}
          isAdmin={isAdmin}
          selectedTeam={selectedTeam}
          onRefreshData={handleRefreshData}
          onImportSuccess={handleImportSuccess}
          onImportError={handleImportError}
          onLogout={handleLogout}
        />

        {/* Modal dla strzałów */}
        {shotModalData && (
          <ShotModal
            isOpen={isShotModalOpen}
            onClose={handleShotModalClose}
            onSave={handleShotSave}
            onDelete={handleShotDelete}
            editingShot={shotModalData.editingShot}
            x={shotModalData.x}
            y={shotModalData.y}
            xG={shotModalData.xG}
            matchId={matchInfo?.matchId || ""}
            players={players}
            matchInfo={matchInfo}
          />
        )}

        <OfflineStatus />
      </main>
    </div>
  );
}

