"use client";

import React, { useRef, useEffect, useState } from "react";
import { TeamInfo } from "@/types";
import styles from "./CustomVideoPlayerExternal.module.css";

interface CustomVideoPlayerExternalProps {
  matchInfo: TeamInfo | null;
  onTimeUpdate?: (time: number) => void;
  onReady?: () => void;
}

const CustomVideoPlayerExternal: React.FC<CustomVideoPlayerExternalProps> = ({
  matchInfo,
  onTimeUpdate,
  onReady,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoUrl = matchInfo?.videoStorageUrl || "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) {
        onTimeUpdate(time);
      }
      // Wyślij czas do głównego okna
      if (window.opener) {
        window.opener.postMessage({
          type: 'VIDEO_TIME_UPDATE',
          time: time
        }, '*');
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (onReady) {
        onReady();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Nasłuchuj wiadomości z głównego okna
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SEEK_TO_TIME' && video) {
        video.currentTime = event.data.time;
      } else if (event.data.type === 'GET_CURRENT_TIME' && video) {
        if (window.opener) {
          window.opener.postMessage({
            type: 'VIDEO_TIME_RESPONSE',
            time: video.currentTime
          }, '*');
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      window.removeEventListener('message', handleMessage);
    };
  }, [onTimeUpdate, onReady]);

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

  if (!videoUrl) {
    return (
      <div className={styles.videoContainer}>
        <div className={styles.noVideo}>
          <p>Brak wgrane wideo dla tego meczu</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.videoContainer}>
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
    </div>
  );
};

export default CustomVideoPlayerExternal;

