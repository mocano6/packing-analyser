// components/ActionSection/ActionSection.tsx
"use client";

import React, { memo, useEffect } from "react";
import FootballPitch from "../FootballPitch/FootballPitch";
import ActionModal from "../ActionModal/ActionModal";
import RegainActionModal from "../RegainActionModal/RegainActionModal";
import LosesActionModal from "../LosesActionModal/LosesActionModal";
import styles from "./ActionSection.module.css";
import { Player, TeamInfo, Action } from "@/types";

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
  isP0StartActive: boolean;
  setIsP0StartActive: React.Dispatch<React.SetStateAction<boolean>>;
  isP1StartActive: boolean;
  setIsP1StartActive: React.Dispatch<React.SetStateAction<boolean>>;
  isP2StartActive: boolean;
  setIsP2StartActive: React.Dispatch<React.SetStateAction<boolean>>;
  isP3StartActive: boolean;
  setIsP3StartActive: React.Dispatch<React.SetStateAction<boolean>>;
  isP0Active: boolean;
  setIsP0Active: React.Dispatch<React.SetStateAction<boolean>>;
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
  isControversial: boolean;
  setIsControversial: React.Dispatch<React.SetStateAction<boolean>>;
  isSecondHalf: boolean;
  setIsSecondHalf: React.Dispatch<React.SetStateAction<boolean>>;
  isBelow8sActive: boolean;
  setIsBelow8sActive: React.Dispatch<React.SetStateAction<boolean>>;
  isReaction5sActive: boolean;
  setIsReaction5sActive: React.Dispatch<React.SetStateAction<boolean>>;
  isBadReaction5sActive: boolean;
  setIsBadReaction5sActive: React.Dispatch<React.SetStateAction<boolean>>;
  isAutActive: boolean;
  setIsAutActive: React.Dispatch<React.SetStateAction<boolean>>;
  isPMAreaActive: boolean;
  setIsPMAreaActive: React.Dispatch<React.SetStateAction<boolean>>;
  playersBehindBall: number;
  setPlayersBehindBall: React.Dispatch<React.SetStateAction<number>>;
  opponentsBehindBall: number;
  setOpponentsBehindBall: React.Dispatch<React.SetStateAction<number>>;
  playersLeftField: number;
  setPlayersLeftField: React.Dispatch<React.SetStateAction<number>>;
  opponentsLeftField: number;
  setOpponentsLeftField: React.Dispatch<React.SetStateAction<number>>;
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
  // Prop dla kategorii akcji
  actionCategory?: "packing" | "regain" | "loses";
  // Propsy do przełączania między regain a loses
  regainLosesMode?: "regain" | "loses";
  onRegainLosesModeChange?: (mode: "regain" | "loses") => void;
  // Propsy do scrollowania do wideo YouTube
  isVideoVisible?: boolean;
  isVideoInternal?: boolean;
  onScrollToVideo?: () => void;
  videoContainerRef?: React.RefObject<HTMLDivElement>;
  // Refs do odtwarzaczy wideo
  youtubeVideoRef?: React.RefObject<{ getCurrentTime: () => Promise<number> }>;
  customVideoRef?: React.RefObject<{ getCurrentTime: () => Promise<number> }>;
  // Funkcja do pobierania surowego czasu z wideo
  onGetVideoTime?: () => Promise<number>;
  // Propsy dla modali edycji
  editingAction?: Action | null;
  isActionEditModalOpen?: boolean;
  onCloseActionEditModal?: () => void;
  onSaveEditedAction?: (action: Action) => void;
  allMatches?: TeamInfo[];
  actions?: Action[];
  onEditingActionChange?: (action: Action | null) => void;
  getActionCategory?: (action: Action) => "packing" | "regain" | "loses";
  allTeams?: Array<{
    id: string;
    name: string;
    logo?: string;
  }>;
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
  isP0StartActive,
  setIsP0StartActive,
  isP1StartActive,
  setIsP1StartActive,
  isP2StartActive,
  setIsP2StartActive,
  isP3StartActive,
  setIsP3StartActive,
  isP0Active,
  setIsP0Active,
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
  isControversial,
  setIsControversial,
  isSecondHalf,
  setIsSecondHalf,
  isBelow8sActive,
  setIsBelow8sActive,
  isReaction5sActive,
  setIsReaction5sActive,
  isBadReaction5sActive,
  setIsBadReaction5sActive,
  isAutActive,
  setIsAutActive,
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
  // Prop dla kategorii akcji
  actionCategory = "packing",
  regainLosesMode = "regain",
  isVideoVisible = false,
  isVideoInternal = false,
  onScrollToVideo,
  onRegainLosesModeChange,
  videoContainerRef,
  youtubeVideoRef,
  customVideoRef,
  onGetVideoTime,
  // Propsy dla modali edycji
  editingAction,
  isActionEditModalOpen = false,
  onCloseActionEditModal,
  onSaveEditedAction,
  allMatches = [],
  actions = [],
  onEditingActionChange,
  getActionCategory,
  allTeams = []
}: ActionSectionProps) {
  // Funkcja do obliczania minuty meczu na podstawie czasu wideo
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
  }, [matchInfo, youtubeVideoRef, customVideoRef]);

  // Funkcja do pobierania surowego czasu z wideo (w sekundach)
  const getVideoTime = React.useCallback(async (): Promise<number> => {
    try {
      // Sprawdź zewnętrzne okno wideo
      const externalWindow = (window as any).externalVideoWindow;
      const isExternalWindowOpen = externalWindow && !externalWindow.closed;
      const isExternalWindowOpenFromStorage = localStorage.getItem('externalVideoWindowOpen') === 'true';
      
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
        
        if (timeFromExternal !== null && timeFromExternal !== undefined) {
          return timeFromExternal;
        }
      } else if (youtubeVideoRef?.current) {
        try {
          const time = await youtubeVideoRef.current.getCurrentTime();
          return time;
        } catch (error) {
          console.warn('ActionSection getVideoTime: błąd pobierania czasu z YouTube:', error);
          return 0;
        }
      } else if (customVideoRef?.current) {
        try {
          const time = await customVideoRef.current.getCurrentTime();
          return time;
        } catch (error) {
          console.warn('ActionSection getVideoTime: błąd pobierania czasu z CustomVideo:', error);
          return 0;
        }
      }
      return 0;
    } catch (error) {
      console.warn('ActionSection getVideoTime: błąd pobierania czasu z wideo:', error);
      return 0;
    }
  }, [youtubeVideoRef, customVideoRef]);

  // Stan do śledzenia, czy wideo jest wyśrodkowane na ekranie
  const [isVideoCentered, setIsVideoCentered] = React.useState(false);
  const [showScrollButton, setShowScrollButton] = React.useState(true);

  // Funkcja sprawdzająca, czy wideo jest wyśrodkowane
  const checkIfVideoCentered = React.useCallback(() => {
    if (!videoContainerRef?.current || !isVideoVisible) {
      setIsVideoCentered(false);
      setShowScrollButton(true);
      return;
    }

    const containerRect = videoContainerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const containerCenter = containerRect.top + containerRect.height / 2;
    const viewportCenter = viewportHeight / 2;
    
    // Sprawdzamy, czy środek kontenera jest w zakresie ±20% wysokości viewportu od środka
    const threshold = viewportHeight * 0.2;
    const isCentered = Math.abs(containerCenter - viewportCenter) < threshold;
    
    setIsVideoCentered(isCentered);
    
    // Jeśli wideo jest wyśrodkowane, ukryj przycisk
    if (isCentered) {
      setShowScrollButton(false);
    } else {
      setShowScrollButton(true);
    }
  }, [videoContainerRef, isVideoVisible]);

  // Listener na scroll, który sprawdza pozycję wideo
  React.useEffect(() => {
    if (!isVideoVisible || !onScrollToVideo) {
      setShowScrollButton(false);
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
  }, [isVideoVisible, onScrollToVideo, checkIfVideoCentered]);

  // Funkcja obsługująca kliknięcie przycisku
  const handleScrollButtonClick = React.useCallback(() => {
    if (onScrollToVideo) {
      onScrollToVideo();
      // Sprawdź pozycję wielokrotnie po scrollowaniu (smooth scroll może trwać różnie)
      const checkInterval = setInterval(() => {
        checkIfVideoCentered();
      }, 100);
      
      // Zatrzymaj sprawdzanie po 2 sekundach
      setTimeout(() => {
        clearInterval(checkInterval);
        checkIfVideoCentered();
      }, 2000);
    }
  }, [onScrollToVideo, checkIfVideoCentered]);
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
        actionCategory={actionCategory}
        matchInfo={matchInfo || undefined}
        allTeams={allTeams}
      />
      
      {actionCategory === "packing" ? (
        <ActionModal
          isOpen={isActionModalOpen}
          isVideoInternal={isVideoInternal}
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
          onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
          onGetVideoTime={getVideoTime}
          actionType={actionType}
          onActionTypeChange={setActionType}
          currentPoints={currentPoints}
          onAddPoints={handleAddPoints}
          isP0StartActive={isP0StartActive}
          onP0StartToggle={() => {
            setIsP0StartActive(!isP0StartActive);
            if (!isP0StartActive) {
              setIsP1StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP1StartActive={isP1StartActive}
          onP1StartToggle={() => {
            setIsP1StartActive(!isP1StartActive);
            if (!isP1StartActive) {
              setIsP0StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP2StartActive={isP2StartActive}
          onP2StartToggle={() => {
            setIsP2StartActive(!isP2StartActive);
            if (!isP2StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP3StartActive={isP3StartActive}
          onP3StartToggle={() => {
            setIsP3StartActive(!isP3StartActive);
            if (!isP3StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP2StartActive(false);
            }
          }}
          isP0Active={isP0Active}
          onP0Toggle={() => {
            setIsP0Active(!isP0Active);
            if (!isP0Active) {
              setIsP1Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP1Active={isP1Active}
          onP1Toggle={() => {
            setIsP1Active(!isP1Active);
            if (!isP1Active) {
              setIsP0Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP2Active={isP2Active}
          onP2Toggle={() => {
            setIsP2Active(!isP2Active);
            if (!isP2Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP3Active(false);
            }
          }}
          isP3Active={isP3Active}
          onP3Toggle={() => {
            setIsP3Active(!isP3Active);
            if (!isP3Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP2Active(false);
            }
          }}
          isContact1Active={isContact1Active}
          onContact1Toggle={() => {
            const newValue = !isContact1Active;
            setIsContact1Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 1T, wyłączamy pozostałe
              setIsContact2Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact2Active={isContact2Active}
          onContact2Toggle={() => {
            const newValue = !isContact2Active;
            setIsContact2Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 2T, wyłączamy pozostałe
              setIsContact1Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact3PlusActive={isContact3PlusActive}
          onContact3PlusToggle={() => {
            const newValue = !isContact3PlusActive;
            setIsContact3PlusActive(newValue);
            if (newValue) {
              // Jeśli aktywujemy 3T+, wyłączamy pozostałe
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
          editingAction={undefined}
          allMatches={undefined}
          selectedMatchId={undefined}
          onMatchSelect={undefined}
          matchInfo={matchInfo}
        isControversial={isControversial}
        onControversialToggle={() => setIsControversial(!isControversial)}
        />
      ) : actionCategory === "regain" ? (
        <RegainActionModal
          isOpen={isActionModalOpen}
          isVideoInternal={isVideoInternal}
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
          onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
          onGetVideoTime={getVideoTime}
          actionType={actionType}
          onActionTypeChange={setActionType}
          currentPoints={currentPoints}
          onAddPoints={handleAddPoints}
          isP0StartActive={isP0StartActive}
          onP0StartToggle={() => {
            setIsP0StartActive(!isP0StartActive);
            if (!isP0StartActive) {
              setIsP1StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP1StartActive={isP1StartActive}
          onP1StartToggle={() => {
            setIsP1StartActive(!isP1StartActive);
            if (!isP1StartActive) {
              setIsP0StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP2StartActive={isP2StartActive}
          onP2StartToggle={() => {
            setIsP2StartActive(!isP2StartActive);
            if (!isP2StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP3StartActive={isP3StartActive}
          onP3StartToggle={() => {
            setIsP3StartActive(!isP3StartActive);
            if (!isP3StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP2StartActive(false);
            }
          }}
          isP0Active={isP0Active}
          onP0Toggle={() => {
            setIsP0Active(!isP0Active);
            if (!isP0Active) {
              setIsP1Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP1Active={isP1Active}
          onP1Toggle={() => {
            setIsP1Active(!isP1Active);
            if (!isP1Active) {
              setIsP0Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP2Active={isP2Active}
          onP2Toggle={() => {
            setIsP2Active(!isP2Active);
            if (!isP2Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP3Active(false);
            }
          }}
          isP3Active={isP3Active}
          onP3Toggle={() => {
            setIsP3Active(!isP3Active);
            if (!isP3Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP2Active(false);
            }
          }}
          isContact1Active={isContact1Active}
          onContact1Toggle={() => {
            const newValue = !isContact1Active;
            setIsContact1Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 1T, wyłączamy pozostałe
              setIsContact2Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact2Active={isContact2Active}
          onContact2Toggle={() => {
            const newValue = !isContact2Active;
            setIsContact2Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 2T, wyłączamy pozostałe
              setIsContact1Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact3PlusActive={isContact3PlusActive}
          onContact3PlusToggle={() => {
            const newValue = !isContact3PlusActive;
            setIsContact3PlusActive(newValue);
            if (newValue) {
              // Jeśli aktywujemy 3T+, wyłączamy pozostałe
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
          onSaveAction={handleSaveAction}
          onReset={resetActionState}
          onResetPoints={resetActionPoints}
          matchInfo={matchInfo}
          // Nowy prop dla przycisku "Poniżej 8s"
          isBelow8sActive={isBelow8sActive}
          onBelow8sToggle={() => setIsBelow8sActive(!isBelow8sActive)}
          // Nowy prop dla liczby partnerów przed piłką
          playersBehindBall={playersBehindBall}
          onPlayersBehindBallChange={setPlayersBehindBall}
          // Nowy prop dla liczby przeciwników przed piłką
            opponentsBehindBall={opponentsBehindBall}
          onOpponentsBehindBallChange={setOpponentsBehindBall}
          // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
          playersLeftField={playersLeftField}
          onPlayersLeftFieldChange={setPlayersLeftField}
          // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
          opponentsLeftField={opponentsLeftField}
          onOpponentsLeftFieldChange={setOpponentsLeftField}
          isControversial={isControversial}
          onControversialToggle={() => setIsControversial(!isControversial)}
        />
      ) : actionCategory === "loses" ? (
        <LosesActionModal
          isOpen={isActionModalOpen}
          isVideoInternal={isVideoInternal}
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
          onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
          onGetVideoTime={getVideoTime}
          actionType={actionType}
          onActionTypeChange={setActionType}
          currentPoints={currentPoints}
          onAddPoints={handleAddPoints}
          isP0StartActive={isP0StartActive}
          onP0StartToggle={() => {
            setIsP0StartActive(!isP0StartActive);
            if (!isP0StartActive) {
              setIsP1StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP1StartActive={isP1StartActive}
          onP1StartToggle={() => {
            setIsP1StartActive(!isP1StartActive);
            if (!isP1StartActive) {
              setIsP0StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP2StartActive={isP2StartActive}
          onP2StartToggle={() => {
            setIsP2StartActive(!isP2StartActive);
            if (!isP2StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP3StartActive={isP3StartActive}
          onP3StartToggle={() => {
            setIsP3StartActive(!isP3StartActive);
            if (!isP3StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP2StartActive(false);
            }
          }}
          isP0Active={isP0Active}
          onP0Toggle={() => {
            setIsP0Active(!isP0Active);
            if (!isP0Active) {
              setIsP1Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP1Active={isP1Active}
          onP1Toggle={() => {
            setIsP1Active(!isP1Active);
            if (!isP1Active) {
              setIsP0Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP2Active={isP2Active}
          onP2Toggle={() => {
            setIsP2Active(!isP2Active);
            if (!isP2Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP3Active(false);
            }
          }}
          isP3Active={isP3Active}
          onP3Toggle={() => {
            setIsP3Active(!isP3Active);
            if (!isP3Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP2Active(false);
            }
          }}
          isContact1Active={isContact1Active}
          onContact1Toggle={() => {
            const newValue = !isContact1Active;
            setIsContact1Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 1T, wyłączamy pozostałe
              setIsContact2Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact2Active={isContact2Active}
          onContact2Toggle={() => {
            const newValue = !isContact2Active;
            setIsContact2Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 2T, wyłączamy pozostałe
              setIsContact1Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact3PlusActive={isContact3PlusActive}
          onContact3PlusToggle={() => {
            const newValue = !isContact3PlusActive;
            setIsContact3PlusActive(newValue);
            if (newValue) {
              // Jeśli aktywujemy 3T+, wyłączamy pozostałe
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
          onSaveAction={handleSaveAction}
          onReset={resetActionState}
          onResetPoints={resetActionPoints}
          matchInfo={matchInfo}
          // Nowy prop dla przycisku "Poniżej 8s"
          isBelow8sActive={isBelow8sActive}
          onBelow8sToggle={() => setIsBelow8sActive(!isBelow8sActive)}
          // Nowy prop dla przycisku "5s"
          isReaction5sActive={isReaction5sActive}
          onReaction5sToggle={() => {
            const newValue = !isReaction5sActive;
            setIsReaction5sActive(newValue);
            if (newValue) {
              setIsReaction5sNotApplicableActive(false);
            }
          }}
          // Nowy prop dla przycisku "Brak 5s" (nie dotyczy)
          isBadReaction5sActive={isBadReaction5sActive}
          onBadReaction5sToggle={() => {
            const newValue = !isBadReaction5sActive;
            setIsBadReaction5sActive(newValue);
            if (newValue) {
              setIsReaction5sActive(false);
            }
          }}
          // Nowy prop dla przycisku "Aut"
          isAutActive={isAutActive}
          onAutToggle={() => setIsAutActive(!isAutActive)}
          // Nowy prop dla liczby partnerów przed piłką
          playersBehindBall={playersBehindBall}
          onPlayersBehindBallChange={setPlayersBehindBall}
          // Nowy prop dla liczby przeciwników przed piłką
            opponentsBehindBall={opponentsBehindBall}
          onOpponentsBehindBallChange={setOpponentsBehindBall}
          // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
          playersLeftField={playersLeftField}
          onPlayersLeftFieldChange={setPlayersLeftField}
          // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
          opponentsLeftField={opponentsLeftField}
          onOpponentsLeftFieldChange={setOpponentsLeftField}
          isControversial={isControversial}
          onControversialToggle={() => setIsControversial(!isControversial)}
        />
      ) : (
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
          onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
          onGetVideoTime={getVideoTime}
          actionType={actionType}
          onActionTypeChange={setActionType}
          currentPoints={currentPoints}
          onAddPoints={handleAddPoints}
          isP0StartActive={isP0StartActive}
          onP0StartToggle={() => {
            setIsP0StartActive(!isP0StartActive);
            if (!isP0StartActive) {
              setIsP1StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP1StartActive={isP1StartActive}
          onP1StartToggle={() => {
            setIsP1StartActive(!isP1StartActive);
            if (!isP1StartActive) {
              setIsP0StartActive(false);
              setIsP2StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP2StartActive={isP2StartActive}
          onP2StartToggle={() => {
            setIsP2StartActive(!isP2StartActive);
            if (!isP2StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP3StartActive(false);
            }
          }}
          isP3StartActive={isP3StartActive}
          onP3StartToggle={() => {
            setIsP3StartActive(!isP3StartActive);
            if (!isP3StartActive) {
              setIsP0StartActive(false);
              setIsP1StartActive(false);
              setIsP2StartActive(false);
            }
          }}
          isP0Active={isP0Active}
          onP0Toggle={() => {
            setIsP0Active(!isP0Active);
            if (!isP0Active) {
              setIsP1Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP1Active={isP1Active}
          onP1Toggle={() => {
            setIsP1Active(!isP1Active);
            if (!isP1Active) {
              setIsP0Active(false);
              setIsP2Active(false);
              setIsP3Active(false);
            }
          }}
          isP2Active={isP2Active}
          onP2Toggle={() => {
            setIsP2Active(!isP2Active);
            if (!isP2Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP3Active(false);
            }
          }}
          isP3Active={isP3Active}
          onP3Toggle={() => {
            setIsP3Active(!isP3Active);
            if (!isP3Active) {
              setIsP0Active(false);
              setIsP1Active(false);
              setIsP2Active(false);
            }
          }}
          isContact1Active={isContact1Active}
          onContact1Toggle={() => {
            const newValue = !isContact1Active;
            setIsContact1Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 1T, wyłączamy pozostałe
              setIsContact2Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact2Active={isContact2Active}
          onContact2Toggle={() => {
            const newValue = !isContact2Active;
            setIsContact2Active(newValue);
            if (newValue) {
              // Jeśli aktywujemy 2T, wyłączamy pozostałe
              setIsContact1Active(false);
              setIsContact3PlusActive(false);
            }
          }}
          isContact3PlusActive={isContact3PlusActive}
          onContact3PlusToggle={() => {
            const newValue = !isContact3PlusActive;
            setIsContact3PlusActive(newValue);
            if (newValue) {
              // Jeśli aktywujemy 3T+, wyłączamy pozostałe
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
          onSaveAction={handleSaveAction}
          onReset={resetActionState}
          onResetPoints={resetActionPoints}
          matchInfo={matchInfo}
          isControversial={isControversial}
          onControversialToggle={() => setIsControversial(!isControversial)}
          // Nowe propsy dla trybu unpacking
          mode={mode}
          onModeChange={onModeChange}
          selectedDefensePlayers={selectedDefensePlayers}
          onDefensePlayersChange={onDefensePlayersChange}
        />
      )}

      {/* Modale edycji akcji - renderowane wewnątrz ActionSection dla poprawnego pozycjonowania */}
      {isActionEditModalOpen && editingAction && getActionCategory && getActionCategory(editingAction) === "loses" ? (
        <LosesActionModal
          isOpen={isActionEditModalOpen}
          isVideoInternal={isVideoInternal}
          onClose={onCloseActionEditModal || (() => {})}
          players={players}
          selectedPlayerId={editingAction?.senderId || null}
          selectedReceiverId={editingAction?.receiverId || null}
          onSenderSelect={(id) => {
            if (editingAction && onEditingActionChange) {
              const player = players.find(p => p.id === id);
              onEditingActionChange({
                ...editingAction,
                senderId: id || '',
                senderName: player?.name || '',
                senderNumber: player?.number || 0
              });
            }
          }}
          onReceiverSelect={(id) => {
            if (editingAction && onEditingActionChange) {
              const player = players.find(p => p.id === id);
              onEditingActionChange({
                ...editingAction,
                receiverId: id || '',
                receiverName: player?.name || '',
                receiverNumber: player?.number || 0
              });
            }
          }}
          actionMinute={editingAction?.minute || 0}
          onMinuteChange={(minute) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                minute
              });
            }
          }}
          onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
          actionType={editingAction?.actionType as "pass" | "dribble" || 'pass'}
          onActionTypeChange={(type) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                actionType: type
              });
            }
          }}
          currentPoints={editingAction?.packingPoints || 0}
          onAddPoints={(points) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                packingPoints: (editingAction.packingPoints || 0) + points
              });
            }
          }}
          isP0Active={editingAction?.isP0 || false}
          onP0Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP0Active = !editingAction.isP0;
              onEditingActionChange({
                ...editingAction,
                isP0: newIsP0Active,
                isP1: newIsP0Active ? false : editingAction.isP1,
                isP2: newIsP0Active ? false : editingAction.isP2,
                isP3: newIsP0Active ? false : editingAction.isP3
              });
            }
          }}
          isP1Active={editingAction?.isP1 || false}
          onP1Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP1Active = !editingAction.isP1;
              onEditingActionChange({
                ...editingAction,
                isP1: newIsP1Active,
                isP0: newIsP1Active ? false : editingAction.isP0,
                isP2: newIsP1Active ? false : editingAction.isP2,
                isP3: newIsP1Active ? false : editingAction.isP3
              });
            }
          }}
          isP2Active={editingAction?.isP2 || false}
          onP2Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP2Active = !editingAction.isP2;
              onEditingActionChange({
                ...editingAction,
                isP2: newIsP2Active,
                isP0: newIsP2Active ? false : editingAction.isP0,
                isP1: newIsP2Active ? false : editingAction.isP1,
                isP3: newIsP2Active ? false : editingAction.isP3
              });
            }
          }}
          isP3Active={editingAction?.isP3 || false}
          onP3Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP3Active = !editingAction.isP3;
              onEditingActionChange({
                ...editingAction,
                isP3: newIsP3Active,
                isP0: newIsP3Active ? false : editingAction.isP0,
                isP1: newIsP3Active ? false : editingAction.isP1,
                isP2: newIsP3Active ? false : editingAction.isP2
              });
            }
          }}
          isContact1Active={editingAction?.isContact1 || false}
          onContact1Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact1;
              onEditingActionChange({
                ...editingAction,
                isContact1: newValue,
                isContact2: newValue ? false : editingAction.isContact2,
                isContact3Plus: newValue ? false : editingAction.isContact3Plus
              });
            }
          }}
          isContact2Active={editingAction?.isContact2 || false}
          onContact2Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact2;
              onEditingActionChange({
                ...editingAction,
                isContact2: newValue,
                isContact1: newValue ? false : editingAction.isContact1,
                isContact3Plus: newValue ? false : editingAction.isContact3Plus
              });
            }
          }}
          isContact3PlusActive={editingAction?.isContact3Plus || false}
          onContact3PlusToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact3Plus;
              onEditingActionChange({
                ...editingAction,
                isContact3Plus: newValue,
                isContact1: newValue ? false : editingAction.isContact1,
                isContact2: newValue ? false : editingAction.isContact2
              });
            }
          }}
          isShot={editingAction?.isShot || false}
          onShotToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isShot: checked
              });
            }
          }}
          isGoal={editingAction?.isGoal || false}
          onGoalToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isGoal: checked
              });
            }
          }}
          isPenaltyAreaEntry={editingAction?.isPenaltyAreaEntry || false}
          onPenaltyAreaEntryToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isPenaltyAreaEntry: checked
              });
            }
          }}
          isSecondHalf={editingAction?.isSecondHalf || false}
          onSecondHalfToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isSecondHalf: checked
              });
            }
          }}
          onSaveAction={() => {
            if (editingAction && onSaveEditedAction) {
              // Pobierz notatkę kontrowersyjną z localStorage
              const tempControversyNote = typeof window !== 'undefined' ? localStorage.getItem('tempControversyNote') : null;
              const controversyNote = tempControversyNote && tempControversyNote.trim() ? tempControversyNote.trim() : undefined;
              
              // Zaktualizuj editingAction z controversyNote
              const updatedAction = {
                ...editingAction,
                ...(editingAction.isControversial && controversyNote && { controversyNote }),
                ...(!editingAction.isControversial && { controversyNote: undefined })
              };
              
              onSaveEditedAction(updatedAction);
            }
          }}
          onReset={() => {
            if (editingAction && actions && actions.length > 0 && onEditingActionChange) {
              const originalAction = actions.find(a => a.id === editingAction.id);
              if (originalAction) {
                onEditingActionChange({ ...originalAction });
              }
            }
          }}
          onResetPoints={resetActionPoints}
          editingAction={editingAction}
          allMatches={allMatches}
          selectedMatchId={editingAction?.matchId || null}
          onMatchSelect={(matchId) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                matchId
              });
            }
          }}
          matchInfo={matchInfo}
          isBelow8sActive={editingAction?.isBelow8s || false}
          onBelow8sToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isBelow8s: !editingAction.isBelow8s
              });
            }
          }}
          isReaction5sActive={editingAction?.isReaction5s || false}
          onReaction5sToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isReaction5s;
              onEditingActionChange({
                ...editingAction,
                isReaction5s: newValue,
                isBadReaction5s: newValue ? false : editingAction.isBadReaction5s
              });
            }
          }}
          isBadReaction5sActive={editingAction?.isBadReaction5s || false}
          onBadReaction5sToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isBadReaction5s;
              onEditingActionChange({
                ...editingAction,
                isBadReaction5s: newValue,
                isReaction5s: newValue ? false : editingAction.isReaction5s
              });
            }
          }}
          isAutActive={editingAction?.isAut || false}
          onAutToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isAut: !editingAction.isAut
              });
            }
          }}
          playersBehindBall={editingAction?.playersBehindBall || 0}
          onPlayersBehindBallChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                playersBehindBall: count
              });
            }
          }}
          opponentsBehindBall={editingAction?.opponentsBehindBall || 0}
          onOpponentsBehindBallChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                opponentsBehindBall: count
              });
            }
          }}
          playersLeftField={editingAction?.playersLeftField || (editingAction?.totalPlayersOnField !== undefined ? 11 - editingAction.totalPlayersOnField : 0)}
          onPlayersLeftFieldChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                playersLeftField: count,
                totalPlayersOnField: 11 - count
              });
            }
          }}
          opponentsLeftField={editingAction?.opponentsLeftField || (editingAction?.totalOpponentsOnField !== undefined ? 11 - editingAction.totalOpponentsOnField : 0)}
          onOpponentsLeftFieldChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                opponentsLeftField: count,
                totalOpponentsOnField: 11 - count
              });
            }
          }}
          isControversial={editingAction?.isControversial || false}
          onControversialToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isControversial: !editingAction.isControversial
              });
            }
          }}
        />
      ) : isActionEditModalOpen && editingAction && getActionCategory && getActionCategory(editingAction) === "regain" ? (
        <RegainActionModal
          isOpen={isActionEditModalOpen}
          isVideoInternal={isVideoInternal}
          onClose={onCloseActionEditModal || (() => {})}
          players={players}
          selectedPlayerId={editingAction?.senderId || null}
          selectedReceiverId={editingAction?.receiverId || null}
          onSenderSelect={(id) => {
            if (editingAction && onEditingActionChange) {
              const player = players.find(p => p.id === id);
              onEditingActionChange({
                ...editingAction,
                senderId: id || '',
                senderName: player?.name || '',
                senderNumber: player?.number || 0
              });
            }
          }}
          onReceiverSelect={(id) => {
            if (editingAction && onEditingActionChange) {
              const player = players.find(p => p.id === id);
              onEditingActionChange({
                ...editingAction,
                receiverId: id || '',
                receiverName: player?.name || '',
                receiverNumber: player?.number || 0
              });
            }
          }}
          actionMinute={editingAction?.minute || 0}
          onMinuteChange={(minute) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                minute
              });
            }
          }}
          onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
          actionType={editingAction?.actionType as "pass" | "dribble" || 'pass'}
          onActionTypeChange={(type) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                actionType: type
              });
            }
          }}
          currentPoints={editingAction?.packingPoints || 0}
          onAddPoints={(points) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                packingPoints: (editingAction.packingPoints || 0) + points
              });
            }
          }}
          isP0StartActive={editingAction?.isP0Start || false}
          onP0StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isP0Start: !editingAction.isP0Start
              });
            }
          }}
          isP1StartActive={editingAction?.isP1Start || false}
          onP1StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isP1Start: !editingAction.isP1Start
              });
            }
          }}
          isP2StartActive={editingAction?.isP2Start || false}
          onP2StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isP2Start: !editingAction.isP2Start
              });
            }
          }}
          isP3StartActive={editingAction?.isP3Start || false}
          onP3StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isP3Start: !editingAction.isP3Start
              });
            }
          }}
          isP0Active={editingAction?.isP0 || false}
          onP0Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP0Active = !editingAction.isP0;
              onEditingActionChange({
                ...editingAction,
                isP0: newIsP0Active,
                isP1: newIsP0Active ? false : editingAction.isP1,
                isP2: newIsP0Active ? false : editingAction.isP2,
                isP3: newIsP0Active ? false : editingAction.isP3
              });
            }
          }}
          isP1Active={editingAction?.isP1 || false}
          onP1Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP1Active = !editingAction.isP1;
              onEditingActionChange({
                ...editingAction,
                isP1: newIsP1Active,
                isP0: newIsP1Active ? false : editingAction.isP0,
                isP2: newIsP1Active ? false : editingAction.isP2,
                isP3: newIsP1Active ? false : editingAction.isP3
              });
            }
          }}
          isP2Active={editingAction?.isP2 || false}
          onP2Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP2Active = !editingAction.isP2;
              onEditingActionChange({
                ...editingAction,
                isP2: newIsP2Active,
                isP0: newIsP2Active ? false : editingAction.isP0,
                isP1: newIsP2Active ? false : editingAction.isP1,
                isP3: newIsP2Active ? false : editingAction.isP3
              });
            }
          }}
          isP3Active={editingAction?.isP3 || false}
          onP3Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP3Active = !editingAction.isP3;
              onEditingActionChange({
                ...editingAction,
                isP3: newIsP3Active,
                isP0: newIsP3Active ? false : editingAction.isP0,
                isP1: newIsP3Active ? false : editingAction.isP1,
                isP2: newIsP3Active ? false : editingAction.isP2
              });
            }
          }}
          isContact1Active={editingAction?.isContact1 || false}
          onContact1Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact1;
              onEditingActionChange({
                ...editingAction,
                isContact1: newValue,
                isContact2: newValue ? false : editingAction.isContact2,
                isContact3Plus: newValue ? false : editingAction.isContact3Plus
              });
            }
          }}
          isContact2Active={editingAction?.isContact2 || false}
          onContact2Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact2;
              onEditingActionChange({
                ...editingAction,
                isContact2: newValue,
                isContact1: newValue ? false : editingAction.isContact1,
                isContact3Plus: newValue ? false : editingAction.isContact3Plus
              });
            }
          }}
          isContact3PlusActive={editingAction?.isContact3Plus || false}
          onContact3PlusToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact3Plus;
              onEditingActionChange({
                ...editingAction,
                isContact3Plus: newValue,
                isContact1: newValue ? false : editingAction.isContact1,
                isContact2: newValue ? false : editingAction.isContact2
              });
            }
          }}
          isShot={editingAction?.isShot || false}
          onShotToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isShot: checked
              });
            }
          }}
          isGoal={editingAction?.isGoal || false}
          onGoalToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isGoal: checked
              });
            }
          }}
          isPenaltyAreaEntry={editingAction?.isPenaltyAreaEntry || false}
          onPenaltyAreaEntryToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isPenaltyAreaEntry: checked
              });
            }
          }}
          isSecondHalf={editingAction?.isSecondHalf || false}
          onSecondHalfToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isSecondHalf: checked
              });
            }
          }}
          onSaveAction={() => {
            if (editingAction && onSaveEditedAction) {
              // Pobierz notatkę kontrowersyjną z localStorage
              const tempControversyNote = typeof window !== 'undefined' ? localStorage.getItem('tempControversyNote') : null;
              const controversyNote = tempControversyNote && tempControversyNote.trim() ? tempControversyNote.trim() : undefined;
              
              // Zaktualizuj editingAction z controversyNote
              const updatedAction = {
                ...editingAction,
                ...(editingAction.isControversial && controversyNote && { controversyNote }),
                ...(!editingAction.isControversial && { controversyNote: undefined })
              };
              
              onSaveEditedAction(updatedAction);
            }
          }}
          onReset={() => {
            if (editingAction && actions && actions.length > 0 && onEditingActionChange) {
              const originalAction = actions.find(a => a.id === editingAction.id);
              if (originalAction) {
                onEditingActionChange({ ...originalAction });
              }
            }
          }}
          onResetPoints={resetActionPoints}
          editingAction={editingAction}
          allMatches={allMatches}
          selectedMatchId={editingAction?.matchId || null}
          onMatchSelect={(matchId) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                matchId
              });
            }
          }}
          matchInfo={matchInfo}
          isBelow8sActive={editingAction?.isBelow8s || false}
          onBelow8sToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isBelow8s: !editingAction.isBelow8s
              });
            }
          }}
          playersBehindBall={editingAction?.playersBehindBall || 0}
          onPlayersBehindBallChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                playersBehindBall: count
              });
            }
          }}
          opponentsBehindBall={editingAction?.opponentsBehindBall || 0}
          onOpponentsBehindBallChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                opponentsBehindBall: count
              });
            }
          }}
          playersLeftField={editingAction?.playersLeftField || (editingAction?.totalPlayersOnField !== undefined ? 11 - editingAction.totalPlayersOnField : 0)}
          onPlayersLeftFieldChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                playersLeftField: count,
                totalPlayersOnField: 11 - count
              });
            }
          }}
          opponentsLeftField={editingAction?.opponentsLeftField || (editingAction?.totalOpponentsOnField !== undefined ? 11 - editingAction.totalOpponentsOnField : 0)}
          onOpponentsLeftFieldChange={(count) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                opponentsLeftField: count,
                totalOpponentsOnField: 11 - count
              });
            }
          }}
          isControversial={editingAction?.isControversial || false}
          onControversialToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isControversial: !editingAction.isControversial
              });
            }
          }}
        />
      ) : isActionEditModalOpen && editingAction ? (
        <ActionModal
          isOpen={isActionEditModalOpen}
          isVideoInternal={isVideoInternal}
          onClose={onCloseActionEditModal || (() => {})}
          players={players}
          selectedPlayerId={editingAction?.senderId || null}
          selectedReceiverId={editingAction?.receiverId || null}
          onSenderSelect={(id) => {
            if (editingAction && onEditingActionChange) {
              const player = players.find(p => p.id === id);
              onEditingActionChange({
                ...editingAction,
                senderId: id || '',
                senderName: player?.name || '',
                senderNumber: player?.number || 0
              });
            }
          }}
          onReceiverSelect={(id) => {
            if (editingAction && onEditingActionChange) {
              const player = players.find(p => p.id === id);
              onEditingActionChange({
                ...editingAction,
                receiverId: id || '',
                receiverName: player?.name || '',
                receiverNumber: player?.number || 0
              });
            }
          }}
          actionMinute={editingAction?.minute || 0}
          onMinuteChange={(minute) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                minute
              });
            }
          }}
          onCalculateMinuteFromVideo={calculateMatchMinuteFromVideoTime}
          actionType={editingAction?.actionType as "pass" | "dribble" || 'pass'}
          onActionTypeChange={(type) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                actionType: type
              });
            }
          }}
          currentPoints={editingAction?.packingPoints || 0}
          onAddPoints={(points) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                packingPoints: (editingAction.packingPoints || 0) + points
              });
            }
          }}
          isP0StartActive={editingAction?.isP0Start || false}
          onP0StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP0StartActive = !editingAction.isP0Start;
              onEditingActionChange({
                ...editingAction,
                isP0Start: newIsP0StartActive,
                isP1Start: newIsP0StartActive ? false : editingAction.isP1Start,
                isP2Start: newIsP0StartActive ? false : editingAction.isP2Start,
                isP3Start: newIsP0StartActive ? false : editingAction.isP3Start
              });
            }
          }}
          isP1StartActive={editingAction?.isP1Start || false}
          onP1StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP1StartActive = !editingAction.isP1Start;
              onEditingActionChange({
                ...editingAction,
                isP1Start: newIsP1StartActive,
                isP0Start: newIsP1StartActive ? false : editingAction.isP0Start,
                isP2Start: newIsP1StartActive ? false : editingAction.isP2Start,
                isP3Start: newIsP1StartActive ? false : editingAction.isP3Start
              });
            }
          }}
          isP2StartActive={editingAction?.isP2Start || false}
          onP2StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP2StartActive = !editingAction.isP2Start;
              onEditingActionChange({
                ...editingAction,
                isP2Start: newIsP2StartActive,
                isP0Start: newIsP2StartActive ? false : editingAction.isP0Start,
                isP1Start: newIsP2StartActive ? false : editingAction.isP1Start,
                isP3Start: newIsP2StartActive ? false : editingAction.isP3Start
              });
            }
          }}
          isP3StartActive={editingAction?.isP3Start || false}
          onP3StartToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP3StartActive = !editingAction.isP3Start;
              onEditingActionChange({
                ...editingAction,
                isP3Start: newIsP3StartActive,
                isP0Start: newIsP3StartActive ? false : editingAction.isP0Start,
                isP1Start: newIsP3StartActive ? false : editingAction.isP1Start,
                isP2Start: newIsP3StartActive ? false : editingAction.isP2Start
              });
            }
          }}
          isP0Active={editingAction?.isP0 || false}
          onP0Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP0Active = !editingAction.isP0;
              onEditingActionChange({
                ...editingAction,
                isP0: newIsP0Active,
                isP1: newIsP0Active ? false : editingAction.isP1,
                isP2: newIsP0Active ? false : editingAction.isP2,
                isP3: newIsP0Active ? false : editingAction.isP3
              });
            }
          }}
          isP1Active={editingAction?.isP1 || false}
          onP1Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP1Active = !editingAction.isP1;
              onEditingActionChange({
                ...editingAction,
                isP1: newIsP1Active,
                isP0: newIsP1Active ? false : editingAction.isP0,
                isP2: newIsP1Active ? false : editingAction.isP2,
                isP3: newIsP1Active ? false : editingAction.isP3
              });
            }
          }}
          isP2Active={editingAction?.isP2 || false}
          onP2Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP2Active = !editingAction.isP2;
              onEditingActionChange({
                ...editingAction,
                isP2: newIsP2Active,
                isP0: newIsP2Active ? false : editingAction.isP0,
                isP1: newIsP2Active ? false : editingAction.isP1,
                isP3: newIsP2Active ? false : editingAction.isP3
              });
            }
          }}
          isP3Active={editingAction?.isP3 || false}
          onP3Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newIsP3Active = !editingAction.isP3;
              onEditingActionChange({
                ...editingAction,
                isP3: newIsP3Active,
                isP0: newIsP3Active ? false : editingAction.isP0,
                isP1: newIsP3Active ? false : editingAction.isP1,
                isP2: newIsP3Active ? false : editingAction.isP2
              });
            }
          }}
          isContact1Active={editingAction?.isContact1 || false}
          onContact1Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact1;
              onEditingActionChange({
                ...editingAction,
                isContact1: newValue,
                isContact2: newValue ? false : editingAction.isContact2,
                isContact3Plus: newValue ? false : editingAction.isContact3Plus
              });
            }
          }}
          isContact2Active={editingAction?.isContact2 || false}
          onContact2Toggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact2;
              onEditingActionChange({
                ...editingAction,
                isContact2: newValue,
                isContact1: newValue ? false : editingAction.isContact1,
                isContact3Plus: newValue ? false : editingAction.isContact3Plus
              });
            }
          }}
          isContact3PlusActive={editingAction?.isContact3Plus || false}
          onContact3PlusToggle={() => {
            if (editingAction && onEditingActionChange) {
              const newValue = !editingAction.isContact3Plus;
              onEditingActionChange({
                ...editingAction,
                isContact3Plus: newValue,
                isContact1: newValue ? false : editingAction.isContact1,
                isContact2: newValue ? false : editingAction.isContact2
              });
            }
          }}
          isShot={editingAction?.isShot || false}
          onShotToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isShot: checked
              });
            }
          }}
          isGoal={editingAction?.isGoal || false}
          onGoalToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isGoal: checked
              });
            }
          }}
          isPenaltyAreaEntry={editingAction?.isPenaltyAreaEntry || false}
          onPenaltyAreaEntryToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isPenaltyAreaEntry: checked
              });
            }
          }}
          isSecondHalf={editingAction?.isSecondHalf || false}
          onSecondHalfToggle={(checked) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isSecondHalf: checked
              });
            }
          }}
          onSaveAction={() => {
            if (editingAction && onSaveEditedAction) {
              // Pobierz notatkę kontrowersyjną z localStorage
              const tempControversyNote = typeof window !== 'undefined' ? localStorage.getItem('tempControversyNote') : null;
              const controversyNote = tempControversyNote && tempControversyNote.trim() ? tempControversyNote.trim() : undefined;
              
              // Zaktualizuj editingAction z controversyNote
              const updatedAction = {
                ...editingAction,
                ...(editingAction.isControversial && controversyNote && { controversyNote }),
                ...(!editingAction.isControversial && { controversyNote: undefined })
              };
              
              onSaveEditedAction(updatedAction);
            }
          }}
          onReset={() => {
            if (editingAction && actions && actions.length > 0 && onEditingActionChange) {
              const originalAction = actions.find(a => a.id === editingAction.id);
              if (originalAction) {
                onEditingActionChange({ ...originalAction });
              }
            }
          }}
          onResetPoints={resetActionPoints}
          editingAction={editingAction}
          allMatches={allMatches}
          selectedMatchId={editingAction?.matchId || null}
          onMatchSelect={(matchId) => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                matchId
              });
            }
          }}
          matchInfo={matchInfo}
          isControversial={editingAction?.isControversial || false}
          onControversialToggle={() => {
            if (editingAction && onEditingActionChange) {
              onEditingActionChange({
                ...editingAction,
                isControversial: !editingAction.isControversial
              });
            }
          }}
        />
      ) : null}
    </section>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ActionSection.displayName = "ActionSection";

export default ActionSection;
