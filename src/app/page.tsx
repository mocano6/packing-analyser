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
import { 
  getXTValueFromMatrix, 
  getOppositeXTValueForZone, 
  zoneNameToIndex, 
  getZoneName, 
  zoneNameToString 
} from "@/constants/xtValues";
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
import pitchHeaderStyles from "@/components/PitchHeader/PitchHeader.module.css";
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
  const [activeTab, setActiveTab] = React.useState<"packing" | "acc8s" | "xg" | "regain_loses" | "pk_entries">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('activeTab');
      if (saved && ['packing', 'acc8s', 'xg', 'regain_loses', 'pk_entries'].includes(saved)) {
        return saved as "packing" | "acc8s" | "xg" | "regain_loses" | "pk_entries";
      }
      // Migracja starych wartości
      if (saved === 'regain' || saved === 'loses') {
        return "regain_loses";
      }
    }
    return "packing";
  });
  
  // Stan do przełączania między regain a loses w modalu
  const [regainLosesMode, setRegainLosesMode] = React.useState<"regain" | "loses">("regain");
  
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
  // Ref do kontenera wideo YouTube do scrollowania
  const youtubeVideoContainerRef = useRef<HTMLDivElement>(null);

  // Funkcja pomocnicza do pobierania czasu z aktywnego odtwarzacza
  const getActiveVideoTime = async (): Promise<number> => {
    // Sprawdź zewnętrzne okno wideo - tylko jeśli jest NAPRAWDĘ otwarte
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    if (isExternalWindowOpen) {
      // Wyślij wiadomość do zewnętrznego okna o pobranie aktualnego czasu
      externalWindow.postMessage({
        type: 'GET_CURRENT_TIME'
      }, '*');
      
      // Czekaj na odpowiedź z zewnętrznego okna
      const timeFromExternal = await new Promise<number | null>((resolve) => {
        const handleTimeResponse = (event: MessageEvent) => {
          if (event.data.type === 'CURRENT_TIME_RESPONSE' || event.data.type === 'VIDEO_TIME_RESPONSE') {
            window.removeEventListener('message', handleTimeResponse);
            resolve(event.data.time);
          }
        };
        window.addEventListener('message', handleTimeResponse);
        setTimeout(() => {
          window.removeEventListener('message', handleTimeResponse);
          resolve(null); // timeout
        }, 2000);
      });
      
      if (timeFromExternal !== null && timeFromExternal !== undefined && timeFromExternal >= 0) {
        return timeFromExternal;
      }
    }
    
    let youtubeTime: number | null = null;
    let customTime: number | null = null;

    if (youtubeVideoRef.current) {
      try {
        const time = await youtubeVideoRef.current.getCurrentTime();
        if (time > 0) {
          return time;
        }
        youtubeTime = time;
      } catch (error) {
        console.warn('Nie udało się pobrać czasu z YouTube:', error);
      }
    }

    if (customVideoRef.current) {
      try {
        const time = await customVideoRef.current.getCurrentTime();
        if (time > 0) {
          return time;
        }
        customTime = time;
      } catch (error) {
        console.warn('Nie udało się pobrać czasu z własnego odtwarzacza:', error);
      }
    }

    if (youtubeTime !== null && youtubeTime >= 0) {
      return youtubeTime;
    }
    if (customTime !== null && customTime >= 0) {
      return customTime;
    }
    return 0;
  };

  // Funkcja pomocnicza do przewijania aktywnego odtwarzacza
  const seekActiveVideo = async (seconds: number): Promise<void> => {
    const hasYouTube = Boolean(matchInfo?.videoUrl);
    const hasCustom = Boolean(matchInfo?.videoStorageUrl);

    if (hasYouTube && youtubeVideoRef.current) {
      try {
        await youtubeVideoRef.current.seekTo(seconds);
        return;
      } catch (error) {
        console.warn('Nie udało się przewinąć YouTube:', error);
      }
    }

    if (hasCustom && customVideoRef.current) {
      try {
        await customVideoRef.current.seekTo(seconds);
      } catch (error) {
        console.warn('Nie udało się przewinąć własnego odtwarzacza:', error);
      }
    }
  };

  // State do przechowywania aktualnego czasu z zewnętrznego wideo
  const [externalVideoTime, setExternalVideoTime] = useState<number>(0);
  const [isVideoVisible, setIsVideoVisible] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('isVideoVisible');
      return saved === 'true';
    }
    return false;
  });
  const [isVideoFullscreen, setIsVideoFullscreen] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('isVideoFullscreen');
      return saved === 'true';
    }
    return false;
  });

  // Oblicz czy wideo jest wyświetlane wewnętrznie (nie w zewnętrznym oknie)
  const isVideoInternal = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isExternalWindowOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
    return isVideoVisible && !isExternalWindowOpen;
  }, [isVideoVisible]);

  // Zapisz stan widoczności wideo do localStorage przy każdej zmianie
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isVideoVisible', isVideoVisible.toString());
    }
  }, [isVideoVisible]);

  // Zapisz stan fullscreen wideo do localStorage przy każdej zmianie
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isVideoFullscreen', isVideoFullscreen.toString());
    }
  }, [isVideoFullscreen]);

  // Funkcja do scrollowania do wideo YouTube
  const handleScrollToVideo = () => {
    if (youtubeVideoContainerRef.current) {
      // Oblicz pozycję środka ekranu
      const containerRect = youtubeVideoContainerRef.current.getBoundingClientRect();
      const scrollPosition = window.scrollY + containerRect.top - (window.innerHeight / 2) + (containerRect.height / 2);
      
      window.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  };

  const [isPlayersGridExpanded, setIsPlayersGridExpanded] = useState<boolean>(false);
  const [showRegainLosesPopup, setShowRegainLosesPopup] = useState<boolean>(false);
  const [pendingZoneSelection, setPendingZoneSelection] = useState<{zoneId: number, xT?: number} | null>(null);
  const [isTeamsSelectorExpanded, setIsTeamsSelectorExpanded] = useState<boolean>(false);

  // Stan do śledzenia, czy wideo jest wyśrodkowane na ekranie (dla przycisku scrollowania)
  const [isVideoCentered, setIsVideoCentered] = React.useState(false);
  const [showScrollToVideoButton, setShowScrollToVideoButton] = React.useState(true);

  // Funkcja sprawdzająca, czy wideo jest wyśrodkowane
  const checkIfVideoCentered = React.useCallback(() => {
    if (!youtubeVideoContainerRef.current || !isVideoVisible) {
      setIsVideoCentered(false);
      setShowScrollToVideoButton(false);
      return;
    }

    const containerRect = youtubeVideoContainerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const containerCenter = containerRect.top + containerRect.height / 2;
    const viewportCenter = viewportHeight / 2;
    
    // Sprawdzamy, czy środek kontenera jest w zakresie ±20% wysokości viewportu od środka
    const threshold = viewportHeight * 0.2;
    const isCentered = Math.abs(containerCenter - viewportCenter) < threshold;
    
    setIsVideoCentered(isCentered);
    
    // Jeśli wideo jest wyśrodkowane, ukryj przycisk
    if (isCentered) {
      setShowScrollToVideoButton(false);
    } else {
      setShowScrollToVideoButton(true);
    }
  }, [isVideoVisible]);

  // Listener na scroll, który sprawdza pozycję wideo
  React.useEffect(() => {
    if (!isVideoVisible || !isVideoInternal) {
      setShowScrollToVideoButton(false);
      return;
    }

    // Sprawdź pozycję przy pierwszym renderze
    checkIfVideoCentered();

    // Debounce dla scroll event
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        checkIfVideoCentered();
      }, 100); // Sprawdzamy co 100ms podczas scrollowania
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isVideoVisible, isVideoInternal, checkIfVideoCentered]);

  // Funkcja obsługująca kliknięcie przycisku scrollowania
  const handleScrollToVideoButtonClick = React.useCallback(() => {
    handleScrollToVideo();
    // Sprawdź pozycję wielokrotnie po scrollowaniu (smooth scroll może trwać różnie)
    const checkInterval = setInterval(() => {
      checkIfVideoCentered();
    }, 100);
    
    // Zatrzymaj sprawdzanie po 2 sekundach
    setTimeout(() => {
      clearInterval(checkInterval);
      checkIfVideoCentered();
    }, 2000);
  }, [handleScrollToVideo, checkIfVideoCentered]);

  // Funkcja do otwierania ActionModal z zapisaniem czasu YouTube
  const openActionModalWithVideoTime = async () => {
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo - tylko jeśli jest NAPRAWDĘ otwarte
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    if (isExternalWindowOpen) {
      // Wyślij wiadomość do zewnętrznego okna o pobranie aktualnego czasu
      externalWindow.postMessage({
        type: 'GET_CURRENT_TIME'
      }, '*');
      
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
      
      if (time !== null && time >= 0) {
        // Cofnij czas o 10 sekund
        const rawTime = Math.max(0, time);
        const adjustedTime = Math.max(0, rawTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
        localStorage.setItem('tempVideoTimestampRaw', String(Math.floor(rawTime)));
      } else {
        // Timeout - nie udało się pobrać czasu
        localStorage.setItem('tempVideoTimestamp', '0');
        localStorage.setItem('tempVideoTimestampRaw', '0');
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
        const rawTime = Math.max(0, currentTime);
        const adjustedTime = Math.max(0, rawTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
        localStorage.setItem('tempVideoTimestampRaw', String(Math.floor(rawTime)));
      }
    }
    setIsActionModalOpen(true);
  };

  const openAcc8sModalWithVideoTime = async () => {
    // Sprawdź czy mamy otwarte zewnętrzne okno wideo - tylko jeśli jest NAPRAWDĘ otwarte
    const externalWindow = (window as any).externalVideoWindow;
    const isExternalWindowOpen = externalWindow && !externalWindow.closed;
    
    if (isExternalWindowOpen) {
      // Wyślij wiadomość do zewnętrznego okna o pobranie aktualnego czasu
      externalWindow.postMessage({
        type: 'GET_CURRENT_TIME'
      }, '*');
      
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
      
      if (time !== null && time >= 0) {
        // Cofnij czas o 10 sekund
        const rawTime = Math.max(0, time);
        const adjustedTime = Math.max(0, rawTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
        localStorage.setItem('tempVideoTimestampRaw', String(Math.floor(rawTime)));
      } else {
        // Timeout - nie udało się pobrać czasu
        localStorage.setItem('tempVideoTimestamp', '0');
        localStorage.setItem('tempVideoTimestampRaw', '0');
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
        // Poczekaj 200ms przed kolejną próbą (więcej czasu na załadowanie playera)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      if (currentTime > 0) {
        const rawTime = Math.max(0, currentTime);
        const adjustedTime = Math.max(0, rawTime - 10);
        localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
        localStorage.setItem('tempVideoTimestampRaw', String(Math.floor(rawTime)));
      } else {
        // Ustaw 0 jako fallback, aby modal mógł się otworzyć
        localStorage.setItem('tempVideoTimestamp', '0');
        localStorage.setItem('tempVideoTimestampRaw', '0');
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

  // Funkcja do obliczania minuty meczu na podstawie czasu wideo (dla modalów ShotModal, PKEntryModal, Acc8sModal)
  const calculateMatchMinuteFromVideoTime = React.useCallback(async (): Promise<{ minute: number; isSecondHalf: boolean } | null> => {
    if (!matchInfo) {
      return null;
    }

    const firstHalfStart = matchInfo.firstHalfStartTime;
    const secondHalfStart = matchInfo.secondHalfStartTime;

    // Jeśli nie mamy czasu startu połów, nie możemy obliczyć minuty
    if (firstHalfStart === undefined && secondHalfStart === undefined) {
      return null;
    }

    try {
      // Pobierz aktualny czas z wideo
      let currentVideoTime = 0;
      
      // Sprawdź zewnętrzne okno wideo
      const externalWindow = (window as any).externalVideoWindow;
      const isExternalWindowOpen = externalWindow && !externalWindow.closed;
      const isExternalWindowOpenFromStorage = localStorage.getItem('externalVideoWindowOpen') === 'true';
      const hasExternalVideoTime = externalVideoTime > 0;
      
      if (isExternalWindowOpen) {
        // Wyślij wiadomość do zewnętrznego okna o pobranie aktualnego czasu
        externalWindow.postMessage({
          type: 'GET_CURRENT_TIME'
        }, '*');
        
        // Czekaj na odpowiedź z zewnętrznego okna
        const timeFromExternal = await new Promise<number | null>((resolve) => {
          const handleTimeResponse = (event: MessageEvent) => {
            if (event.data.type === 'CURRENT_TIME_RESPONSE' || event.data.type === 'VIDEO_TIME_RESPONSE') {
              window.removeEventListener('message', handleTimeResponse);
              resolve(event.data.time);
            }
          };
          window.addEventListener('message', handleTimeResponse);
          setTimeout(() => {
            window.removeEventListener('message', handleTimeResponse);
            resolve(null); // timeout
          }, 2000);
        });
        
        if (timeFromExternal === null || timeFromExternal === undefined) {
        return null;
        }
        
        currentVideoTime = timeFromExternal;
      } else if (youtubeVideoRef?.current) {
        try {
        currentVideoTime = await youtubeVideoRef.current.getCurrentTime();
        } catch (error) {
          return null;
        }
      } else if (customVideoRef?.current) {
        try {
        currentVideoTime = await customVideoRef.current.getCurrentTime();
        } catch (error) {
          return null;
        }
      } else {
        return null;
      }

      // Oblicz minutę meczu
      if (secondHalfStart !== undefined && currentVideoTime >= secondHalfStart) {
        // Druga połowa
        const secondsIntoSecondHalf = currentVideoTime - secondHalfStart;
        const minute = Math.floor(secondsIntoSecondHalf / 60) + 46; // 46 = początek 2. połowy
        const calculatedMinute = Math.max(46, Math.min(90, minute)); // Ograniczenie do 46-90
        return { minute: calculatedMinute, isSecondHalf: true };
      } else if (firstHalfStart !== undefined && currentVideoTime >= firstHalfStart) {
        // Pierwsza połowa (gdy mamy zdefiniowany firstHalfStart)
        const secondsIntoFirstHalf = currentVideoTime - firstHalfStart;
        const minute = Math.floor(secondsIntoFirstHalf / 60) + 1;
        const calculatedMinute = Math.max(1, Math.min(45, minute)); // Ograniczenie do 1-45
        return { minute: calculatedMinute, isSecondHalf: false };
      } else if (secondHalfStart !== undefined && currentVideoTime < secondHalfStart) {
        // Pierwsza połowa (gdy nie mamy firstHalfStart, ale mamy secondHalfStart)
        // Zakładamy, że pierwsza połowa zaczyna się od 0 lub od początku nagrania
        // Obliczamy minutę na podstawie czasu wideo (zakładając, że 0 = minuta 0 meczu)
        const minute = Math.floor(currentVideoTime / 60) + 1;
        const calculatedMinute = Math.max(1, Math.min(45, minute)); // Ograniczenie do 1-45
        return { minute: calculatedMinute, isSecondHalf: false };
      } else if (firstHalfStart !== undefined && currentVideoTime < firstHalfStart) {
        // Przed startem pierwszej połowy (gdy mamy zdefiniowany firstHalfStart)
        return null;
      } else {
        // Nie mamy żadnych danych o czasie startu połów
        return null;
      }
    } catch (error) {
      console.warn('Nie udało się pobrać czasu z wideo:', error);
      return null;
    }
  }, [matchInfo, youtubeVideoRef, customVideoRef, externalVideoTime]);

  // Stany dla trybu unpacking - muszą być przed usePackingActions
  const [actionMode, setActionMode] = useState<"attack" | "defense">("attack");
  const [selectedDefensePlayers, setSelectedDefensePlayers] = useState<string[]>([]);

  // Określamy kategorię akcji na podstawie aktywnej zakładki
  // Określamy kategorię akcji na podstawie aktywnej zakładki
  // Dla zakładki regain_loses przekazujemy "regain" jako domyślną, ale w usePackingActions
  // zmienimy logikę, aby ładować obie kolekcje gdy activeTab === "regain_loses"
  const actionCategory = activeTab === "regain_loses" ? regainLosesMode : "packing";
  const packingActions = usePackingActions(players, matchInfo, actionMode, selectedDefensePlayers, actionCategory, activeTab === "regain_loses");
  
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

  // Stan dla weryfikacji PK entries
  const [showPKRegainVerifyModal, setShowPKRegainVerifyModal] = useState(false);
  const [pendingPKRegainUpdates, setPendingPKRegainUpdates] = useState<Array<{
    entry: PKEntry;
    isRegain: boolean;
    regainTime?: string;
    timeDiffSeconds?: number;
  }>>([]);

  // Stan dla weryfikacji strzałów
  const [showShotsVerifyModal, setShowShotsVerifyModal] = useState(false);
  const [pendingShotsUpdates, setPendingShotsUpdates] = useState<Array<{
    shot: Shot;
    actionType: 'open_play' | 'counter' | 'corner' | 'free_kick' | 'direct_free_kick' | 'penalty' | 'throw_in' | 'regain';
    regainTime?: string;
    timeDiffSeconds?: number;
  }>>([]);

  // Funkcje obsługi strzałów
  const handleShotAdd = async (x: number, y: number, xG: number) => {
    // Pobierz czas wideo przed otwarciem modala (używając getActiveVideoTime który obsługuje zewnętrzne okno)
    const currentTime = await getActiveVideoTime();
    if (currentTime > 0) {
      const rawTime = Math.max(0, currentTime);
      const adjustedTime = Math.max(0, rawTime - 10);
      localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
      localStorage.setItem('tempVideoTimestampRaw', String(Math.floor(rawTime)));
    } else {
      localStorage.setItem('tempVideoTimestamp', '0');
      localStorage.setItem('tempVideoTimestampRaw', '0');
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
      const parsedVideoTimestamp = videoTimestamp !== null && videoTimestamp !== '' 
        ? parseInt(videoTimestamp, 10) 
        : undefined;
      const isValidTimestamp = parsedVideoTimestamp !== undefined && !isNaN(parsedVideoTimestamp) && parsedVideoTimestamp >= 0;

      const videoTimestampRaw = localStorage.getItem('tempVideoTimestampRaw');
      const parsedVideoTimestampRaw = videoTimestampRaw !== null && videoTimestampRaw !== ''
        ? parseInt(videoTimestampRaw, 10)
        : undefined;
      const isValidTimestampRaw = parsedVideoTimestampRaw !== undefined && !isNaN(parsedVideoTimestampRaw) && parsedVideoTimestampRaw >= 0;
      
      const isEditMode = Boolean(shotModalData?.editingShot);
      
      // W trybie edycji używamy nowych wartości z localStorage, jeśli są dostępne, w przeciwnym razie starych z editingShot
      const finalVideoTimestamp = isEditMode
        ? (isValidTimestamp ? parsedVideoTimestamp : shotModalData?.editingShot?.videoTimestamp)
        : (isValidTimestamp ? parsedVideoTimestamp : undefined);

      const finalVideoTimestampRaw = isEditMode
        ? (isValidTimestampRaw ? parsedVideoTimestampRaw : (shotModalData?.editingShot as any)?.videoTimestampRaw)
        : (isValidTimestampRaw ? parsedVideoTimestampRaw : undefined);
      
      // Użyj wartości z shotData (które już zawierają videoTimestamp z ShotModal), jeśli są dostępne
      // W przeciwnym razie użyj wartości z localStorage (dla kompatybilności wstecznej)
      const shotDataWithTimestamp = {
        ...shotData,
        // Priorytet: wartości z shotData (z ShotModal), potem z localStorage
        ...(shotData.videoTimestamp !== undefined && shotData.videoTimestamp !== null 
          ? { videoTimestamp: shotData.videoTimestamp }
          : (finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp })),
        ...(shotData.videoTimestampRaw !== undefined && shotData.videoTimestampRaw !== null
          ? { videoTimestampRaw: shotData.videoTimestampRaw }
          : (finalVideoTimestampRaw !== undefined && finalVideoTimestampRaw !== null && { videoTimestampRaw: finalVideoTimestampRaw })),
      };

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
    isControversial,
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
    setIsControversial,
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
    opponentsBehindBall,
    setOpponentsBehindBall,
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
    if (activeTab === "regain_loses") {
      // Dla zakładki regain_loses zwracamy wszystkie akcje regain i loses
      // ActionsTable sam je przefiltruje po actionModeFilter
      return actions.filter(action => {
        // Regain: ma playersBehindBall lub opponentsBehindBall, ale NIE ma isReaction5s
        const isRegain = (action.playersBehindBall !== undefined || 
                         action.opponentsBehindBall !== undefined ||
                         action.totalPlayersOnField !== undefined ||
                         action.totalOpponentsOnField !== undefined ||
                         action.playersLeftField !== undefined ||
                         action.opponentsLeftField !== undefined) &&
                        action.isReaction5s === undefined &&
                        action.isAut === undefined &&
                        action.isReaction5sNotApplicable === undefined;
        
        // Loses: ma isReaction5s, isAut lub isReaction5sNotApplicable
        const isLoses = action.isReaction5s !== undefined || 
                       action.isAut !== undefined || 
                       action.isReaction5sNotApplicable !== undefined;
        
        return isRegain || isLoses;
      });
    } else if (actionCategory === "regain") {
      // Regain: ma playersBehindBall lub opponentsBehindBall, ale NIE ma isReaction5s
      // Kluczowa różnica: regain NIE ma isReaction5s
      return actions.filter(action => 
        (action.playersBehindBall !== undefined || 
         action.opponentsBehindBall !== undefined ||
         action.totalPlayersOnField !== undefined ||
         action.totalOpponentsOnField !== undefined ||
         action.playersLeftField !== undefined ||
         action.opponentsLeftField !== undefined) &&
        action.isReaction5s === undefined &&
        action.isAut === undefined &&
        action.isReaction5sNotApplicable === undefined
      );
    } else if (actionCategory === "loses") {
      // Loses: ma isReaction5s, isAut lub isReaction5sNotApplicable (którekolwiek z tych pól zdefiniowane)
      return actions.filter(action => 
        action.isReaction5s !== undefined || 
        action.isAut !== undefined || 
        action.isReaction5sNotApplicable !== undefined
      );
    } else {
      // Packing: nie ma pól charakterystycznych dla regain/loses
      return actions.filter(action => 
        action.isBelow8s === undefined &&
        action.playersBehindBall === undefined &&
        action.opponentsBehindBall === undefined &&
        action.isReaction5s === undefined &&
        action.totalPlayersOnField === undefined &&
        action.totalOpponentsOnField === undefined &&
        action.playersLeftField === undefined &&
        action.opponentsLeftField === undefined
      );
    }
  }, [actions, actionCategory, activeTab]);

  const { isAuthenticated, isLoading, userTeams, isAdmin, userRole, logout } = useAuth();

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
          
          // DODANO: Resetujemy przyciski kompaktowe po zapisaniu (tylko jeśli nie jesteśmy w trybie edycji)
          // Sprawdzamy czy nie ma editingAction - jeśli nie ma, to znaczy że dodajemy nową akcję
          if (!editingAction) {
            resetActionPoints();
          }
          
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
    if (activeTab === "regain_loses") {
      // Dla regain_loses pokazujemy popup z wyborem
      setPendingZoneSelection({ zoneId, xT });
      setShowRegainLosesPopup(true);
      return;
    } else {
      return handlePackingZoneSelection(zoneId, xT);
    }
  };

  // Funkcja obsługująca wybór w popupie
  const handleRegainLosesChoice = (choice: "regain" | "loses") => {
    if (pendingZoneSelection) {
      setRegainLosesMode(choice);
      setShowRegainLosesPopup(false);
      if (choice === "regain") {
        handleRegainZoneSelection(pendingZoneSelection.zoneId, pendingZoneSelection.xT);
      } else {
        handleLosesZoneSelection(pendingZoneSelection.zoneId, pendingZoneSelection.xT);
      }
      setPendingZoneSelection(null);
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
    // Regain: ma playersBehindBall lub opponentsBehindBall, ale NIE ma isReaction5s
    if (action.playersBehindBall !== undefined || 
        action.opponentsBehindBall !== undefined ||
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

  // Funkcja konwersji starych akcji regain do nowego formatu
  const convertOldRegainAction = (action: Action): Action => {
    const actionCategory = getActionCategory(action);
    
    // Tylko dla regain
    if (actionCategory !== "regain") {
      return action;
    }

    const convertedAction: any = { ...action };
    
    // Konwertuj strefy: stare pola → nowe pola
    if (!convertedAction.regainAttackZone || !convertedAction.regainDefenseZone) {
      // Jeśli mamy stare pola, konwertuj je
      if (convertedAction.oppositeZone) {
        convertedAction.regainAttackZone = convertedAction.oppositeZone;
      } else if (convertedAction.regainZone) {
        // regainZone to była strefa regain (obrona), więc opposite to atak
        const startZone = convertedAction.regainZone || convertedAction.fromZone || convertedAction.toZone;
        if (startZone) {
          const startZoneName = typeof startZone === 'string' ? startZone.toUpperCase() : null;
          if (startZoneName) {
            const zoneIndex = zoneNameToIndex(startZoneName);
            if (zoneIndex !== null) {
              const row = Math.floor(zoneIndex / 12);
              const col = zoneIndex % 12;
              const oppositeRow = 7 - row;
              const oppositeCol = 11 - col;
              const oppositeIndex = oppositeRow * 12 + oppositeCol;
              const oppositeZoneData = getZoneName(oppositeIndex);
              if (oppositeZoneData) {
                convertedAction.regainAttackZone = zoneNameToString(oppositeZoneData);
              }
            }
          }
        }
        convertedAction.regainDefenseZone = startZone;
      } else if (convertedAction.fromZone || convertedAction.toZone) {
        // fromZone/toZone są takie same dla regain
        const regainZone = convertedAction.fromZone || convertedAction.toZone;
        convertedAction.regainDefenseZone = regainZone;
        
        // Oblicz opposite zone
        const startZoneName = typeof regainZone === 'string' ? regainZone.toUpperCase() : null;
        if (startZoneName) {
          const zoneIndex = zoneNameToIndex(startZoneName);
          if (zoneIndex !== null) {
            const row = Math.floor(zoneIndex / 12);
            const col = zoneIndex % 12;
            const oppositeRow = 7 - row;
            const oppositeCol = 11 - col;
            const oppositeIndex = oppositeRow * 12 + oppositeCol;
            const oppositeZoneData = getZoneName(oppositeIndex);
            if (oppositeZoneData) {
              convertedAction.regainAttackZone = zoneNameToString(oppositeZoneData);
            }
          }
        }
      }
    }
    
    // Konwertuj wartości xT: zamień miejscami jeśli są stare pola
    if (convertedAction.regainAttackXT === undefined || convertedAction.regainDefenseXT === undefined) {
      // Jeśli mamy stare pola, konwertuj je
      if (convertedAction.oppositeXT !== undefined) {
        convertedAction.regainAttackXT = convertedAction.oppositeXT;
      } else if (convertedAction.regainDefenseXT === undefined) {
        // Użyj xTValueStart/xTValueEnd jako regainDefenseXT
        const defenseXT = convertedAction.xTValueStart || convertedAction.xTValueEnd;
        if (defenseXT !== undefined) {
          convertedAction.regainDefenseXT = defenseXT;
        }
      }
      
      // Jeśli nadal brakuje regainAttackXT, oblicz z opposite zone
      if (convertedAction.regainAttackXT === undefined && convertedAction.regainAttackZone) {
        const attackZoneName = typeof convertedAction.regainAttackZone === 'string' 
          ? convertedAction.regainAttackZone.toUpperCase() 
          : null;
        if (attackZoneName) {
          const zoneIndex = zoneNameToIndex(attackZoneName);
          if (zoneIndex !== null) {
            convertedAction.regainAttackXT = getOppositeXTValueForZone(zoneIndex);
          }
        }
      }
    }
    
    // Usuń stare pola
    delete convertedAction.fromZone;
    delete convertedAction.toZone;
    delete convertedAction.regainZone;
    delete convertedAction.oppositeZone;
    delete convertedAction.oppositeXT;
    delete convertedAction.mode;
    delete convertedAction.xTValueStart;
    delete convertedAction.xTValueEnd;
    delete convertedAction.isP0Start;
    delete convertedAction.isP1Start;
    delete convertedAction.isP2Start;
    delete convertedAction.isP3Start;
    delete convertedAction.isContact1;
    delete convertedAction.isContact2;
    delete convertedAction.isContact3Plus;
    
    return convertedAction as Action;
  };

  const convertOldLosesAction = (action: Action): Action => {
    const actionCategory = getActionCategory(action);
    
    // Tylko dla loses
    if (actionCategory !== "loses") {
      return action;
    }

    const convertedAction: any = { ...action };
    
    // Konwertuj strefy: stare pola → nowe pola
    if (!convertedAction.losesAttackZone || !convertedAction.losesDefenseZone) {
      // Jeśli mamy stare pola, konwertuj je
      if (convertedAction.oppositeZone) {
        convertedAction.losesAttackZone = convertedAction.oppositeZone;
      } else if (convertedAction.fromZone || convertedAction.toZone) {
        // fromZone/toZone są takie same dla loses
        const losesZone = convertedAction.fromZone || convertedAction.toZone;
        convertedAction.losesDefenseZone = losesZone;
        
        // Oblicz opposite zone
        const startZoneName = typeof losesZone === 'string' ? losesZone.toUpperCase() : null;
        if (startZoneName) {
          const zoneIndex = zoneNameToIndex(startZoneName);
          if (zoneIndex !== null) {
            const row = Math.floor(zoneIndex / 12);
            const col = zoneIndex % 12;
            const oppositeRow = 7 - row;
            const oppositeCol = 11 - col;
            const oppositeIndex = oppositeRow * 12 + oppositeCol;
            const oppositeZoneData = getZoneName(oppositeIndex);
            if (oppositeZoneData) {
              convertedAction.losesAttackZone = zoneNameToString(oppositeZoneData);
            }
          }
        }
      }
    }
    
    // Konwertuj wartości xT: stare pola → nowe pola
    if (convertedAction.losesAttackXT === undefined || convertedAction.losesDefenseXT === undefined) {
      // Jeśli mamy stare pola, konwertuj je
      if (convertedAction.oppositeXT !== undefined) {
        convertedAction.losesAttackXT = convertedAction.oppositeXT;
      } else if (convertedAction.losesDefenseXT === undefined) {
        // Użyj xTValueStart/xTValueEnd jako losesDefenseXT
        const defenseXT = convertedAction.xTValueStart || convertedAction.xTValueEnd;
        if (defenseXT !== undefined) {
          convertedAction.losesDefenseXT = defenseXT;
        }
      }
      
      // Jeśli nadal brakuje losesAttackXT, oblicz z opposite zone
      if (convertedAction.losesAttackXT === undefined && convertedAction.losesAttackZone) {
        const attackZoneName = typeof convertedAction.losesAttackZone === 'string' 
          ? convertedAction.losesAttackZone.toUpperCase() 
          : null;
        if (attackZoneName) {
          const zoneIndex = zoneNameToIndex(attackZoneName);
          if (zoneIndex !== null) {
            convertedAction.losesAttackXT = getOppositeXTValueForZone(zoneIndex);
          }
        }
      }
    }
    
    // Usuń stare pola
    delete convertedAction.fromZone;
    delete convertedAction.toZone;
    delete convertedAction.oppositeZone;
    delete convertedAction.oppositeXT;
    delete convertedAction.mode;
    delete convertedAction.xTValueStart;
    delete convertedAction.xTValueEnd;
    delete convertedAction.isP0Start;
    delete convertedAction.isP1Start;
    delete convertedAction.isP2Start;
    delete convertedAction.isP3Start;
    delete convertedAction.isP0;
    delete convertedAction.isP1;
    delete convertedAction.isP2;
    delete convertedAction.isP3;
    delete convertedAction.isContact1;
    delete convertedAction.isContact2;
    delete convertedAction.isContact3Plus;
    delete convertedAction.packingPoints;
    delete convertedAction.isShot;
    delete convertedAction.isGoal;
    delete convertedAction.isPenaltyAreaEntry;
    
    return convertedAction as Action;
  };

  // Funkcja pomocnicza do obliczania opposite wartości dla regain/loses
  const calculateOppositeValues = (action: Action): Action => {
    const actionCategory = getActionCategory(action);
    
    // Tylko dla regain i loses
    if (actionCategory !== "regain" && actionCategory !== "loses") {
      return action;
    }

    // Dla regain: jeśli akcja ma już komplet nowych pól, nie przemapowuj niczego
    if (actionCategory === "regain") {
      if (
        action.regainDefenseXT !== undefined &&
        action.regainAttackXT !== undefined &&
        action.regainAttackZone &&
        action.regainDefenseZone &&
        action.isAttack !== undefined
      ) {
        return action;
      }
    } else if (actionCategory === "loses") {
      // Dla loses: jeśli akcja ma już komplet nowych pól, nie przemapowuj niczego
      if (
        action.losesDefenseXT !== undefined &&
        action.losesAttackXT !== undefined &&
        action.losesAttackZone &&
        action.losesDefenseZone
      ) {
        return action;
      }
    }

    // Oblicz brakujące wartości
    const startZone = action.fromZone || action.startZone;
    if (!startZone) {
      return action;
    }

    // Konwertuj strefę na nazwę (format "A1")
    const startZoneName = typeof startZone === 'string' 
      ? startZone.toUpperCase() 
      : null;
    
    if (!startZoneName) {
      return action;
    }

    const zoneIndex = zoneNameToIndex(startZoneName);
    if (zoneIndex === null) {
      return action;
    }

    // Oblicz opposite strefę
    const row = Math.floor(zoneIndex / 12);
    const col = zoneIndex % 12;
    const oppositeRow = 7 - row;
    const oppositeCol = 11 - col;
    const oppositeIndex = oppositeRow * 12 + oppositeCol;
    const oppositeZoneData = getZoneName(oppositeIndex);
    const oppositeZone = oppositeZoneData ? zoneNameToString(oppositeZoneData) : null;

    // Oblicz opposite xT
    const oppositeXT = getOppositeXTValueForZone(zoneIndex);

    // Określ czy to atak czy obrona
    const receiverXT = action.xTValueEnd || 0;
    const isAttack = receiverXT < 0.02; // xT < 0.02 to atak

    // Dla regain: używamy nowych pól regainDefenseXT i regainAttackXT
    if (actionCategory === "regain") {
      // Wartość w obronie - używamy xTValueStart/xTValueEnd (są takie same dla regain)
      const defenseXT = action.xTValueStart || action.xTValueEnd || 0;
      
      // Określ strefy
      const regainDefenseZone = action.regainDefenseZone || action.regainZone || action.fromZone || action.toZone || startZone;
      const regainAttackZone = action.regainAttackZone || oppositeZone;
      
      const convertedAction = {
        ...action,
        regainDefenseZone,
        regainAttackZone: regainAttackZone || undefined,
        regainDefenseXT: defenseXT,
        regainAttackXT: oppositeXT,
        isAttack
      };
      
      // Usuń stare pola
      delete convertedAction.fromZone;
      delete convertedAction.toZone;
      delete convertedAction.regainZone;
      delete convertedAction.oppositeZone;
      delete convertedAction.oppositeXT;
      delete convertedAction.mode;
      delete convertedAction.xTValueStart;
      delete convertedAction.xTValueEnd;
      delete convertedAction.isP0Start;
      delete convertedAction.isP1Start;
      delete convertedAction.isP2Start;
      delete convertedAction.isP3Start;
      delete convertedAction.isContact1;
      delete convertedAction.isContact2;
      delete convertedAction.isContact3Plus;
      
      return convertedAction as Action;
    } else if (actionCategory === "loses") {
      // Dla loses: używamy nowych pól losesAttackXT i losesDefenseXT
      const defenseXT = action.xTValueStart || action.xTValueEnd || 0;
      
      // Określ strefy
      const losesDefenseZone = action.losesDefenseZone || action.fromZone || action.toZone || startZone;
      const losesAttackZone = action.losesAttackZone || oppositeZone;
      
      const convertedAction = {
        ...action,
        losesDefenseZone,
        losesAttackZone: losesAttackZone || undefined,
        losesDefenseXT: defenseXT,
        losesAttackXT: oppositeXT,
        isAttack
      };
      
      // Usuń stare pola
      delete convertedAction.fromZone;
      delete convertedAction.toZone;
      delete convertedAction.oppositeZone;
      delete convertedAction.oppositeXT;
      delete convertedAction.mode;
      delete convertedAction.xTValueStart;
      delete convertedAction.xTValueEnd;
      delete convertedAction.isP0Start;
      delete convertedAction.isP1Start;
      delete convertedAction.isP2Start;
      delete convertedAction.isP3Start;
      delete convertedAction.isP0;
      delete convertedAction.isP1;
      delete convertedAction.isP2;
      delete convertedAction.isP3;
      delete convertedAction.isContact1;
      delete convertedAction.isContact2;
      delete convertedAction.isContact3Plus;
      delete convertedAction.packingPoints;
      delete convertedAction.isShot;
      delete convertedAction.isGoal;
      delete convertedAction.isPenaltyAreaEntry;
      
      return convertedAction as Action;
    }
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

      // Zablokuj minuta i połowa podczas edycji, ale pozwól na zmianę timestamp
      const originalAction = actions.find(a => a.id === editedAction.id);
      
      // Pobierz nowy timestamp z localStorage jeśli został zmieniony
      const tempVideoTimestamp = localStorage.getItem('tempVideoTimestamp');
      const tempVideoTimestampRaw = localStorage.getItem('tempVideoTimestampRaw');
      const tempControversyNote = localStorage.getItem('tempControversyNote');
      const parsedVideoTimestamp = tempVideoTimestamp ? parseInt(tempVideoTimestamp) : undefined;
      const parsedVideoTimestampRaw = tempVideoTimestampRaw ? parseInt(tempVideoTimestampRaw) : undefined;
      const controversyNote = tempControversyNote && tempControversyNote.trim() ? tempControversyNote.trim() : undefined;
      
      const lockedEditedAction = originalAction ? {
        ...editedAction,
        minute: originalAction.minute,
        isSecondHalf: originalAction.isSecondHalf,
        // Użyj nowego timestamp z localStorage jeśli jest dostępny, w przeciwnym razie zachowaj oryginalny
        videoTimestamp: parsedVideoTimestamp !== undefined ? parsedVideoTimestamp : originalAction.videoTimestamp,
        videoTimestampRaw: parsedVideoTimestampRaw !== undefined ? parsedVideoTimestampRaw : (originalAction as any)?.videoTimestampRaw,
        // Użyj nowej notatki z localStorage jeśli jest dostępna, w przeciwnym razie zachowaj oryginalną
        controversyNote: controversyNote !== undefined ? controversyNote : editedAction.controversyNote
      } : {
        ...editedAction,
        ...(controversyNote !== undefined && { controversyNote })
      };
      
      // Określamy kategorię akcji i odpowiednią kolekcję
      const actionCategory = getActionCategory(lockedEditedAction);
      
      // Przy edycji NIE przemapowujemy starych akcji na nowe i nie przeliczamy opposite
      // Zachowujemy dokładnie to, co było zapisane wcześniej.
      const actionWithOppositeValues = lockedEditedAction;
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
        
        // Zachowujemy wszystkie pola, w tym te z wartością false
        const cleanedAction = removeUndefinedFields(actionWithOppositeValues);
        // Upewniamy się, że pola boolean są zachowane nawet jeśli są false
        // Używamy wartości bezpośrednio z editedAction, aby upewnić się, że są aktualne
        const actionWithBooleans = {
          ...cleanedAction,
          // Zachowujemy pola boolean dla regain i loses - używamy wartości z editedAction
          ...(actionCategory === "regain" || actionCategory === "loses" ? {
            isP0: editedAction.isP0 === true,
            isP1: editedAction.isP1 === true,
            isP2: editedAction.isP2 === true,
            isP3: editedAction.isP3 === true,
            isContact1: editedAction.isContact1 === true,
            isContact2: editedAction.isContact2 === true,
            isContact3Plus: editedAction.isContact3Plus === true,
            isShot: editedAction.isShot === true,
            isGoal: editedAction.isGoal === true,
            isPenaltyAreaEntry: editedAction.isPenaltyAreaEntry === true,
            ...(actionCategory === "loses" && {
              isPMArea: (editedAction as any).isPMArea === true
            })
          } : {})
        };
        const updatedNewActions = [...newActions, actionWithBooleans];
        
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
          setActions([...actions, actionWithOppositeValues]);
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
        // Zachowujemy wszystkie pola, w tym te z wartością false
        const cleanedAction = removeUndefinedFields(actionWithOppositeValues);
        // Upewniamy się, że pola boolean są zachowane nawet jeśli są false
        // Używamy wartości bezpośrednio z editedAction, aby upewnić się, że są aktualne
        const actionWithBooleans = {
          ...cleanedAction,
          // Zachowujemy pola boolean dla regain i loses - używamy wartości z editedAction
          ...(actionCategory === "regain" || actionCategory === "loses" ? {
            isP0: editedAction.isP0 === true,
            isP1: editedAction.isP1 === true,
            isP2: editedAction.isP2 === true,
            isP3: editedAction.isP3 === true,
            isContact1: editedAction.isContact1 === true,
            isContact2: editedAction.isContact2 === true,
            isContact3Plus: editedAction.isContact3Plus === true,
            isShot: editedAction.isShot === true,
            isGoal: editedAction.isGoal === true,
            isPenaltyAreaEntry: editedAction.isPenaltyAreaEntry === true,
            ...(actionCategory === "loses" && {
              isPMArea: (editedAction as any).isPMArea === true
            })
          } : {})
        };
        updatedActions[actionIndex] = actionWithBooleans;

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

  // Dla coach - pokaż stronę z linkami do statystyk (bez Statystyk zawodników)
  if (isAuthenticated && userRole === 'coach') {
    return (
      <div className={styles.container}>
        <div className={styles.coachWelcome}>
          <h1>Witaj</h1>
          <p>Wybierz sekcję, którą chcesz przeglądać:</p>
          <div className={styles.coachLinks}>
            <Link href="/statystyki-zespolu" className={styles.coachLink}>
              <span className={styles.coachLinkIcon}>📊</span>
              <div className={styles.coachLinkContent}>
                <h3>Statystyki zespołu</h3>
                <p>Analizuj statystyki zespołowe i KPI</p>
              </div>
            </Link>
            <Link href="/profile" className={styles.coachLink}>
              <span className={styles.coachLinkIcon}>👤</span>
              <div className={styles.coachLinkContent}>
                <h3>Profil zawodnika</h3>
                <p>Szczegółowy profil wybranego zawodnika</p>
              </div>
            </Link>
          </div>
        </div>
        <SidePanel
          players={players}
          actions={packingActions.actions || []}
          matchInfo={matchInfo}
          isAdmin={isAdmin}
          userRole={userRole}
          selectedTeam={selectedTeam}
          onRefreshData={handleRefreshData}
          onImportSuccess={handleImportSuccess}
          onImportError={handleImportError}
          onLogout={handleLogout}
        />
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
        <div className={styles.videoPlayersContainer} ref={youtubeVideoContainerRef}>
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
            isControversial={isControversial}
            setIsControversial={setIsControversial}
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
            opponentsBehindBall={opponentsBehindBall}
            setOpponentsBehindBall={setOpponentsBehindBall}
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
            // Propsy do scrollowania do wideo YouTube
            isVideoVisible={isVideoVisible}
            isVideoInternal={isVideoInternal}
            onScrollToVideo={handleScrollToVideo}
            videoContainerRef={youtubeVideoContainerRef}
            youtubeVideoRef={youtubeVideoRef}
            customVideoRef={customVideoRef}
            onGetVideoTime={getActiveVideoTime}
            // Propsy dla modali edycji
            editingAction={editingAction}
            isActionEditModalOpen={isActionEditModalOpen}
            onCloseActionEditModal={handleCloseActionEditModal}
            onSaveEditedAction={handleSaveEditedAction}
            allMatches={allMatches}
            actions={actions}
            onEditingActionChange={setEditingAction}
            getActionCategory={getActionCategory}
            allTeams={allTeams}
          />
        )}

        {activeTab === "regain_loses" && (
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
            isControversial={isControversial}
            setIsControversial={setIsControversial}
            isSecondHalf={isSecondHalf}
            setIsSecondHalf={handleSecondHalfToggle}
            isBelow8sActive={isBelow8sActive}
            setIsBelow8sActive={setIsBelow8sActive}
            isReaction5sActive={isReaction5sActive}
            setIsReaction5sActive={setIsReaction5sActive}
            isAutActive={isAutActive}
            setIsAutActive={setIsAutActive}
            isReaction5sNotApplicableActive={isReaction5sNotApplicableActive}
            setIsReaction5sNotApplicableActive={setIsReaction5sNotApplicableActive}
            isPMAreaActive={isPMAreaActive}
            setIsPMAreaActive={setIsPMAreaActive}
            playersBehindBall={playersBehindBall}
            setPlayersBehindBall={setPlayersBehindBall}
            opponentsBehindBall={opponentsBehindBall}
            setOpponentsBehindBall={setOpponentsBehindBall}
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
            actionCategory={regainLosesMode}
            regainLosesMode={regainLosesMode}
            onRegainLosesModeChange={setRegainLosesMode}
            // Propsy do scrollowania do wideo YouTube
            isVideoVisible={isVideoVisible}
            isVideoInternal={isVideoInternal}
            onScrollToVideo={handleScrollToVideo}
            videoContainerRef={youtubeVideoContainerRef}
            youtubeVideoRef={youtubeVideoRef}
            customVideoRef={customVideoRef}
            onGetVideoTime={getActiveVideoTime}
            // Propsy dla modali edycji
            editingAction={editingAction}
            isActionEditModalOpen={isActionEditModalOpen}
            onCloseActionEditModal={handleCloseActionEditModal}
            onSaveEditedAction={handleSaveEditedAction}
            allMatches={allMatches}
            actions={actions}
            onEditingActionChange={setEditingAction}
            getActionCategory={getActionCategory}
            allTeams={allTeams}
          />
        )}

        {activeTab === "acc8s" && (
          <div className={styles.acc8sSection}>
            <Acc8sTable
              entries={acc8sEntries}
              matchInfo={matchInfo || undefined}
              allTeams={allTeams}
              allPKEntries={pkEntries}
              allShots={shots}
              onAddEntry={async () => {
                if (!matchInfo?.matchId || !matchInfo?.team) {
                  alert("Wybierz mecz, aby dodać akcję 8s ACC!");
                  return;
                }
                await openAcc8sModalWithVideoTime();
              }}
              onDeleteEntry={async (entryId) => {
                if (confirm("Czy na pewno chcesz usunąć tę akcję 8s ACC?")) {
                  await deleteAcc8sEntry(entryId);
                }
              }}
              onEditEntry={(entry) => {
                setAcc8sModalData({ editingEntry: entry });
                setIsAcc8sModalOpen(true);
              }}
              onBulkUpdateEntries={async (updates) => {
                if (!matchInfo?.matchId) return;
                
                try {
                  for (const update of updates) {
                    const entry = acc8sEntries.find(e => e.id === update.id);
                    if (entry) {
                      await updateAcc8sEntry(update.id, {
                        ...entry,
                        isShotUnder8s: update.isShotUnder8s,
                        isPKEntryUnder8s: update.isPKEntryUnder8s,
                      } as any);
                    }
                  }
                  alert(`Zaktualizowano ${updates.length} akcji 8s ACC.`);
                } catch (error) {
                  console.error('Błąd podczas masowej aktualizacji:', error);
                  alert('Wystąpił błąd podczas aktualizacji. Spróbuj ponownie.');
                }
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
            {acc8sModalData && (
              <Acc8sModal
                isOpen={isAcc8sModalOpen}
                isVideoInternal={isVideoInternal}
                onClose={() => {
                  setIsAcc8sModalOpen(false);
                  setAcc8sModalData(null);
                }}
                onSave={async (entryData) => {
                  if (acc8sModalData.editingEntry) {
                    await updateAcc8sEntry(acc8sModalData.editingEntry.id, entryData);
                  } else {
                    await addAcc8sEntry(entryData);
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
                onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
                onGetVideoTime={async () => {
                  // Najpierw sprawdź localStorage (ustawiony przez openAcc8sModalWithVideoTime)
                  const tempTime = localStorage.getItem('tempVideoTimestampRaw');
                  if (tempTime !== null && tempTime !== '') {
                    const parsed = parseInt(tempTime, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      return parsed;
                    }
                  }
                  // Fallback do getActiveVideoTime
                  return await getActiveVideoTime();
                }}
              />
            )}
          </div>
        )}

        {activeTab === "xg" && (
          <div style={{ position: 'relative' }}>
            <XGPitch
              shots={shots}
              onShotAdd={handleShotAdd}
              onShotClick={handleShotClick}
              selectedShotId={selectedShotId}
              matchInfo={matchInfo || undefined}
              allTeams={allTeams}
              rightExtraContent={
                shots.length > 0 ? (
                  <button
                    className={pitchHeaderStyles.headerButton}
                    type="button"
                    title="Automatycznie ustaw actionType na 'regain' dla strzałów po regainie na połowie przeciwnika w 8s"
                    onClick={async () => {
                      console.log("=== PRZYCISK WERYFIKUJ STRZAŁY KLIKNIĘTY ===");
                      console.log("matchInfo:", matchInfo);
                      
                      if (!matchInfo?.team || !matchInfo?.matchId) {
                        console.log("Brak matchInfo.team lub matchInfo.matchId");
                        alert("Wybierz mecz, aby zweryfikować strzały.");
                        return;
                      }

                      console.log("Rozpoczynam weryfikację strzałów...");

                      try {

                      const updates: Array<{
                        shot: Shot;
                        actionType: 'open_play' | 'counter' | 'corner' | 'free_kick' | 'direct_free_kick' | 'penalty' | 'throw_in' | 'regain';
                        regainTime?: string;
                        timeDiffSeconds?: number;
                      }> = [];

                      const normalizeZoneName = (zone: string | number | null | undefined): string | null => {
                        if (zone === null || zone === undefined) return null;
                        if (typeof zone === "string") {
                          return zone.toUpperCase().replace(/\s+/g, "");
                        }
                        const name = getZoneName(zone);
                        return name ? zoneNameToString(name).toUpperCase() : null;
                      };

                      const isOpponentHalf = (zoneName: string | null | undefined): boolean => {
                        if (!zoneName) return false;
                        const zoneIndex = zoneNameToIndex(zoneName);
                        if (zoneIndex === null) return false;
                        const col = zoneIndex % 12;
                        return col >= 6; // Kolumny 6-11 = połowa przeciwnika
                      };

                      // Pobierz strzały bezpośrednio z Firebase
                      let shotsFromFirebase: Shot[] = [];
                      let regainActionsForTeam: Action[] = [];
                      let losesActionsForTeam: Action[] = [];
                      
                      try {
                        const db = getDB();
                        const matchDoc = await getDoc(doc(db, "matches", matchInfo.matchId));
                        
                        if (matchDoc.exists()) {
                          const matchData = matchDoc.data() as TeamInfo;
                          
                          // Pobierz strzały z Firebase
                          shotsFromFirebase = (matchData.shots || []) as Shot[];
                          console.log("Strzały z Firebase:", shotsFromFirebase.length);
                          
                          // Pobierz regains
                          const allRegainActions = (matchData.actions_regain || []).map(action => ({
                            ...action,
                            _actionSource: "regain"
                          })) as Action[];
                          
                          regainActionsForTeam = allRegainActions.filter(action => {
                            if (!action.teamId) return true;
                            return action.teamId === matchInfo.team;
                          });
                          
                          // Pobierz loses
                          const allLosesActions = (matchData.actions_loses || []).map(action => ({
                            ...action,
                            _actionSource: "loses"
                          })) as Action[];
                          
                          losesActionsForTeam = allLosesActions.filter(action => {
                            if (!action.teamId) return true;
                            return action.teamId === matchInfo.team;
                          });
                        } else {
                          alert("Nie znaleziono meczu w bazie danych.");
                          return;
                        }
                      } catch (error) {
                        console.error("Błąd podczas pobierania danych z Firebase:", error);
                        alert("Nie udało się pobrać danych z bazy danych.");
                        return;
                      }

                      // Filtruj tylko strzały w ataku (teamContext === "attack")
                      const shotsAttack = shotsFromFirebase.filter(shot => {
                        return shot.teamContext === "attack";
                      });

                      console.log(`\n=== DEBUG: Weryfikacja strzałów ===`);
                      console.log(`Wszystkie strzały z Firebase: ${shotsFromFirebase.length}`);
                      console.log(`Strzały w ataku: ${shotsAttack.length}`);

                      shotsAttack.forEach((shot) => {
                        // Używamy TYLKO videoTimestampRaw
                        if (shot.videoTimestampRaw === undefined || shot.videoTimestampRaw === null) {
                          return;
                        }
                        const shotTimeRaw = shot.videoTimestampRaw;
                        const shotMinutes = Math.floor(shotTimeRaw / 60);
                        const shotSeconds = Math.floor(shotTimeRaw % 60);
                        const shotTimeString = `${shotMinutes}:${shotSeconds.toString().padStart(2, "0")}`;

                        console.log(`\n=== DEBUG: Sprawdzanie strzału ${shotTimeString} (${shotTimeRaw}s) ===`);

                        // Znajdź regains na połowie przeciwnika przed strzałem
                        const regainsBeforeShot = regainActionsForTeam
                          .filter((regain: any) => {
                            if (regain.videoTimestampRaw === undefined || regain.videoTimestampRaw === null) {
                              return false;
                            }
                            const regainTimeRaw = regain.videoTimestampRaw;
                            
                            // Tylko regains PRZED strzałem
                            if (regainTimeRaw >= shotTimeRaw) {
                              return false;
                            }

                            // Sprawdź, czy regain był na połowie przeciwnika
                            const attackZoneRaw = regain.regainAttackZone || regain.oppositeZone || regain.toZone;
                            const attackZoneName = normalizeZoneName(attackZoneRaw);
                            
                            if (!attackZoneName) {
                              return false;
                            }

                            return isOpponentHalf(attackZoneName);
                          })
                          .map((regain: any) => ({
                            regain,
                            timestamp: regain.videoTimestampRaw,
                          }))
                          .sort((a, b) => b.timestamp - a.timestamp); // Sortuj od najnowszej

                        console.log(`  Znaleziono ${regainsBeforeShot.length} regainów na połowie przeciwnika przed strzałem`);

                        let shouldBeRegain = false;
                        let timeDiff: number | undefined;
                        let regainTimeString: string | undefined;

                        if (regainsBeforeShot.length > 0) {
                          const lastRegain = regainsBeforeShot[0];
                          timeDiff = shotTimeRaw - lastRegain.timestamp;
                          
                          console.log(`  Ostatni regain: ${lastRegain.timestamp}s, różnica: ${timeDiff.toFixed(1)}s`);

                          // Sprawdzamy czy różnica czasu jest <= 8 sekund (i dodatnia)
                          if (timeDiff > 0 && timeDiff <= 8) {
                            console.log(`  Różnica <= 8s - sprawdzam loses między regainem a strzałem`);
                            
                            // Sprawdzamy czy nie było loses między regainem a strzałem
                            const losesBetween = losesActionsForTeam.filter((lose: any) => {
                              if (lose.videoTimestampRaw === undefined || lose.videoTimestampRaw === null) return false;
                              const loseTimeRaw = lose.videoTimestampRaw;
                              return loseTimeRaw > lastRegain.timestamp && loseTimeRaw < shotTimeRaw;
                            });

                            console.log(`  Znaleziono ${losesBetween.length} strat między regainem a strzałem`);
                            
                            // Jeśli nie ma loses między regainem a strzałem, to powinno być actionType = 'regain'
                            shouldBeRegain = losesBetween.length === 0;
                            
                            if (shouldBeRegain) {
                              const regainMinutes = Math.floor(lastRegain.timestamp / 60);
                              const regainSeconds = Math.floor(lastRegain.timestamp % 60);
                              regainTimeString = `${regainMinutes}:${regainSeconds.toString().padStart(2, "0")}`;
                            }
                          } else {
                            console.log(`  Różnica > 8s lub <= 0 - nie kwalifikuje się`);
                          }
                        } else {
                          console.log(`  Brak regainów na połowie przeciwnika przed strzałem`);
                        }

                        // Sprawdź czy trzeba zaktualizować actionType
                        const currentActionType = shot.actionType || 'open_play';
                        let needsUpdate = false;
                        let newActionType: 'open_play' | 'regain' = currentActionType as 'open_play' | 'regain';

                        if (shouldBeRegain && currentActionType !== 'regain') {
                          // Powinno być 'regain', ale jest inne
                          needsUpdate = true;
                          newActionType = 'regain';
                        } else if (!shouldBeRegain && currentActionType === 'regain') {
                          // Jest 'regain', ale nie powinno być
                          needsUpdate = true;
                          newActionType = 'open_play';
                        }

                        console.log(`  Wynik: shouldBeRegain = ${shouldBeRegain}, currentActionType = ${currentActionType}, needsUpdate = ${needsUpdate}, newActionType = ${newActionType}`);

                        if (needsUpdate) {
                          updates.push({
                            shot,
                            actionType: newActionType,
                            regainTime: regainTimeString,
                            timeDiffSeconds: timeDiff,
                          });
                        }
                      });

                      // Filtruj tylko strzały w obronie (teamContext === "defense")
                      const shotsDefense = shotsFromFirebase.filter(shot => {
                        return shot.teamContext === "defense";
                      });

                      console.log(`\n=== DEBUG: Weryfikacja strzałów w obronie ===`);
                      console.log(`Strzały w obronie: ${shotsDefense.length}`);

                      const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                        if (!zoneName) return false;
                        const zoneIndex = zoneNameToIndex(zoneName);
                        if (zoneIndex === null) return false;
                        const col = zoneIndex % 12;
                        return col <= 5; // Kolumny 0-5 = własna połowa (strefy 1-6)
                      };

                      shotsDefense.forEach((shot) => {
                        // Używamy TYLKO videoTimestampRaw
                        if (shot.videoTimestampRaw === undefined || shot.videoTimestampRaw === null) {
                          return;
                        }
                        const shotTimeRaw = shot.videoTimestampRaw;
                        const shotMinutes = Math.floor(shotTimeRaw / 60);
                        const shotSeconds = Math.floor(shotTimeRaw % 60);
                        const shotTimeString = `${shotMinutes}:${shotSeconds.toString().padStart(2, "0")}`;

                        console.log(`\n=== DEBUG: Sprawdzanie strzału w obronie ${shotTimeString} (${shotTimeRaw}s) ===`);

                        // Filtruj loses na własnej połowie (strefy 1-6, kolumny 0-5)
                        // Wykluczamy auty (isAut: false)
                        const losesOnOwnHalf = losesActionsForTeam.filter((lose: any) => {
                          // Wykluczamy auty
                          if (lose.isAut === true) {
                            return false;
                          }

                          // Używamy losesAttackZone (strefa ataku = strefa, gdzie nastąpiła strata)
                          const attackZoneRaw = lose.losesAttackZone || lose.oppositeZone || lose.toZone;
                          const attackZoneName = normalizeZoneName(attackZoneRaw);
                          
                          if (!attackZoneName) {
                            return false;
                          }
                          
                          return isOwnHalf(attackZoneName);
                        });

                        console.log(`  Loses na własnej połowie (bez autów): ${losesOnOwnHalf.length}`);

                        // Znajdź straty na własnej połowie w przedziale do 8s przed strzałem
                        const losesWithin8s = losesOnOwnHalf
                          .filter((lose: any) => {
                            if (lose.videoTimestampRaw === undefined || lose.videoTimestampRaw === null) {
                              return false;
                            }
                            const loseTimeRaw = lose.videoTimestampRaw;
                            
                            // Tylko loses PRZED strzałem
                            if (loseTimeRaw >= shotTimeRaw) {
                              return false;
                            }

                            const timeDiff = shotTimeRaw - loseTimeRaw;
                            // Maksymalnie 8s przed strzałem
                            if (timeDiff > 8) {
                              return false;
                            }

                            return true;
                          })
                          .map((lose: any) => ({
                            lose,
                            timestamp: lose.videoTimestampRaw,
                            timeDiff: shotTimeRaw - lose.videoTimestampRaw,
                          }))
                          .sort((a, b) => b.timestamp - a.timestamp); // Sortuj od najnowszej

                        console.log(`  Znaleziono ${losesWithin8s.length} strat na własnej połowie w przedziale do 8s przed strzałem`);

                        let shouldBeRegain = false;
                        let timeDiff: number | undefined;
                        let loseTimeString: string | undefined;

                        if (losesWithin8s.length > 0) {
                          const lastLose = losesWithin8s[0];
                          timeDiff = lastLose.timeDiff;
                          
                          console.log(`  Ostatnia strata: ${lastLose.timestamp}s, różnica: ${timeDiff.toFixed(1)}s`);

                          // Sprawdzamy czy nie było regainów między stratą a strzałem
                          const regainsBetween = regainActionsForTeam.filter((regain: any) => {
                            if (regain.videoTimestampRaw === undefined || regain.videoTimestampRaw === null) return false;
                            const regainTimeRaw = regain.videoTimestampRaw;
                            return regainTimeRaw > lastLose.timestamp && regainTimeRaw < shotTimeRaw;
                          });

                          console.log(`  Znaleziono ${regainsBetween.length} regainów między stratą a strzałem`);

                          // Jeśli nie ma regainów między stratą a strzałem, to powinno być actionType = 'regain'
                          shouldBeRegain = regainsBetween.length === 0;
                          
                          if (shouldBeRegain) {
                            const loseMinutes = Math.floor(lastLose.timestamp / 60);
                            const loseSeconds = Math.floor(lastLose.timestamp % 60);
                            loseTimeString = `${loseMinutes}:${loseSeconds.toString().padStart(2, "0")}`;
                          }
                        } else {
                          console.log(`  Brak strat na własnej połowie w przedziale do 8s przed strzałem`);
                        }

                        // Sprawdź czy trzeba zaktualizować actionType
                        const currentActionType = shot.actionType || 'open_play';
                        let needsUpdate = false;
                        let newActionType: 'open_play' | 'regain' = currentActionType as 'open_play' | 'regain';

                        if (shouldBeRegain && currentActionType !== 'regain') {
                          // Powinno być 'regain', ale jest inne
                          needsUpdate = true;
                          newActionType = 'regain';
                        } else if (!shouldBeRegain && currentActionType === 'regain') {
                          // Jest 'regain', ale nie powinno być
                          needsUpdate = true;
                          newActionType = 'open_play';
                        }

                        console.log(`  Wynik: shouldBeRegain = ${shouldBeRegain}, currentActionType = ${currentActionType}, needsUpdate = ${needsUpdate}, newActionType = ${newActionType}`);

                        if (needsUpdate) {
                          updates.push({
                            shot,
                            actionType: newActionType,
                            regainTime: loseTimeString, // Używamy loseTimeString dla kontekstu
                            timeDiffSeconds: timeDiff,
                          });
                        }
                      });

                      if (updates.length === 0) {
                        alert("Nie znaleziono żadnych zmian do zastosowania.");
                        return;
                      }

                        console.log("Updates przed zapisaniem:", updates.length);
                        setPendingShotsUpdates(updates);
                        setShowShotsVerifyModal(true);
                      } catch (error) {
                        console.error("Błąd podczas weryfikacji strzałów:", error);
                        alert("Nie udało się zweryfikować strzałów.");
                      }
                    }}
                >
                  ✓ Weryfikuj
                </button>
              ) : null
              }
            />
            {shotModalData && (
              <ShotModal
                isOpen={isShotModalOpen}
                isVideoInternal={isVideoInternal}
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
                shots={shots}
                onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
                onGetVideoTime={async () => {
                  // Najpierw sprawdź localStorage (ustawiony przez handleShotAdd)
                  const tempTime = localStorage.getItem('tempVideoTimestampRaw');
                  if (tempTime !== null && tempTime !== '') {
                    const parsed = parseInt(tempTime, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      return parsed;
                    }
                  }
                  // Fallback do getActiveVideoTime
                  return await getActiveVideoTime();
                }}
              />
            )}
          </div>
        )}

        {activeTab === "pk_entries" && (
          <div style={{ position: 'relative' }}>
            <PKEntriesPitch
              pkEntries={pkEntries}
              onEntryAdd={async (startX, startY, endX, endY) => {
                if (!matchInfo?.matchId || !matchInfo?.team) {
                  alert("Wybierz mecz, aby dodać wejście PK!");
                  return;
                }
                
                // Pobierz czas wideo przed otwarciem modala (tak jak w openAcc8sModalWithVideoTime)
                const currentTime = await getActiveVideoTime();
                if (currentTime > 0) {
                  const rawTime = Math.max(0, currentTime);
                  const adjustedTime = Math.max(0, rawTime - 10);
                  localStorage.setItem('tempVideoTimestamp', String(Math.floor(adjustedTime)));
                  localStorage.setItem('tempVideoTimestampRaw', String(Math.floor(rawTime)));
                } else {
                  // Fallback - ustaw 0
                  localStorage.setItem('tempVideoTimestamp', '0');
                  localStorage.setItem('tempVideoTimestampRaw', '0');
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
            rightExtraContent={
              pkEntries.length > 0 ? (
                <button
                  className={pitchHeaderStyles.headerButton}
                  type="button"
                  title="Automatycznie ustaw flagi isRegain, isShot i isGoal na podstawie regainów, strzałów i goli"
                  onClick={async () => {
                    console.log("=== PRZYCISK WERYFIKUJ KLIKNIĘTY ===");
                    console.log("matchInfo:", matchInfo);
                    
                    if (!matchInfo?.team || !matchInfo?.matchId) {
                      console.log("Brak matchInfo.team lub matchInfo.matchId");
                      alert("Wybierz mecz, aby zweryfikować wejścia w PK.");
                      return;
                    }

                    console.log("Rozpoczynam weryfikację...");

                    const updates: Array<{
                      entry: PKEntry;
                      isRegain: boolean;
                      regainTime?: string;
                      timeDiffSeconds?: number;
                      isShot?: boolean;
                      isGoal?: boolean;
                      shotTime?: string;
                      shotTimeDiff?: number;
                    }> = [];

                    const normalizeZoneName = (zone: string | number | null | undefined): string | null => {
                      if (zone === null || zone === undefined) return null;
                      if (typeof zone === "string") {
                        return zone.toUpperCase().replace(/\s+/g, "");
                      }
                      const name = getZoneName(zone);
                      return name ? zoneNameToString(name).toUpperCase() : null;
                    };

                    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                      if (!zoneName) return false;
                      const zoneIndex = zoneNameToIndex(zoneName);
                      if (zoneIndex === null) return false;
                      const col = zoneIndex % 12;
                      return col <= 5;
                    };

                    console.log("\n=== DEBUG: Weryfikacja PK entries ===");
                    console.log("matchInfo.team:", matchInfo.team);
                    console.log("matchInfo.matchId:", matchInfo.matchId);

                    // Pobierz pkEntries bezpośrednio z Firebase, aby mieć aktualne dane
                    let pkEntriesFromFirebase: PKEntry[] = [];
                    let regainActionsForTeam: Action[] = [];
                    try {
                      const db = getDB();
                      console.log("Pobieranie dokumentu meczu:", matchInfo.matchId);
                      const matchDoc = await getDoc(doc(db, "matches", matchInfo.matchId));
                      console.log("Dokument istnieje:", matchDoc.exists());
                      
                      if (matchDoc.exists()) {
                        const matchData = matchDoc.data() as TeamInfo;
                        
                        // Pobierz pkEntries bezpośrednio z Firebase
                        pkEntriesFromFirebase = (matchData.pkEntries || []) as PKEntry[];
                        console.log("PK entries z Firebase:", pkEntriesFromFirebase.length);
                        console.log("Przykładowe PK entries:", pkEntriesFromFirebase.slice(0, 3));
                        // Sprawdź wartości isShot i isGoal dla wszystkich entries
                        pkEntriesFromFirebase.forEach((entry, idx) => {
                          if (entry.videoTimestampRaw && Math.floor(entry.videoTimestampRaw / 60) === 29 && Math.floor(entry.videoTimestampRaw % 60) === 58) {
                            console.log(`\n=== DEBUG: Znaleziono entry 29:58 (indeks ${idx}) ===`);
                            console.log("Pełny obiekt entry:", JSON.stringify(entry, null, 2));
                            console.log("entry.isShot:", entry.isShot, "typ:", typeof entry.isShot);
                            console.log("entry.isGoal:", entry.isGoal, "typ:", typeof entry.isGoal);
                            console.log("entry.isRegain:", entry.isRegain, "typ:", typeof entry.isRegain);
                          }
                        });
                        console.log("Dane dokumentu:", {
                          hasActionsRegain: !!matchData.actions_regain,
                          actionsRegainType: typeof matchData.actions_regain,
                          actionsRegainLength: Array.isArray(matchData.actions_regain) ? matchData.actions_regain.length : 'not array',
                          actionsRegain: matchData.actions_regain
                        });
                        
                        const allRegainActions = (matchData.actions_regain || []).map(action => ({
                          ...action,
                          _actionSource: "regain"
                        })) as Action[];
                        
                        console.log("Wszystkie regains z Firebase (po mapowaniu):", allRegainActions.length);
                        console.log("Przykładowe regains:", allRegainActions.slice(0, 3));
                        
                        regainActionsForTeam = allRegainActions.filter(action => {
                          if (!action.teamId) return true;
                          return action.teamId === matchInfo.team;
                        });
                        
                        console.log("Regains dla zespołu (po filtrowaniu):", regainActionsForTeam.length);
                        console.log("matchInfo.team:", matchInfo.team);
                        console.log("Przykładowe regains dla zespołu:", regainActionsForTeam.slice(0, 3));
                      } else {
                        console.error("Dokument meczu nie istnieje!");
                        alert("Nie znaleziono meczu w bazie danych.");
                        return;
                      }
                    } catch (error) {
                      console.error("Błąd podczas pobierania regainów z Firebase:", error);
                      alert("Nie udało się pobrać regainów z bazy danych.");
                      return;
                    }

                    console.log("Regains dla zespołu (po filtrowaniu):", regainActionsForTeam.length);
                    regainActionsForTeam.forEach((regain: any, index: number) => {
                      const attackZoneRaw = regain.regainAttackZone || regain.oppositeZone || regain.toZone;
                      const attackZoneName = normalizeZoneName(attackZoneRaw);
                      const regainTimeRaw = regain.videoTimestampRaw;
                      const regainMinutes = regainTimeRaw ? Math.floor(regainTimeRaw / 60) : 0;
                      const regainSeconds = regainTimeRaw ? Math.floor(regainTimeRaw % 60) : 0;
                      const regainTimeString = `${regainMinutes}:${regainSeconds.toString().padStart(2, "0")}`;
                      console.log(`  Regain ${index + 1}: ${regainTimeString} (${regainTimeRaw}s), teamId: ${regain.teamId}, attackZoneRaw: ${attackZoneRaw}, attackZoneName: ${attackZoneName}`);
                    });

                    // Pobierz loses bezpośrednio z Firebase (z actions_loses)
                    let losesActionsForTeam: Action[] = [];
                    try {
                      const db = getDB();
                      const matchDoc = await getDoc(doc(db, "matches", matchInfo.matchId));
                      if (matchDoc.exists()) {
                        const matchData = matchDoc.data() as TeamInfo;
                        const allLosesActions = (matchData.actions_loses || []).map(action => ({
                          ...action,
                          _actionSource: "loses"
                        })) as Action[];
                        
                        losesActionsForTeam = allLosesActions.filter(action => {
                          if (!action.teamId) return true;
                          return action.teamId === matchInfo.team;
                        });
                      }
                    } catch (error) {
                      console.error("Błąd podczas pobierania loses z Firebase:", error);
                    }

                    // Pobierz strzały bezpośrednio z Firebase (z shots)
                    let allShotsForMatch: Shot[] = [];
                    try {
                      const db = getDB();
                      const matchDoc = await getDoc(doc(db, "matches", matchInfo.matchId));
                      if (matchDoc.exists()) {
                        const matchData = matchDoc.data() as TeamInfo;
                        allShotsForMatch = (matchData.shots || []) as Shot[];
                        console.log("Pobrano strzały z Firebase:", allShotsForMatch.length);
                      }
                    } catch (error) {
                      console.error("Błąd podczas pobierania strzałów z Firebase:", error);
                    }

                    // Filtruj regains na połowie przeciwnika i wypisz w konsoli
                    // Połowa przeciwnika = regainAttackZone w strefach a-h 7-12 (kolumny 6-11)
                    const regainsOnOpponentHalf = regainActionsForTeam.filter((regain: any) => {
                      const regainTimeRaw = regain.videoTimestampRaw;
                      const regainMinutes = regainTimeRaw ? Math.floor(regainTimeRaw / 60) : 0;
                      const regainSeconds = regainTimeRaw ? Math.floor(regainTimeRaw % 60) : 0;
                      const regainTimeString = `${regainMinutes}:${regainSeconds.toString().padStart(2, "0")}`;
                      
                      // Używamy regainAttackZone (strefa ataku = opposite zone = połowa przeciwnika)
                      const attackZoneRaw = regain.regainAttackZone || regain.oppositeZone || regain.toZone;
                      console.log(`\n  Sprawdzanie regainu ${regainTimeString}:`);
                      console.log(`    regainAttackZone: ${regain.regainAttackZone}`);
                      console.log(`    oppositeZone: ${regain.oppositeZone}`);
                      console.log(`    toZone: ${regain.toZone}`);
                      console.log(`    attackZoneRaw (wybrane): ${attackZoneRaw}`);
                      
                      const attackZoneName = normalizeZoneName(attackZoneRaw);
                      console.log(`    attackZoneName po normalizacji: ${attackZoneName}`);
                      
                      if (!attackZoneName) {
                        console.log(`    ❌ Brak attackZoneName - pomijam`);
                        return false;
                      }
                      
                      const zoneIndex = zoneNameToIndex(attackZoneName);
                      console.log(`    zoneIndex: ${zoneIndex}`);
                      
                      if (zoneIndex === null) {
                        console.log(`    ❌ Nie można przekonwertować strefy na indeks - pomijam`);
                        return false;
                      }
                      
                      const col = zoneIndex % 12;
                      const row = Math.floor(zoneIndex / 12);
                      console.log(`    row: ${row}, col: ${col}`);
                      console.log(`    Kolumny 0-5 = własna połowa, kolumny 6-11 = połowa przeciwnika`);
                      
                      // Kolumny 6-11 (indeksy 6-11) to połowa przeciwnika (strefy 7-12)
                      const isOwn = col <= 5;
                      console.log(`    isOwnHalf (col <= 5): ${isOwn}`);
                      const isOpponentHalf = !isOwn; // Kolumny 6-11 = połowa przeciwnika
                      console.log(`    isOpponentHalf (col >= 6): ${isOpponentHalf}`);
                      
                      if (isOpponentHalf) {
                        console.log(`    ✅ Regain na połowie przeciwnika (strefy a-h 7-12) - DODAJĘ`);
                      } else {
                        console.log(`    ❌ Regain na własnej połowie (strefy a-h 1-6) - POMIJAM`);
                      }
                      
                      return isOpponentHalf; // Zwracamy true jeśli jest na połowie przeciwnika (kolumny 6-11)
                    });

                    console.log("\n=== DEBUG: Regains na połowie przeciwnika ===");
                    console.log("Wszystkie regains dla zespołu:", regainActionsForTeam.length);
                    console.log("Regains na połowie przeciwnika:", regainsOnOpponentHalf.length);
                    if (regainsOnOpponentHalf.length === 0) {
                      console.log("⚠️ BRAK regainów na połowie przeciwnika!");
                      console.log("Sprawdzam wszystkie regains dla zespołu:");
                      regainActionsForTeam.forEach((regain: any, index: number) => {
                        const regainTimeRaw = regain.videoTimestampRaw;
                        const regainMinutes = regainTimeRaw ? Math.floor(regainTimeRaw / 60) : 0;
                        const regainSeconds = regainTimeRaw ? Math.floor(regainTimeRaw % 60) : 0;
                        const regainTimeString = `${regainMinutes}:${regainSeconds.toString().padStart(2, "0")}`;
                        const attackZoneRaw = regain.regainAttackZone || regain.oppositeZone || regain.toZone;
                        const attackZoneName = normalizeZoneName(attackZoneRaw);
                        let isOwn: boolean | null = null;
                        if (attackZoneName) {
                          const zoneIndex = zoneNameToIndex(attackZoneName);
                          if (zoneIndex !== null) {
                            const col = zoneIndex % 12;
                            isOwn = col <= 5;
                          }
                        }
                        console.log(`  ${index + 1}. Regain ${regainTimeString} (${regainTimeRaw}s) - attackZone: ${attackZoneName}, isOwnHalf: ${isOwn}, regainAttackZone: ${regain.regainAttackZone}, oppositeZone: ${regain.oppositeZone}, toZone: ${regain.toZone}`);
                      });
                    } else {
                      regainsOnOpponentHalf.forEach((regain: any, index: number) => {
                        const regainTimeRaw = regain.videoTimestampRaw;
                        const regainMinutes = regainTimeRaw ? Math.floor(regainTimeRaw / 60) : 0;
                        const regainSeconds = regainTimeRaw ? Math.floor(regainTimeRaw % 60) : 0;
                        const regainTimeString = `${regainMinutes}:${regainSeconds.toString().padStart(2, "0")}`;
                        const attackZoneRaw = regain.regainAttackZone || regain.oppositeZone || regain.toZone;
                        const attackZoneName = normalizeZoneName(attackZoneRaw);
                        console.log(`  ${index + 1}. Regain ${regainTimeString} (${regainTimeRaw}s) - attackZone: ${attackZoneName}, regainAttackZone: ${regain.regainAttackZone}, oppositeZone: ${regain.oppositeZone}, toZone: ${regain.toZone}`);
                      });
                    }

                    // Filtruj tylko wejścia w PK w ataku (teamContext === "attack")
                    // Używamy pkEntriesFromFirebase zamiast pkEntries z hooka, aby mieć aktualne dane
                    const pkEntriesAttack = pkEntriesFromFirebase.filter(entry => {
                      // Jeśli nie ma teamContext, domyślnie uznajemy za atak (dla kompatybilności wstecznej)
                      return !entry.teamContext || entry.teamContext === "attack";
                    });

                    console.log(`\n=== DEBUG: Filtrowanie PK entries ===`);
                    console.log(`Wszystkie PK entries z Firebase: ${pkEntriesFromFirebase.length}`);
                    console.log(`PK entries w ataku: ${pkEntriesAttack.length}`);

                    pkEntriesAttack.forEach((entry) => {
                      // Używamy TYLKO videoTimestampRaw (bez fallbacków)
                      if (entry.videoTimestampRaw === undefined || entry.videoTimestampRaw === null) {
                        if (entry.isRegain !== false) {
                          updates.push({ entry, isRegain: false });
                        }
                        return;
                      }
                      const pkTimeRaw = entry.videoTimestampRaw;
                      const pkMinutes = Math.floor(pkTimeRaw / 60);
                      const pkSeconds = Math.floor(pkTimeRaw % 60);
                      const pkTimeString = `${pkMinutes}:${pkSeconds.toString().padStart(2, "0")}`;

                      console.log(`\n=== DEBUG: Sprawdzanie PK entry ${pkTimeString} (${pkTimeRaw}s) ===`);
                      console.log(`  Aktualne wartości z Firebase:`, {
                        isShot: entry.isShot,
                        isGoal: entry.isGoal,
                        isRegain: entry.isRegain,
                        isShotType: typeof entry.isShot,
                        isGoalType: typeof entry.isGoal,
                        isRegainType: typeof entry.isRegain,
                        entryId: entry.id,
                        entryFull: entry
                      });

                      const regainsBeforePK = regainsOnOpponentHalf
                        .filter((regain: any) => {
                          // Używamy TYLKO videoTimestampRaw (bez fallbacków)
                          if (regain.videoTimestampRaw === undefined || regain.videoTimestampRaw === null) {
                            console.log(`  Regain bez videoTimestampRaw - pomijam`);
                            return false;
                          }
                          const regainTimeRaw = regain.videoTimestampRaw;
                          
                          // Tylko regains PRZED PK entry (nie w tym samym czasie lub później)
                          if (regainTimeRaw >= pkTimeRaw) {
                            console.log(`  Regain ${regainTimeRaw}s >= PK ${pkTimeRaw}s - pomijam (za późno)`);
                            return false;
                          }

                          console.log(`  Regain ${regainTimeRaw}s < PK ${pkTimeRaw}s - OK (przed PK)`);
                          return true;
                        })
                        .map((regain: any) => ({
                          regain,
                          timestamp: regain.videoTimestampRaw,
                        }))
                        .sort((a, b) => b.timestamp - a.timestamp);

                      console.log(`  Znaleziono ${regainsBeforePK.length} regainów na połowie przeciwnika przed PK entry`);

                      let shouldBeRegain = false;
                      let timeDiff: number | undefined;
                      let regainTimeString: string | undefined;

                      if (regainsBeforePK.length > 0) {
                        const lastRegain = regainsBeforePK[0];
                        timeDiff = pkTimeRaw - lastRegain.timestamp;
                        const lastRegainMinutes = Math.floor(lastRegain.timestamp / 60);
                        const lastRegainSeconds = Math.floor(lastRegain.timestamp % 60);
                        const lastRegainTimeString = `${lastRegainMinutes}:${lastRegainSeconds.toString().padStart(2, "0")}`;

                        console.log(`  Ostatni regain: ${lastRegainTimeString} (${lastRegain.timestamp}s)`);
                        console.log(`  Różnica czasu: ${timeDiff.toFixed(1)}s`);

                        // Sprawdzamy czy różnica czasu jest <= 8 sekund (i dodatnia)
                        if (timeDiff > 0 && timeDiff <= 8) {
                          console.log(`  Różnica <= 8s - sprawdzam loses między regainem a PK`);
                          // Sprawdzamy czy nie było loses między regainem a PK entry
                          const losesBetween = losesActionsForTeam.filter((lose: any) => {
                            // Używamy TYLKO videoTimestampRaw (bez fallbacków)
                            if (lose.videoTimestampRaw === undefined || lose.videoTimestampRaw === null) return false;
                            const loseTimeRaw = lose.videoTimestampRaw;
                            return loseTimeRaw > lastRegain.timestamp && loseTimeRaw < pkTimeRaw;
                          });

                          console.log(`  Znaleziono ${losesBetween.length} strat między regainem a PK`);
                          // Jeśli nie ma loses między regainem a PK, to powinno być isRegain = true
                          shouldBeRegain = losesBetween.length === 0;
                        } else {
                          console.log(`  Różnica > 8s lub <= 0 - nie kwalifikuje się`);
                        }

                        regainTimeString = lastRegainTimeString;
                      } else {
                        console.log(`  Brak regainów na połowie przeciwnika przed PK entry`);
                      }

                      console.log(`  Wynik: shouldBeRegain = ${shouldBeRegain}, entry.isRegain = ${entry.isRegain}`);

                      // Sprawdź strzały do 5s po wejściu w PK (dla flag)
                      // Znajdź też najbliższy strzał (nawet poza 5s) dla kontekstu
                      let hasShot = false;
                      let hasGoal = false;
                      let shotTime: string | undefined;
                      let shotTimeDiff: number | undefined;
                      let closestShotTimeRaw: number | null = null;
                      let closestShotTimeDiff: number | null = null;
                      
                      if (pkTimeRaw !== null && pkTimeRaw !== undefined) {
                        const shotWindowEnd = pkTimeRaw + 5; // Do 5s po wejściu w PK
                        
                        for (const shot of allShotsForMatch) {
                          let shotTimeRaw: number | null = null;
                          if (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null) {
                            shotTimeRaw = shot.videoTimestampRaw;
                          }
                          if (shotTimeRaw === null) continue;
                          
                          // Tylko strzały po wejściu w PK
                          if (shotTimeRaw < pkTimeRaw) continue;
                          
                          const timeDiff = shotTimeRaw - pkTimeRaw;
                          
                          // Sprawdź czy strzał jest w przedziale do 5s po wejściu w PK (dla flag)
                          if (shotTimeRaw >= pkTimeRaw && shotTimeRaw <= shotWindowEnd) {
                            if (closestShotTimeRaw === null || timeDiff < closestShotTimeDiff!) {
                              closestShotTimeRaw = shotTimeRaw;
                              closestShotTimeDiff = timeDiff;
                              hasShot = true;
                              if (shot.isGoal === true) {
                                hasGoal = true;
                              }
                              const shotMinutes = Math.floor(shotTimeRaw / 60);
                              const shotSeconds = Math.floor(shotTimeRaw % 60);
                              shotTime = `${shotMinutes}:${shotSeconds.toString().padStart(2, '0')}`;
                              shotTimeDiff = timeDiff;
                            }
                          } else {
                            // Jeśli jest poza przedziałem 5s, ale jest najbliższy, zapisz dla kontekstu
                            if (closestShotTimeRaw === null || timeDiff < closestShotTimeDiff!) {
                              closestShotTimeRaw = shotTimeRaw;
                              closestShotTimeDiff = timeDiff;
                              const shotMinutes = Math.floor(shotTimeRaw / 60);
                              const shotSeconds = Math.floor(shotTimeRaw % 60);
                              shotTime = `${shotMinutes}:${shotSeconds.toString().padStart(2, '0')}`;
                              shotTimeDiff = timeDiff;
                            }
                          }
                        }
                      }

                      // Sprawdź czy trzeba zaktualizować flagi
                      // Weryfikujemy, czy istniejące flagi są poprawne:
                      // - jeśli w bazie jest isShot=true, ale strzał jest poza 5s → powinno być false
                      // - jeśli w bazie jest isShot=false, ale strzał jest w przedziale 5s → powinno być true
                      // - jeśli w bazie jest isGoal=true, ale strzał jest poza 5s lub nie ma gola → powinno być false
                      // - jeśli w bazie jest isGoal=false, ale strzał jest w przedziale 5s i jest gol → powinno być true
                      
                      // Normalizuj wartości z Firebase (undefined/null → false)
                      const entryIsShot = entry.isShot === true;
                      const entryIsGoal = entry.isGoal === true;
                      const entryIsRegain = entry.isRegain === true;
                      
                      console.log(`  Porównanie wartości:`, {
                        entryIsShot,
                        hasShot,
                        entryIsGoal,
                        hasGoal,
                        entryIsRegain,
                        shouldBeRegain,
                        isShotDiffers: entryIsShot !== hasShot,
                        isGoalDiffers: entryIsGoal !== hasGoal,
                        isRegainDiffers: entryIsRegain !== shouldBeRegain
                      });
                      
                      const needsUpdate = entryIsRegain !== shouldBeRegain || 
                                        entryIsShot !== hasShot || 
                                        entryIsGoal !== hasGoal;

                      // Dodajemy do updates tylko jeśli wartość się zmienia
                      if (needsUpdate) {
                        updates.push({
                          entry,
                          isRegain: shouldBeRegain,
                          regainTime: regainTimeString, // Zawsze pokazuj czas ostatniego regaina, jeśli istnieje
                          timeDiffSeconds: timeDiff, // Zawsze pokazuj różnicę czasu, jeśli jest zdefiniowana
                          isShot: hasShot,
                          isGoal: hasGoal,
                          shotTime,
                          shotTimeDiff,
                        });
                      }
                    });

                    // Filtruj tylko wejścia w PK w defensywie (teamContext === "defense")
                    // Używamy pkEntriesFromFirebase zamiast pkEntries z hooka, aby mieć aktualne dane
                    const pkEntriesDefense = pkEntriesFromFirebase.filter(entry => {
                      return entry.teamContext === "defense";
                    });

                    console.log(`\n=== DEBUG: Filtrowanie PK entries w defensywie ===`);
                    console.log(`PK entries w defensywie: ${pkEntriesDefense.length}`);

                    // Filtruj loses na własnej połowie (z perspektywy losesAttackZone to strefy 1-6)
                    // Wykluczamy auty (isAut: true)
                    const losesOnOwnHalf = losesActionsForTeam.filter((lose: any) => {
                      // Wykluczamy auty
                      if (lose.isAut === true) {
                        return false;
                      }

                      // Używamy losesAttackZone (strefa ataku = strefa, gdzie nastąpiła strata)
                      const attackZoneRaw = lose.losesAttackZone || lose.oppositeZone || lose.toZone;
                      const attackZoneName = normalizeZoneName(attackZoneRaw);
                      
                      if (!attackZoneName) {
                        return false;
                      }
                      
                      const zoneIndex = zoneNameToIndex(attackZoneName);
                      if (zoneIndex === null) {
                        return false;
                      }
                      
                      const col = zoneIndex % 12;
                      // Kolumny 0-5 (indeksy 0-5) to własna połowa (strefy 1-6)
                      const isOwnHalf = col <= 5;
                      
                      return isOwnHalf;
                    });

                    console.log(`Loses na własnej połowie (bez autów): ${losesOnOwnHalf.length}`);

                    pkEntriesDefense.forEach((entry) => {
                      // Używamy TYLKO videoTimestampRaw (bez fallbacków)
                      if (entry.videoTimestampRaw === undefined || entry.videoTimestampRaw === null) {
                        if (entry.isRegain !== false) {
                          updates.push({ entry, isRegain: false });
                        }
                        return;
                      }
                      const pkTimeRaw = entry.videoTimestampRaw;
                      const pkMinutes = Math.floor(pkTimeRaw / 60);
                      const pkSeconds = Math.floor(pkTimeRaw % 60);
                      const pkTimeString = `${pkMinutes}:${pkSeconds.toString().padStart(2, "0")}`;

                      console.log(`\n=== DEBUG: Sprawdzanie PK entry w defensywie ${pkTimeString} (${pkTimeRaw}s) ===`);

                      // Znajdź straty na własnej połowie w przedziale do 8s przed PK entry
                      // Używamy TYLKO videoTimestampRaw
                      const losesWithin8s = losesOnOwnHalf
                        .filter((lose: any) => {
                          // Używamy TYLKO videoTimestampRaw (bez fallbacków)
                          if (lose.videoTimestampRaw === undefined || lose.videoTimestampRaw === null) {
                            console.log(`  Lose bez videoTimestampRaw - pomijam`);
                            return false;
                          }
                          const loseTimeRaw = lose.videoTimestampRaw;
                          
                          // Tylko loses w przedziale [pkTimeRaw - 8, pkTimeRaw) - maksymalnie 8s przed PK
                          if (loseTimeRaw >= pkTimeRaw) {
                            console.log(`  Lose ${loseTimeRaw}s >= PK ${pkTimeRaw}s - pomijam (za późno)`);
                            return false;
                          }

                          const timeDiff = pkTimeRaw - loseTimeRaw;
                          if (timeDiff > 8) {
                            console.log(`  Lose ${loseTimeRaw}s - różnica ${timeDiff.toFixed(1)}s > 8s - pomijam (za wcześnie)`);
                            return false;
                          }

                          console.log(`  Lose ${loseTimeRaw}s - różnica ${timeDiff.toFixed(1)}s <= 8s - OK`);
                          return true;
                        })
                        .map((lose: any) => ({
                          lose,
                          timestamp: lose.videoTimestampRaw,
                          timeDiff: pkTimeRaw - lose.videoTimestampRaw,
                        }))
                        .sort((a, b) => b.timestamp - a.timestamp); // Sortuj od najnowszej

                      console.log(`  Znaleziono ${losesWithin8s.length} strat na własnej połowie w przedziale do 8s przed PK entry`);

                      let shouldBeRegain = false; // Domyślnie false, jeśli nie było strat (przeciwnik nie odzyskał piłki)
                      let timeDiff: number | undefined;
                      let loseTimeString: string | undefined;

                      if (losesWithin8s.length > 0) {
                        // Jeśli była strata naszego zespołu do 8s przed PK, to przeciwnik odzyskał piłkę → isRegain = true
                        const lastLose = losesWithin8s[0];
                        timeDiff = lastLose.timeDiff;
                        const lastLoseMinutes = Math.floor(lastLose.timestamp / 60);
                        const lastLoseSeconds = Math.floor(lastLose.timestamp % 60);
                        const lastLoseTimeString = `${lastLoseMinutes}:${lastLoseSeconds.toString().padStart(2, "0")}`;

                        console.log(`  Ostatnia strata w przedziale 8s: ${lastLoseTimeString} (${lastLose.timestamp}s), różnica: ${timeDiff.toFixed(1)}s`);
                        console.log(`  Była strata naszego zespołu do 8s przed PK - przeciwnik odzyskał piłkę → isRegain = true`);
                        
                        shouldBeRegain = true; // Przeciwnik odzyskał piłkę (nasza strata)
                        loseTimeString = lastLoseTimeString;
                      } else {
                        console.log(`  Brak strat naszego zespołu na własnej połowie w przedziale do 8s przed PK entry - przeciwnik nie odzyskał piłki → isRegain = false`);
                        shouldBeRegain = false; // Przeciwnik nie odzyskał piłki (nie było strat)
                      }

                      console.log(`  Wynik: shouldBeRegain = ${shouldBeRegain}, entry.isRegain = ${entry.isRegain}`);

                      // Sprawdź strzały do 5s po wejściu w PK (dla flag)
                      // Znajdź też najbliższy strzał (nawet poza 5s) dla kontekstu
                      let hasShot = false;
                      let hasGoal = false;
                      let shotTime: string | undefined;
                      let shotTimeDiff: number | undefined;
                      let closestShotTimeRaw: number | null = null;
                      let closestShotTimeDiff: number | null = null;
                      
                      if (pkTimeRaw !== null && pkTimeRaw !== undefined) {
                        const shotWindowEnd = pkTimeRaw + 5; // Do 5s po wejściu w PK
                        
                        for (const shot of allShotsForMatch) {
                          let shotTimeRaw: number | null = null;
                          if (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null) {
                            shotTimeRaw = shot.videoTimestampRaw;
                          }
                          if (shotTimeRaw === null) continue;
                          
                          // Tylko strzały po wejściu w PK
                          if (shotTimeRaw < pkTimeRaw) continue;
                          
                          const timeDiff = shotTimeRaw - pkTimeRaw;
                          
                          // Sprawdź czy strzał jest w przedziale do 5s po wejściu w PK (dla flag)
                          if (shotTimeRaw >= pkTimeRaw && shotTimeRaw <= shotWindowEnd) {
                            if (closestShotTimeRaw === null || timeDiff < closestShotTimeDiff!) {
                              closestShotTimeRaw = shotTimeRaw;
                              closestShotTimeDiff = timeDiff;
                              hasShot = true;
                              if (shot.isGoal === true) {
                                hasGoal = true;
                              }
                              const shotMinutes = Math.floor(shotTimeRaw / 60);
                              const shotSeconds = Math.floor(shotTimeRaw % 60);
                              shotTime = `${shotMinutes}:${shotSeconds.toString().padStart(2, '0')}`;
                              shotTimeDiff = timeDiff;
                            }
                          } else {
                            // Jeśli jest poza przedziałem 5s, ale jest najbliższy, zapisz dla kontekstu
                            if (closestShotTimeRaw === null || timeDiff < closestShotTimeDiff!) {
                              closestShotTimeRaw = shotTimeRaw;
                              closestShotTimeDiff = timeDiff;
                              const shotMinutes = Math.floor(shotTimeRaw / 60);
                              const shotSeconds = Math.floor(shotTimeRaw % 60);
                              shotTime = `${shotMinutes}:${shotSeconds.toString().padStart(2, '0')}`;
                              shotTimeDiff = timeDiff;
                            }
                          }
                        }
                      }

                      // Sprawdź czy trzeba zaktualizować flagi
                      // Weryfikujemy, czy istniejące flagi są poprawne:
                      // - jeśli w bazie jest isShot=true, ale strzał jest poza 5s → powinno być false
                      // - jeśli w bazie jest isShot=false, ale strzał jest w przedziale 5s → powinno być true
                      // - jeśli w bazie jest isGoal=true, ale strzał jest poza 5s lub nie ma gola → powinno być false
                      // - jeśli w bazie jest isGoal=false, ale strzał jest w przedziale 5s i jest gol → powinno być true
                      // Dla defensywy (wejścia przeciwnika w nasze PK):
                      //   - jeśli była strata naszego zespołu do 8s przed PK → przeciwnik odzyskał piłkę → isRegain = true
                      //   - jeśli nie było strat naszego zespołu do 8s przed PK → przeciwnik nie odzyskał piłki → isRegain = false
                      
                      // Normalizuj wartości z Firebase (undefined/null → false)
                      const entryIsShot = entry.isShot === true;
                      const entryIsGoal = entry.isGoal === true;
                      const entryIsRegain = entry.isRegain === true;
                      
                      console.log(`  Porównanie wartości (defense):`, {
                        entryIsShot,
                        hasShot,
                        entryIsGoal,
                        hasGoal,
                        entryIsRegain,
                        shouldBeRegain,
                        isShotDiffers: entryIsShot !== hasShot,
                        isGoalDiffers: entryIsGoal !== hasGoal,
                        isRegainDiffers: entryIsRegain !== shouldBeRegain
                      });
                      
                      const needsUpdate = entryIsRegain !== shouldBeRegain || 
                                        entryIsShot !== hasShot || 
                                        entryIsGoal !== hasGoal;

                      // Dodajemy do updates tylko jeśli wartość się zmienia
                      if (needsUpdate) {
                        updates.push({
                          entry,
                          isRegain: shouldBeRegain,
                          regainTime: loseTimeString, // Czas ostatniej straty dla kontekstu (jeśli była w przedziale 8s)
                          timeDiffSeconds: timeDiff, // Zawsze pokazuj różnicę czasu, jeśli jest zdefiniowana
                          isShot: hasShot,
                          isGoal: hasGoal,
                          shotTime,
                          shotTimeDiff,
                        });
                      }
                    });

                    if (updates.length === 0) {
                      alert("Nie znaleziono żadnych zmian do zastosowania.");
                      return;
                    }

                    setPendingPKRegainUpdates(updates);
                    setShowPKRegainVerifyModal(true);
                  }}
                >
                  ✓ Weryfikuj
                </button>
              ) : null
            }
          />
          {showPKRegainVerifyModal && (
            <div className={styles.pkVerifyOverlay} onClick={() => setShowPKRegainVerifyModal(false)}>
              <div className={styles.pkVerifyModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.pkVerifyHeader}>
                  <h3>Podgląd zmian automatycznych flag (isRegain, isShot, isGoal)</h3>
                  <button
                    className={styles.pkVerifyClose}
                    onClick={() => setShowPKRegainVerifyModal(false)}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.pkVerifyBody}>
                  <p>
                    Znaleziono <strong>{pendingPKRegainUpdates.length}</strong> wejść w PK do zaktualizowania:
                  </p>
                  
                  {(() => {
                    const attackUpdates = pendingPKRegainUpdates.filter(update => 
                      !update.entry.teamContext || update.entry.teamContext === "attack"
                    );
                    const defenseUpdates = pendingPKRegainUpdates.filter(update => 
                      update.entry.teamContext === "defense"
                    );

                    const renderUpdateItem = (update: typeof pendingPKRegainUpdates[0], index: number) => {
                      // Używamy TYLKO videoTimestampRaw (bez fallbacków)
                      if (update.entry.videoTimestampRaw === undefined || update.entry.videoTimestampRaw === null) return null;
                      const pkTimeRaw = update.entry.videoTimestampRaw;
                      const pkMinutes = Math.floor(pkTimeRaw / 60);
                      const pkSeconds = Math.floor(pkTimeRaw % 60);
                      const pkTimeString = `${pkMinutes}:${pkSeconds.toString().padStart(2, "0")}`;

                      return (
                        <div key={update.entry.id || index} className={styles.pkVerifyItem}>
                          <div className={styles.pkVerifyItemHeader}>
                            <span className={styles.pkVerifyTime}>{pkTimeString}</span>
                            <span className={styles.pkVerifyMinute}>Minuta {update.entry.minute}'</span>
                          </div>
                          <div className={styles.pkVerifyFlags}>
                            {update.entry.isRegain !== update.isRegain && (
                              <>
                                <span className={styles.pkVerifyLabel}>isRegain:</span>
                                <span className={styles.pkVerifyChange}>
                                  <span className={styles.pkVerifyIcon}>{update.entry.isRegain ? "✓" : "✗"}</span>
                                  <span>→</span>
                                  <span className={styles.pkVerifyIcon}>{update.isRegain ? "✓" : "✗"}</span>
                                  {update.regainTime && update.timeDiffSeconds !== undefined && (
                                    <span className={styles.pkVerifyTimeHint}>
                                      ({update.entry.teamContext === "defense" ? "Strata" : "Regain"}: {update.regainTime}, {update.timeDiffSeconds >= 0 ? '+' : ''}{update.timeDiffSeconds.toFixed(1)}s)
                                    </span>
                                  )}
                                  {update.regainTime && update.timeDiffSeconds === undefined && (
                                    <span className={styles.pkVerifyTimeHint}>
                                      ({update.entry.teamContext === "defense" ? "Strata" : "Regain"}: {update.regainTime})
                                    </span>
                                  )}
                                  {!update.regainTime && update.timeDiffSeconds !== undefined && (
                                    <span className={styles.pkVerifyTimeHint}>
                                      ({update.timeDiffSeconds >= 0 ? '+' : ''}{update.timeDiffSeconds.toFixed(1)}s)
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                            {update.isShot !== undefined && update.entry.isShot !== update.isShot && (
                              <>
                                <span className={styles.pkVerifyLabel}>isShot:</span>
                                <span className={styles.pkVerifyChange}>
                                  <span className={styles.pkVerifyIcon}>{update.entry.isShot ? "✓" : "✗"}</span>
                                  <span>→</span>
                                  <span className={styles.pkVerifyIcon}>{update.isShot ? "✓" : "✗"}</span>
                                  {update.shotTime && update.shotTimeDiff !== undefined && (
                                    <span className={styles.pkVerifyTimeHint}>
                                      (Strzał: {update.shotTime}, {update.shotTimeDiff >= 0 ? '+' : ''}{update.shotTimeDiff.toFixed(1)}s)
                                    </span>
                                  )}
                                  {update.shotTime && update.shotTimeDiff === undefined && (
                                    <span className={styles.pkVerifyTimeHint}>
                                      (Strzał: {update.shotTime})
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                            {update.isGoal !== undefined && update.entry.isGoal !== update.isGoal && (
                              <>
                                <span className={styles.pkVerifyLabel}>isGoal:</span>
                                <span className={styles.pkVerifyChange}>
                                  <span className={styles.pkVerifyIcon}>{update.entry.isGoal ? "✓" : "✗"}</span>
                                  <span>→</span>
                                  <span className={styles.pkVerifyIcon}>{update.isGoal ? "✓" : "✗"}</span>
                                  {update.shotTime && update.shotTimeDiff !== undefined && (
                                    <span className={styles.pkVerifyTimeHint}>
                                      (Gol: {update.shotTime}, {update.shotTimeDiff >= 0 ? '+' : ''}{update.shotTimeDiff.toFixed(1)}s)
                                    </span>
                                  )}
                                  {update.shotTime && update.shotTimeDiff === undefined && (
                                    <span className={styles.pkVerifyTimeHint}>
                                      (Gol: {update.shotTime})
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {attackUpdates.length > 0 && (
                          <div>
                            <h4 style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 'bold' }}>
                              Atak (nasze wejścia w PK przeciwnika) - {attackUpdates.length}
                            </h4>
                            <div className={styles.pkVerifyList}>
                              {attackUpdates.map((update, index) => renderUpdateItem(update, index))}
                            </div>
                          </div>
                        )}
                        {defenseUpdates.length > 0 && (
                          <div>
                            <h4 style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 'bold' }}>
                              Obrona (wejścia przeciwnika w nasze PK) - {defenseUpdates.length}
                            </h4>
                            <div className={styles.pkVerifyList}>
                              {defenseUpdates.map((update, index) => renderUpdateItem(update, index))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className={styles.pkVerifyFooter}>
                  <button
                    className={styles.pkVerifyCancel}
                    onClick={() => setShowPKRegainVerifyModal(false)}
                  >
                    Anuluj
                  </button>
                  <button
                    className={styles.pkVerifySave}
                    onClick={async () => {
                      if (!matchInfo?.matchId) {
                        alert("Wybierz mecz, aby zapisać zmiany.");
                        return;
                      }

                      try {
                        const updatedEntries = pkEntries.map(entry => {
                          const update = pendingPKRegainUpdates.find(u => u.entry.id === entry.id);
                          if (update) {
                            return { 
                              ...entry, 
                              isRegain: update.isRegain,
                              isShot: update.isShot !== undefined ? update.isShot : entry.isShot,
                              isGoal: update.isGoal !== undefined ? update.isGoal : entry.isGoal,
                            };
                          }
                          return entry;
                        });

                        const db = getDB();
                        await updateDoc(doc(db, "matches", matchInfo.matchId), {
                          pkEntries: updatedEntries
                        });

                        setShowPKRegainVerifyModal(false);
                        setPendingPKRegainUpdates([]);
                      } catch (error) {
                        console.error("Błąd podczas aktualizacji wejść w PK:", error);
                        alert("Nie udało się zaktualizować wejść w PK.");
                      }
                    }}
                  >
                    Zatwierdź zmiany
                  </button>
                </div>
              </div>
            </div>
          )}
          {pkEntryModalData && (
            <PKEntryModal
            isOpen={isPKEntryModalOpen}
            isVideoInternal={isVideoInternal}
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
            onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
            onGetVideoTime={async () => {
              // Najpierw sprawdź localStorage (ustawiony przy otwieraniu modala)
              const tempTime = localStorage.getItem('tempVideoTimestampRaw');
              if (tempTime !== null && tempTime !== '') {
                const parsed = parseInt(tempTime, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                  return parsed;
                }
              }
              // Fallback do getActiveVideoTime
              return await getActiveVideoTime();
            }}
          />
          )}
          </div>
        )}

        {/* Popup wyboru Regain/Loses */}
        {showRegainLosesPopup && (
          <div className={styles.regainLosesPopupOverlay} onClick={() => {
            setShowRegainLosesPopup(false);
            setPendingZoneSelection(null);
          }}>
            <div className={styles.regainLosesPopup} onClick={(e) => e.stopPropagation()}>
              <h3>Wybierz typ akcji</h3>
              <div className={styles.regainLosesPopupButtons}>
                <button
                  className={styles.regainLosesPopupButton}
                  onClick={() => handleRegainLosesChoice("regain")}
                >
                  Regain
                </button>
                <button
                  className={styles.regainLosesPopupButton}
                  onClick={() => handleRegainLosesChoice("loses")}
                >
                  Loses
                </button>
              </div>
              <div className={styles.regainLosesPopupCancel}>
                <button
                  className={styles.regainLosesPopupCancelButton}
                  onClick={() => {
                    setShowRegainLosesPopup(false);
                    setPendingZoneSelection(null);
                  }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        )}

        {showShotsVerifyModal && (
          <div className={styles.pkVerifyOverlay} onClick={() => setShowShotsVerifyModal(false)}>
            <div className={styles.pkVerifyModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.pkVerifyHeader}>
                <h3>Podgląd zmian automatycznych actionType dla strzałów</h3>
                <button
                  className={styles.pkVerifyClose}
                  onClick={() => setShowShotsVerifyModal(false)}
                >
                  ×
                </button>
              </div>
                <div className={styles.pkVerifyBody}>
                  <p>
                    Znaleziono <strong>{pendingShotsUpdates.length}</strong> strzałów do zaktualizowania:
                  </p>
                  
                  {(() => {
                    const attackUpdates = pendingShotsUpdates.filter(update => 
                      update.shot.teamContext === "attack"
                    );
                    const defenseUpdates = pendingShotsUpdates.filter(update => 
                      update.shot.teamContext === "defense"
                    );

                    const renderUpdateItem = (update: typeof pendingShotsUpdates[0], index: number) => {
                      if (update.shot.videoTimestampRaw === undefined || update.shot.videoTimestampRaw === null) return null;
                      const shotTimeRaw = update.shot.videoTimestampRaw;
                      const shotMinutes = Math.floor(shotTimeRaw / 60);
                      const shotSeconds = Math.floor(shotTimeRaw % 60);
                      const shotTimeString = `${shotMinutes}:${shotSeconds.toString().padStart(2, "0")}`;

                      return (
                        <div key={update.shot.id || index} className={styles.pkVerifyItem}>
                          <div className={styles.pkVerifyItemHeader}>
                            <span className={styles.pkVerifyTime}>{shotTimeString}</span>
                            <span className={styles.pkVerifyMinute}>Minuta {update.shot.minute}'</span>
                          </div>
                          <div className={styles.pkVerifyFlags}>
                            <span className={styles.pkVerifyLabel}>actionType:</span>
                            <span className={styles.pkVerifyChange}>
                              <span className={styles.pkVerifyIcon}>{(update.shot.actionType || 'open_play') === 'regain' ? "✓" : "✗"}</span>
                              <span>→</span>
                              <span className={styles.pkVerifyIcon}>{update.actionType === 'regain' ? "✓" : "✗"}</span>
                              {update.actionType === 'regain' && update.regainTime && update.timeDiffSeconds !== undefined && (
                                <span className={styles.pkVerifyTimeHint}>
                                  (Regain: {update.regainTime}, {update.timeDiffSeconds >= 0 ? '+' : ''}{update.timeDiffSeconds.toFixed(1)}s)
                                </span>
                              )}
                              {update.actionType === 'open_play' && (
                                <span className={styles.pkVerifyTimeHint}>
                                  (Brak regainu/straty w przedziale 8s)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {attackUpdates.length > 0 && (
                          <div>
                            <h4 style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 'bold' }}>
                              Atak (nasze strzały) - {attackUpdates.length}
                            </h4>
                            <div className={styles.pkVerifyList}>
                              {attackUpdates.map((update, index) => renderUpdateItem(update, index))}
                            </div>
                          </div>
                        )}
                        {defenseUpdates.length > 0 && (
                          <div>
                            <h4 style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 'bold' }}>
                              Obrona (strzały przeciwnika) - {defenseUpdates.length}
                            </h4>
                            <div className={styles.pkVerifyList}>
                              {defenseUpdates.map((update, index) => renderUpdateItem(update, index))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              <div className={styles.pkVerifyFooter}>
                <button
                  className={styles.pkVerifyCancel}
                  onClick={() => setShowShotsVerifyModal(false)}
                >
                  Anuluj
                </button>
                <button
                  className={styles.pkVerifySave}
                  onClick={async () => {
                    if (!matchInfo?.matchId) {
                      alert("Wybierz mecz, aby zapisać zmiany.");
                      return;
                    }

                    try {
                      const updatedShots = shots.map(shot => {
                        const update = pendingShotsUpdates.find(u => u.shot.id === shot.id);
                        if (update) {
                          return { 
                            ...shot, 
                            actionType: update.actionType,
                          };
                        }
                        return shot;
                      });

                      const db = getDB();
                      await updateDoc(doc(db, "matches", matchInfo.matchId), {
                        shots: updatedShots
                      });

                      setShowShotsVerifyModal(false);
                      setPendingShotsUpdates([]);
                    } catch (error) {
                      console.error("Błąd podczas aktualizacji strzałów:", error);
                      alert("Nie udało się zaktualizować strzałów.");
                    }
                  }}
                >
                  Zatwierdź zmiany
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "packing" || activeTab === "regain_loses" ? (
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
            onUpdateEntry={async (entryId, entryData) => {
              await updatePKEntry(entryId, entryData);
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

        {/* Modale edycji akcji są teraz renderowane w ActionSection */}

        <SidePanel
          players={players}
          actions={actions}
          matchInfo={matchInfo}
          isAdmin={isAdmin}
          userRole={userRole}
          selectedTeam={selectedTeam}
          onRefreshData={handleRefreshData}
          onImportSuccess={handleImportSuccess}
          onImportError={handleImportError}
          onLogout={handleLogout}
        />

        <OfflineStatus />

        {/* Przycisk scrollowania do wideo YouTube - fixed w prawym dolnym rogu */}
        {isVideoVisible && isVideoInternal && showScrollToVideoButton && (
          <button
            className={styles.scrollToVideoButtonFixed}
            onClick={handleScrollToVideoButtonClick}
            title="Przewiń do wideo YouTube"
            aria-label="Przewiń do wideo YouTube"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
            </svg>
          </button>
        )}
      </main>
    </div>
  );
}
