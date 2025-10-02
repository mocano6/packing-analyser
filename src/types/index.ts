// src/types/index.ts
export type Tab = "packing" | "players";

export type Zone = number;

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  name?: string; // Zachowane dla kompatybilności wstecznej - będzie wypełniane automatycznie
  number: number;
  position: string;
  birthYear?: number;
  imageUrl?: string;
  teams: string[]; // Tablica identyfikatorów zespołów, do których należy zawodnik
  isTestPlayer?: boolean; // Czy zawodnik jest testowany
  // Akcje są teraz przechowywane tylko w matches/{matchId}.actions_packing[]
  // Minuty zawodników są teraz przechowywane tylko w matches/{matchId}.playerMinutes[]
}

export interface ConnectionStats {
  playerName: string;
  count: number;
  packingPoints: number;
  totalXT: number;
}

export interface PlayerStats {
  totalActions: number;
  packingPoints: number;
  totalXT: number;
  packingAsSender: number;
  packingAsReceiver: number;
  xtAsSender: number;
  xtAsReceiver: number;
  averagePoints: number;
  averageXT: number;
  totalP3: number;
  connections: { [key: string]: ConnectionStats }; // Zachowujemy dla kompatybilności
  connectionsAsSender: { [key: string]: ConnectionStats };
  connectionsAsReceiver: { [key: string]: ConnectionStats };
  totalShots: number;
  totalGoals: number;
}

export interface PlayerConnection {
  playerName: string;
  count: number;
  packingPoints: number;
  totalXT: number;
}

// Aktualizacja interfejsu Action dla Firebase
export interface Action {
  id: string;
  matchId: string;
  teamId: string;
  minute: number;
  fromZone: string;
  toZone: string;
  actionType: string;
  videoTimestamp?: number; // Czas w sekundach z YouTube playera
  // Dodatkowe pola z ActionsPacking
  senderId: string;
  senderName?: string;
  senderNumber?: number;
  receiverId?: string;
  receiverName?: string;
  receiverNumber?: number;
  startZone?: string;
  endZone?: string | null;
  packingPoints?: number;
  xTValueStart?: number;
  xTValueEnd?: number;
  PxT?: number;
  isP1?: boolean;
  isP2?: boolean;
  isP3?: boolean;
  isShot?: boolean;
  isGoal?: boolean;
  isPenaltyAreaEntry?: boolean;
  isSecondHalf: boolean;
  mode?: "attack" | "defense"; // Tryb akcji: Atak lub Obrona
  defensePlayers?: string[]; // Lista zawodników obrony (tylko dla trybu obrona)
}

// Dla zachowania kompatybilności
export type ActionsPacking = Action;

export interface ActionSectionProps {
  selectedZone: Zone | null;
  handleZoneSelect: (
    zone: Zone | null,
    xT?: number,
    value1?: number,
    value2?: number
  ) => void;
  players: Player[];
  selectedPlayerId: string | null;
  selectedReceiverId: string | null;
  setSelectedReceiverId: (id: string | null) => void;
  actionMinute: number;
  setActionMinute: (minute: number) => void;
  actionType: "pass" | "dribble";
  setActionType: (type: "pass" | "dribble") => void;
  currentPoints: number;
  setCurrentPoints: React.Dispatch<React.SetStateAction<number>>;
  isP3Active: boolean;
  setIsP3Active: React.Dispatch<React.SetStateAction<boolean>>;
  isShot: boolean;
  setIsShot: React.Dispatch<React.SetStateAction<boolean>>;
  isGoal: boolean;
  setIsGoal: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveAction: () => void;
  resetActionState: () => void;
}

export interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Omit<Player, "id">) => void;
  editingPlayer?: Player;
  currentTeam?: string;
  allTeams: { id: string, name: string }[]; // Lista wszystkich dostępnych zespołów
}

export interface Shot {
  id: string;
  x: number; // Pozycja X w procentach (0-100)
  y: number; // Pozycja Y w procentach (0-100)
  playerId?: string;
  playerName?: string;
  minute: number;
  xG: number; // Wartość expected goals
  isGoal: boolean;
  bodyPart?: 'foot' | 'head' | 'other';
  matchId: string;
  timestamp: number;
  // Nowe pola dla strzałów
  shotType: 'on_target' | 'off_target' | 'blocked' | 'goal'; // Typ strzału: celny, niecelny, zablokowany, gol
  teamContext: 'attack' | 'defense'; // Kontekst zespołu: atak czy obrona
  teamId: string; // ID zespołu, który wykonał strzał
  actionType?: 'open_play' | 'counter' | 'corner' | 'free_kick' | 'direct_free_kick' | 'penalty' | 'throw_in' | 'regain'; // Rodzaj akcji
  sfgSubtype?: 'direct' | 'combination'; // Podrodzaj SFG: bezpośredni, kombinacyjny
  actionPhase?: 'phase1' | 'phase2' | 'under8s' | 'over8s'; // Faza akcji: I faza, II faza (SFG) lub Do 8s, Powyżej 8s (Otwarta gra)
  blockingPlayers?: string[]; // ID zawodników blokujących strzał
  linePlayers?: string[]; // ID zawodników na linii strzału (obrona)
  linePlayersCount?: number; // Liczba zawodników na linii strzału (atak)
  pkPlayersCount?: number; // Liczba zawodników w polu karnym (nie wpływa na xG)
}

export interface TeamInfo {
  matchId?: string;
  team: string;
  opponent: string;
  opponentLogo?: string; // URL lub base64 grafiki przeciwnika
  isHome: boolean;
  competition: string;
  date: string;
  matchType?: 'liga' | 'puchar' | 'towarzyski'; // Typ meczu
  videoUrl?: string; // URL wideo z YouTube dla tego meczu
  playerMinutes?: PlayerMinutes[];
  actions_packing?: Action[]; // Tablica akcji packing związanych z tym meczem
  shots?: Shot[]; // Tablica strzałów z mapą xG
}

export interface PlayerMinutes {
  playerId: string;
  startMinute: number;
  endMinute: number;
  position?: string;
  status?: 'dostepny' | 'kontuzja' | 'brak_powolania' | 'inny_zespol'; // Status zawodnika
}

export interface PlayerMinutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playerMinutes: PlayerMinutes[]) => void;
  match: TeamInfo;
  players: Player[];
  currentPlayerMinutes?: PlayerMinutes[];
}
