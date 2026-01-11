// components/ActionSection/ActionSection.tsx
"use client";

import React, { memo, useEffect } from "react";
import FootballPitch from "../FootballPitch/FootballPitch";
import ActionModal from "../ActionModal/ActionModal";
import RegainActionModal from "../RegainActionModal/RegainActionModal";
import LosesActionModal from "../LosesActionModal/LosesActionModal";
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
  isSecondHalf: boolean;
  setIsSecondHalf: React.Dispatch<React.SetStateAction<boolean>>;
  isBelow8sActive: boolean;
  setIsBelow8sActive: React.Dispatch<React.SetStateAction<boolean>>;
  isReaction5sActive: boolean;
  setIsReaction5sActive: React.Dispatch<React.SetStateAction<boolean>>;
  isAutActive: boolean;
  setIsAutActive: React.Dispatch<React.SetStateAction<boolean>>;
  isReaction5sNotApplicableActive: boolean;
  setIsReaction5sNotApplicableActive: React.Dispatch<React.SetStateAction<boolean>>;
  isPMAreaActive: boolean;
  setIsPMAreaActive: React.Dispatch<React.SetStateAction<boolean>>;
  playersBehindBall: number;
  setPlayersBehindBall: React.Dispatch<React.SetStateAction<number>>;
  opponentsBeforeBall: number;
  setOpponentsBeforeBall: React.Dispatch<React.SetStateAction<number>>;
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
  onScrollToVideo?: () => void;
  videoContainerRef?: React.RefObject<HTMLDivElement>;
  // Refs do odtwarzaczy wideo
  youtubeVideoRef?: React.RefObject<{ getCurrentTime: () => Promise<number> }>;
  customVideoRef?: React.RefObject<{ getCurrentTime: () => Promise<number> }>;
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
  isSecondHalf,
  setIsSecondHalf,
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
  onScrollToVideo,
  onRegainLosesModeChange,
  videoContainerRef,
  youtubeVideoRef,
  customVideoRef,
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
        currentVideoTime = await youtubeVideoRef.current.getCurrentTime();
      } else if (customVideoRef?.current) {
        currentVideoTime = await customVideoRef.current.getCurrentTime();
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
      {/* Tekst informacyjny dla packing (atak) */}
      {actionCategory === "packing" && mode === "attack" && (
        <div className={styles.defenseInfo}>
          <p>⚠️ Pola kolorowe to bramka, którą atakujesz</p>
        </div>
      )}
      {/* Tekst informacyjny dla regain i loses */}
      {(actionCategory === "regain" || actionCategory === "loses") && (
        <div className={styles.defenseInfo}>
          <p>⚠️ Pola kolorowe to bramka, której bronisz</p>
        </div>
      )}
      {/* Przycisk scrollowania do wideo YouTube - fixed w prawym dolnym rogu */}
      {isVideoVisible && onScrollToVideo && showScrollButton && (
        <button
          className={styles.scrollToVideoButtonFixed}
          onClick={handleScrollButtonClick}
          title="Przewiń do wideo YouTube"
          aria-label="Przewiń do wideo YouTube"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
          </svg>
        </button>
      )}
      <FootballPitch
        selectedZone={selectedZone}
        onZoneSelect={handlePitchZoneSelect}
        startZone={startZone}
        endZone={endZone}
        actionCategory={actionCategory}
      />
      
      {actionCategory === "packing" ? (
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
          editingAction={undefined}
          allMatches={undefined}
          selectedMatchId={undefined}
          onMatchSelect={undefined}
          matchInfo={matchInfo}
        />
      ) : actionCategory === "regain" ? (
        <RegainActionModal
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
          opponentsBeforeBall={opponentsBeforeBall}
          onOpponentsBeforeBallChange={setOpponentsBeforeBall}
          // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
          playersLeftField={playersLeftField}
          onPlayersLeftFieldChange={setPlayersLeftField}
          // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
          opponentsLeftField={opponentsLeftField}
          onOpponentsLeftFieldChange={setOpponentsLeftField}
        />
      ) : actionCategory === "loses" ? (
        <LosesActionModal
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
          onSaveAction={handleSaveAction}
          onReset={resetActionState}
          onResetPoints={resetActionPoints}
          matchInfo={matchInfo}
          // Nowy prop dla przycisku "Poniżej 8s"
          isBelow8sActive={isBelow8sActive}
          onBelow8sToggle={() => setIsBelow8sActive(!isBelow8sActive)}
          // Nowy prop dla przycisku "Reakcja 5s"
          isReaction5sActive={isReaction5sActive}
          onReaction5sToggle={() => setIsReaction5sActive(!isReaction5sActive)}
          // Nowy prop dla przycisku "Aut"
          isAutActive={isAutActive}
          onAutToggle={() => setIsAutActive(!isAutActive)}
          // Nowy prop dla przycisku "Nie dotyczy" (reakcja 5s)
          isReaction5sNotApplicableActive={isReaction5sNotApplicableActive}
          onReaction5sNotApplicableToggle={() => setIsReaction5sNotApplicableActive(!isReaction5sNotApplicableActive)}
          // Nowy prop dla liczby partnerów przed piłką
          playersBehindBall={playersBehindBall}
          onPlayersBehindBallChange={setPlayersBehindBall}
          // Nowy prop dla liczby przeciwników przed piłką
          opponentsBeforeBall={opponentsBeforeBall}
          onOpponentsBeforeBallChange={setOpponentsBeforeBall}
          // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
          playersLeftField={playersLeftField}
          onPlayersLeftFieldChange={setPlayersLeftField}
          // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
          opponentsLeftField={opponentsLeftField}
          onOpponentsLeftFieldChange={setOpponentsLeftField}
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
          onSaveAction={handleSaveAction}
          onReset={resetActionState}
          onResetPoints={resetActionPoints}
          matchInfo={matchInfo}
          // Nowe propsy dla trybu unpacking
          mode={mode}
          onModeChange={onModeChange}
          selectedDefensePlayers={selectedDefensePlayers}
          onDefensePlayersChange={onDefensePlayersChange}
        />
      )}
    </section>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ActionSection.displayName = "ActionSection";

export default ActionSection;
