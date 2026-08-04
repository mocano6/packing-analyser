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
  | "compensation";

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
