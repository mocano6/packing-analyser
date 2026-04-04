import { collection, getDocs } from "@/lib/firestoreWithMetrics";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { isTeamActive } from "@/utils/teamActive";

// Struktura zespołu w Firebase
export interface Team {
  id: string;
  name: string;
  logo?: string; // URL lub base64 grafiki zespołu
  createdAt?: Date;
  isSystem?: boolean;
  /** true = ukryty w selektorach (można przywrócić w panelu admina) */
  inactive?: boolean;
}

// Domyślne zespoły na wypadek braku połączenia z Firebase
export const DEFAULT_TEAMS = {
  REZERWY: {
    id: "89039437-62a7-4eda-b67d-70a4fb24e4ea",
    name: "Rezerwy",
    logo: undefined
  },
  POLONIA_BYTOM: {
    id: "4fqwPiTdSZSLEwUHo785",
    name: "Polonia Bytom",
    logo: undefined
  },
  U19: {
    id: "1595da8a-a9d6-463d-a49d-5e2c41ff36be",
    name: "U19",
    logo: undefined
  },
  U17: {
    id: "58f3862c-75d5-4fa7-a18d-0c8e3b00402a",
    name: "U17",
    logo: undefined
  },
  U16: {
    id: "06141fa4-80bc-404e-8fcb-63ef2d0a7815",
    name: "U16",
    logo: undefined
  },
  U15: {
    id: "0ebf0d57-4f2c-4c12-937f-635feb2af332",
    name: "U15",
    logo: undefined
  }
} as const;

// Pełna lista z ostatniego pobrania (wszystkie zespoły, także nieaktywne)
let cachedTeamsFull: Team[] | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 godzina w milisekundach

function teamDocToTeam(docId: string, teamData: Partial<Team>): Team {
  return {
    id: docId,
    name: teamData.name ?? "",
    logo: teamData.logo,
    createdAt: teamData.createdAt,
    isSystem: teamData.isSystem,
    inactive: teamData.inactive === true ? true : undefined,
  };
}

function buildTeamsRecord(teamsList: Team[]): Record<string, Team> {
  const teams: Record<string, Team> = {};
  for (const team of teamsList) {
    const key =
      Object.entries(DEFAULT_TEAMS).find(([, defaultTeam]) => defaultTeam.id === team.id)?.[0] || team.id;
    teams[key] = team;
  }
  return teams;
}

function defaultTeamsAsList(): Team[] {
  return Object.entries(DEFAULT_TEAMS).map(([, t]) => ({
    id: t.id,
    name: t.name,
    logo: t.logo,
    isSystem: true,
  }));
}

/**
 * Pobiera zespoły z Firebase i konwertuje na format używany w aplikacji.
 * Domyślnie zwraca tylko aktywne (inactive !== true). Użyj { includeInactive: true } dla admina / weryfikacji.
 */
export async function fetchTeams(options?: { includeInactive?: boolean }): Promise<Record<string, Team>> {
  const includeInactive = options?.includeInactive === true;
  const now = Date.now();

  if (cachedTeamsFull && now - lastFetchTime < CACHE_TTL) {
    const slice = includeInactive ? cachedTeamsFull : cachedTeamsFull.filter(isTeamActive);
    return buildTeamsRecord(slice);
  }

  const isOfflineMode = typeof window !== "undefined" && localStorage.getItem("firestore_offline_mode") === "true";
  if (isOfflineMode) {
    cachedTeamsFull = defaultTeamsAsList();
    lastFetchTime = now;
    const slice = includeInactive ? cachedTeamsFull : cachedTeamsFull.filter(isTeamActive);
    return buildTeamsRecord(slice);
  }

  try {
    if (!db) {
      throw new Error("Firebase nie jest zainicjalizowane");
    }

    const teamsCollection = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCollection);

    if (teamsSnapshot.empty) {
      console.warn("Brak zespołów w Firebase, używam domyślnych danych");
      cachedTeamsFull = defaultTeamsAsList();
      lastFetchTime = now;
      const slice = includeInactive ? cachedTeamsFull : cachedTeamsFull.filter(isTeamActive);
      return buildTeamsRecord(slice);
    }

    const all: Team[] = [];
    teamsSnapshot.forEach((d) => {
      all.push(teamDocToTeam(d.id, d.data() as Partial<Team>));
    });

    cachedTeamsFull = all;
    lastFetchTime = now;
    const slice = includeInactive ? all : all.filter(isTeamActive);
    return buildTeamsRecord(slice);
  } catch (error) {
    console.error("Błąd podczas pobierania zespołów z Firebase:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("Missing or insufficient permissions") ||
        error.message.includes("client is offline") ||
        error.message.includes("Failed to get document because the client is offline")
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem("firestore_offline_mode", "true");
          toast.error(
            "Brak uprawnień do kolekcji teams. Aplikacja działa w trybie offline z domyślnymi zespołami."
          );
        }
      }
    }

    console.warn("Używam domyślnych danych o zespołach");
    cachedTeamsFull = defaultTeamsAsList();
    lastFetchTime = now;
    const slice = includeInactive ? cachedTeamsFull : cachedTeamsFull.filter(isTeamActive);
    return buildTeamsRecord(slice);
  }
}

/**
 * Zwraca listę zespołów. Domyślnie bez nieaktywnych; admin: { includeInactive: true }.
 */
export async function getTeamsArray(options?: { includeInactive?: boolean }): Promise<Team[]> {
  await fetchTeams({ includeInactive: true });
  const list = cachedTeamsFull ?? [];
  const slice = options?.includeInactive ? list : list.filter(isTeamActive);
  return [...slice].sort((a, b) => a.name.localeCompare(b.name, "pl", { sensitivity: "base", numeric: true }));
}

/**
 * Czyści cache zespołów - wymusza ponowne pobranie z Firebase przy następnym wywołaniu fetchTeams
 */
export function clearTeamsCache(): void {
  cachedTeamsFull = null;
  lastFetchTime = 0;
}

// Eksportujemy domyślne zespoły dla kompatybilności wstecznej
export const TEAMS = DEFAULT_TEAMS;
export default TEAMS; 