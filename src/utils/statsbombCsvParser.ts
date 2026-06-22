import { parseCSV } from "./csvAnalyzer";

export type StatsBombOutcomes = {
  goals: number;
  goalsConceded: number;
  gd: number;
  xg: number;
  xga: number;
  xgd: number;
  win: number;
  draw: number;
  loss: number;
  points: number;
};

export type StatsBombMatchRow = {
  matchLabel: string;
  date: string;
  isHome: boolean;
  opponent: string;
  gameWeek: number | null;
  outcomes: StatsBombOutcomes;
  /** Wszystkie kolumny liczbowe z CSV (klucz = nagłówek). */
  numeric: Record<string, number>;
};

const NON_NUMERIC_COLUMNS = new Set([
  "Match",
  "Date",
  "Game SBD ID",
]);

const OUTCOME_SOURCE_COLUMNS = {
  goals: "Goals & Penalty Goals",
  goalsConceded: "Goals Conceded",
  xg: "Cumulative xG",
  xga: "Opposition xG",
} as const;

export const STATSBOMB_CSV_STORAGE_KEY = "statsbomb_csv_upload_v1";
export const STATSBOMB_SQUAD_CSV_STORAGE_KEY = "statsbomb_squad_csv_upload_v1";

export type StatsBombCsvKind = "match" | "squad" | "unknown";

export type StatsBombSquadPlayerRow = {
  playerId: string;
  name: string;
  displayName: string;
  minutes: number;
  age: number | null;
  height: number | null;
  preferredFoot: string;
  isGoalkeeper: boolean;
  /** Wartości per 90 (lub % / wskaźniki) z eksportu Squad STATS. */
  numeric: Record<string, number>;
};

export function saveStatsBombCsvToStorage(csvText: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATSBOMB_CSV_STORAGE_KEY, csvText);
  } catch {
    // quota / private mode
  }
}

export function loadStatsBombCsvFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STATSBOMB_CSV_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStatsBombCsvFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STATSBOMB_CSV_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function saveStatsBombSquadCsvToStorage(csvText: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATSBOMB_SQUAD_CSV_STORAGE_KEY, csvText);
  } catch {
    // quota / private mode
  }
}

export function loadStatsBombSquadCsvFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STATSBOMB_SQUAD_CSV_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStatsBombSquadCsvFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STATSBOMB_SQUAD_CSV_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Rozpoznaje typ pliku StatsBomb po nagłówku CSV. */
export function detectStatsBombCsvKind(csvText: string): StatsBombCsvKind {
  const normalized = normalizeStatsBombCsv(csvText);
  const firstLine = normalized.split("\n")[0] ?? "";
  const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  if (headers.includes("Match")) return "match";
  if (headers.includes("Player")) return "squad";
  return "unknown";
}

/** Usuwa BOM z eksportu Excel/StatsBomb. */
export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Normalizuje surowy CSV: usuwa BOM i ujednolica końce linii do "\n".
 * Eksporty Excel/StatsBomb używają CRLF — bez tego ostatnia kolumna nagłówka
 * kończyła się znakiem "\r" (np. "Opposition xG\r"), przez co nie pasowała do
 * kluczy outcome i metryka była liczona jako 0.
 */
export function normalizeStatsBombCsv(text: string): string {
  return stripUtf8Bom(text).replace(/\r\n?/g, "\n");
}

/** Parsuje wartość liczbową z eksportu StatsBomb (liczby, ułamki, %, true/false). */
export function parseStatsBombNumber(raw: string | undefined): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "true") return 1;
  if (lower === "false") return 0;
  // Wartości procentowe ("55%") — skalowanie nie zmienia korelacji Pearsona.
  const cleaned = t.endsWith("%") ? t.slice(0, -1).trim() : t;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Rozpoznaje gospodarza / gościa na podstawie etykiety meczu. */
export function parseStatsBombMatchLabel(label: string): { isHome: boolean; opponent: string } {
  const parts = label.split(/\s+vs\.?\s+/i);
  if (parts.length !== 2) {
    return { isHome: true, opponent: label.trim() };
  }
  const [home, away] = parts.map((p) => p.trim());
  const homeIsTracked = /jagiellonia/i.test(home);
  const awayIsTracked = /jagiellonia/i.test(away);
  if (homeIsTracked && !awayIsTracked) return { isHome: true, opponent: away };
  if (awayIsTracked && !homeIsTracked) return { isHome: false, opponent: home };
  return { isHome: true, opponent: away };
}

function readNumericField(numeric: Record<string, number>, key: string): number {
  const v = numeric[key];
  return Number.isFinite(v) ? v : 0;
}

export function computeStatsBombOutcomes(numeric: Record<string, number>): StatsBombOutcomes {
  const goals = readNumericField(numeric, OUTCOME_SOURCE_COLUMNS.goals);
  const goalsConceded = readNumericField(numeric, OUTCOME_SOURCE_COLUMNS.goalsConceded);
  const xg = readNumericField(numeric, OUTCOME_SOURCE_COLUMNS.xg);
  const xga = readNumericField(numeric, OUTCOME_SOURCE_COLUMNS.xga);
  const gd = goals - goalsConceded;
  return {
    goals,
    goalsConceded,
    gd,
    xg,
    xga,
    xgd: xg - xga,
    win: gd > 0 ? 1 : 0,
    draw: gd === 0 ? 1 : 0,
    loss: gd < 0 ? 1 : 0,
    points: gd > 0 ? 3 : gd === 0 ? 1 : 0,
  };
}

function extractNumericColumns(rawRows: Record<string, string>[]): string[] {
  if (rawRows.length === 0) return [];
  const headers = Object.keys(rawRows[0]);
  const numericHeaders: string[] = [];
  for (const header of headers) {
    if (NON_NUMERIC_COLUMNS.has(header)) continue;
    let numericCount = 0;
    let checked = 0;
    for (const row of rawRows) {
      const parsed = parseStatsBombNumber(row[header]);
      checked += 1;
      if (parsed !== null) numericCount += 1;
      if (checked >= 8) break;
    }
    if (checked > 0 && numericCount / checked >= 0.75) {
      numericHeaders.push(header);
    }
  }
  return numericHeaders;
}

/** Parsuje pełny plik CSV StatsBomb (MatchStats). */
export function parseStatsBombMatchStatsCsv(csvText: string): StatsBombMatchRow[] {
  const rawRows = parseCSV(normalizeStatsBombCsv(csvText));
  if (rawRows.length === 0) return [];

  const numericHeaders = extractNumericColumns(rawRows);
  const rows: StatsBombMatchRow[] = [];

  for (const raw of rawRows) {
    const matchLabel = String(raw.Match ?? "").trim();
    if (!matchLabel) continue;

    const { isHome, opponent } = parseStatsBombMatchLabel(matchLabel);
    const numeric: Record<string, number> = {};
    for (const header of numericHeaders) {
      const parsed = parseStatsBombNumber(raw[header]);
      if (parsed !== null) numeric[header] = parsed;
    }

    rows.push({
      matchLabel,
      date: String(raw.Date ?? "").trim(),
      isHome,
      opponent,
      gameWeek: parseStatsBombNumber(raw["Game Week"]),
      outcomes: computeStatsBombOutcomes(numeric),
      numeric,
    });
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

const SQUAD_NON_NUMERIC_COLUMNS = new Set([
  "Player",
  "Date of Birth",
  "First Name",
  "Last Name",
  "Nickname",
  "Preferred Foot",
  "Player SBD ID",
  "Current Team SBD ID",
]);

function squadPlayerIdFromRaw(raw: Record<string, string>, name: string): string {
  const sbdId = String(raw["Player SBD ID"] ?? "").trim();
  if (sbdId) return `sb_player_${sbdId}`;
  return `sb_player_${name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase()}`;
}

function squadDisplayName(raw: Record<string, string>, name: string): string {
  const nickname = String(raw.Nickname ?? "").trim();
  if (nickname) return nickname;
  const first = String(raw["First Name"] ?? "").trim();
  const last = String(raw["Last Name"] ?? "").trim();
  if (first && last) return `${first} ${last}`;
  return name;
}

/** Heurystyka bramkarza na podstawie metryk Squad STATS. */
export function detectStatsBombSquadGoalkeeper(numeric: Record<string, number>): boolean {
  const shotsFaced = numeric["Shots Faced"] ?? numeric["Non Penalty Shots Faced"] ?? 0;
  const saves = numeric.Saves ?? 0;
  const gkObv = numeric["Goalkeeper OBV"] ?? 0;
  const goalsSaved = numeric["Goals Saved Above Average"] ?? 0;
  return shotsFaced > 2 || saves > 2 || Math.abs(gkObv) > 0.01 || Math.abs(goalsSaved) > 0.01;
}

/** Parsuje plik CSV StatsBomb Squad STATS (statystyki indywidualne per 90). */
export function parseStatsBombSquadStatsCsv(csvText: string): StatsBombSquadPlayerRow[] {
  const rawRows = parseCSV(normalizeStatsBombCsv(csvText));
  if (rawRows.length === 0) return [];

  const numericHeaders = extractNumericColumns(
    rawRows.map((row) => {
      const filtered: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!SQUAD_NON_NUMERIC_COLUMNS.has(key)) filtered[key] = value;
      }
      return filtered;
    }),
  );

  const rows: StatsBombSquadPlayerRow[] = [];

  for (const raw of rawRows) {
    const name = String(raw.Player ?? "").trim();
    if (!name) continue;

    const numeric: Record<string, number> = {};
    for (const header of numericHeaders) {
      const parsed = parseStatsBombNumber(raw[header]);
      if (parsed !== null) numeric[header] = parsed;
    }

    const minutes = numeric.Minutes ?? parseStatsBombNumber(raw.Minutes) ?? 0;
    rows.push({
      playerId: squadPlayerIdFromRaw(raw, name),
      name,
      displayName: squadDisplayName(raw, name),
      minutes,
      age: parseStatsBombNumber(raw.Age),
      height: parseStatsBombNumber(raw.Height),
      preferredFoot: String(raw["Preferred Foot"] ?? "").trim(),
      isGoalkeeper: detectStatsBombSquadGoalkeeper(numeric),
      numeric,
    });
  }

  return rows.sort((a, b) => b.minutes - a.minutes);
}
