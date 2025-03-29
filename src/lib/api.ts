import { v4 as uuidv4 } from 'uuid';

// Struktura przechowywania oczekujących akcji
interface PendingRequest {
  id: string;
  url: string;
  method: string;
  body?: any;
  timestamp: number;
}

// Klucz do przechowywania oczekujących żądań w localStorage
const PENDING_REQUESTS_KEY = 'packing_analyzer_pending_requests';

// Sprawdzenie, czy aplikacja jest online
const isOnline = () => {
  return navigator.onLine;
};

// Obsługa żądań API z mechanizmem offline
export const apiRequest = async <T>(
  url: string,
  method: string = 'GET',
  body?: any
): Promise<T> => {
  // Jeśli jesteśmy online, wysyłamy żądanie normalnie
  if (isOnline()) {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      // Jeśli żądanie nie powiodło się (np. z powodu nagłej utraty połączenia),
      // zapisujemy je do oczekujących żądań
      if (method !== 'GET') {
        savePendingRequest(url, method, body);
      }
      throw error;
    }
  } else {
    // Jeśli jesteśmy offline i jest to żądanie modyfikujące dane
    if (method !== 'GET') {
      savePendingRequest(url, method, body);
      // Zwracamy mock odpowiedzi
      return { 
        success: true, 
        offline: true, 
        message: 'Żądanie zostało zapisane i zostanie wysłane, gdy połączenie zostanie przywrócone' 
      } as unknown as T;
    } else {
      // Dla operacji GET możemy próbować pobrać dane z cache
      throw new Error('Brak połączenia z internetem. Operacje odczytu nie są dostępne w trybie offline.');
    }
  }
};

// Zapisanie oczekującego żądania do localStorage
const savePendingRequest = (url: string, method: string, body?: any) => {
  const pendingRequests: PendingRequest[] = getPendingRequests();

  const newRequest: PendingRequest = {
    id: uuidv4(),
    url,
    method,
    body,
    timestamp: Date.now(),
  };

  pendingRequests.push(newRequest);
  localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(pendingRequests));
  
  console.log(`Zapisano żądanie offline: ${method} ${url}`);
};

// Pobranie listy oczekujących żądań
export const getPendingRequests = (): PendingRequest[] => {
  const requestsJson = localStorage.getItem(PENDING_REQUESTS_KEY);
  return requestsJson ? JSON.parse(requestsJson) : [];
};

// Synchronizacja oczekujących żądań po przywróceniu połączenia
export const syncPendingRequests = async (): Promise<void> => {
  if (!isOnline()) {
    console.log('Nie można zsynchronizować żądań: brak połączenia');
    return;
  }

  const pendingRequests = getPendingRequests();
  if (pendingRequests.length === 0) {
    return;
  }

  console.log(`Rozpoczęto synchronizację ${pendingRequests.length} oczekujących żądań`);

  // Sortujemy żądania według znacznika czasu
  const sortedRequests = [...pendingRequests].sort((a, b) => a.timestamp - b.timestamp);
  
  // Tworzymy nową listę oczekujących żądań, aktualizowaną w przypadku niepowodzeń
  const newPendingRequests: PendingRequest[] = [];

  for (const request of sortedRequests) {
    try {
      const options: RequestInit = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (request.body) {
        options.body = JSON.stringify(request.body);
      }

      const response = await fetch(request.url, options);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      console.log(`Zsynchronizowano żądanie: ${request.method} ${request.url}`);
    } catch (error) {
      console.error(`Nie udało się zsynchronizować żądania: ${request.method} ${request.url}`, error);
      // Zachowaj żądanie, które nie powiodło się, do kolejnej próby
      newPendingRequests.push(request);
    }
  }

  // Zapisz zaktualizowaną listę oczekujących żądań
  localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(newPendingRequests));
  
  if (newPendingRequests.length === 0) {
    console.log('Wszystkie żądania zostały zsynchronizowane');
  } else {
    console.log(`Pozostało ${newPendingRequests.length} żądań do synchronizacji`);
  }
};

// Nasłuchiwanie zmiany stanu połączenia
export const setupOfflineSync = () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('Przywrócono połączenie. Rozpoczynam synchronizację.');
      syncPendingRequests();
    });

    window.addEventListener('offline', () => {
      console.log('Utracono połączenie. Aplikacja działa w trybie offline.');
    });
  }
};

// Sprawdzanie i synchronizacja przy starcie aplikacji
export const initializeOfflineSupport = () => {
  setupOfflineSync();
  
  // Jeśli jesteśmy online przy starcie aplikacji, spróbujmy zsynchronizować oczekujące żądania
  if (isOnline()) {
    syncPendingRequests();
  }
};

// Specjalistyczne funkcje API
export const apiActions = {
  // Pobieranie akcji dla określonego meczu
  getActions: (matchId?: string) => {
    const url = matchId ? `/api/actions?matchId=${matchId}` : '/api/actions';
    return apiRequest(url, 'GET');
  },

  // Zapisywanie nowej akcji
  saveAction: (actionData: any) => {
    return apiRequest('/api/actions', 'POST', actionData);
  },

  // Usuwanie akcji
  deleteAction: (actionId: string) => {
    return apiRequest(`/api/actions/${actionId}`, 'DELETE');
  },

  // Usuwanie wszystkich akcji dla meczu
  deleteAllActions: (matchId: string) => {
    return apiRequest(`/api/actions?matchId=${matchId}`, 'DELETE');
  }
};

export const apiMatches = {
  // Pobieranie meczów dla określonego zespołu
  getMatches: (teamId?: string) => {
    const url = teamId ? `/api/matches?teamId=${teamId}` : '/api/matches';
    return apiRequest(url, 'GET');
  },

  // Zapisywanie nowego meczu
  saveMatch: (matchData: any) => {
    return apiRequest('/api/matches', 'POST', matchData);
  },

  // Usuwanie meczu
  deleteMatch: (matchId: string) => {
    return apiRequest(`/api/matches/${matchId}`, 'DELETE');
  }
};

export const apiPlayers = {
  // Pobieranie zawodników dla określonego zespołu
  getPlayers: (teamId?: string) => {
    const url = teamId ? `/api/players?teamId=${teamId}` : '/api/players';
    return apiRequest(url, 'GET');
  },

  // Zapisywanie nowego zawodnika
  savePlayer: (playerData: any) => {
    return apiRequest('/api/players', 'POST', playerData);
  },

  // Aktualizacja zawodnika
  updatePlayer: (playerId: string, playerData: any) => {
    return apiRequest(`/api/players/${playerId}`, 'PUT', playerData);
  },

  // Usuwanie zawodnika
  deletePlayer: (playerId: string) => {
    return apiRequest(`/api/players/${playerId}`, 'DELETE');
  }
};

// Eksportujemy API
export default {
  apiRequest,
  getPendingRequests,
  syncPendingRequests,
  initializeOfflineSupport,
  setupOfflineSync,
  apiActions,
  apiMatches,
  apiPlayers
}; 