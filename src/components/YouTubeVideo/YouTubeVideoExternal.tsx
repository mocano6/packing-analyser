"use client";

import React, { useEffect, useRef, useState } from "react";
import YouTube, { YouTubeProps } from "react-youtube";
import { TeamInfo } from "@/types";
import { extractYouTubeId } from "@/utils/youtubeVideoId";
import {
  canSeekYoutubePlayer,
  isVideoSeekLanded,
  readYoutubePlayerTime,
  youtubeEmbedStartSeconds,
} from "@/utils/youtubeSeek";
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
  const pendingSeekRef = useRef<number | null>(null);
  const videoIdRef = useRef<string | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const applyPendingSeek = (player: {
    seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
    getCurrentTime?: () => number | Promise<number>;
    getPlayerState?: () => number;
    cueVideoById?: (opts: { videoId: string; startSeconds: number }) => void;
  }) => {
    const target = pendingSeekRef.current;
    if (target == null) return;
    const state = typeof player.getPlayerState === "function" ? Number(player.getPlayerState()) : -1;
    if (!canSeekYoutubePlayer(state)) {
      const id = videoIdRef.current;
      if (id && typeof player.cueVideoById === "function") {
        player.cueVideoById({ videoId: id, startSeconds: youtubeEmbedStartSeconds(target) });
      }
      return;
    }
    if (typeof player.getCurrentTime !== "function" || typeof player.seekTo !== "function") return;
    void (async () => {
      try {
        const current = await readYoutubePlayerTime(player as { getCurrentTime: () => number | Promise<number> });
        if (pendingSeekRef.current !== target) return;
        if (isVideoSeekLanded(current, target)) {
          pendingSeekRef.current = null;
          return;
        }
        player.seekTo?.(target, true);
      } catch (error) {
        console.warn("Nie udało się przewinąć wideo do czasu:", target, error);
      }
    })();
  };

  // Nasłuchiwanie wiadomości z głównego okna
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      
      // Sprawdź czy to wiadomość z głównego okna (nie z YouTube)
      // Akceptuj wiadomości z tego samego origin (główne okno) lub z innego origin niż YouTube
      const isFromYouTube = event.origin === 'https://www.youtube.com' || event.origin === 'https://youtube.com';
      const isFromMainWindow = !isFromYouTube && event.data?.type;
      
      if (isFromMainWindow) {
        if (event.data.type === 'SEEK_TO_TIME') {
          const time = Number(event.data.time);
          if (!Number.isFinite(time)) return;
          // Wiadomość często wpada, zanim iframe jest gotowy. Trzymamy ją
          // i aplikujemy w onReady / onStateChange — inaczej okno startuje od 0.
          pendingSeekRef.current = time;
          if (playerRef.current) {
            applyPendingSeek(playerRef.current);
          }
        } else if (event.data.type === 'GET_CURRENT_TIME') {
          if (playerRef.current && isPlayerReady) {
            try {
              const currentTime = await playerRef.current.getCurrentTime();
              if (event.source) {
                (event.source as Window).postMessage({
                  type: 'CURRENT_TIME_RESPONSE',
                  time: currentTime
                }, '*');
              } else if (window.opener) {
                window.opener.postMessage({
                  type: 'CURRENT_TIME_RESPONSE',
                  time: currentTime
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
                }, '*');
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
              }, '*');
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
                time: currentTime
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
  videoIdRef.current = videoId;

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    try {
      playerRef.current = event.target;
      setIsPlayerReady(true);
      setPlayerError(null);
      applyPendingSeek(event.target);
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
    const playerState = event.data;
    if (pendingSeekRef.current != null && canSeekYoutubePlayer(playerState)) {
      applyPendingSeek(event.target);
    }
    // Wysyłaj stan playera do głównego okna
    if (window.opener) {
      window.opener.postMessage({
        type: 'VIDEO_STATE_UPDATE',
        state: playerState
      }, '*');
    }
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