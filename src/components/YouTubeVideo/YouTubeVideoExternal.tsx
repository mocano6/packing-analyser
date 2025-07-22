"use client";

import React, { useEffect, useRef, useState } from "react";
import YouTube, { YouTubeProps } from "react-youtube";
import { TeamInfo } from "@/types";
import styles from "./YouTubeVideo.module.css";

interface YouTubeVideoExternalProps {
  matchInfo?: TeamInfo | null;
  onTimeUpdate?: (time: number) => void;
  onReady?: (player: any) => void;
}

const YouTubeVideoExternal: React.FC<YouTubeVideoExternalProps> = ({
  matchInfo,
  onTimeUpdate,
  onReady
}) => {
  const playerRef = useRef<any>(null);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

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

  // Nasłuchiwanie wiadomości z głównego okna
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      
      // Sprawdź czy to wiadomość z głównego okna (nie z YouTube)
      if (event.origin !== 'https://www.youtube.com' && event.origin !== 'https://youtube.com') {
        
        if (event.data.type === 'SEEK_TO_TIME') {
          if (playerRef.current && isPlayerReady) {
            try {
              await playerRef.current.seekTo(event.data.time, true);
            } catch (error) {
              console.warn('Nie udało się przewinąć wideo do czasu:', event.data.time, error);
            }
          } else {
            // Player niegotowy
          }
        } else if (event.data.type === 'GET_CURRENT_TIME') {
          if (playerRef.current && isPlayerReady) {
            try {
              const currentTime = await playerRef.current.getCurrentTime();
              if (event.source) {
                (event.source as Window).postMessage({
                  type: 'CURRENT_TIME_RESPONSE',
                  time: Math.floor(currentTime)
                }, (typeof event.origin === 'string' && event.origin.length > 0 ? event.origin : '*'));
              } else if (window.opener) {
                window.opener.postMessage({
                  type: 'CURRENT_TIME_RESPONSE',
                  time: Math.floor(currentTime)
                }, '*');
              } else {
                console.warn('YouTubeVideoExternal - brak event.source i window.opener');
              }
            } catch (error) {
              console.warn('Nie udało się pobrać czasu z YouTube:', error);
              if (event.source) {
                (event.source as Window).postMessage({
                  type: 'CURRENT_TIME_RESPONSE',
                  time: 0
                }, (typeof event.origin === 'string' && event.origin.length > 0 ? event.origin : '*'));
              } else if (window.opener) {
                window.opener.postMessage({
                  type: 'CURRENT_TIME_RESPONSE',
                  time: 0
                }, '*');
              }
            }
          } else {
            // Player niegotowy
            if (event.source) {
              (event.source as Window).postMessage({
                type: 'CURRENT_TIME_RESPONSE',
                time: 0
              }, (typeof event.origin === 'string' && event.origin.length > 0 ? event.origin : '*'));
            } else if (window.opener) {
              window.opener.postMessage({
                type: 'CURRENT_TIME_RESPONSE',
                time: 0
              }, '*');
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPlayerReady]);

  // Wysyłanie aktualnego czasu do głównego okna
  useEffect(() => {
    if (playerRef.current && isPlayerReady && !playerError) {
      timeUpdateIntervalRef.current = setInterval(async () => {
        try {
          if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            const currentTime = await playerRef.current.getCurrentTime();
            if (window.opener) {
              window.opener.postMessage({
                type: 'VIDEO_TIME_UPDATE',
                time: Math.floor(currentTime)
              }, '*');
            }
          }
        } catch (error) {
          console.warn('Nie udało się pobrać czasu z YouTube:', error);
        }
      }, 1000); // Aktualizuj co sekundę
    }

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [playerRef.current, isPlayerReady, playerError]);

  const videoUrl = matchInfo?.videoUrl || "";
  const videoId = extractYouTubeId(videoUrl);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    try {
      playerRef.current = event.target;
      setIsPlayerReady(true);
      setPlayerError(null);
    } catch (error) {
      console.error('Błąd podczas inicjalizacji playera:', error);
      setPlayerError('Błąd inicjalizacji playera');
    }
    if (onReady) {
      onReady(event.target);
    }
  };

  const onPlayerError: YouTubeProps['onError'] = (event) => {
    console.error('Błąd YouTube playera:', event.data);
    setPlayerError(`Błąd playera: ${event.data}`);
    setIsPlayerReady(false);
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
  };

  if (!videoId) {
    return (
      <div className={styles.videoContainer}>
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

  return (
    <div className={styles.videoContainer}>
      <div className={styles.videoWrapper}>
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={onPlayerReady}
          onError={onPlayerError}
          onStateChange={onPlayerStateChange}
          className={styles.youtubePlayer}
        />
      </div>
    </div>
  );
};

export default YouTubeVideoExternal; 