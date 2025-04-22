// src/hooks/usePlayersState.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { Player } from "../types";
import { db } from "../lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, 
  deleteDoc, doc, query, where, writeBatch 
} from "firebase/firestore";

// Helper do generowania ID (alternatywa dla crypto.randomUUID())
const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

export function usePlayersState() {
  // Inicjalizacja stanu
  const [players, setPlayers] = useState<Player[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pobierz zawodników z Firebase podczas inicjalizacji
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setIsLoading(true);
        const playersCollection = collection(db, "players");
        const playersSnapshot = await getDocs(playersCollection);
        
        if (!playersSnapshot.empty) {
          const playersList = playersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Player[];
          
          console.log('Zawodnicy pobrani z Firebase:', playersList);
          setPlayers(playersList);
        } else {
          console.log('Brak zawodników w Firebase - sprawdzam localStorage');
          
          // Sprawdź dane w localStorage jako fallback
          if (typeof window !== "undefined") {
            try {
              const savedPlayers = localStorage.getItem("players");
              if (savedPlayers) {
                const localPlayers = JSON.parse(savedPlayers) as Player[];
                setPlayers(localPlayers);
                
                // Możesz opcjonalnie dodać zapisanie tych danych do Firebase
                console.log('Zapisuję zawodników z localStorage do Firebase...');
                const batch = writeBatch(db);
                
                localPlayers.forEach(player => {
                  const playerRef = doc(collection(db, "players"));
                  batch.set(playerRef, {
                    name: player.name,
                    number: player.number,
                    position: player.position || "",
                    birthYear: player.birthYear,
                    imageUrl: player.imageUrl,
                    teams: player.teams || []
                  });
                });
                
                await batch.commit();
                console.log('Zawodnicy z localStorage zapisani do Firebase');
              }
            } catch (error) {
              console.error("Błąd odczytu z localStorage:", error);
            }
          }
        }
      } catch (error) {
        console.error('Błąd pobierania zawodników z Firebase:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  // Backup do localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && players.length > 0) {
      try {
        localStorage.setItem("players", JSON.stringify(players));
      } catch (error) {
        console.error("Błąd zapisu do localStorage:", error);
      }
    }
  }, [players]);

  // Usuwanie zawodnika
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Czy na pewno chcesz usunąć tego zawodnika?")
    ) {
      try {
        setIsLoading(true);
        
        // Usuwanie z Firebase
        await deleteDoc(doc(db, "players", playerId));
        
        // Aktualizacja lokalnego stanu
        setPlayers((prev) => prev.filter((p) => p.id !== playerId));
        console.log('Zawodnik usunięty z Firebase');
        return true;
      } catch (error) {
        console.error('Błąd usuwania zawodnika:', error);
        alert('Wystąpił błąd podczas usuwania zawodnika. Spróbuj ponownie.');
        return false;
      } finally {
        setIsLoading(false);
      }
    }
    return false;
  }, []);

  // Dodawanie/edycja zawodnika
  const handleSavePlayer = useCallback(
    async (playerData: Omit<Player, "id">) => {
      try {
        setIsLoading(true);
        
        if (editingPlayerId) {
          // Aktualizacja istniejącego zawodnika
          const playerRef = doc(db, "players", editingPlayerId);
          await updateDoc(playerRef, playerData);
          
          // Aktualizacja lokalnego stanu
          setPlayers((prev) =>
            prev.map((player) =>
              player.id === editingPlayerId
                ? { ...player, ...playerData, id: editingPlayerId }
                : player
            )
          );
          console.log('Zawodnik zaktualizowany w Firebase');
        } else {
          // Dodawanie nowego zawodnika
          const newPlayerRef = await addDoc(collection(db, "players"), playerData);
          
          // Aktualizacja lokalnego stanu
          const newPlayer: Player = {
            id: newPlayerRef.id,
            ...playerData,
          };
          setPlayers((prev) => [...prev, newPlayer]);
          console.log('Nowy zawodnik dodany do Firebase');
        }
        
        // Zamknij modal i resetuj stan edycji
        setIsModalOpen(false);
        setEditingPlayerId(null);
      } catch (error) {
        console.error('Błąd zapisywania zawodnika:', error);
        alert('Wystąpił błąd podczas zapisywania zawodnika. Spróbuj ponownie.');
      } finally {
        setIsLoading(false);
      }
    },
    [editingPlayerId]
  );

  const handleEditPlayer = useCallback((playerId: string) => {
    setEditingPlayerId(playerId);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingPlayerId(null);
  }, []);

  // Funkcja pomocnicza do pobrania edytowanego gracza
  const getEditingPlayer = useCallback(() => {
    if (!editingPlayerId) return null;
    return players.find((p) => p.id === editingPlayerId) || null;
  }, [players, editingPlayerId]);

  return {
    players,
    isModalOpen,
    editingPlayerId,
    editingPlayer: getEditingPlayer(),
    isLoading,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
  };
}
