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
  fromZone?: string; // Opcjonalne - dla regain używamy regainAttackZone/regainDefenseZone
  toZone?: string; // Opcjonalne - dla regain używamy regainAttackZone/regainDefenseZone
  regainAttackZone?: string; // Strefa ataku dla regain (opposite zone)
  regainDefenseZone?: string; // Strefa obrony dla regain (gdzie nastąpił regain)
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
  // PxT jest obliczane dynamicznie na froncie
  isP0Start?: boolean;
  isP1Start?: boolean;
  isP2Start?: boolean;
  isP3Start?: boolean;
  isP0?: boolean;
  isP1?: boolean;
  isP2?: boolean;
  isP3?: boolean;
  isContact1?: boolean;
  isContact2?: boolean;
  isContact3Plus?: boolean;
  isShot?: boolean;
  isGoal?: boolean;
  isPenaltyAreaEntry?: boolean;
  isSecondHalf: boolean;
  mode?: "attack" | "defense"; // Tryb akcji: Atak lub Obrona
  defensePlayers?: string[]; // Lista zawodników obrony (tylko dla trybu obrona)
  isBelow8s?: boolean; // Poniżej 8 sekund (dla regain i loses)
  playersBehindBall?: number; // Liczba partnerów przed piłką (dla regain i loses)
  opponentsBehindBall?: number; // Liczba przeciwników za piłką (dla regain i loses)
  totalPlayersOnField?: number; // Całkowita liczba zawodników naszego zespołu na boisku (dla regain i loses) - obliczane jako 11 - playersLeftField
  totalOpponentsOnField?: number; // Całkowita liczba zawodników przeciwnika na boisku (dla regain i loses) - obliczane jako 11 - opponentsLeftField
  playersLeftField?: number; // Liczba zawodników naszego zespołu, którzy opuścili boisko (dla regain i loses)
  opponentsLeftField?: number; // Liczba zawodników przeciwnika, którzy opuścili boisko (dla regain i loses)
  // Pola dla regain - wartości po przekątnej (opposite)
  regainAttackXT?: number; // Wartość xT w ataku dla regain (z opposite zone)
  regainDefenseXT?: number; // Wartość xT w obronie dla regain (z regain zone)
  regainAttackZone?: string; // Strefa ataku dla regain (opposite zone)
  regainDefenseZone?: string; // Strefa obrony dla regain (gdzie nastąpił regain)
  oppositeXT?: number; // Wartość xT po przekątnej (opposite) - DEPRECATED, użyj regainAttackXT
  oppositeZone?: string; // Strefa po przekątnej (opposite) - DEPRECATED, użyj regainAttackZone
  isAttack?: boolean; // Czy to atak (xTValueEnd < 0.02) czy obrona (xTValueEnd >= 0.02) - dla regain
  // Pola dla loses - wartości po przekątnej (opposite)
  losesAttackXT?: number; // Wartość xT w ataku dla loses (z opposite zone)
  losesDefenseXT?: number; // Wartość xT w obronie dla loses (z lose zone)
  losesAttackZone?: string; // Strefa ataku dla loses (opposite zone)
  losesDefenseZone?: string; // Strefa obrony dla loses (gdzie nastąpiła strata)
  isReaction5s?: boolean; // Reakcja 5s (dla loses)
  isAut?: boolean; // Aut (dla loses)
  isReaction5sNotApplicable?: boolean; // Nie dotyczy - nie da się zrobić 5s (dla loses)
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
  videoTimestamp?: number; // Czas wideo w sekundach z YouTube playera
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
  isContact1?: boolean; // Liczba kontaktów: 1T
  isContact2?: boolean; // Liczba kontaktów: 2T
  isContact3Plus?: boolean; // Liczba kontaktów: 3T+
  assistantId?: string; // ID asystenta (tylko dla goli)
  assistantName?: string; // Nazwa asystenta (tylko dla goli)
}

export interface PKEntry {
  id: string;
  matchId: string;
  teamId: string;
  startX: number; // Pozycja X punktu startu w procentach (0-100)
  startY: number; // Pozycja Y punktu startu w procentach (0-100)
  endX: number; // Pozycja X punktu końca w procentach (0-100)
  endY: number; // Pozycja Y punktu końca w procentach (0-100)
  minute: number;
  isSecondHalf: boolean;
  senderId?: string; // ID zawodnika podającego
  senderName?: string; // Nazwa zawodnika podającego
  receiverId?: string; // ID zawodnika otrzymującego (opcjonalne dla dryblingu i regain)
  receiverName?: string; // Nazwa zawodnika otrzymującego (opcjonalne dla dryblingu i regain)
  entryType?: "pass" | "dribble" | "sfg" | "regain"; // Typ akcji definiujący kolor strzałki
  teamContext?: "attack" | "defense"; // Kontekst zespołu
  videoTimestamp?: number; // Czas wideo w milisekundach
  isPossible1T?: boolean; // Możliwe 1T
  pkPlayersCount?: number; // Liczba partnerów w PK
  opponentsInPKCount?: number; // Liczba przeciwników w PK
  isShot?: boolean; // Czy po wejściu w PK był strzał
  isGoal?: boolean; // Czy po wejściu w PK był gol
  isRegain?: boolean; // Czy był przechwyt piłki
  timestamp: number;
}

export interface Acc8sEntry {
  id: string;
  matchId: string;
  teamId: string;
  minute: number;
  isSecondHalf: boolean;
  teamContext: "attack" | "defense";
  isShotUnder8s: boolean; // Strzał do 8s
  isPKEntryUnder8s: boolean; // Wejście w PK do 8s
  passingPlayerIds: string[]; // ID zawodników biorących udział w akcji (wielokrotny wybór)
  videoTimestamp?: number; // Czas wideo w sekundach (nie milisekundach jak w PKEntry)
  timestamp: number;
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
  videoStoragePath?: string; // Ścieżka do wideo w Firebase Storage
  videoStorageUrl?: string; // URL do wideo z Firebase Storage (signed URL)
  firstHalfStartTime?: number; // Czas startu 1. połowy w sekundach na nagraniu
  secondHalfStartTime?: number; // Czas startu 2. połowy w sekundach na nagraniu
  playerMinutes?: PlayerMinutes[];
  actions_packing?: Action[]; // Tablica akcji packing związanych z tym meczem
  actions_unpacking?: Action[]; // Tablica akcji unpacking związanych z tym meczem
  actions_regain?: Action[]; // Tablica akcji regain związanych z tym meczem
  actions_loses?: Action[]; // Tablica akcji loses związanych z tym meczem
  shots?: Shot[]; // Tablica strzałów z mapą xG
  pkEntries?: PKEntry[]; // Tablica wejść w pole karne
  // Dane meczu
  matchData?: {
    // Czas posiadania (w minutach)
    possession?: {
      teamFirstHalf?: number; // Czas posiadania naszego zespołu w 1 połowie (min)
      opponentFirstHalf?: number; // Czas posiadania przeciwnika w 1 połowie (min)
      teamSecondHalf?: number; // Czas posiadania naszego zespołu w 2 połowie (min)
      opponentSecondHalf?: number; // Czas posiadania przeciwnika w 2 połowie (min)
    };
    // Liczba podań celnych na własnej połowie
    passes?: {
      teamFirstHalf?: number; // Liczba podań celnych naszego zespołu na własnej połowie w 1 połowie
      opponentFirstHalf?: number; // Liczba podań celnych przeciwnika na własnej połowie w 1 połowie
      teamSecondHalf?: number; // Liczba podań celnych naszego zespołu na własnej połowie w 2 połowie
      opponentSecondHalf?: number; // Liczba podań celnych przeciwnika na własnej połowie w 2 połowie
    };
    // Liczba podań niecelnych na własnej połowie
    passesInaccurate?: {
      teamFirstHalf?: number; // Liczba podań niecelnych naszego zespołu na własnej połowie w 1 połowie
      opponentFirstHalf?: number; // Liczba podań niecelnych przeciwnika na własnej połowie w 1 połowie
      teamSecondHalf?: number; // Liczba podań niecelnych naszego zespołu na własnej połowie w 2 połowie
      opponentSecondHalf?: number; // Liczba podań niecelnych przeciwnika na własnej połowie w 2 połowie
    };
    // Liczba podań celnych na połowie przeciwnika
    passesInOpponentHalf?: {
      teamFirstHalf?: number; // Liczba podań celnych naszego zespołu na połowie przeciwnika w 1 połowie
      opponentFirstHalf?: number; // Liczba podań celnych przeciwnika na naszej połowie w 1 połowie
      teamSecondHalf?: number; // Liczba podań celnych naszego zespołu na połowie przeciwnika w 2 połowie
      opponentSecondHalf?: number; // Liczba podań celnych przeciwnika na naszej połowie w 2 połowie
    };
    // Liczba podań niecelnych na połowie przeciwnika
    passesInOpponentHalfInaccurate?: {
      teamFirstHalf?: number; // Liczba podań niecelnych naszego zespołu na połowie przeciwnika w 1 połowie
      opponentFirstHalf?: number; // Liczba podań niecelnych przeciwnika na naszej połowie w 1 połowie
      teamSecondHalf?: number; // Liczba podań niecelnych naszego zespołu na połowie przeciwnika w 2 połowie
      opponentSecondHalf?: number; // Liczba podań niecelnych przeciwnika na naszej połowie w 2 połowie
    };
    // Liczba skutecznych akcji 8s ACC
    successful8sActions?: {
      teamFirstHalf?: number; // Liczba skutecznych akcji 8s ACC naszego zespołu w 1 połowie
      opponentFirstHalf?: number; // Liczba skutecznych akcji 8s ACC przeciwnika w 1 połowie
      teamSecondHalf?: number; // Liczba skutecznych akcji 8s ACC naszego zespołu w 2 połowie
      opponentSecondHalf?: number; // Liczba skutecznych akcji 8s ACC przeciwnika w 2 połowie
    };
    // Liczba nieskutecznych akcji 8s ACC
    unsuccessful8sActions?: {
      teamFirstHalf?: number; // Liczba nieskutecznych akcji 8s ACC naszego zespołu w 1 połowie
      opponentFirstHalf?: number; // Liczba nieskutecznych akcji 8s ACC przeciwnika w 1 połowie
      teamSecondHalf?: number; // Liczba nieskutecznych akcji 8s ACC naszego zespołu w 2 połowie
      opponentSecondHalf?: number; // Liczba nieskutecznych akcji 8s ACC przeciwnika w 2 połowie
    };
  };
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
