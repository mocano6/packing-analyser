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
export const STATSBOMB_SCOUT_CSV_STORAGE_KEY = "statsbomb_scout_csv_upload_v1";

export type StatsBombCsvKind = "match" | "squad" | "scout" | "unknown";

export type StatsBombSquadPlayerRow = {
  playerId: string;
  name: string;
  displayName: string;
  minutes: number;
  age: number | null;
  height: number | null;
  preferredFoot: string;
  /** Wartość rynkowa w EUR, jeśli kolumna jest w eksporcie CSV. */
  marketValue: number | null;
  isGoalkeeper: boolean;
  /** Wartości per 90 (lub % / wskaźniki) z eksportu Squad STATS. */
  numeric: Record<string, number>;
};

/** Zawodnik z eksportu PlayerScout — ta sama struktura co Squad STATS + klub. */
export type StatsBombScoutPlayerRow = StatsBombSquadPlayerRow & {
  currentTeam: string;
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

export function saveStatsBombScoutCsvToStorage(csvText: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATSBOMB_SCOUT_CSV_STORAGE_KEY, csvText);
  } catch {
    // quota / private mode
  }
}

export function loadStatsBombScoutCsvFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STATSBOMB_SCOUT_CSV_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStatsBombScoutCsvFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STATSBOMB_SCOUT_CSV_STORAGE_KEY);
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
  if (headers.includes("Player")) {
    if (headers.includes("Current Team")) return "scout";
    return "squad";
  }
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

/** Kolumny wartości rynkowej w eksporcie StatsBomb / Transfermarkt. */
export const STATSBOMB_MARKET_VALUE_COLUMN_CANDIDATES = [
  "Market Value",
  "Transfer Value",
  "Player Value",
  "Valuation",
  "Transfermarkt Value",
  "TM Market Value",
] as const;

export function resolveMarketValueColumn(headers: string[]): string | null {
  const normalized = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  for (const candidate of STATSBOMB_MARKET_VALUE_COLUMN_CANDIDATES) {
    const match = normalized.get(candidate.toLowerCase());
    if (match) return match;
  }
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    if (key.includes("market value") || key === "transfer value") return header;
  }
  return null;
}

/** Parsuje wartość rynkową (EUR) z tekstu lub liczby w CSV. */
export function parseMarketValueEuro(raw: string | undefined): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const numericOnly = parseStatsBombNumber(text);
  if (numericOnly !== null && numericOnly > 0) {
    // Małe liczby traktujemy jako miliony EUR (np. 2.5 = 2,5 mln).
    if (numericOnly < 10_000) return numericOnly * 1_000_000;
    return numericOnly;
  }

  const cleaned = text
    .replace(/\u00a0/g, " ")
    .replace(/[€£$]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .toLowerCase();

  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const suffix = match[2]?.toLowerCase();
  if (suffix === "b") return amount * 1_000_000_000;
  if (suffix === "m") return amount * 1_000_000;
  if (suffix === "k") return amount * 1_000;
  if (amount < 10_000) return amount * 1_000_000;
  return amount;
}

export function parsePlayerMarketValueFromRaw(
  raw: Record<string, string>,
  headers: string[],
): number | null {
  const column = resolveMarketValueColumn(headers);
  if (!column) return null;
  return parseMarketValueEuro(raw[column]);
}

export function formatStatsBombMarketValueEur(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} mln €`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("pl-PL")} tys. €`;
  }
  return `${Math.round(value).toLocaleString("pl-PL")} €`;
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
  "Current Team",
  "Date of Birth",
  "First Name",
  "Last Name",
  "Nickname",
  "Preferred Foot",
  "Player SBD ID",
  "Current Team SBD ID",
  ...STATSBOMB_MARKET_VALUE_COLUMN_CANDIDATES,
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
  const csvHeaders = rawRows.length > 0 ? Object.keys(rawRows[0]!) : [];

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
      marketValue: parsePlayerMarketValueFromRaw(raw, csvHeaders),
      isGoalkeeper: detectStatsBombSquadGoalkeeper(numeric),
      numeric,
    });
  }

  return rows.sort((a, b) => b.minutes - a.minutes);
}

/** Parsuje plik CSV PlayerScout (lista kandydatów spoza własnego składu). */
export function parseStatsBombPlayerScoutCsv(csvText: string): StatsBombScoutPlayerRow[] {
  const normalized = normalizeStatsBombCsv(csvText);
  const rawRows = parseCSV(normalized);
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

  const rows: StatsBombScoutPlayerRow[] = [];
  const csvHeaders = rawRows.length > 0 ? Object.keys(rawRows[0]!) : [];

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
      marketValue: parsePlayerMarketValueFromRaw(raw, csvHeaders),
      isGoalkeeper: detectStatsBombSquadGoalkeeper(numeric),
      currentTeam: String(raw["Current Team"] ?? "").trim(),
      numeric,
    });
  }

  return rows.sort((a, b) => b.minutes - a.minutes);
}
