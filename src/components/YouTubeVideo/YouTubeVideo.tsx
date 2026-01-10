"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState } from "react";
import YouTube, { YouTubeProps } from "react-youtube";
import { TeamInfo } from "@/types";
import styles from "./YouTubeVideo.module.css";

interface YouTubeVideoProps {
  matchInfo?: TeamInfo | null;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
}, ref) => {
  const playerRef = useRef<any>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isExternalWindowOpen, setIsExternalWindowOpen] = useState<boolean>(false);
  const [isFullscreenInternal, setIsFullscreenInternal] = useState<boolean>(false);
  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : isFullscreenInternal;

  // Funkcja do wyciągnięcia YouTube Video ID z URL
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

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
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          await playerRef.current.seekTo(seconds, true); // true = allowSeekAhead
        } catch (error) {
          console.warn('Nie udało się przewinąć YouTube playera do czasu:', seconds, error);
        }
      }
    }
  }));

  const videoUrl = matchInfo?.videoUrl || "";
  const videoId = extractYouTubeId(videoUrl);

  const onReady: YouTubeProps['onReady'] = (event) => {
    try {
      playerRef.current = event.target;
      setPlayerError(null);
    } catch (error) {
      console.error('Błąd podczas inicjalizacji playera:', error);
      setPlayerError('Błąd inicjalizacji playera');
    }
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
      // Zapisz dane meczu do localStorage
      localStorage.setItem('externalVideoMatchInfo', JSON.stringify(matchInfo));
      // Otwórz nowe okno i zapisz referencję
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