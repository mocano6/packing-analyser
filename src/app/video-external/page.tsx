"use client";

import React, { useEffect, useState } from 'react';
import YouTubeVideoExternal from '@/components/YouTubeVideo/YouTubeVideoExternal';
import { TeamInfo } from '@/types';
import styles from './video-external.module.css';

export default function VideoExternalPage() {
  const [matchInfo, setMatchInfo] = useState<TeamInfo | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    // Pobierz dane meczu z localStorage lub URL params
    const savedMatchInfo = localStorage.getItem('externalVideoMatchInfo');
    if (savedMatchInfo) {
      try {
        setMatchInfo(JSON.parse(savedMatchInfo));
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
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      localStorage.removeItem('externalVideoWindowOpen');
    };
  }, []);

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  return (
    <div className={styles.container}>
      
      <div className={styles.videoSection}>
        <YouTubeVideoExternal 
          matchInfo={matchInfo}
          onTimeUpdate={handleTimeUpdate}
        />
      </div>
    </div>
  );
} 