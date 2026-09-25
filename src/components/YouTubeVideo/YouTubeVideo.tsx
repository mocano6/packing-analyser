"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState } from "react";
import YouTube, { YouTubeProps } from "react-youtube";
import { TeamInfo } from "@/types";
import toast from "react-hot-toast";
import { hasExternalVideoSource, saveExternalVideoMatchInfo } from "@/utils/externalVideoMatchInfo";
import { extractYouTubeId } from "@/utils/youtubeVideoId";
import {
  canSeekYoutubePlayer,
  isVideoSeekLanded,
  readYoutubePlayerTime,
  resolveYoutubeEmbedStart,
} from "@/utils/youtubeSeek";
import styles from "./YouTubeVideo.module.css";

interface YouTubeVideoProps {
  matchInfo?: TeamInfo | null;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /**
   * Sekunda startu. Przy pierwszym zamontowaniu playera trafia do playerVars.start,
   * żeby iframe nie wstał od 0. Kolejne kliknięcia idą przez seekTo.
   */
  seekTargetSeconds?: number | null;
  onSeekTargetConsumed?: () => void;
}

export interface YouTubeVideoRef {
  getCurrentTime: () => Promise<number>;
  seekTo: (seconds: number) => Promise<void>;
}

const YouTubeVideo = forwardRef<YouTubeVideoRef, YouTubeVideoProps>(({
  matchInfo,
  isVisible = true,
  onToggleVisibility,
  isFullscreen: isFullscreenProp,
  onToggleFullscreen,
  seekTargetSeconds = null,
  onSeekTargetConsumed,
}, ref) => {
  const playerRef = useRef<any>(null);
  const onSeekTargetConsumedRef = useRef(onSeekTargetConsumed);
  onSeekTargetConsumedRef.current = onSeekTargetConsumed;
  /** Ostatni żądany moment — nie czyścimy go, gdy rodzic na chwilę wyzeruje prop. */
  const pendingSeekRef = useRef<number | null>(null);
  const requestedSeekRef = useRef<number | null>(null);
  const seekAttemptRef = useRef(0);
  const playerReadyRef = useRef(false);
  const frozenEmbedStartRef = useRef<number | undefined>(undefined);
  const videoIdRef = useRef<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isExternalWindowOpen, setIsExternalWindowOpen] = useState<boolean>(false);
  const [isFullscreenInternal, setIsFullscreenInternal] = useState<boolean>(false);
  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : isFullscreenInternal;

  // Udostępnij funkcję getCurrentTime przez ref
  useImperativeHandle(ref, () => ({
    getCurrentTime: async (): Promise<number> => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          return await playerRef.current.getCurrentTime();
        } catch (error) {
          console.warn('Nie udało się pobrać czasu z YouTube playera:', error);
          return 0;
        }
      }
      return 0;
    },
    seekTo: async (seconds: number): Promise<void> => {
      if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error("youtube-seek-invalid");
      }
      if (pendingSeekRef.current !== seconds) {
        seekAttemptRef.current = 0;
      }
      pendingSeekRef.current = seconds;
      requestedSeekRef.current = seconds;

      const player = playerRef.current;
      if (!player || typeof player.seekTo !== "function" || typeof player.getCurrentTime !== "function") {
        throw new Error("youtube-player-not-ready");
      }
      if (pendingSeekRef.current !== seconds) {
        throw new Error("youtube-seek-superseded");
      }

      const state = typeof player.getPlayerState === "function" ? Number(player.getPlayerState()) : -1;
      // Przed cue/play YouTube ignoruje seekTo i zostaje na 00:00. Nie wołaj API,
      // dopóki player nie wejdzie w stan, w którym przewinięcie zostaje.
      if (!canSeekYoutubePlayer(state)) {
        throw new Error("youtube-player-unstarted");
      }

      const current = await readYoutubePlayerTime(player);
      if (pendingSeekRef.current !== seconds) {
        throw new Error("youtube-seek-superseded");
      }
      if (isVideoSeekLanded(current, seconds)) {
        pendingSeekRef.current = null;
        onSeekTargetConsumedRef.current?.();
        return;
      }

      player.seekTo(seconds, true);
      throw new Error("youtube-seek-pending");
    }
  }));

  const videoUrl = matchInfo?.videoUrl || "";
  const videoId = extractYouTubeId(videoUrl);

  if (videoIdRef.current !== videoId) {
    videoIdRef.current = videoId;
    playerRef.current = null;
    playerReadyRef.current = false;
    frozenEmbedStartRef.current = undefined;
    pendingSeekRef.current = null;
    requestedSeekRef.current = null;
    seekAttemptRef.current = 0;
  }

  if (
    seekTargetSeconds != null &&
    Number.isFinite(seekTargetSeconds) &&
    requestedSeekRef.current !== seekTargetSeconds
  ) {
    requestedSeekRef.current = seekTargetSeconds;
    pendingSeekRef.current = seekTargetSeconds;
    seekAttemptRef.current = 0;
  }

  const embedStart = resolveYoutubeEmbedStart({
    playerReady: playerReadyRef.current,
    seekTargetSeconds:
      seekTargetSeconds != null && Number.isFinite(seekTargetSeconds) ? seekTargetSeconds : null,
    frozenStart: frozenEmbedStartRef.current,
  });
  if (!playerReadyRef.current && embedStart !== undefined) {
    frozenEmbedStartRef.current = embedStart;
  }

  const onReady: YouTubeProps["onReady"] = (event) => {
    try {
      playerRef.current = event.target;
      playerReadyRef.current = true;
      setPlayerError(null);
      // Nie seekuj w onReady. Przy stanie unstarted YouTube i tak puszcza film od 0
      // i nadpisuje wcześniejszy seek. Start jest w playerVars; korekta idzie w onStateChange.
    } catch (error) {
      console.error("Błąd podczas inicjalizacji playera:", error);
      setPlayerError("Błąd inicjalizacji playera");
    }
  };

  const onStateChange: YouTubeProps["onStateChange"] = (event) => {
    const target = pendingSeekRef.current;
    if (target == null || !canSeekYoutubePlayer(event.data)) return;
    const player = event.target;
    if (!player || typeof player.seekTo !== "function" || typeof player.getCurrentTime !== "function") return;

    void (async () => {
      try {
        const current = await readYoutubePlayerTime(player);
        if (pendingSeekRef.current !== target) return;
        if (isVideoSeekLanded(current, target)) {
          pendingSeekRef.current = null;
          onSeekTargetConsumedRef.current?.();
          return;
        }
        if (seekAttemptRef.current >= 6) return;
        seekAttemptRef.current += 1;
        player.seekTo(target, true);
      } catch (error) {
        console.warn("YouTubeVideo: korekta czasu po starcie playera", error);
      }
    })();
  };

  const onPlayerError: YouTubeProps['onError'] = (event) => {
    console.error('Błąd YouTube playera:', event.data);
    setPlayerError(`Błąd playera: ${event.data}`);
  };

  // Ref do zewnętrznego okna
  const externalVideoWindowRef = useRef<Window | null>(null);

  // Funkcja do otwierania wideo w zewnętrznym oknie
  const openExternalVideo = () => {
    if (matchInfo) {
      if (!hasExternalVideoSource(matchInfo)) {
        toast.error("Brak adresu wideo dla tego meczu.");
        return;
      }
      if (!saveExternalVideoMatchInfo(matchInfo)) {
        toast.error(
          "Nie udało się zapisać danych wideo (limit pamięci przeglądarki). Spróbuj wyczyścić dane witryny lub zwolnić miejsce w localStorage."
        );
        return;
      }
      const externalWindow = window.open(
        '/video-external',
        'youtube-video',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
      );
      if (externalWindow) {
        (window as any).externalVideoWindow = externalWindow;
        externalVideoWindowRef.current = externalWindow;
        localStorage.setItem('externalVideoWindowOpen', 'true');
        if (onToggleVisibility) {
          onToggleVisibility();
        }
        // Nasłuchuj zamknięcia okna
        const checkClosed = setInterval(() => {
          if (externalWindow.closed) {
            clearInterval(checkClosed);
            (window as any).externalVideoWindow = null;
            externalVideoWindowRef.current = null;
            localStorage.removeItem('externalVideoWindowOpen');
            setIsExternalWindowOpen(false);
          }
        }, 1000);
        
        setIsExternalWindowOpen(true);
      }
    }
  };

  // State do przechowywania aktualnego czasu wideo
  const [currentVideoTime, setCurrentVideoTime] = React.useState<number>(0);

  // Sprawdź czy zewnętrzne okno jest otwarte
  React.useEffect(() => {
    const checkExternalWindow = () => {
      const isOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
      setIsExternalWindowOpen(isOpen);
    };
    
    checkExternalWindow();
    const interval = setInterval(checkExternalWindow, 1000);
    return () => clearInterval(interval);
  }, []);

  // Nasłuchuj wiadomości z zewnętrznego okna
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'VIDEO_TIME_UPDATE') {
        setCurrentVideoTime(event.data.time);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Dodaj deklarację globalną dla window.externalVideoWindow
  // @ts-ignore
  if (typeof window !== 'undefined' && !(window as any).externalVideoWindow) {
    (window as any).externalVideoWindow = null;
  }

  if (!videoId) {
    return (
      <div className={`${styles.videoContainer} ${styles.videoContainerNoVideo}`}>
        <div className={styles.noVideo}>
          <p>Brak dodanego wideo dla tego meczu</p>
          <p className={styles.hint}>Wideo można dodać podczas tworzenia lub edycji meczu</p>
        </div>
      </div>
    );
  }

  if (playerError) {
    return (
      <div className={styles.videoContainer}>
        <div className={styles.noVideo}>
          <p>Błąd odtwarzacza YouTube</p>
          <p className={styles.hint}>{playerError}</p>
          <button onClick={() => window.location.reload()}>Odśwież stronę</button>
        </div>
      </div>
    );
  }

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      enablejsapi: 1,
      ...(embedStart !== undefined ? { start: embedStart } : {}),
    },
  };

  // Ukryj nagłówek, jeśli zewnętrzne okno jest otwarte
  if (isExternalWindowOpen) {
    return null;
  }

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setIsFullscreenInternal(!isFullscreenInternal);
    }
    if (!isVisible && !isFullscreen) {
      // Jeśli wideo jest zwinięte, najpierw je rozwiń
      if (onToggleVisibility) {
        onToggleVisibility();
      }
    }
  };

  const handleLogoClick = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setIsFullscreenInternal(!isFullscreenInternal);
    }
    if (!isVisible) {
      // Jeśli wideo jest zwinięte, najpierw je rozwiń
      if (onToggleVisibility) {
        onToggleVisibility();
      }
    }
  };

  return (
    <div className={`${styles.videoContainer} ${isFullscreen ? styles.videoContainerFullscreen : ''}`}>
      
      {isVisible && (
        <div className={`${styles.videoWrapper} ${isFullscreen ? styles.videoWrapperFullscreen : ''}`}>
          {currentVideoTime > 0 && (
            <div className={styles.timeDisplay}>
              Czas: {Math.floor(currentVideoTime / 60)}:{(currentVideoTime % 60).toString().padStart(2, '0')}
            </div>
          )}
          <YouTube
            videoId={videoId}
            opts={opts}
            onReady={onReady}
            onStateChange={onStateChange}
            onError={onPlayerError}
            className={styles.youtubePlayer}
          />
        </div>
      )}
    </div>
  );
});

YouTubeVideo.displayName = "YouTubeVideo";

export default YouTubeVideo; 