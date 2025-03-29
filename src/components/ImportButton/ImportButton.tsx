"use client";

import React, { useState, useRef } from "react";
import { Player, Action } from "@/types";
import styles from "./ImportButton.module.css";

interface ImportButtonProps {
  onImportSuccess: (data: { players: Player[], actions: Action[], matchInfo: any }) => void;
  onImportError: (error: string) => void;
}

const ImportButton: React.FC<ImportButtonProps> = ({
  onImportSuccess,
  onImportError,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const fileContent = await readFileAsText(file);
      const importedData = JSON.parse(fileContent);
      
      // Sprawdź strukturę danych
      if (!importedData.matchInfo || !importedData.players || !importedData.actions) {
        throw new Error("Nieprawidłowy format pliku. Brak wymaganych danych.");
      }

      // Zapisz dane do bazy
      await importDataToDatabase(importedData);
      
      // Powiadom o sukcesie
      onImportSuccess({
        players: importedData.players,
        actions: importedData.actions,
        matchInfo: importedData.matchInfo
      });

    } catch (error) {
      console.error("Błąd importu:", error);
      onImportError(`Błąd importu: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      // Zresetuj pole pliku, aby można było zaimportować ten sam plik ponownie
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error("Nie udało się odczytać pliku"));
        }
      };
      reader.onerror = () => reject(new Error("Błąd podczas odczytu pliku"));
      reader.readAsText(file);
    });
  };

  const importDataToDatabase = async (importedData: any) => {
    // Importuj dane meczu, jeśli nie ma go jeszcze w bazie
    const matchData = importedData.matchInfo;
    if (!matchData.matchId) {
      matchData.matchId = crypto.randomUUID();
    }

    // Importuj graczy i akcje
    await Promise.all([
      importPlayers(importedData.players, matchData),
      importActions(importedData.actions, matchData)
    ]);
  };

  const importPlayers = async (players: Player[], matchInfo: any) => {
    // Sprawdź, którzy gracze już istnieją
    const checkPlayers = await Promise.all(
      players.map(player => 
        fetch(`/api/players?id=${player.id}`).then(res => res.json())
      )
    );

    // Importuj tylko nowych graczy lub aktualizuj istniejących
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const existingPlayer = checkPlayers[i]?.length > 0 ? checkPlayers[i][0] : null;

      if (!existingPlayer) {
        // Dodaj nowego gracza
        await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...player,
            teams: [matchInfo.team]
          })
        });
      }
    }
  };

  const importActions = async (actions: Action[], matchInfo: any) => {
    // Sprawdź, które akcje już istnieją
    const existingActions = await fetch(`/api/actions?matchId=${matchInfo.matchId}`).then(res => res.json());
    const existingIds = new Set(existingActions.map((a: Action) => a.id));

    // Zaimportuj tylko nowe akcje
    const newActions = actions.filter(action => !existingIds.has(action.id));

    // Dodaj akcje do bazy danych
    for (const action of newActions) {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...action,
          matchId: matchInfo.matchId
        })
      });
    }

    return newActions.length;
  };

  return (
    <>
      <button 
        className={styles.importButton} 
        onClick={handleImportClick}
        disabled={isLoading}
        title="Importuj dane z pliku JSON"
      >
        <span className={styles.icon}>{isLoading ? "⏳" : "📥"}</span>
        {isLoading ? "Importowanie..." : "Importuj dane"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </>
  );
};

export default ImportButton; 