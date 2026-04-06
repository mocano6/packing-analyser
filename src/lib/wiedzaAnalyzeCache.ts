import { TeamInfo } from "../types";

/** Persystencja ostatniej analizy Bazy wiedzy (filtry + mecze) — reguła projektu: teamStats_*. */
export const WIEDZA_ANALYZE_CACHE_KEY = "teamStats_wiedzaAnalyze";

export type WiedzaTabId = "regains" | "loses" | "correlations" | "packingZones" | "youth";

export type WiedzaCachedMatch = TeamInfo & { id: string };

/** Legacy: pełne mecze w localStorage — łatwo przekracza limit ~5 MB; nadal parsujemy przy wczytaniu. */
export type WiedzaAnalyzeCacheV1 = {
  v: 1;
  dateFrom: string;
  dateTo: string;
  selectedTeams: string[];
  matches: WiedzaCachedMatch[];
  activeTab: WiedzaTabId;
};

/** Aktualny zapis: tylko filtry — mecze pobierane ponownie z Firestore (fallback przy przepełnionym dysku). */
export type WiedzaAnalyzeCacheV2 = {
  v: 2;
  dateFrom: string;
  dateTo: string;
  selectedTeams: string[];
  activeTab: WiedzaTabId;
};

/** Zapis z odtworzeniem offline: skrócone dokumenty meczu (liczby, ID, strefy — bez logo / wideo / PII). */
export type WiedzaAnalyzeCacheV3 = {
  v: 3;
  dateFrom: string;
  dateTo: string;
  selectedTeams: string[];
  matches: WiedzaCachedMatch[];
  activeTab: WiedzaTabId;
};

export type WiedzaAnalyzeCachePayload = WiedzaAnalyzeCacheV1 | WiedzaAnalyzeCacheV2 | WiedzaAnalyzeCacheV3;

const TAB_IDS: WiedzaTabId[] = ["regains", "loses", "correlations", "packingZones", "youth"];

function normalizeTab(x: unknown): WiedzaTabId {
  if (x === "weights") return "correlations";
  return typeof x === "string" && (TAB_IDS as string[]).includes(x) ? (x as WiedzaTabId) : "regains";
}

export function parseWiedzaAnalyzeCache(raw: string | null): WiedzaAnalyzeCachePayload | null {
  if (raw == null || raw === "") return null;
  try {
    const o = JSON.parse(raw) as Partial<WiedzaAnalyzeCacheV1> &
      Partial<WiedzaAnalyzeCacheV2> &
      Partial<WiedzaAnalyzeCacheV3>;
    if (o.v === 2) {
      if (typeof o.dateFrom !== "string" || typeof o.dateTo !== "string") return null;
      if (!Array.isArray(o.selectedTeams)) return null;
      return {
        v: 2,
        dateFrom: o.dateFrom,
        dateTo: o.dateTo,
        selectedTeams: o.selectedTeams.filter((id): id is string => typeof id === "string"),
        activeTab: normalizeTab(o.activeTab),
      };
    }
    if (o.v === 3) {
      if (typeof o.dateFrom !== "string" || typeof o.dateTo !== "string") return null;
      if (!Array.isArray(o.selectedTeams) || !Array.isArray(o.matches)) return null;
      return {
        v: 3,
        dateFrom: o.dateFrom,
        dateTo: o.dateTo,
        selectedTeams: o.selectedTeams.filter((id): id is string => typeof id === "string"),
        matches: o.matches as WiedzaCachedMatch[],
        activeTab: normalizeTab(o.activeTab),
      };
    }
    if (o.v !== 1) return null;
    if (typeof o.dateFrom !== "string" || typeof o.dateTo !== "string") return null;
    if (!Array.isArray(o.selectedTeams) || !Array.isArray(o.matches)) return null;
    return {
      v: 1,
      dateFrom: o.dateFrom,
      dateTo: o.dateTo,
      selectedTeams: o.selectedTeams.filter((id): id is string => typeof id === "string"),
      matches: o.matches as WiedzaCachedMatch[],
      activeTab: normalizeTab(o.activeTab),
    };
  } catch {
    return null;
  }
}

/** Wynik sanityzacji do użycia na stronie Wiedzy. */
export type SanitizedWiedzaLoaded = {
  dateFrom: string;
  dateTo: string;
  selectedTeams: string[];
  activeTab: WiedzaTabId;
  matches: WiedzaCachedMatch[];
  /** v2 lub brak meczów w cache — trzeba pobrać dokumenty z Firestore. */
  needsRefetch: boolean;
};

/** Odfiltrowuje zespół i mecze do ID nadal obecnych w aplikacji. */
export function sanitizeWiedzaCache(
  cached: WiedzaAnalyzeCachePayload,
  validTeamIds: Set<string>,
): SanitizedWiedzaLoaded {
  const dateFrom = cached.dateFrom;
  const dateTo = cached.dateTo;
  const activeTab = cached.activeTab;

  if (cached.v === 2) {
    const selectedTeams = cached.selectedTeams.filter((id) => validTeamIds.has(id));
    return {
      dateFrom,
      dateTo,
      selectedTeams,
      activeTab,
      matches: [],
      needsRefetch: selectedTeams.length > 0,
    };
  }

  if (cached.v === 3) {
    let matches = cached.matches.filter((m) => m && validTeamIds.has(m.team));
    let selectedTeams = cached.selectedTeams.filter((id) => validTeamIds.has(id));
    if (selectedTeams.length === 0 && matches.length > 0) {
      selectedTeams = [...new Set(matches.map((m) => m.team))].filter((id) => validTeamIds.has(id));
    }
    return {
      dateFrom,
      dateTo,
      selectedTeams,
      activeTab,
      matches,
      needsRefetch: matches.length === 0 && selectedTeams.length > 0,
    };
  }

  let matches = cached.matches.filter((m) => m && validTeamIds.has(m.team));
  let selectedTeams = cached.selectedTeams.filter((id) => validTeamIds.has(id));
  if (selectedTeams.length === 0 && matches.length > 0) {
    selectedTeams = [...new Set(matches.map((m) => m.team))].filter((id) => validTeamIds.has(id));
  }

  return {
    dateFrom,
    dateTo,
    selectedTeams,
    activeTab,
    matches,
    needsRefetch: false,
  };
}

function isQuotaError(e: unknown): boolean {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
  return name === "QuotaExceededError";
}

export type SaveWiedzaAnalyzeResult =
  | { ok: true; filtersOnly?: boolean }
  | { ok: false; reason: "quota" | "unknown" };

/**
 * v3 — skompaktowane mecze; przy braku miejsca próba v2 (tylko filtry).
 * v2 — bez meczów w payloadzie.
 */
export function saveWiedzaAnalyzeToStorage(
  payload: WiedzaAnalyzeCacheV2 | WiedzaAnalyzeCacheV3,
): SaveWiedzaAnalyzeResult {
  if (typeof window === "undefined") return { ok: false, reason: "unknown" };
  try {
    localStorage.setItem(WIEDZA_ANALYZE_CACHE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (e: unknown) {
    if (payload.v === 3 && isQuotaError(e)) {
      try {
        const v2: WiedzaAnalyzeCacheV2 = {
          v: 2,
          dateFrom: payload.dateFrom,
          dateTo: payload.dateTo,
          selectedTeams: payload.selectedTeams,
          activeTab: payload.activeTab,
        };
        localStorage.setItem(WIEDZA_ANALYZE_CACHE_KEY, JSON.stringify(v2));
        return { ok: true, filtersOnly: true };
      } catch (e2: unknown) {
        if (isQuotaError(e2)) return { ok: false, reason: "quota" };
        return { ok: false, reason: "unknown" };
      }
    }
    if (isQuotaError(e)) return { ok: false, reason: "quota" };
    return { ok: false, reason: "unknown" };
  }
}

export function loadWiedzaAnalyzeFromStorage(): WiedzaAnalyzeCachePayload | null {
  if (typeof window === "undefined") return null;
  return parseWiedzaAnalyzeCache(localStorage.getItem(WIEDZA_ANALYZE_CACHE_KEY));
}
