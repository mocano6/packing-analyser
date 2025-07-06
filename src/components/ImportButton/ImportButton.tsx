"use client";

import React, { useState, useRef } from "react";
import { Player, Action } from "@/types";
import styles from "./ImportButton.module.css";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, getDocs, query, where, 
  doc, writeBatch
} from "firebase/firestore";

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

      // Zapisz dane do Firebase
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
    
    // Upewnij się, że matchData ma wszystkie wymagane pola
    if (!matchData.time) {
      matchData.time = "";
    }

    // Importuj graczy i akcje
    await Promise.all([
      importPlayers(importedData.players, matchData),
      importActions(importedData.actions, matchData)
    ]);
  };

  const importPlayers = async (players: Player[], matchInfo: any) => {
    // Sprawdź, którzy gracze już istnieją
    const existingPlayers = new Map<string, Player>();
    
    for (const player of players) {
      const playerQuery = query(
        collection(db, "players"), 
        where("id", "==", player.id)
      );
      
      const playerSnapshot = await getDocs(playerQuery);
      
      if (!playerSnapshot.empty) {
        const existingPlayer = {
          id: playerSnapshot.docs[0].id,
          ...playerSnapshot.docs[0].data()
        } as Player;
        
        existingPlayers.set(player.id, existingPlayer);
      }
    }

    // Importuj tylko nowych graczy
    const batch = writeBatch(db);
    
    for (const player of players) {
      if (!existingPlayers.has(player.id)) {
        const playerRef = doc(collection(db, "players"));
        batch.set(playerRef, {
          ...player,
          teams: [matchInfo.team]
        });
      }
    }
    
    await batch.commit();
    
  };

  const importActions = async (actions: Action[], matchInfo: any) => {
    // Sprawdź, które akcje już istnieją
    const actionsQuery = query(
      collection(db, "actions_packing"), 
      where("matchId", "==", matchInfo.matchId)
    );
    
    const actionsSnapshot = await getDocs(actionsQuery);
    const existingIds = new Set(
      actionsSnapshot.docs.map(doc => doc.data().id)
    );

    // Zaimportuj tylko nowe akcje
    const newActions = actions.filter(action => !existingIds.has(action.id));
    
    // Użyj batch do importowania wielu akcji naraz
    const batch = writeBatch(db);
    
    for (const action of newActions) {
      const actionRef = doc(collection(db, "actions_packing"));
      batch.set(actionRef, {
        ...action,
        matchId: matchInfo.matchId
      });
    }
    
    await batch.commit();
    
    
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