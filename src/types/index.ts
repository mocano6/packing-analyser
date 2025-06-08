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
  actionsSent?: { [matchId: string]: Action[] }; // Akcje z zawodnikiem jako podającym, pogrupowane wg meczu
  actionsReceived?: { [matchId: string]: Action[] }; // Akcje z zawodnikiem jako odbierającym, pogrupowane wg meczu
  matchesInfo?: { 
    [matchId: string]: { 
      startMinute: number, 
      endMinute: number, 
      position: string 
    } 
  }; // Informacje o minutach i pozycji zawodnika w danym meczu
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
  isP3?: boolean;
  isShot?: boolean;
  isGoal?: boolean;
  isPenaltyAreaEntry?: boolean;
  isSecondHalf: boolean;
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

export interface TeamInfo {
  matchId?: string;
  team: string;
  opponent: string;
  isHome: boolean;
  competition: string;
  date: string;
  playerMinutes?: PlayerMinutes[];
  actions_packing?: Action[]; // Tablica akcji packing związanych z tym meczem
}

export interface PlayerMinutes {
  playerId: string;
  startMinute: number;
  endMinute: number;
  position?: string;
}

export interface PlayerMinutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playerMinutes: PlayerMinutes[]) => void;
  match: TeamInfo;
  players: Player[];
  currentPlayerMinutes?: PlayerMinutes[];
}
