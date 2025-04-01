// src/hooks/useMatchInfo.ts
"use client";

import { useState, useEffect } from "react";
import { TeamInfo, PlayerMinutes } from "@/types";

// Funkcja do generowania unikalnych ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function useMatchInfo() {
  const [matchInfo, setMatchInfo] = useState<TeamInfo | null>(null);
  const [allMatches, setAllMatches] = useState<TeamInfo[]>([]);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rozszerzona funkcja otwierania/zamykania modalu
  const toggleMatchModal = (isOpen: boolean, isNewMatch: boolean = false) => {
    // Najpierw aktualizujemy stan modalu
    setIsMatchModalOpen(isOpen);
    
    // Jeśli otwieramy modal dla nowego meczu, resetujemy dane meczu
    if (isOpen && isNewMatch) {
      // Opóźnienie jest potrzebne, aby zmiany stanu nastąpiły w odpowiedniej kolejności
      setTimeout(() => {
        setMatchInfo(null);
      }, 0);
    }
  };

  // Funkcja do pobierania meczów z API
  const fetchMatches = async (teamId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const username = process.env.NEXT_PUBLIC_AUTH_USERNAME || "rakow";
      const password = process.env.NEXT_PUBLIC_AUTH_PASSWORD || "napakowaniRakow";
      const credentials = btoa(`${username}:${password}`);
      
      const url = teamId ? `${API_URL}/api/matches?teamId=${teamId}` : `${API_URL}/api/matches`;
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching matches: ${response.status}`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const matchesData = await response.json();
      console.log('Pobrane mecze:', matchesData);
      
      setAllMatches(matchesData);
      
      // Jeśli mamy już wybrany mecz, znajdź go w nowo pobranych danych
      if (matchInfo?.matchId) {
        const selectedMatch = matchesData.find((m: TeamInfo) => m.matchId === matchInfo.matchId);
        if (selectedMatch) {
          setMatchInfo(selectedMatch);
        } else if (matchesData.length > 0) {
          // Jeśli nie znaleziono wybranego meczu, wybierz pierwszy z listy
          setMatchInfo(matchesData[0]);
        } else {
          setMatchInfo(null);
        }
      } else if (matchesData.length > 0) {
        // Jeśli nie ma wybranego meczu, wybierz pierwszy z listy
        setMatchInfo(matchesData[0]);
      }
      
      return matchesData;
    } catch (err) {
      console.error("Błąd podczas pobierania meczów:", err);
      setError(`Błąd podczas pobierania meczów: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Ładowanie meczów przy montowaniu komponentu
  useEffect(() => {
    fetchMatches();
  }, []);

  // Funkcja do zapisywania informacji o meczu
  const handleSaveMatchInfo = async (info: Omit<TeamInfo, "matchId"> & { matchId?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const username = process.env.NEXT_PUBLIC_AUTH_USERNAME || "rakow";
      const password = process.env.NEXT_PUBLIC_AUTH_PASSWORD || "napakowaniRakow";
      const credentials = btoa(`${username}:${password}`);
      
      const url = `${API_URL}/api/matches`;
      // Zawsze używamy metody POST
      const method = 'POST';
      
      console.log('Dane wysyłane do serwera:', JSON.stringify(info, null, 2));
      console.log('URL:', url);
      console.log('Metoda:', method);
      
      const response = await fetch(url, {
        method,
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(info),
      });
      
      console.log('Status odpowiedzi:', response.status);
      console.log('OK:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Treść błędu:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const savedMatch = await response.json();
      console.log('Odpowiedź z serwera:', JSON.stringify(savedMatch, null, 2));
      
      if (info.matchId) {
        // Aktualizacja istniejącego meczu
        setAllMatches(prev => 
          prev.map(match => 
            match.matchId === info.matchId ? savedMatch : match
          )
        );
      } else {
        // Dodanie nowego meczu
        setAllMatches(prev => [...prev, savedMatch]);
      }
      
      setMatchInfo(savedMatch);
      setIsMatchModalOpen(false);
    } catch (err) {
      console.error("Błąd podczas zapisywania informacji o meczu:", err);
      setError(`Błąd podczas zapisywania informacji o meczu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Funkcja do zapisywania minut zawodników w meczu
  const handleSavePlayerMinutes = async (match: TeamInfo, playerMinutes: PlayerMinutes[]) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const username = process.env.NEXT_PUBLIC_AUTH_USERNAME || "rakow";
      const password = process.env.NEXT_PUBLIC_AUTH_PASSWORD || "napakowaniRakow";
      const credentials = btoa(`${username}:${password}`);
      
      const response = await fetch(`${API_URL}/api/player-minutes`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          matchId: match.matchId,
          playerMinutes
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error saving player minutes:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const updatedMatch = await response.json();
      
      // Aktualizuj listę wszystkich meczów
      setAllMatches(prev => 
        prev.map(m => 
          m.matchId === match.matchId ? updatedMatch : m
        )
      );

      // Jeśli to aktualnie wybrany mecz, zaktualizuj też matchInfo
      if (matchInfo?.matchId === match.matchId) {
        setMatchInfo(updatedMatch);
      }
    } catch (err) {
      console.error("Błąd podczas zapisywania minut zawodników:", err);
      setError(`Błąd podczas zapisywania minut zawodników: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMatch = (match: TeamInfo | null) => {
    setMatchInfo(match);
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
      try {
        setIsLoading(true);
        setError(null);
        
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
        const username = process.env.NEXT_PUBLIC_AUTH_USERNAME || "rakow";
        const password = process.env.NEXT_PUBLIC_AUTH_PASSWORD || "napakowaniRakow";
        const credentials = btoa(`${username}:${password}`);
        
        const response = await fetch(`${API_URL}/api/matches?id=${matchId}`, {
          method: 'DELETE',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error deleting match:', response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        setAllMatches(prev => {
          const updatedMatches = prev.filter(match => match.matchId !== matchId);
          
          // Jeśli usunęliśmy aktualnie wybrany mecz
          if (matchInfo?.matchId === matchId) {
            // Jeśli zostały jeszcze jakieś mecze, wybierz pierwszy
            if (updatedMatches.length > 0) {
              setMatchInfo(updatedMatches[0]);
            } else {
              setMatchInfo(null);
            }
          }
          
          return updatedMatches;
        });
      } catch (err) {
        console.error("Błąd podczas usuwania meczu:", err);
        setError(`Błąd podczas usuwania meczu: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return {
    matchInfo,
    allMatches,
    isMatchModalOpen,
    isLoading,
    error,
    setIsMatchModalOpen: toggleMatchModal,
    handleSaveMatchInfo,
    handleSelectMatch,
    handleDeleteMatch,
    handleSavePlayerMinutes,
    fetchMatches
  };
}
