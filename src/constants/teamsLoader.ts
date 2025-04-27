import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";

// Struktura zespołu w Firebase
export interface Team {
  id: string;
  name: string;
  createdAt?: Date;
  isSystem?: boolean;
}

// Domyślne zespoły na wypadek braku połączenia z Firebase
export const DEFAULT_TEAMS = {
  REZERWY: {
    id: "89039437-62a7-4eda-b67d-70a4fb24e4ea",
    name: "Rezerwy"
  },
  U19: {
    id: "1595da8a-a9d6-463d-a49d-5e2c41ff36be",
    name: "U19"
  },
  U17: {
    id: "58f3862c-75d5-4fa7-a18d-0c8e3b00402a",
    name: "U17"
  },
  U16: {
    id: "06141fa4-80bc-404e-8fcb-63ef2d0a7815",
    name: "U16"
  },
  U15: {
    id: "0ebf0d57-4f2c-4c12-937f-635feb2af332",
    name: "U15"
  }
} as const;

// Cache dla pobranych zespołów
let cachedTeams: Record<string, Team> | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 godzina w milisekundach

/**
 * Pobiera zespoły z Firebase i konwertuje na format używany w aplikacji
 */
export async function fetchTeams(): Promise<Record<string, Team>> {
  // Jeśli mamy cache i nie jest starszy niż CACHE_TTL, zwróć cache
  const now = Date.now();
  if (cachedTeams && (now - lastFetchTime < CACHE_TTL)) {
    console.log("Używam zapisanych w pamięci danych o zespołach");
    return cachedTeams;
  }

  // Sprawdź, czy aplikacja jest w trybie offline
  const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('firestore_offline_mode') === 'true';
  if (isOfflineMode) {
    console.log("📴 Aplikacja w trybie offline - używam domyślnych zespołów");
    return DEFAULT_TEAMS;
  }

  try {
    console.log("Pobieranie zespołów z Firebase...");
    const teamsCollection = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCollection);
    
    if (teamsSnapshot.empty) {
      console.warn("Brak zespołów w Firebase, używam domyślnych danych");
      return DEFAULT_TEAMS;
    }
    
    const teams: Record<string, Team> = {};
    
    teamsSnapshot.forEach(doc => {
      const teamData = doc.data() as Team;
      // Konwertujemy dane na format używany w aplikacji
      const key = Object.entries(DEFAULT_TEAMS).find(
        ([_, defaultTeam]) => defaultTeam.id === teamData.id
      )?.[0] || teamData.id;
      
      teams[key] = {
        id: teamData.id,
        name: teamData.name
      };
    });
    
    // Aktualizujemy cache
    cachedTeams = teams;
    lastFetchTime = now;
    console.log("Pobrano zespoły z Firebase:", Object.keys(teams).length);
    
    return teams;
  } catch (error) {
    console.error("Błąd podczas pobierania zespołów z Firebase:", error);
    
    // Sprawdzamy, czy to błąd uprawnień
    if (error instanceof Error) {
      if (error.message.includes("Missing or insufficient permissions") || 
          error.message.includes("client is offline") ||
          error.message.includes("Failed to get document because the client is offline")) {
        console.log("🔒 Wykryto brak uprawnień lub tryb offline, przełączam na tryb offline");
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('firestore_offline_mode', 'true');
          toast.error("Brak uprawnień do kolekcji teams. Aplikacja działa w trybie offline z domyślnymi zespołami.");
        }
      }
    }
    
    console.warn("Używam domyślnych danych o zespołach");
    return DEFAULT_TEAMS;
  }
}

/**
 * Zwraca listę zespołów jako tablicę
 */
export async function getTeamsArray(): Promise<Team[]> {
  const teams = await fetchTeams();
  return Object.values(teams);
}

// Eksportujemy domyślne zespoły dla kompatybilności wstecznej
export const TEAMS = DEFAULT_TEAMS;
export default TEAMS; 