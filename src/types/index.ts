// src/types/index.ts
export type Tab = "packing";

export type Zone = number;

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  birthYear?: number;
  imageUrl?: string;
  teams: string[]; // Tablica identyfikatorów zespołów, do których należy zawodnik
}

export interface ConnectionStats {
  playerName: string;
  count: number;
  totalPoints: number;
  totalXT: number;
}

export interface PlayerStats {
  totalActions: number;
  totalPoints: number;
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
  totalPoints: number;
  totalXT: number;
}

export interface Action {
  id: string;
  minute: number;
  senderId: string;
  senderName: string;
  senderNumber: number;
  senderClickValue: number;
  receiverId: string;
  receiverName: string;
  receiverNumber: number;
  receiverClickValue: number;
  zone: Zone;
  basePoints: number;
  multiplier: number;
  totalPoints: number;
  actionType: "pass" | "dribble";
  packingPoints: number;
  xTValue: number;
  isP3: boolean;
  isShot: boolean;
  isGoal: boolean;
  isPenaltyAreaEntry?: boolean;
  matchId?: string; // ID meczu, do którego przypisana jest akcja
}

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
  time?: string;
  playerMinutes?: PlayerMinutes[];
}

export interface PlayerMinutes {
  playerId: string;
  startMinute: number;
  endMinute: number;
}

export interface PlayerMinutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playerMinutes: PlayerMinutes[]) => void;
  match: TeamInfo;
  players: Player[];
  currentPlayerMinutes?: PlayerMinutes[];
}
