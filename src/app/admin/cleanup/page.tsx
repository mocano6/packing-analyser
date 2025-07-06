'use client';

import { useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { getDB } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import styles from './cleanup.module.css';

interface CleanupStats {
  totalPlayers: number;
  playersWithActionsSent: number;
  playersWithActionsReceived: number;
  playersWithMatchesInfo: number;
  cleanedPlayers: number;
  processedPlayers: number;
}

export default function CleanupPage() {
  const { isAdmin } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<CleanupStats | null>(null);
  const [cleanupResults, setCleanupResults] = useState<CleanupStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const analyzePlayerData = async () => {
    if (!isAdmin) {
      alert('Tylko administratorzy mogą analizować dane');
      return;
    }

    setIsAnalyzing(true);
    setLogs([]);
    addLog('🔍 Rozpoczynam analizę danych zawodników...');

    try {
      const playersCollection = collection(getDB(), 'players');
      const playersSnapshot = await getDocs(playersCollection);
      
      addLog(`📋 Znaleziono ${playersSnapshot.size} zawodników`);

      let playersWithActionsSent = 0;
      let playersWithActionsReceived = 0;
      let playersWithMatchesInfo = 0;
      let totalActions = 0;

      playersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        if (data.actionsSent) {
          playersWithActionsSent++;
          totalActions += Object.keys(data.actionsSent).length;
          addLog(`🔍 ${data.firstName} ${data.lastName} - actionsSent: ${Object.keys(data.actionsSent).length} meczów`);
        }
        
        if (data.actionsReceived) {
          playersWithActionsReceived++;
          totalActions += Object.keys(data.actionsReceived).length;
          addLog(`🔍 ${data.firstName} ${data.lastName} - actionsReceived: ${Object.keys(data.actionsReceived).length} meczów`);
        }
        
        if (data.matchesInfo) {
          playersWithMatchesInfo++;
          totalActions += Object.keys(data.matchesInfo).length;
          addLog(`🔍 ${data.firstName} ${data.lastName} - matchesInfo: ${Object.keys(data.matchesInfo).length} meczów`);
        }
      });

      const results: CleanupStats = {
        totalPlayers: playersSnapshot.size,
        playersWithActionsSent,
        playersWithActionsReceived,
        playersWithMatchesInfo,
        cleanedPlayers: 0,
        processedPlayers: 0
      };

      setAnalysisResults(results);
      
      addLog(`📊 Analiza zakończona:`);
      addLog(`   • Zawodnicy z actionsSent: ${playersWithActionsSent}`);
      addLog(`   • Zawodnicy z actionsReceived: ${playersWithActionsReceived}`);
      addLog(`   • Zawodnicy z matchesInfo: ${playersWithMatchesInfo}`);
      addLog(`   • Łącznie duplikatów do usunięcia: ${totalActions}`);
      
      if (playersWithActionsSent === 0 && playersWithActionsReceived === 0 && playersWithMatchesInfo === 0) {
        addLog('✅ Baza danych jest już czysta!');
      } else {
        addLog('⚠️  Znaleziono dane do wyczyszczenia');
      }

    } catch (error) {
      console.error('Błąd analizy:', error);
      addLog(`❌ Błąd analizy: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cleanupPlayerData = async () => {
    if (!isAdmin) {
      alert('Tylko administratorzy mogą czyścić dane');
      return;
    }

    if (!analysisResults || (analysisResults.playersWithActionsSent === 0 && analysisResults.playersWithActionsReceived === 0 && analysisResults.playersWithMatchesInfo === 0)) {
      alert('Brak danych do wyczyszczenia lub nie wykonano analizy');
      return;
    }

    const totalPlayersToClean = analysisResults.playersWithActionsSent + analysisResults.playersWithActionsReceived + analysisResults.playersWithMatchesInfo;
    const confirmed = confirm(
      `Czy na pewno chcesz usunąć duplikaty danych z ${totalPlayersToClean} zawodników?\n\n` +
      `• actionsSent: ${analysisResults.playersWithActionsSent} zawodników\n` +
      `• actionsReceived: ${analysisResults.playersWithActionsReceived} zawodników\n` +
      `• matchesInfo: ${analysisResults.playersWithMatchesInfo} zawodników\n\n` +
      'Ta operacja jest nieodwracalna!'
    );

    if (!confirmed) return;

    setIsCleaning(true);
    setLogs([]);
    addLog('🧹 Rozpoczynam czyszczenie danych zawodników...');

    try {
      const playersCollection = collection(getDB(), 'players');
      const playersSnapshot = await getDocs(playersCollection);
      
      let processedCount = 0;
      let cleanedCount = 0;

      for (const playerDoc of playersSnapshot.docs) {
        const playerData = playerDoc.data();
        const playerId = playerDoc.id;
        
        const hasActionsSent = playerData.actionsSent !== undefined;
        const hasActionsReceived = playerData.actionsReceived !== undefined;
        const hasMatchesInfo = playerData.matchesInfo !== undefined;
        
        if (hasActionsSent || hasActionsReceived || hasMatchesInfo) {
          addLog(`🔄 Czyszczę zawodnika: ${playerData.firstName} ${playerData.lastName}`);
          
          const updates: any = {};
          
          if (hasActionsSent) {
            updates.actionsSent = deleteField();
            addLog(`  ❌ Usuwam actionsSent (${Object.keys(playerData.actionsSent || {}).length} meczów)`);
          }
          
          if (hasActionsReceived) {
            updates.actionsReceived = deleteField();
            addLog(`  ❌ Usuwam actionsReceived (${Object.keys(playerData.actionsReceived || {}).length} meczów)`);
          }
          
          if (hasMatchesInfo) {
            updates.matchesInfo = deleteField();
            addLog(`  ❌ Usuwam matchesInfo (${Object.keys(playerData.matchesInfo || {}).length} meczów)`);
          }
          
          const playerRef = doc(getDB(), 'players', playerId);
          await updateDoc(playerRef, updates);
          
          cleanedCount++;
          addLog(`  ✅ Wyczyszczono zawodnika ${playerData.firstName} ${playerData.lastName}`);
        }
        
        processedCount++;
      }

      const results: CleanupStats = {
        totalPlayers: playersSnapshot.size,
        playersWithActionsSent: analysisResults.playersWithActionsSent,
        playersWithActionsReceived: analysisResults.playersWithActionsReceived,
        playersWithMatchesInfo: analysisResults.playersWithMatchesInfo,
        cleanedPlayers: cleanedCount,
        processedPlayers: processedCount
      };

      setCleanupResults(results);
      
      addLog('🎉 Czyszczenie zakończone!');
      addLog(`📊 Przetworzono: ${processedCount} zawodników`);
      addLog(`🧹 Wyczyszczono: ${cleanedCount} zawodników`);
      addLog(`✨ Pomiętych: ${processedCount - cleanedCount} zawodników`);
      
      addLog('💾 Korzyści z czyszczenia:');
      addLog('• Usunięto duplikaty akcji które były przechowywane w matches');
      addLog('• Usunięto duplikaty minut zawodników które były przechowywane w matches');
      addLog('• Zmniejszono rozmiar dokumentów zawodników');
      addLog('• Uprościono strukturę danych');
      addLog('• Poprawiono wydajność zapytań');

    } catch (error) {
      console.error('Błąd czyszczenia:', error);
      addLog(`❌ Błąd czyszczenia: ${error}`);
    } finally {
      setIsCleaning(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <h1>Brak uprawnień</h1>
        <p>Tylko administratorzy mogą korzystać z panelu czyszczenia danych.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>🧹 Czyszczenie danych zawodników</h1>
      
      <div className={styles.section}>
        <h2>Problem z duplikacją danych</h2>
        <p>
          Wcześniej akcje były zapisywane w dwóch miejscach:
        </p>
        <ul>
          <li><strong>matches/{`{matchId}`}.actions_packing[]</strong> - główne źródło danych akcji (używane w UI)</li>
          <li><strong>matches/{`{matchId}`}.playerMinutes[]</strong> - główne źródło danych minut (używane w UI)</li>
          <li><strong>players/{`{playerId}`}.actionsSent/actionsReceived</strong> - duplikaty akcji (nieużywane)</li>
          <li><strong>players/{`{playerId}`}.matchesInfo</strong> - duplikaty minut (nieużywane)</li>
        </ul>
        <p>
          Ten panel pozwala usunąć niepotrzebne duplikaty z dokumentów zawodników:
        </p>
        <ul>
          <li><strong>actionsSent/actionsReceived</strong> - duplikaty akcji</li>
          <li><strong>matchesInfo</strong> - duplikaty minut zawodników</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2>Analiza danych</h2>
        <button
          onClick={analyzePlayerData}
          disabled={isAnalyzing}
          className={styles.button}
        >
          {isAnalyzing ? 'Analizuję...' : '🔍 Analizuj dane zawodników'}
        </button>
        
        {analysisResults && (
          <div className={styles.results}>
            <h3>Wyniki analizy:</h3>
            <ul>
              <li>Łącznie zawodników: {analysisResults.totalPlayers}</li>
              <li>Zawodnicy z actionsSent: {analysisResults.playersWithActionsSent}</li>
              <li>Zawodnicy z actionsReceived: {analysisResults.playersWithActionsReceived}</li>
              <li>Zawodnicy z matchesInfo: {analysisResults.playersWithMatchesInfo}</li>
              <li>Status: {analysisResults.playersWithActionsSent === 0 && analysisResults.playersWithActionsReceived === 0 && analysisResults.playersWithMatchesInfo === 0 ? '✅ Baza czysta' : '⚠️ Wymaga czyszczenia'}</li>
            </ul>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Czyszczenie</h2>
        <button
          onClick={cleanupPlayerData}
          disabled={isCleaning || !analysisResults || (analysisResults.playersWithActionsSent === 0 && analysisResults.playersWithActionsReceived === 0 && analysisResults.playersWithMatchesInfo === 0)}
          className={`${styles.button} ${styles.dangerButton}`}
        >
          {isCleaning ? 'Czyszczę...' : '🧹 Usuń duplikaty akcji'}
        </button>
        
        {cleanupResults && (
          <div className={styles.results}>
            <h3>Wyniki czyszczenia:</h3>
            <ul>
              <li>Przetworzono: {cleanupResults.processedPlayers} zawodników</li>
              <li>Wyczyszczono: {cleanupResults.cleanedPlayers} zawodników</li>
              <li>Bez zmian: {cleanupResults.processedPlayers - cleanupResults.cleanedPlayers} zawodników</li>
              <li>Status: ✅ Czyszczenie zakończone</li>
            </ul>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Logi operacji</h2>
        <div className={styles.logs}>
          {logs.length === 0 ? (
            <p>Brak logów - wykonaj analizę lub czyszczenie</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={styles.logEntry}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 