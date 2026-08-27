/**
 * Warstwa motoryczna mikrocyklu — Periodyzacja Taktyczna (Frade) + model obciążeniowy GPS.
 * Dominanta dnia wynika z offsetu względem meczu (MD), nie z treści taktycznej.
 */

export type MotorDominantId =
  | "off"
  | "recovery"
  | "activation"
  | "tension"
  | "duration"
  | "velocity"
  | "match";

export interface MotorDominant {
  id: MotorDominantId;
  label: string;
  shortLabel: string;
  /** Co realnie obciąża w tym dniu. */
  loadFocus: string;
  /** Zalecana gęstość boiska w m²/gracz (null = nie dotyczy). */
  areaPerPlayer: { min: number; max: number } | null;
  color: string;
}

export const MOTOR_DOMINANTS: MotorDominant[] = [
  {
    id: "off",
    label: "Dzień wolny",
    shortLabel: "WOLNE",
    loadFocus: "Brak treningu — sen, nawodnienie, białko 1,8–2,2 g/kg.",
    areaPerPlayer: null,
    color: "#94a3b8",
  },
  {
    id: "recovery",
    label: "Regeneracja",
    shortLabel: "REGEN",
    loadFocus: "Obniżenie DOMS, diagnostyka, kompensacja dla niegrających.",
    areaPerPlayer: null,
    color: "#0ea5e9",
  },
  {
    id: "activation",
    label: "Aktywacja / priming",
    shortLabel: "AKTYW",
    loadFocus: "Potencjacja bez zmęczenia, rytm, pewność, plan na przeciwnika.",
    areaPerPlayer: { min: 150, max: 300 },
    color: "#a855f7",
  },
  {
    id: "tension",
    label: "Napięcie / siła",
    shortLabel: "NAPIĘCIE",
    loadFocus:
      "Ekscentryka, hamowania, pojedynki, zmiany kierunku. Mało metrów, dużo akcji.",
    areaPerPlayer: { min: 80, max: 160 },
    color: "#f97316",
  },
  {
    id: "duration",
    label: "Trwanie / wytrzymałość",
    shortLabel: "TRWANIE",
    loadFocus:
      "Największa objętość tygodnia: dystans, ciągłość, powtarzalne wysiłki.",
    areaPerPlayer: { min: 180, max: 300 },
    color: "#16a34a",
  },
  {
    id: "velocity",
    label: "Szybkość",
    shortLabel: "SZYBKOŚĆ",
    loadFocus:
      "Sprint i HSR przy pełnej świeżości. Krótkie serie, długie przerwy.",
    areaPerPlayer: { min: 150, max: 300 },
    color: "#ef4444",
  },
  {
    id: "match",
    label: "Mecz",
    shortLabel: "MECZ",
    loadFocus: "Punkt odniesienia dla wszystkich obciążeń tygodnia (100%).",
    areaPerPlayer: null,
    color: "#1e293b",
  },
];

export const MOTOR_DOMINANT_BY_ID: Record<MotorDominantId, MotorDominant> =
  MOTOR_DOMINANTS.reduce(
    (acc, d) => {
      acc[d.id] = d;
      return acc;
    },
    {} as Record<MotorDominantId, MotorDominant>
  );

/**
 * Rola jednostki w mikrocyklu. Wynika z odległości od meczu i kolejności jednostek,
 * a nie z etykiety MD — ten sam offset gra inną rolę przy meczu w sobotę i w niedzielę.
 */
export type MotorSessionRole = "strength" | "tension" | "volume" | "speed" | "activation";

export interface MotorSessionRoleDef {
  id: MotorSessionRole;
  label: string;
  shortLabel: string;
  /** Kolejność od jednostki najdalszej od meczu do najbliższej. */
  order: number;
  /** Minimalna liczba dni do meczu, przy której rola jest bezpieczna. */
  minDaysToMatch: number;
  dominant: MotorDominantId;
  color: string;
}

export const MOTOR_SESSION_ROLES: MotorSessionRoleDef[] = [
  {
    id: "strength",
    label: "Siła + technika — najdalej od meczu",
    shortLabel: "SIŁA",
    order: 1,
    minDaysToMatch: 4,
    dominant: "recovery",
    color: "#0ea5e9",
  },
  {
    id: "tension",
    label: "Napięcie i moc — małe formaty",
    shortLabel: "NAPIĘCIE",
    order: 2,
    minDaysToMatch: 3,
    dominant: "tension",
    color: "#f97316",
  },
  {
    id: "volume",
    label: "Objętość — szczyt dystansu i HSR",
    shortLabel: "OBJĘTOŚĆ",
    order: 3,
    minDaysToMatch: 3,
    dominant: "duration",
    color: "#16a34a",
  },
  {
    id: "speed",
    label: "Prędkość — sprint, przejścia, SFG",
    shortLabel: "PRĘDKOŚĆ",
    order: 4,
    minDaysToMatch: 2,
    dominant: "velocity",
    color: "#ef4444",
  },
  {
    id: "activation",
    label: "Aktywacja — dzień przed meczem",
    shortLabel: "AKTYWACJA",
    order: 5,
    minDaysToMatch: 1,
    dominant: "activation",
    color: "#a855f7",
  },
];

export const MOTOR_SESSION_ROLE_BY_ID: Record<MotorSessionRole, MotorSessionRoleDef> =
  MOTOR_SESSION_ROLES.reduce(
    (acc, r) => {
      acc[r.id] = r;
      return acc;
    },
    {} as Record<MotorSessionRole, MotorSessionRoleDef>
  );

/** Rotacja czterech jednostek treningowych tygodnia — od najdalszej do najbliższej meczowi. */
export const MOTOR_CORE_SESSION_ROLES: MotorSessionRole[] = [
  "strength",
  "tension",
  "volume",
  "speed",
];

const MOTOR_SESSION_ROLE_IDS = new Set<string>(MOTOR_SESSION_ROLES.map((r) => r.id));

export function isMotorSessionRole(v: unknown): v is MotorSessionRole {
  return typeof v === "string" && MOTOR_SESSION_ROLE_IDS.has(v);
}

/** Charakter bloku siłowego otwierającego jednostkę. */
export type GymSessionCharacter = "heavy" | "power" | "minimal" | "priming" | "none";

export interface GymSessionCharacterDef {
  id: GymSessionCharacter;
  label: string;
  shortLabel: string;
  /** Typowy czas siłowni w minutach. */
  typicalMinutes: string;
}

export const GYM_SESSION_CHARACTERS: GymSessionCharacterDef[] = [
  {
    id: "heavy",
    label: "Ciężki — dolna + prewencja (główna sesja tygodnia)",
    shortLabel: "CIĘŻKI",
    typicalMinutes: "45–50",
  },
  {
    id: "power",
    label: "Moc + góra ciała",
    shortLabel: "MOC",
    typicalMinutes: "30–35",
  },
  {
    id: "minimal",
    label: "Minimalny — core, mobilność, górna lekko",
    shortLabel: "MIN",
    typicalMinutes: "10–12",
  },
  {
    id: "priming",
    label: "Priming — krótki, wybuchowy, bez zmęczenia",
    shortLabel: "PRIMING",
    typicalMinutes: "12–15",
  },
  {
    id: "none",
    label: "Bez siłowni",
    shortLabel: "—",
    typicalMinutes: "0",
  },
];

export const GYM_SESSION_CHARACTER_BY_ID: Record<GymSessionCharacter, GymSessionCharacterDef> =
  GYM_SESSION_CHARACTERS.reduce(
    (acc, d) => {
      acc[d.id] = d;
      return acc;
    },
    {} as Record<GymSessionCharacter, GymSessionCharacterDef>
  );

const GYM_CHARACTER_IDS = new Set<string>(GYM_SESSION_CHARACTERS.map((d) => d.id));

export function isGymSessionCharacter(v: unknown): v is GymSessionCharacter {
  return typeof v === "string" && GYM_CHARACTER_IDS.has(v);
}

/** Tagi bloków treningowych — na nich opierają się reguły bezpieczeństwa. */
export type MotorTagId =
  | "sprint_max"
  | "acceleration"
  | "strength_max"
  | "nordic"
  | "prevention"
  | "rsa"
  | "ssg"
  | "positional"
  | "transitions"
  | "set_pieces"
  | "mobility"
  | "video"
  | "recovery"
  | "compensation"
  | "gym"
  | "transfer"
  | "power"
  | "priming";

export interface MotorTag {
  id: MotorTagId;
  label: string;
  shortLabel: string;
}

export const MOTOR_TAGS: MotorTag[] = [
  { id: "sprint_max", label: "Sprint maksymalny (≥90% Vmax)", shortLabel: "SPRINT" },
  { id: "acceleration", label: "Akceleracje / deceleracje", shortLabel: "ACC/DEC" },
  { id: "strength_max", label: "Siła maksymalna", shortLabel: "SIŁA" },
  { id: "nordic", label: "Nordic Hamstring", shortLabel: "NORDIC" },
  { id: "prevention", label: "Prewencja / mobilność stawowa", shortLabel: "PREWENCJA" },
  { id: "rsa", label: "Powtarzalne sprinty (RSA)", shortLabel: "RSA" },
  { id: "ssg", label: "Gra na małym / średnim boisku", shortLabel: "SSG" },
  { id: "positional", label: "Gra pozycyjna", shortLabel: "POZYCYJNA" },
  { id: "transitions", label: "Przejścia / kontratak", shortLabel: "PRZEJŚCIA" },
  { id: "set_pieces", label: "Stałe fragmenty gry", shortLabel: "SFG" },
  { id: "mobility", label: "Rozgrzewka / mobility", shortLabel: "MOBILITY" },
  { id: "video", label: "Analiza wideo / odprawa", shortLabel: "WIDEO" },
  { id: "recovery", label: "Regeneracja", shortLabel: "REGEN" },
  { id: "compensation", label: "Jednostka kompensacyjna", shortLabel: "KOMPENSACJA" },
  { id: "gym", label: "Siłownia (otwarcie jednostki)", shortLabel: "SIŁOWNIA" },
  { id: "transfer", label: "Transfer siłownia → boisko (10–15 min)", shortLabel: "TRANSFER" },
  { id: "power", label: "Moc / plyometria", shortLabel: "MOC" },
  { id: "priming", label: "Priming / PAPE", shortLabel: "PAPE" },
];

export const MOTOR_TAG_BY_ID: Record<MotorTagId, MotorTag> = MOTOR_TAGS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<MotorTagId, MotorTag>
);

const MOTOR_TAG_IDS = new Set<string>(MOTOR_TAGS.map((t) => t.id));

export function isMotorTagId(v: unknown): v is MotorTagId {
  return typeof v === "string" && MOTOR_TAG_IDS.has(v);
}

const MOTOR_DOMINANT_IDS = new Set<string>(MOTOR_DOMINANTS.map((d) => d.id));

export function isMotorDominantId(v: unknown): v is MotorDominantId {
  return typeof v === "string" && MOTOR_DOMINANT_IDS.has(v);
}

/** Cele obciążenia dnia — w % obciążenia meczowego (sRPE i minuty w wartościach bezwzględnych). */
export interface MicrocycleDayLoadTargets {
  /** Dystans całkowity, % meczu. */
  totalDistancePct: number;
  /** Bieg wysokiej intensywności >19,8 km/h, % meczu. */
  hsrPct: number;
  /** Sprint >25 km/h, % meczu. */
  sprintPct: number;
  /** Akceleracje i deceleracje >3 m/s², % meczu. */
  accDecPct: number;
  /** Planowane sRPE w AU (RPE × minuty). */
  srpe: number;
  /** Planowany czas jednostki w minutach. */
  minutes: number;
}

export const MICROCYCLE_LOAD_METRICS: {
  key: keyof Omit<MicrocycleDayLoadTargets, "srpe" | "minutes">;
  label: string;
  shortLabel: string;
}[] = [
  { key: "totalDistancePct", label: "Dystans całkowity", shortLabel: "DYST" },
  { key: "hsrPct", label: "HSR >19,8 km/h", shortLabel: "HSR" },
  { key: "sprintPct", label: "Sprint >25 km/h", shortLabel: "SPRINT" },
  { key: "accDecPct", label: "Acc/Dec >3 m/s²", shortLabel: "ACC" },
];
