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
  const handleDeletePlayer = useCallback((playerId: string) => {
    // window.confirm jest dostępny tylko po stronie klienta
    if (
      typeof window !== "undefined" &&
      window.confirm("Czy na pewno chcesz usunąć tego zawodnika?")
    ) {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      return true;
    }
    return false;
  }, []);

  const handleSavePlayer = useCallback(
    (playerData: Omit<Player, "id">) => {
      if (editingPlayerId) {
        setPlayers((prev) =>
          prev.map((player) =>
            player.id === editingPlayerId
              ? { ...player, ...playerData }
              : player
          )
        );
      } else {
        const newPlayer: Player = {
          // Używamy bezpiecznej alternatywy dla crypto.randomUUID()
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : generateId(),
          ...playerData,
        };
        setPlayers((prev) => [...prev, newPlayer]);
      }
      setIsModalOpen(false);
      setEditingPlayerId(null);
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
