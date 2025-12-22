"use client";

import React, { useEffect, useState } from 'react';
import YouTubeVideoExternal from '@/components/YouTubeVideo/YouTubeVideoExternal';
import CustomVideoPlayerExternal from '@/components/CustomVideoPlayer/CustomVideoPlayerExternal';
import { TeamInfo } from '@/types';
import styles from './video-external.module.css';

export default function VideoExternalPage() {
  const [matchInfo, setMatchInfo] = useState<TeamInfo | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoType, setVideoType] = useState<'youtube' | 'custom'>('youtube');

  useEffect(() => {
    // Pobierz dane meczu z localStorage lub URL params
    const savedMatchInfo = localStorage.getItem('externalVideoMatchInfo');
    if (savedMatchInfo) {
      try {
        const parsed = JSON.parse(savedMatchInfo);
        setMatchInfo(parsed);
        // Sprawdź typ wideo
        const savedVideoType = localStorage.getItem('externalVideoType');
        if (savedVideoType === 'custom' || parsed.videoStorageUrl) {
          setVideoType('custom');
        } else {
          setVideoType('youtube');
        }
      } catch (error) {
        console.error('Błąd podczas parsowania danych meczu:', error);
      }
    }

    // Nasłuchuj wiadomości z głównego okna
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'VIDEO_TIME_UPDATE') {
        setCurrentTime(event.data.time);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Obsługa zamknięcia okna
    const handleBeforeUnload = () => {
      localStorage.removeItem('externalVideoWindowOpen');
      localStorage.removeItem('externalVideoType');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      localStorage.removeItem('externalVideoWindowOpen');
      localStorage.removeItem('externalVideoType');
    };
  }, []);

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  return (
    <div className={styles.container}>
      <div className={styles.videoSection}>
        {videoType === 'custom' && matchInfo?.videoStorageUrl ? (
          <CustomVideoPlayerExternal 
            matchInfo={matchInfo}
            onTimeUpdate={handleTimeUpdate}
          />
        ) : (
          <YouTubeVideoExternal 
            matchInfo={matchInfo}
            onTimeUpdate={handleTimeUpdate}
          />
        )}
      </div>
    </div>
  );
} 