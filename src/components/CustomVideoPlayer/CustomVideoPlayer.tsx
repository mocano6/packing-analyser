"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import styles from "./CustomVideoPlayer.module.css";

interface CustomVideoPlayerProps {
  matchInfo?: TeamInfo | null;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

export interface CustomVideoPlayerRef {
  getCurrentTime: () => Promise<number>;
  seekTo: (seconds: number) => Promise<void>;
}

const CustomVideoPlayer = forwardRef<CustomVideoPlayerRef, CustomVideoPlayerProps>(({
  matchInfo,
  isVisible = true,
  onToggleVisibility,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isExternalWindowOpen, setIsExternalWindowOpen] = useState<boolean>(false);

  const videoUrl = matchInfo?.videoStorageUrl || "";

  // Udostępnij funkcje przez ref
  useImperativeHandle(ref, () => ({
    getCurrentTime: async (): Promise<number> => {
      if (videoRef.current) {
        return videoRef.current.currentTime;
      }
      return 0;
    },
    seekTo: async (seconds: number): Promise<void> => {
      console.log('CustomVideoPlayer seekTo - seconds:', seconds, 'videoRef.current:', videoRef.current);
      if (videoRef.current) {
        console.log('CustomVideoPlayer seekTo - ustawiam currentTime na:', seconds);
        videoRef.current.currentTime = seconds;
        console.log('CustomVideoPlayer seekTo - currentTime po ustawieniu:', videoRef.current.currentTime);
      } else {
        console.warn('CustomVideoPlayer seekTo - videoRef.current jest null');
      }
    }
  }));

  // Aktualizuj czas wideo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openExternalVideo = () => {
    if (matchInfo) {
      localStorage.setItem('externalVideoMatchInfo', JSON.stringify(matchInfo));
      localStorage.setItem('externalVideoType', 'custom');
      const externalWindow = window.open(
        '/video-external',
        'custom-video',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
      );
      if (externalWindow) {
        (window as any).externalVideoWindow = externalWindow;
        localStorage.setItem('externalVideoWindowOpen', 'true');
        if (onToggleVisibility) {
          onToggleVisibility();
        }
        const checkClosed = setInterval(() => {
          if (externalWindow.closed) {
            clearInterval(checkClosed);
            (window as any).externalVideoWindow = null;
            localStorage.removeItem('externalVideoWindowOpen');
            setIsExternalWindowOpen(false);
          }
        }, 1000);
        setIsExternalWindowOpen(true);
      }
    }
  };

  useEffect(() => {
    const checkExternalWindow = () => {
      const isOpen = localStorage.getItem('externalVideoWindowOpen') === 'true';
      setIsExternalWindowOpen(isOpen);
    };
    
    checkExternalWindow();
    const interval = setInterval(checkExternalWindow, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!videoUrl) {
    return null;
  }

  if (isExternalWindowOpen) {
    return null;
  }

  return (
    <div className={styles.videoContainer}>
      <div 
        className={styles.videoHeader}
        onClick={onToggleVisibility}
      >
        <h3>Nagranie własne</h3>
        <div className={styles.headerButtons}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              openExternalVideo();
            }}
            className={styles.externalButton}
            title="Otwórz wideo w nowym oknie (dla drugiego monitora)"
          >
            <span className={styles.externalIcon}>🖥️</span>
          </button>
          {onToggleVisibility && (
            <button 
              className={styles.collapseButton}
              aria-label={isVisible ? "Ukryj odtwarzacz" : "Pokaż odtwarzacz"}
            >
              {isVisible ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>
      
      {isVisible && (
        <div className={styles.videoWrapper}>
          <video
            ref={videoRef}
            src={videoUrl}
            className={styles.videoPlayer}
            controls={false}
          />
          
          <div className={styles.controls}>
            <button 
              onClick={togglePlay}
              className={styles.playButton}
              aria-label={isPlaying ? "Pauza" : "Odtwarzaj"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            
            <div className={styles.timeInfo}>
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className={styles.seekBar}
            />
            
            <div className={styles.volumeControl}>
              <span>🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className={styles.volumeBar}
              />
            </div>
            
            <div className={styles.speedControl}>
              <button
                onClick={() => handlePlaybackRateChange(0.5)}
                className={playbackRate === 0.5 ? styles.activeSpeed : ''}
              >
                0.5x
              </button>
              <button
                onClick={() => handlePlaybackRateChange(1)}
                className={playbackRate === 1 ? styles.activeSpeed : ''}
              >
                1x
              </button>
              <button
                onClick={() => handlePlaybackRateChange(1.25)}
                className={playbackRate === 1.25 ? styles.activeSpeed : ''}
              >
                1.25x
              </button>
              <button
                onClick={() => handlePlaybackRateChange(1.5)}
                className={playbackRate === 1.5 ? styles.activeSpeed : ''}
              >
                1.5x
              </button>
              <button
                onClick={() => handlePlaybackRateChange(2)}
                className={playbackRate === 2 ? styles.activeSpeed : ''}
              >
                2x
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CustomVideoPlayer.displayName = "CustomVideoPlayer";

export default CustomVideoPlayer;

