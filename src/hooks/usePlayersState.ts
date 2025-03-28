// src/hooks/usePlayersState.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { Player } from "../types";

// Helper do generowania ID (alternatywa dla crypto.randomUUID())
const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

export function usePlayersState() {
  // Inicjalizacja z localStorage z obsługą SSR
  const [players, setPlayers] = useState<Player[]>(() => {
    // Wykonujemy to tylko po stronie klienta
    if (typeof window !== "undefined") {
      try {
        const savedPlayers = localStorage.getItem("players");
        return savedPlayers ? JSON.parse(savedPlayers) : [];
      } catch (error) {
        console.error("Failed to parse players from localStorage:", error);
        return [];
      }
    }
    return [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // Pobierz zawodników z API podczas inicjalizacji
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch('/api/players');
        if (response.ok) {
          const data = await response.json();
          setPlayers(data);
        } else {
          console.error('Failed to fetch players from API');
        }
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };

    fetchPlayers();
  }, []);

  // Zapisz dane graczy do localStorage
  useEffect(() => {
    // Wykonujemy to tylko po stronie klienta
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("players", JSON.stringify(players));
      } catch (error) {
        console.error("Failed to save players to localStorage:", error);
      }
    }
  }, [players]);

  // Używamy useCallback dla funkcji które są przekazywane do komponentów
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    // window.confirm jest dostępny tylko po stronie klienta
    if (
      typeof window !== "undefined" &&
      window.confirm("Czy na pewno chcesz usunąć tego zawodnika?")
    ) {
      try {
        // Usuń zawodnika przez API
        const response = await fetch(`/api/players/${playerId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          // Usuń zawodnika z lokalnego stanu
          setPlayers((prev) => prev.filter((p) => p.id !== playerId));
          return true;
        } else {
          console.error('Failed to delete player via API');
          alert('Wystąpił błąd podczas usuwania zawodnika. Spróbuj ponownie.');
          return false;
        }
      } catch (error) {
        console.error('Error deleting player:', error);
        alert('Wystąpił błąd podczas usuwania zawodnika. Spróbuj ponownie.');
        return false;
      }
    }
    return false;
  }, []);

  const handleSavePlayer = useCallback(
    async (playerData: Omit<Player, "id">) => {
      try {
        if (editingPlayerId) {
          // Aktualizuj istniejącego zawodnika
          const response = await fetch(`/api/players/${editingPlayerId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(playerData),
          });

          if (response.ok) {
            const updatedPlayer = await response.json();
            setPlayers((prev) =>
              prev.map((player) =>
                player.id === editingPlayerId ? updatedPlayer : player
              )
            );
          } else {
            console.error('Failed to update player via API');
            // Lokalnie aktualizuj jako fallback
            setPlayers((prev) =>
              prev.map((player) =>
                player.id === editingPlayerId
                  ? { ...player, ...playerData }
                  : player
              )
            );
          }
        } else {
          // Utwórz nowego zawodnika
          const response = await fetch('/api/players', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(playerData),
          });

          if (response.ok) {
            const newPlayer = await response.json();
            setPlayers((prev) => [...prev, newPlayer]);
          } else {
            const errorData = await response.json();
            console.error('Failed to create player via API:', errorData.error);
            alert(`Błąd podczas tworzenia zawodnika: ${errorData.error}`);
            
            // Lokalnie dodaj jako fallback tylko jeśli API nie zwróciło błędu
            if (response.status >= 500) {
              const newPlayer: Player = {
                id: crypto.randomUUID ? crypto.randomUUID() : generateId(),
                ...playerData,
              };
              setPlayers((prev) => [...prev, newPlayer]);
            } else {
              // Nie zamykaj modalu jeśli wystąpił błąd walidacji
              return;
            }
          }
        }
        
        // Zamknij modal i resetuj stan edycji tylko jeśli operacja się powiodła
        setIsModalOpen(false);
        setEditingPlayerId(null);
      } catch (error) {
        console.error('Error saving player:', error);
        alert('Wystąpił błąd podczas zapisywania zawodnika. Spróbuj ponownie.');
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
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
  };
}
