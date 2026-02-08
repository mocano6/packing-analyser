// src/components/GPSDataSection/GPSDataSection.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { TeamInfo, Player, PlayerMinutes, GPSDataEntry, GPSProvider } from "@/types";
import { analyzeCSVStructure, parseCSV, CSVStructure } from "@/utils/csvAnalyzer";
import { buildPlayersIndex, getPlayerFirstName, getPlayerFullName, getPlayerLabel, getPlayerLastName, sortPlayersByLastName } from "@/utils/playerUtils";
import { getAvailableSeasonsFromMatches, getSeasonForDate } from "@/utils/seasonUtils";
import { getDB } from "@/lib/firebase";
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, getDoc, updateDoc, setDoc } from "@/lib/firestoreWithMetrics";
import { POSITIONS, mapOldPositionToNew } from "@/constants/positions";
import styles from "./GPSDataSection.module.css";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";

// Tooltipy informacyjne STATSports GPS (definicje)
const STATSPORTS_GPS_TOOLTIPS: Record<string, string> = {
  "Distance Zone 4 (Absolute)":
    "Wysoka intensywność aerobowa (19-21 km/h). Monitoruj stabilność między sesjami.",
  "Distance Zone 3 (Absolute)":
    "Średnia intensywność (15-19 km/h). Budowanie bazy tlenowej.",
  "Player Primary Position":
    "Pozycja podstawowa zawodnika. Oczekiwane benchmarki dla danej roli.",
  "Accelerations Zone 5 (Absolute)":
    "Przyspieszenia w bardzo wysokiej intensywności. Wskazuje eksplozywność.",
  "Number Of High Intensity Bursts":
    "Liczba zrywów powyżej 85% max HR. Kluczowe dla pressingu i kontr.",
  "Decelerations Zone 4 (Absolute)":
    "Hamowania w wysokiej intensywności. Praca bez piłki i zmiany kierunku.",
  "HML Efforts":
    "Całkowita liczba wysiłków Wysokich/Średnich/Niskich intensywności.",
  "Max Speed":
    "Szczytowa prędkość sesji. Profil szybkościowy zawodnika.",
  "HML Distance":
    "Suma dystansu Wysokiego/Średniego/Niskiego. Jakość całkowitej pracy.",
  "Duration Of High Intensity Bursts":
    "Całkowity czas pracy anaerobowej podczas zrywów.",
  "Duration Of High Intensity Bursts (s)":
    "Całkowity czas pracy anaerobowej podczas zrywów.",
  Sprints:
    "Sprinty powyżej 25.2 km/h. Maksymalna prędkość wysiłkowa.",
  "Distance Zone 3 - Zone 6 (Absolute)":
    "Suma dystansu wszystkich stref wysokiej intensywności.",
  "High Speed Running (Relative)":
    "HSR na minutę gry. Intensywność względna do czasu.",
  "Sprint Distance":
    "Całkowity dystans pokonany podczas sprintów.",
  "Accelerations (Relative)":
    "Przyspieszenia na minutę. Eksplozywność względna.",
  "Decelerations (Relative)":
    "Hamowania na minutę. Zmiany kierunku względne do czasu.",
  "Session Date":
    "Data ostatniej zarejestrowanej sesji GPS.",
  "Accelerations Zone 4 (Absolute)":
    "Przyspieszenia w strefie wysokiej intensywności.",
  "High Intensity Bursts Maximum Speed":
    "Maksymalna prędkość osiągnięta podczas zrywów.",
  "Distance Zone 2 (Relative)":
    "Dystans średnio-niskiej intensywności na minutę.",
  "Distance Zone 1 (Absolute)":
    "Dystans niskiej intensywności (chodzenie/bieg).",
  "Distance Per Min":
    "Średnia prędkość sesji (m/min). Tempo pracy.",
  "Decelerations Zone 6 (Absolute)":
    "Hamowania maksymalnej intensywności.",
  "High Intensity Bursts Total Distance":
    "Całkowity dystans pokonany podczas zrywów.",
  "Distance Zone 6 (Absolute)":
    "Maksymalna strefa intensywności (>25 km/h).",
  "Total Time":
    "Rzeczywisty czas gry na boisku.",
  "Decelerations Zone 5 (Absolute)":
    "Hamowania bardzo wysokiej intensywności.",
  "Accelerations Zone 6 (Absolute)":
    "Przyspieszenia maksymalnej intensywności.",
  "Distance Zone 5 (Absolute)":
    "Bardzo wysoka intensywność (21-25 km/h).",
  "Total Distance":
    "Całkowity dystans pokonany w sesji.",
};

// Lista znanych metryk per dostawca (wybór metryk na dzień niezależny od wgranych danych)
const KNOWN_METRICS_STATSPORTS = Object.keys(STATSPORTS_GPS_TOOLTIPS);
const KNOWN_METRICS_CATAPULT: string[] = [
  "Player Name", "Period Name", "Date", "Total Distance", "Total Time", "Distance Per Min",
  "Sprints", "Sprint Distance", "Max Speed", "High Speed Running (Relative)", "Accelerations (Relative)",
  "Decelerations (Relative)", "HML Distance", "HML Efforts",
];

function getStatsportsGpsTooltip(metricName: string): string | undefined {
  const direct = STATSPORTS_GPS_TOOLTIPS[metricName];
  if (direct) return direct;

  const normalized = metricName.replace(/\s+\(s\)\s*$/i, "").trim();
  return STATSPORTS_GPS_TOOLTIPS[normalized];
}

function getGpsMetricTooltip(metricName: string, provider: GPSProvider): string | undefined {
  if (provider === "STATSports") return getStatsportsGpsTooltip(metricName);
  return undefined;
}

// Skróty nazw metryk do nagłówków tabeli (pełna nazwa w tooltipie)
const METRIC_SHORT_NAMES: Record<string, string> = {
  "Accelerations (Relative)": "Acc. (rel.)",
  "Accelerations Zone 4 (Absolute)": "Acc. Z4",
  "Accelerations Zone 5 (Absolute)": "Acc. Z5",
  "Accelerations Zone 6 (Absolute)": "Acc. Z6",
  "Decelerations (Relative)": "Dec. (rel.)",
  "Decelerations Zone 4 (Absolute)": "Dec. Z4",
  "Decelerations Zone 5 (Absolute)": "Dec. Z5",
  "Decelerations Zone 6 (Absolute)": "Dec. Z6",
  "Distance Zone 1 (Absolute)": "Dist. Z1",
  "Distance Zone 2 (Relative)": "Dist. Z2 (rel.)",
  "Distance Zone 3 (Absolute)": "Dist. Z3",
  "Distance Zone 3 - Zone 6 (Absolute)": "Dist. Z3–Z6",
  "Distance Zone 4 (Absolute)": "Dist. Z4",
  "Distance Zone 5 (Absolute)": "Dist. Z5",
  "Distance Zone 6 (Absolute)": "Dist. Z6",
  "Distance Per Min": "Dist./min",
  "Duration Of High Intensity Bursts": "Dur. HIB",
  "Duration Of High Intensity Bursts (s)": "Dur. HIB (s)",
  "High Intensity Bursts Maximum Speed": "HIB Max Speed",
  "High Intensity Bursts Total Distance": "HIB Total Dist.",
  "High Speed Running (Relative)": "HSR (rel.)",
  "HML Distance": "HML Dist.",
  "HML Efforts": "HML Efforts",
  "Max Speed": "Max Speed",
  "Number Of High Intensity Bursts": "No. HIB",
  "Player Primary Position": "Position",
  "Session Date": "Session Date",
  "Sprint Distance": "Sprint Dist.",
  "Sprints": "Sprints",
  "Total Distance": "Total Dist.",
  "Total Time": "Total Time",
};

// Tylko dla Max Speed w agregacji (wiersz Zespół / Suma) bierzemy max — sumowanie prędkości maksymalnych nie ma sensu
const MAX_AGGREGATION_METRIC = "Max Speed";
// Metryki, dla których przy wielu meczach i w wierszu Zespół pokazujemy średnią z wartości (nie sumę)
const AVG_AGGREGATION_METRICS = new Set<string>([
  "Distance Per Min",
  "High Speed Running (Relative)",
  "Accelerations (Relative)",
  "Decelerations (Relative)",
  "Distance Zone 2 (Relative)",
  "Distance Zone 1 (Relative)",
]);

/** Minimalny czas gry w meczu (minuty), aby mecz mógł być dodany do „Mecze do targetu”. */
const MIN_MATCH_MINUTES = 75;

function getMetricShortLabel(metricName: string): string {
  return METRIC_SHORT_NAMES[metricName] ?? (metricName.length > 20 ? metricName.slice(0, 18) + "…" : metricName);
}

function getMetricHeaderTitle(
  metricName: string,
  provider: GPSProvider,
  combinedMetrics?: Record<string, CombinedMetricDef>
): string {
  const combinedDef = combinedMetrics?.[metricName];
  if (combinedDef?.definition?.trim()) return `${metricName}\n\n${combinedDef.definition.trim()}`;
  const desc = getGpsMetricTooltip(metricName, provider);
  return desc ? `${metricName}\n\n${desc}` : metricName;
}

export type CombinedOperation = "sum" | "diff" | "ratio" | "product";
export interface CombinedMetricDef {
  parts: string[];
  operation: CombinedOperation;
  /** Opcjonalny opis wyświetlany w tooltipie w tabelach */
  definition?: string;
}

/** Zwraca wartość metryki z data: dla połączonej metryki — wynik operacji na składnikach, inaczej data[metric]. */
function getMetricValue(data: Record<string, unknown>, metric: string, combinedMetrics: Record<string, CombinedMetricDef>): unknown {
  const def = combinedMetrics[metric];
  if (def?.parts?.length) {
    const nums = def.parts.map((key) => {
      const v = data[key];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isNaN(n) ? 0 : n;
    });
    if (def.operation === "sum") return nums.reduce((a, b) => a + b, 0);
    if (def.operation === "product") return nums.reduce((a, b) => a * b, 1);
    if (def.operation === "diff") return nums.length >= 1 ? nums.slice(1).reduce((acc, n) => acc - n, nums[0]) : 0;
    if (def.operation === "ratio" && nums.length === 2) return nums[1] !== 0 ? nums[0] / nums[1] : 0;
    if (def.operation === "ratio") return nums[0];
    return nums.reduce((a, b) => a + b, 0);
  }
  return data[metric];
}

/** Parsuje Total Time z CSV (np. "01:02:41" lub "62:41") na minuty (liczba). */
function parseTotalTimeToMinutes(totalTime: unknown): number | undefined {
  if (totalTime == null || totalTime === "") return undefined;
  const s = String(totalTime).trim();
  const num = Number(s);
  if (!Number.isNaN(num)) return num >= 0 ? num : undefined;
  const parts = s.split(/[:\s]+/).map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n));
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (parts.length === 1) return parts[0];
  return undefined;
}

const GPS_DAY_KEYS = ["MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2", "MD+3"] as const;
type GPSDayKey = (typeof GPS_DAY_KEYS)[number];

const GPS_DATA_COLLECTION = "gps";
const GPS_NORMS_COLLECTION = "gps_norms";

interface GPSDataSectionProps {
  players: Player[];
  allAvailableTeams?: { id: string; name: string; logo?: string }[];
}

interface GPSDataRow {
  [key: string]: string;
}

const GPSDataSection: React.FC<GPSDataSectionProps> = ({ 
  players,
  allAvailableTeams = []
}) => {
  const providers: Array<{ value: GPSProvider; label: string }> = [
    { value: "STATSports", label: "STATSports" },
    { value: "Catapult", label: "Catapult" },
  ];
  const [selectedProvider, setSelectedProvider] = useState<GPSProvider>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gps_selected_provider_global");
      if (saved === "STATSports" || saved === "Catapult") return saved;
    }
    return "STATSports";
  });

  const dayOptions: Array<{ value: string; label: string }> = [
    { value: "MD-4", label: "MD-4 — 4 dni przed meczem" },
    { value: "MD-3", label: "MD-3 — 3 dni przed meczem" },
    { value: "MD-2", label: "MD-2 — 2 dni przed meczem" },
    { value: "MD-1", label: "MD-1 — 1 dzień przed meczem" },
    { value: "MD", label: "MD — Dzień meczu" },
    { value: "MD+1", label: "MD+1 — 1 dzień po meczu" },
    { value: "MD+2", label: "MD+2 — 2 dni po meczu" },
    { value: "MD+3", label: "MD+3 — 3 dni po meczu" },
  ];

  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedTeam') || "";
    }
    return "";
  });

  // Zapamiętaj / przywróć ostatnio wybranego dostawcę per zespół
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = selectedTeam ? `gps_selected_provider_${selectedTeam}` : "gps_selected_provider_global";
    const saved = localStorage.getItem(key);
    if ((saved === "STATSports" || saved === "Catapult") && saved !== selectedProvider) {
      setSelectedProvider(saved);
    }
  }, [selectedTeam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = selectedTeam ? `gps_selected_provider_${selectedTeam}` : "gps_selected_provider_global";
    localStorage.setItem(key, selectedProvider);
    localStorage.setItem("gps_selected_provider_global", selectedProvider);
  }, [selectedProvider, selectedTeam]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format YYYY-MM-DD
  });
  const [gpsDateRangeStart, setGpsDateRangeStart] = useState<string>("");
  const [gpsDateRangeEnd, setGpsDateRangeEnd] = useState<string>("");
  const [csvData, setCsvData] = useState<GPSDataRow[]>([]);
  const [csvStructure, setCsvStructure] = useState<CSVStructure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("MD");
  const providerCSVConfig = React.useMemo(() => {
    if (selectedProvider === "Catapult") {
      return {
        playerNameColumn: "Player Name",
        periodColumn: "Period Name",
        dateColumn: "Date",
      };
    }
    // STATSports (domyślnie)
    return {
      playerNameColumn: "Player Name",
      periodColumn: "Drill Title",
      dateColumn: "Session Date",
    };
  }, [selectedProvider]);

  const playerNameColumn = providerCSVConfig.playerNameColumn;
  const periodColumn = providerCSVConfig.periodColumn;
  const dateColumn = providerCSVConfig.dateColumn;
  const [mappedPlayers, setMappedPlayers] = useState<Array<{
    playerName: string;
    rows: GPSDataRow[];
    player: Player | null;
    matched: boolean;
    manualPlayerId?: string; // Dla ręcznego wyboru zawodnika
  }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"data" | "norms" | "table" | "player">("norms");
  const [expandedGPSEntries, setExpandedGPSEntries] = useState<Set<string>>(new Set());
  const [editingAssignmentEntryId, setEditingAssignmentEntryId] = useState<string | null>(null);
  const [reassignPlayerId, setReassignPlayerId] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [batchDayValue, setBatchDayValue] = useState<string>("MD");
  const [isSavingBatchDay, setIsSavingBatchDay] = useState(false);

  const playersIndex = React.useMemo(() => buildPlayersIndex(players), [players]);

  const [gpsDataFromFirebase, setGpsDataFromFirebase] = useState<any[]>([]);
  const [isLoadingGPSData, setIsLoadingGPSData] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"firstHalf" | "secondHalf" | "total">("total");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastLoadedFileKeyRef = useRef<string | null>(null);

  // Domyślna wartość „Dzień dla wszystkich” = najczęstszy dzień w aktualnie wyświetlanych wpisach
  useEffect(() => {
    if (gpsDataFromFirebase.length === 0) return;
    const days = gpsDataFromFirebase.map((e: any) => e.day).filter(Boolean) as string[];
    if (days.length === 0) return;
    const counts: Record<string, number> = {};
    days.forEach((d) => { counts[d] = (counts[d] ?? 0) + 1; });
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? days[0];
    setBatchDayValue(mostCommon);
  }, [gpsDataFromFirebase]);

  // Metryki na dzień: które dane wyświetlać dla danego dnia treningowego (MD) — zapis per zespół
  const normsStorageKey = (teamId: string) => `gps_norms_${teamId || "global"}`;
  const [selectedNormsForDay, setSelectedNormsForDay] = useState<Record<string, string[]>>({});
  const [selectedDayNorms, setSelectedDayNorms] = useState<string>("MD");
  const [normsSaveFeedback, setNormsSaveFeedback] = useState(false);
  // Połączone metryki: nazwa → { parts, operation }
  const [combinedMetrics, setCombinedMetrics] = useState<Record<string, CombinedMetricDef>>({});
  const [newCombinedName, setNewCombinedName] = useState("");
  const [newCombinedParts, setNewCombinedParts] = useState<string[]>([]);
  const [newCombinedOperation, setNewCombinedOperation] = useState<CombinedOperation>("sum");
  const [newCombinedDefinition, setNewCombinedDefinition] = useState("");
  const [editingCombinedName, setEditingCombinedName] = useState<string | null>(null);
  const combinedMetricsCardRef = useRef<HTMLDivElement>(null);
  const [combinedMetricsModalOpen, setCombinedMetricsModalOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const MAX_COMBINED_PARTS = 6;
  const COMBINED_OPERATIONS: { value: CombinedOperation; label: string }[] = [
    { value: "sum", label: "Suma" },
    { value: "diff", label: "Różnica" },
    { value: "ratio", label: "Iloraz" },
    { value: "product", label: "Iloczyn" },
  ];

  // Tabela zespołu: filtr pozycji i dnia
  const [selectedPositionTable, setSelectedPositionTable] = useState<string>("");
  const [selectedDayTable, setSelectedDayTable] = useState<string>("MD");
  // Dla MD: lista meczów zespołu, tylko mecze z danymi GPS (day MD), wybrane mecze (multi), zagregowane dane
  const [teamMatches, setTeamMatches] = useState<Array<{ matchId: string; dateStr: string; opponent: string }>>([]);
  const [datesWithMDData, setDatesWithMDData] = useState<string[]>([]);
  const [selectedTableMatchIds, setSelectedTableMatchIds] = useState<string[]>([]);
  const [tableGPSDataForMD, setTableGPSDataForMD] = useState<any[]>([]);
  const [isLoadingTableMD, setIsLoadingTableMD] = useState(false);
  const [playerMinutesForTableMD, setPlayerMinutesForTableMD] = useState<Record<string, number>>({});
  const [tablePanelExpanded, setTablePanelExpanded] = useState(false);
  const [tableMatchesDropdownOpen, setTableMatchesDropdownOpen] = useState(false);
  const tableMatchesDropdownRef = useRef<HTMLDivElement>(null);
  const [tableSort, setTableSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });
  const [playerTableSort, setPlayerTableSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });

  useEffect(() => {
    if (!tableMatchesDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (tableMatchesDropdownRef.current && !tableMatchesDropdownRef.current.contains(e.target as Node)) setTableMatchesDropdownOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [tableMatchesDropdownOpen]);

  // Tabela zawodnika: wybór zawodnika i filtr dnia treningowego
  const [selectedPlayerForTable, setSelectedPlayerForTable] = useState<string>("");
  const [selectedDayFilterForPlayer, setSelectedDayFilterForPlayer] = useState<string>("all");
  const [lastXDaysPlayer, setLastXDaysPlayer] = useState<string>("");
  const [playerTableData, setPlayerTableData] = useState<any[]>([]);
  const [isLoadingPlayerTable, setIsLoadingPlayerTable] = useState(false);
  const [playerMinutesForPlayerView, setPlayerMinutesForPlayerView] = useState<Record<string, number>>({});
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [playerTargetMatches, setPlayerTargetMatches] = useState<Record<string, string[]>>({});
  const [targetMatchDateStrs, setTargetMatchDateStrs] = useState<string[]>([]);
  const [savingTargetMatches, setSavingTargetMatches] = useState(false);

  const [expandedStructure, setExpandedStructure] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState(false);

  // Lista metryk do wyboru w „Metryki na dzień”: z danych GPS lub stała lista dla dostawcy
  const availableMetricsForNorms = React.useMemo(() => {
    const fromData = new Set<string>();
    gpsDataFromFirebase.forEach((entry) => {
      ["total", "firstHalf", "secondHalf"].forEach((period) => {
        const data = entry[period] as Record<string, unknown> | undefined;
        if (data && typeof data === "object") Object.keys(data).forEach((k) => fromData.add(k));
      });
    });
    const fromDataArr = Array.from(fromData).sort();
    if (fromDataArr.length > 0) return fromDataArr;
    return selectedProvider === "Catapult" ? [...KNOWN_METRICS_CATAPULT].sort() : [...KNOWN_METRICS_STATSPORTS].sort();
  }, [gpsDataFromFirebase, selectedProvider]);

  // Załaduj wybór metryk na dzień: Firebase (gps_norms/{teamId}), potem localStorage (cache)
  useEffect(() => {
    if (typeof window === "undefined" || !selectedTeam) {
      setSelectedNormsForDay({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const db = getDB();
        const docRef = doc(db, GPS_NORMS_COLLECTION, selectedTeam);
        const snap = await getDoc(docRef);
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const norms = (data.norms as Record<string, string[]>) || {};
          setSelectedNormsForDay(norms);
          const raw = (data.combinedMetrics as Record<string, CombinedMetricDef | string[]>) || {};
          const normalized: Record<string, CombinedMetricDef> = {};
          Object.entries(raw).forEach(([name, val]) => {
            if (Array.isArray(val)) normalized[name] = { parts: val, operation: "sum" };
            else if (val && typeof val === "object" && "parts" in val) {
              const v = val as CombinedMetricDef & { definition?: string };
              normalized[name] = { parts: v.parts, operation: v.operation ?? "sum", definition: v.definition };
            }
          });
          setCombinedMetrics(normalized);
          const ptm = (data.playerTargetMatches as Record<string, string[]>) || {};
          setPlayerTargetMatches(ptm);
          try {
            localStorage.setItem(normsStorageKey(selectedTeam), JSON.stringify(norms));
          } catch (_) {}
        } else {
          const saved = localStorage.getItem(normsStorageKey(selectedTeam));
          setSelectedNormsForDay(saved ? (JSON.parse(saved) as Record<string, string[]>) : {});
          setCombinedMetrics({});
          setPlayerTargetMatches({});
        }
      } catch (_) {
        if (cancelled) return;
        try {
          const saved = localStorage.getItem(normsStorageKey(selectedTeam));
          setSelectedNormsForDay(saved ? (JSON.parse(saved) as Record<string, string[]>) : {});
        } catch (__) {
          setSelectedNormsForDay({});
        }
        setCombinedMetrics({});
        setPlayerTargetMatches({});
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedTeam]);

  useEffect(() => {
    setTargetMatchDateStrs(selectedPlayerForTable ? (playerTargetMatches[selectedPlayerForTable] ?? []) : []);
  }, [selectedPlayerForTable, playerTargetMatches]);

  // Cache: zapis zaznaczonych opcji w localStorage przy każdej zmianie (bez czekania na Firebase)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(normsStorageKey(selectedTeam), JSON.stringify(selectedNormsForDay));
    } catch (_) {}
  }, [selectedNormsForDay, selectedTeam]);

  const [normsSaving, setNormsSaving] = useState(false);
  const saveNormsToFirebase = async () => {
    if (!selectedTeam) return;
    setNormsSaving(true);
    setNormsSaveFeedback(false);
    try {
      const db = getDB();
      await setDoc(doc(db, GPS_NORMS_COLLECTION, selectedTeam), {
        norms: selectedNormsForDay,
        combinedMetrics,
        updatedAt: new Date().toISOString(),
      });
      setNormsSaveFeedback(true);
      setTimeout(() => setNormsSaveFeedback(false), 2000);
    } catch (_) {
      setError("Nie udało się zapisać norm do Firebase.");
    } finally {
      setNormsSaving(false);
    }
  };

  const saveTargetMatchesToFirebase = async () => {
    if (!selectedTeam || !selectedPlayerForTable || targetMatchDateStrs.length < 1 || targetMatchDateStrs.length > 5) return;
    setSavingTargetMatches(true);
    setError(null);
    try {
      const db = getDB();
      const docRef = doc(db, GPS_NORMS_COLLECTION, selectedTeam);
      const next = { ...playerTargetMatches, [selectedPlayerForTable]: targetMatchDateStrs };
      await setDoc(docRef, { playerTargetMatches: next, updatedAt: new Date().toISOString() }, { merge: true });
      setPlayerTargetMatches(next);
    } catch (err) {
      setError("Nie udało się zapisać meczów do targetu.");
    } finally {
      setSavingTargetMatches(false);
    }
  };

  const toggleNormForDay = (day: string, metric: string) => {
    setSelectedNormsForDay((prev) => {
      const list = prev[day] ?? [];
      const next = list.includes(metric) ? list.filter((m) => m !== metric) : [...list, metric];
      return { ...prev, [day]: next };
    });
  };

  const normsForSelectedDay = selectedNormsForDay[selectedDayNorms] ?? [];
  const normsForTableDaySorted = React.useMemo(
    () => [...(selectedNormsForDay[selectedDayTable] ?? [])].sort((a, b) => a.localeCompare(b)),
    [selectedNormsForDay, selectedDayTable]
  );

  // Minuty gry z meczu (dla wybranej daty i zespołu) — używane w tabeli GPS
  const [playerMinutesFromMatch, setPlayerMinutesFromMatch] = useState<Record<string, number>>({});
  const [tablePerMinute, setTablePerMinute] = useState(false);

  useEffect(() => {
    if (!selectedTeam || !selectedDate) {
      setPlayerMinutesFromMatch({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const db = getDB();
        const q = query(
          collection(db, "matches"),
          where("team", "==", selectedTeam),
          orderBy("date", "desc")
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const toDateStr = (v: unknown): string => {
          if (!v) return "";
          if (typeof v === "string") return v.slice(0, 10);
          if (typeof (v as { toDate?: () => Date }).toDate === "function") return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
          return String(v).slice(0, 10);
        };
        const match = snap.docs
          .map((d) => ({ matchId: d.id, ...d.data() } as TeamInfo))
          .find((m) => toDateStr(m.date) === selectedDate.slice(0, 10));
        if (!match?.playerMinutes?.length) {
          setPlayerMinutesFromMatch({});
          return;
        }
        const byPlayer: Record<string, number> = {};
        (match.playerMinutes as PlayerMinutes[]).forEach((pm) => {
          const mins = (pm.endMinute ?? pm.startMinute) - (pm.startMinute ?? 0) + 1;
          byPlayer[pm.playerId] = (byPlayer[pm.playerId] ?? 0) + mins;
        });
        setPlayerMinutesFromMatch(byPlayer);
      } catch (_) {
        if (!cancelled) setPlayerMinutesFromMatch({});
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedTeam, selectedDate]);

  // Dane tabeli zespołu: dla MD używamy tableGPSDataForMD i playerMinutesForTableMD, inaczej gpsDataFromFirebase
  const { tableEntriesForDay, tableTeamSums, tableTeamAvgs, tableEntryCount } = React.useMemo(() => {
    const isMD = selectedDayTable === "MD";
    const source = isMD ? tableGPSDataForMD : gpsDataFromFirebase;
    const matchMinutes = isMD ? playerMinutesForTableMD : playerMinutesFromMatch;
    let entries = source.filter((e: any) => e.day === selectedDayTable);
    if (selectedPositionTable) {
      entries = entries.filter((e: any) => {
        const p = players.find((x) => x.id === e.playerId);
        const pos = p?.position ? mapOldPositionToNew(p.position) : p?.position;
        return pos === selectedPositionTable || p?.position === selectedPositionTable;
      });
    }
    let totalMinutes = 0;
    const metrics: Record<string, number> = {};
    const avgAccum: Record<string, { s: number; n: number }> = {};
    const sumForAvg: Record<string, number> = {};
    normsForTableDaySorted.forEach((m) => {
      metrics[m] = m === MAX_AGGREGATION_METRIC ? -Infinity : 0;
      if (AVG_AGGREGATION_METRICS.has(m)) avgAccum[m] = { s: 0, n: 0 };
      sumForAvg[m] = 0;
    });
    entries.forEach((entry: any) => {
      const data = entry.total ?? {};
      const minsFromMatch = matchMinutes[entry.playerId];
      const totalTimeRaw = data["Total Time"];
      const minsFromCsv = parseTotalTimeToMinutes(totalTimeRaw);
      const divisorMins = isMD ? minsFromMatch : minsFromCsv;
      if (typeof divisorMins === "number" && !Number.isNaN(divisorMins)) totalMinutes += divisorMins;
      normsForTableDaySorted.forEach((metric) => {
        const v = getMetricValue(data, metric, combinedMetrics);
        const num = typeof v === "number" && !Number.isNaN(v) ? v : Number(v);
        if (Number.isNaN(num)) return;
        if (metric === MAX_AGGREGATION_METRIC) {
          metrics[metric] = Math.max(metrics[metric] === -Infinity ? -Infinity : metrics[metric], num);
        } else if (AVG_AGGREGATION_METRICS.has(metric)) {
          avgAccum[metric].s += num;
          avgAccum[metric].n += 1;
        } else {
          metrics[metric] = (metrics[metric] ?? 0) + num;
        }
        sumForAvg[metric] = (sumForAvg[metric] ?? 0) + num;
      });
    });
    const metricsFinal: Record<string, number> = {};
    const metricsAvg: Record<string, number> = {};
    const n = entries.length;
    normsForTableDaySorted.forEach((m) => {
      if (AVG_AGGREGATION_METRICS.has(m) && avgAccum[m]?.n > 0) {
        metricsFinal[m] = avgAccum[m].s / avgAccum[m].n;
      } else {
        metricsFinal[m] = metrics[m] === -Infinity || metrics[m] == null ? NaN : metrics[m];
      }
      metricsAvg[m] = n > 0 && Number.isFinite(sumForAvg[m]) ? sumForAvg[m] / n : NaN;
    });
    return {
      tableEntriesForDay: entries,
      tableTeamSums: { totalMinutes, metrics: metricsFinal },
      tableTeamAvgs: { avgMinutes: n > 0 ? totalMinutes / n : 0, metrics: metricsAvg },
      tableEntryCount: n,
    };
  }, [
    gpsDataFromFirebase,
    tableGPSDataForMD,
    selectedDayTable,
    selectedPositionTable,
    players,
    playerMinutesFromMatch,
    playerMinutesForTableMD,
    normsForTableDaySorted,
    combinedMetrics,
  ]);

  // Funkcja do normalizacji polskich znaków - zamienia znaki zapytania na możliwe polskie znaki
  // Używa kontekstu do określenia, który polski znak powinien być użyty
  const normalizePolishChars = (text: string): string => {
    let result = text;
    
    // Zamień znaki zapytania na podstawie kontekstu
    // Wzorce dla małych liter
    result = result
      .replace(/l\?/g, 'ł') // l? -> ł (np. "?ukasz" -> "Łukasz" będzie obsłużone dalej)
      .replace(/\?l/g, 'ł') // ?l -> ł
      .replace(/a\?/g, 'ą') // a? -> ą
      .replace(/e\?/g, 'ę') // e? -> ę
      .replace(/o\?/g, 'ó') // o? -> ó
      .replace(/c\?/g, 'ć') // c? -> ć
      .replace(/n\?/g, 'ń') // n? -> ń
      .replace(/s\?/g, 'ś') // s? -> ś
      .replace(/z\?/g, 'ź') // z? -> ź
      .replace(/\?z/g, 'ż'); // ?z -> ż
    
    // Wzorce dla wielkich liter (na początku słowa)
    result = result
      .replace(/\?([a-z])/g, (match, next) => {
        // Jeśli ? jest na początku słowa, może być Ł
        if (next === 'u' || next === 'U') return 'Ł' + next;
        // Dla innych przypadków spróbuj najczęstszych
        return 'Ł' + next;
      })
      .replace(/\?([A-Z])/g, (match, next) => {
        if (next === 'U') return 'Ł' + next;
        return 'Ł' + next;
      });
    
    // Zamień pozostałe znaki zapytania na najczęstsze polskie znaki
    // (to jest fallback - lepiej niż nic)
    result = result
      .replace(/\?/g, 'ł'); // Domyślnie ? -> ł (najczęstszy przypadek)
    
    return result;
  };

  // Funkcja do fuzzy matching nazw z polskimi znakami - bardziej restrykcyjna
  const fuzzyMatchNames = (name1: string, name2: string): boolean => {
    const normalize = (str: string) => normalizePolishChars(str.toLowerCase().trim());
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    // 1. Dokładne dopasowanie po normalizacji
    if (n1 === n2) return true;
    
    // 2. Dopasowanie bez normalizacji (dla przypadków bez polskich znaków)
    const original1 = name1.toLowerCase().trim();
    const original2 = name2.toLowerCase().trim();
    if (original1 === original2) return true;
    
    // 3. Dopasowanie słowo po słowie - bardziej restrykcyjne
    const words1 = n1.split(/\s+/).filter(w => w.length > 2); // Tylko słowa dłuższe niż 2 znaki
    const words2 = n2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    // Wymagamy, aby przynajmniej 2 słowa się zgadzały (dla imienia i nazwiska)
    let matchingWords = 0;
    words1.forEach(w1 => {
      if (words2.some(w2 => {
        // Dokładne dopasowanie słowa
        if (w1 === w2) return true;
        // Dopasowanie jeśli jedno słowo zawiera drugie i różnica długości <= 2
        if ((w1.includes(w2) || w2.includes(w1)) && Math.abs(w1.length - w2.length) <= 2) {
          return true;
        }
        return false;
      })) {
        matchingWords++;
      }
    });
    
    // Wymagamy przynajmniej 2 dopasowanych słów lub wszystkie słowa jeśli jest ich mniej
    const minMatches = Math.min(words1.length, words2.length, 2);
    return matchingWords >= minMatches;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Proszę wybrać plik CSV');
      return;
    }

    const fileKey = `${file.name}-${file.size}`;
    if (lastLoadedFileKeyRef.current === fileKey) {
      setError('Ten plik jest już wczytany. Wybierz inny plik lub wyczyść i wczytaj ponownie.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileName(file.name);
    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();

      let processedText = text;
      let catapultMetaDate: string | null = null;

      // Catapult: często ma nagłówki-metadata przed tabelą + delimiter ";"
      if (selectedProvider === "Catapult") {
        const rawLines = text.split("\n");
        const headerIdx = rawLines.findIndex((l) => {
          const t = l.trim().toLowerCase();
          return t.startsWith("player name") && t.includes("period name");
        });
        if (headerIdx >= 0) {
          processedText = rawLines.slice(headerIdx).join("\n");
        }

        // Spróbuj odczytać datę z metadanych (np. linia zaczynająca się od "Date:")
        const dateLine = rawLines.find((l) => l.trim().toLowerCase().startsWith("date:"));
        if (dateLine) {
          const parts = dateLine.split(";");
          const raw = (parts[1] || "").trim();
          if (raw) {
            // Obsłuż YYYY-MM-DD oraz DD/MM/YYYY
            const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
            const dmyMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (isoMatch) {
              catapultMetaDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
            } else if (dmyMatch) {
              catapultMetaDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
            }
          }
        }
      }
      
      // Analizuj strukturę CSV
      const structure = analyzeCSVStructure(processedText);

      // Walidacja kolumn per provider
      const requiredColumns =
        selectedProvider === "Catapult"
          ? [playerNameColumn, periodColumn]
          : [playerNameColumn, periodColumn];
      const missing = requiredColumns.filter((c) => !structure.headers.includes(c));
      if (missing.length > 0) {
        throw new Error(`Brakuje kolumny/kolumn: ${missing.join(", ")} (dostawca: ${selectedProvider})`);
      }
      setCsvStructure(structure);

      // Parsuj dane
      const parsed = parseCSV(processedText);
      setCsvData(parsed);
      lastLoadedFileKeyRef.current = fileKey;

      // Automatycznie wykryj datę z kolumny dateColumn (jeśli istnieje)
      if (parsed.length > 0 && parsed[0][dateColumn]) {
        const rawDate = parsed[0][dateColumn];
        try {
          const dateMatch = rawDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            const [, day, month, year] = dateMatch;
            setSelectedDate(`${year}-${month}-${day}`);
          } else {
            const isoMatch = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              setSelectedDate(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
            }
          }
        } catch (e) {
          console.log("Nie udało się sparsować daty z CSV:", rawDate);
        }
      } else if (selectedProvider === "Catapult" && catapultMetaDate) {
        // jeśli nie ma kolumny Date w tabeli, ale metadane zawierają datę
        setSelectedDate(catapultMetaDate);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd podczas odczytywania pliku CSV';
      setError(errorMessage);
      setCsvStructure(null);
      setCsvData([]);
      lastLoadedFileKeyRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = () => {
    setCsvData([]);
    setCsvStructure(null);
    setFileName(null);
    lastLoadedFileKeyRef.current = null;
    setError(null);
    setSelectedDay("MD");
    setMappedPlayers([]);
    setSaveSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Kolumny są na stałe zdefiniowane - nie ma potrzeby automatycznego wykrywania

  // Zapisz selectedTeam do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedTeam) {
      localStorage.setItem('selectedTeam', selectedTeam);
    }
  }, [selectedTeam]);

  // Automatyczne mapowanie wszystkich zawodników z CSV - grupowanie po nazwie zawodnika
  useEffect(() => {
    if (csvData.length > 0 && playerNameColumn && selectedTeam) {
      const teamPlayers = players.filter(p => 
        selectedTeam && (p.teams?.includes(selectedTeam) || p.teamId === selectedTeam)
      );

      // Grupuj wiersze po nazwie zawodnika z CSV
      const groupedByPlayerName: Record<string, GPSDataRow[]> = {};
      csvData.forEach(csvRow => {
        const playerName = String(csvRow[playerNameColumn] || '').trim();
        if (playerName) {
          if (!groupedByPlayerName[playerName]) {
            groupedByPlayerName[playerName] = [];
          }
          groupedByPlayerName[playerName].push(csvRow);
        }
      });

      // Mapuj każdą grupę zawodników po imieniu/nazwisku
      const mapped = Object.entries(groupedByPlayerName).map(([playerName, rows]) => {
        let matchedPlayer: Player | null = null;

        // Najpierw spróbuj dokładnego dopasowania (bez normalizacji)
        const csvNameLower = playerName.toLowerCase().trim();
        matchedPlayer = teamPlayers.find(p => {
          const fullName = getPlayerFullName(p).toLowerCase().trim();
          // Dokładne dopasowanie
          if (fullName === csvNameLower) return true;
          // Dopasowanie z normalizacją polskich znaków
          const normalizedCsv = normalizePolishChars(csvNameLower);
          const normalizedFull = normalizePolishChars(fullName);
          if (normalizedFull === normalizedCsv) return true;
          return false;
        }) || null;

        // Jeśli nie znaleziono dokładnego dopasowania, użyj fuzzy matching (ale tylko jako fallback)
        if (!matchedPlayer) {
          // Użyj fuzzy matching tylko jeśli nazwy są podobne (przynajmniej 70% podobieństwa)
          const candidates = teamPlayers.filter(p => {
            const fullName = getPlayerFullName(p);
            return fuzzyMatchNames(playerName, fullName);
          });
          
          // Jeśli jest tylko jeden kandydat, użyj go
          // Jeśli jest więcej, nie dopasowuj automatycznie (użytkownik wybierze ręcznie)
          if (candidates.length === 1) {
            matchedPlayer = candidates[0];
          }
        }

        return {
          playerName,
          rows,
          player: matchedPlayer,
          matched: matchedPlayer !== null,
        };
      });

      setMappedPlayers(mapped);
    } else {
      setMappedPlayers([]);
    }
  }, [csvData, playerNameColumn, players, selectedTeam, selectedProvider]);

  // Funkcja do ręcznego przypisania zawodnika
  const handleManualPlayerSelect = (playerName: string, playerId: string) => {
    setMappedPlayers(prev => prev.map(mp => {
      if (mp.playerName === playerName) {
        const selectedPlayer = players.find(p => p.id === playerId);
        // Jeśli wybrano pustą wartość, przywróć oryginalne dopasowanie (jeśli było)
        if (!playerId && mp.player) {
          return {
            ...mp,
            manualPlayerId: undefined,
          };
        }
        return {
          ...mp,
          player: selectedPlayer || null,
          matched: selectedPlayer !== null,
          manualPlayerId: playerId || undefined,
        };
      }
      return mp;
    }));
  };

  // Funkcja do wyodrębnienia danych dla I połowy, II połowy i globalnie na podstawie Period/Drill
  const extractGPSDataByPeriod = (rows: GPSDataRow[]) => {
    const firstHalf: Record<string, any> = {};
    const secondHalf: Record<string, any> = {};
    const total: Record<string, any> = {};

    if (!csvStructure || !periodColumn) return { firstHalf, secondHalf, total };

    // Znajdź wiersze dla każdej połowy
    const firstHalfRow = rows.find(row => {
      const periodName = String(row[periodColumn] || '').toLowerCase().trim();
      if (selectedProvider === "Catapult") {
        return (
          periodName.includes("first half") ||
          periodName.includes("1st half") ||
          periodName.includes("1 half") ||
          periodName.includes("i połowa") ||
          periodName.includes("1 połowa")
        );
      }
      return periodName.includes('i połowa') || periodName.includes('i po?owa') || 
             periodName.includes('1 połowa') || periodName.includes('1 po?owa') ||
             periodName.includes('first half') || periodName === 'i po?owa' ||
             periodName === 'i połowa';
    });

    const secondHalfRow = rows.find(row => {
      const periodName = String(row[periodColumn] || '').toLowerCase().trim();
      if (selectedProvider === "Catapult") {
        return (
          periodName.includes("second half") ||
          periodName.includes("2nd half") ||
          periodName.includes("2 half") ||
          periodName.includes("ii połowa") ||
          periodName.includes("2 połowa")
        );
      }
      return periodName.includes('ii połowa') || periodName.includes('ii po?owa') ||
             periodName.includes('2 połowa') || periodName.includes('2 po?owa') ||
             periodName.includes('second half') || periodName === 'ii po?owa' ||
             periodName === 'ii połowa';
    });

    const totalRow = rows.find(row => {
      const periodName = String(row[periodColumn] || '').toLowerCase().trim();
      if (selectedProvider === "Catapult") {
        return (
          periodName.includes("total") ||
          periodName.includes("full") ||
          periodName.includes("entire") ||
          periodName.includes("match") ||
          periodName.includes("game") ||
          periodName.includes("session")
        );
      }
      return periodName.includes('entire session') || periodName.includes('cały mecz') ||
             periodName.includes('full match') || periodName.includes('total') ||
             periodName === 'entire session';
    });

    // Catapult: jeśli nie ma połów, a jest tylko jeden wiersz, traktuj go jako total
    const fallbackTotalRow = !totalRow && !firstHalfRow && !secondHalfRow && rows.length === 1 ? rows[0] : null;

    // Wyodrębnij dane z odpowiednich wierszy
    [firstHalfRow, secondHalfRow, totalRow || fallbackTotalRow].forEach((row, index) => {
      if (!row) return;

      const target = index === 0 ? firstHalf : index === 1 ? secondHalf : total;

      csvStructure.headers.forEach(header => {
        // Pomijamy kolumny z identyfikacją zawodnika i nazwy okresu
        if (header === playerNameColumn || header === periodColumn) {
          return;
        }

        const value = row[header];
        if (value !== undefined && value !== null && value !== '') {
          target[header] = value;
        }
      });
    });

    return { firstHalf, secondHalf, total };
  };

  const handleSaveToFirebase = async () => {
    if (!selectedTeam) {
      setError("Wybierz zespół przed zapisem danych GPS.");
      return;
    }

    if (!selectedDate) {
      setError("Wybierz datę przed zapisem danych GPS.");
      return;
    }

    if (mappedPlayers.length === 0) {
      setError("Brak zmapowanych zawodników. Sprawdź mapowanie kolumn.");
      return;
    }

    const matchedPlayers = mappedPlayers.filter(mp => mp.player || mp.manualPlayerId);
    if (matchedPlayers.length === 0) {
      setError("Nie znaleziono żadnych dopasowanych zawodników. Sprawdź mapowanie kolumn lub wybierz zawodników ręcznie.");
      return;
    }

    const db = getDB();

    // Sprawdź, którzy zawodnicy mają już dane na ten dzień (teamId + date)
    const existingQuery = query(
      collection(db, GPS_DATA_COLLECTION),
      where("teamId", "==", selectedTeam),
      where("date", "==", selectedDate)
    );
    const existingSnap = await getDocs(existingQuery);
    const existingByPlayerId: Record<string, string> = {};
    existingSnap.forEach((docSnap) => {
      const playerId = docSnap.data().playerId;
      if (playerId) existingByPlayerId[playerId] = docSnap.id;
    });

    const playersWithExisting: { playerId: string; finalPlayer: NonNullable<Player> }[] = [];
    for (const { rows, player, manualPlayerId } of matchedPlayers) {
      const finalPlayer = manualPlayerId
        ? players.find(p => p.id === manualPlayerId) || player
        : player;
      if (finalPlayer && existingByPlayerId[finalPlayer.id])
        playersWithExisting.push({ playerId: finalPlayer.id, finalPlayer });
    }

    if (playersWithExisting.length > 0) {
      const names = playersWithExisting.map(({ finalPlayer }) => getPlayerLabel(finalPlayer.id, playersIndex)).join(", ");
      const confirmed = window.confirm(
        `Następujący zawodnicy mają już zapisane dane na ten dzień (${selectedDate}):\n\n${names}\n\nZastąpić ich dane nowymi?`
      );
      if (!confirmed) {
        setError("Zapis anulowany. Dane nie zostały zmienione.");
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Przygotuj dane GPS dla wszystkich zmapowanych zawodników (update istniejących lub add nowych)
      const savePromises = matchedPlayers.map(async ({ rows, player, manualPlayerId }) => {
        const finalPlayer = manualPlayerId 
          ? players.find(p => p.id === manualPlayerId) || player
          : player;

        if (!finalPlayer) return null;

        const { firstHalf, secondHalf, total } = extractGPSDataByPeriod(rows);
        const payload = {
          provider: selectedProvider,
          teamId: selectedTeam,
          date: selectedDate,
          playerId: finalPlayer.id,
          day: selectedDay,
          firstHalf,
          secondHalf,
          total,
          uploadedAt: new Date().toISOString(),
          fileName: fileName || 'unknown.csv',
        };

        const existingId = existingByPlayerId[finalPlayer.id];
        if (existingId) {
          await updateDoc(doc(db, GPS_DATA_COLLECTION, existingId), payload);
        } else {
          await addDoc(collection(db, GPS_DATA_COLLECTION), payload);
        }
      });

      await Promise.all(savePromises.filter(p => p !== null));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
      // Po zapisie czyścimy formularz, żeby nie dało się przypadkiem zapisać drugi raz (duplikaty)
      handleClearData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd podczas zapisywania danych GPS do Firebase';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchGPSDataFromFirebase = async () => {
    if (!selectedTeam) return [];
    const db = getDB();
    const useRange = gpsDateRangeStart && gpsDateRangeEnd && gpsDateRangeStart <= gpsDateRangeEnd;

    const fetchWithProvider = async (withProvider: boolean, dateStart?: string, dateEnd?: string) => {
      const constraints: any[] = [where("teamId", "==", selectedTeam)];
      if (dateStart && dateEnd) {
        constraints.push(where("date", ">=", dateStart));
        constraints.push(where("date", "<=", dateEnd));
      } else {
        constraints.push(where("date", "==", selectedDate));
      }
      if (withProvider) {
        constraints.push(where("provider", "==", selectedProvider));
      }
      const gpsQuery = query(collection(db, GPS_DATA_COLLECTION), ...constraints);
      const querySnapshot = await getDocs(gpsQuery);
      const gpsData: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        gpsData.push({ id: docSnap.id, provider: d.provider || "STATSports", ...d });
      });
      return gpsData;
    };

    const start = useRange ? gpsDateRangeStart.slice(0, 10) : undefined;
    const end = useRange ? gpsDateRangeEnd.slice(0, 10) : undefined;

    let gpsData: any[] = [];
    try {
      gpsData = await fetchWithProvider(true, start, end);
    } catch (e) {
      console.warn("Nie udało się pobrać danych z filtrem provider.", e);
      gpsData = [];
    }
    if (gpsData.length === 0 && selectedProvider === "STATSports") {
      try {
        gpsData = await fetchWithProvider(false, start, end);
      } catch (e2) {
        console.error("Fallback bez provider:", e2);
        gpsData = [];
      }
    }
    return gpsData;
  };

  // Pobierz dane GPS dla konkretnej daty (dla tabeli MD — bez zmiany selectedDate)
  const fetchGPSDataForDate = async (teamId: string, date: string): Promise<any[]> => {
    if (!teamId || !date) return [];
    const db = getDB();
    const constraints: any[] = [
      where("teamId", "==", teamId),
      where("date", "==", date),
    ];
    const gpsQuery = query(collection(db, GPS_DATA_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(gpsQuery);
    const gpsData: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      gpsData.push({ id: docSnap.id, provider: d.provider || "STATSports", ...d });
    });
    return gpsData;
  };

  const fetchPlayerGPSData = async (teamId: string, playerId: string): Promise<any[]> => {
    if (!teamId || !playerId) return [];
    const db = getDB();
    const q = query(
      collection(db, GPS_DATA_COLLECTION),
      where("teamId", "==", teamId),
      where("playerId", "==", playerId)
    );
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({ id: d.id, provider: data.provider || "STATSports", ...data });
    });
    list.sort((a, b) => {
      const da = (a.date || "").toString();
      const db = (b.date || "").toString();
      return da > db ? -1 : da < db ? 1 : 0;
    });
    return list.slice(0, 30);
  };

  // Pobierz dane GPS z Firebase (pojedyncza data lub zakres dat)
  useEffect(() => {
    const loadGPSData = async () => {
      if (!selectedTeam) {
        setGpsDataFromFirebase([]);
        return;
      }
      const useRange = gpsDateRangeStart && gpsDateRangeEnd && gpsDateRangeStart <= gpsDateRangeEnd;
      if (!useRange && !selectedDate) {
        setGpsDataFromFirebase([]);
        return;
      }

      setIsLoadingGPSData(true);
      try {
        const gpsData = await fetchGPSDataFromFirebase();
        setGpsDataFromFirebase(gpsData);
      } catch (err) {
        console.error("Błąd podczas ładowania danych GPS:", err);
        setGpsDataFromFirebase([]);
      } finally {
        setIsLoadingGPSData(false);
      }
    };

    loadGPSData();
  }, [selectedTeam, selectedDate, selectedProvider, gpsDateRangeStart, gpsDateRangeEnd]);

  const toDateStr = React.useCallback((v: unknown): string => {
    if (!v) return "";
    if (typeof v === "string") return String(v).slice(0, 10);
    if (typeof (v as { toDate?: () => Date }).toDate === "function") return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  }, []);

  // Lista meczów zespołu (dla zakładki Tabela MD i Widok zawodnika)
  useEffect(() => {
    if (!selectedTeam) {
      setTeamMatches([]);
      return;
    }
    let cancelled = false;
    const db = getDB();
    getDocs(query(collection(db, "matches"), where("team", "==", selectedTeam), orderBy("date", "desc"))).then((snap) => {
      if (cancelled) return;
      const list = snap.docs.map((d) => {
        const data = d.data() as TeamInfo;
        return { matchId: d.id, dateStr: toDateStr(data.date), opponent: data.opponent || "—" };
      });
      setTeamMatches(list);
    });
    return () => { cancelled = true; };
  }, [selectedTeam, toDateStr]);

  // Dla zakładki Tabela przy wyborze MD: które daty mają dane GPS (day MD)
  useEffect(() => {
    if (!selectedTeam || activeTab !== "table" || selectedDayTable !== "MD") {
      setDatesWithMDData([]);
      return;
    }
    let cancelled = false;
    const db = getDB();
    getDocs(query(collection(db, GPS_DATA_COLLECTION), where("teamId", "==", selectedTeam), where("day", "==", "MD"))).then((gpsSnap) => {
      if (cancelled) return;
      const datesSet = new Set<string>();
      gpsSnap.forEach((d) => {
        const dateStr = toDateStr(d.data().date);
        if (dateStr) datesSet.add(dateStr);
      });
      setDatesWithMDData(Array.from(datesSet));
    });
    return () => { cancelled = true; };
  }, [selectedTeam, activeTab, selectedDayTable, toDateStr]);

  const seasonDefaultSetForTeamRef = useRef<string | null>(null);
  useEffect(() => {
    setSelectedSeason("all");
    seasonDefaultSetForTeamRef.current = null;
  }, [selectedTeam]);

  // Dostępne sezony na podstawie meczów zespołu
  const availableSeasons = React.useMemo(
    () => getAvailableSeasonsFromMatches(teamMatches),
    [teamMatches]
  );

  // Domyślnie ustaw ostatni (najnowszy) sezon gdy lista meczów się załaduje (tylko raz na zespół)
  useEffect(() => {
    if (!selectedTeam || availableSeasons.length === 0) return;
    if (seasonDefaultSetForTeamRef.current === selectedTeam) return;
    seasonDefaultSetForTeamRef.current = selectedTeam;
    setSelectedSeason(availableSeasons[0].id);
  }, [selectedTeam, availableSeasons]);

  // Tylko mecze, które mają zapisane dane GPS (dzień MD), opcjonalnie filtrowane po sezonie
  const teamMatchesWithData = React.useMemo(() => {
    const withData = teamMatches.filter((m) => datesWithMDData.includes(m.dateStr));
    if (selectedSeason === "all") return withData;
    return withData.filter((m) => getSeasonForDate(m.dateStr) === selectedSeason);
  }, [teamMatches, datesWithMDData, selectedSeason]);

  useEffect(() => {
    setSelectedTableMatchIds((prev) => {
      const valid = prev.filter((id) => teamMatchesWithData.some((m) => m.matchId === id));
      if (valid.length > 0) return valid;
      if (teamMatchesWithData.length > 0) return [teamMatchesWithData[0].matchId];
      return [];
    });
  }, [teamMatchesWithData]);

  // Dla wybranych meczów (multi): załaduj dane GPS i minuty dla każdego, potem zsumuj
  useEffect(() => {
    if (!selectedTeam || selectedTableMatchIds.length === 0) {
      setTableGPSDataForMD([]);
      setPlayerMinutesForTableMD({});
      return;
    }
    let cancelled = false;
    setIsLoadingTableMD(true);
    const db = getDB();
    const toDateStr = (v: unknown): string => {
      if (!v) return "";
      if (typeof v === "string") return String(v).slice(0, 10);
      if (typeof (v as { toDate?: () => Date }).toDate === "function") return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
      return String(v).slice(0, 10);
    };
    Promise.all(
      selectedTableMatchIds.map(async (matchId) => {
        const matchDoc = await getDoc(doc(db, "matches", matchId));
        const matchData = matchDoc.data() as TeamInfo | undefined;
        const dateStr = matchData ? toDateStr(matchData.date) : "";
        const [gpsData, minutes] = await Promise.all([
          dateStr ? fetchGPSDataForDate(selectedTeam, dateStr) : Promise.resolve([]),
          (async () => {
            if (!matchData?.playerMinutes?.length) return {};
            const byPlayer: Record<string, number> = {};
            (matchData.playerMinutes as PlayerMinutes[]).forEach((pm) => {
              const mins = (pm.endMinute ?? pm.startMinute) - (pm.startMinute ?? 0) + 1;
              byPlayer[pm.playerId] = (byPlayer[pm.playerId] ?? 0) + mins;
            });
            return byPlayer;
          })(),
        ]);
        return { gpsData, minutes };
      })
    ).then((results) => {
      if (cancelled) return;
      const minutesSum: Record<string, number> = {};
      const byPlayer: Record<string, { total: Record<string, number>; id: string; _avg?: Record<string, { s: number; n: number }> }> = {};
      results.forEach(({ gpsData, minutes }) => {
        Object.entries(minutes).forEach(([pid, m]) => { minutesSum[pid] = (minutesSum[pid] ?? 0) + m; });
        gpsData.forEach((entry: any) => {
          if (entry.day !== "MD") return;
          const pid = entry.playerId;
          if (!byPlayer[pid]) byPlayer[pid] = { total: {}, id: entry.id };
          const tot = entry.total ?? {};
          Object.entries(tot).forEach(([k, v]) => {
            const num = typeof v === "number" && !Number.isNaN(v) ? v : Number(v);
            if (Number.isNaN(num)) return;
            if (k === MAX_AGGREGATION_METRIC) {
              byPlayer[pid].total[k] = Math.max(byPlayer[pid].total[k] ?? -Infinity, num);
            } else if (AVG_AGGREGATION_METRICS.has(k)) {
              if (!byPlayer[pid]._avg) byPlayer[pid]._avg = {};
              if (!byPlayer[pid]._avg[k]) byPlayer[pid]._avg![k] = { s: 0, n: 0 };
              byPlayer[pid]._avg![k].s += num;
              byPlayer[pid]._avg![k].n += 1;
            } else {
              byPlayer[pid].total[k] = (byPlayer[pid].total[k] ?? 0) + num;
            }
          });
        });
      });
      setPlayerMinutesForTableMD(minutesSum);
      setTableGPSDataForMD(
        Object.entries(byPlayer).map(([playerId, data]) => {
          const total = { ...data.total };
          if (data._avg) {
            Object.entries(data._avg).forEach(([k, { s, n }]) => {
              total[k] = n > 0 ? s / n : 0;
            });
          }
          return {
            id: `agg-${playerId}`,
            playerId,
            day: "MD",
            total,
            firstHalf: {},
            secondHalf: {},
          };
        })
      );
    }).finally(() => {
      if (!cancelled) setIsLoadingTableMD(false);
    });
    return () => { cancelled = true; };
  }, [selectedTeam, selectedTableMatchIds]);

  useEffect(() => {
    if (!selectedTeam || !selectedPlayerForTable || activeTab !== "player") {
      setPlayerTableData([]);
      return;
    }
    let cancelled = false;
    setIsLoadingPlayerTable(true);
    fetchPlayerGPSData(selectedTeam, selectedPlayerForTable)
      .then((data) => {
        if (!cancelled) setPlayerTableData(data);
      })
      .catch(() => {
        if (!cancelled) setPlayerTableData([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlayerTable(false);
      });
    return () => { cancelled = true; };
  }, [selectedTeam, selectedPlayerForTable, activeTab]);

  // Dla widoku zawodnika: minuty meczowe (MD) z dokumentu meczu — używane w kolumnie "Czas gry"
  useEffect(() => {
    if (!selectedTeam || !selectedPlayerForTable || playerTableData.length === 0) {
      setPlayerMinutesForPlayerView({});
      return;
    }
    const mdDates = Array.from(
      new Set(
        playerTableData
          .filter((e) => e.day === "MD")
          .map((e) => toDateStr(e.date))
          .filter(Boolean)
      )
    );
    if (mdDates.length === 0) {
      setPlayerMinutesForPlayerView({});
      return;
    }
    let cancelled = false;
    const db = getDB();
    Promise.all(
      mdDates.map(async (dateStr) => {
        const match = teamMatches.find((m) => m.dateStr === dateStr);
        if (!match) return { dateStr, minutes: 0 };
        const matchDoc = await getDoc(doc(db, "matches", match.matchId));
        const matchData = matchDoc.data() as TeamInfo | undefined;
        if (!matchData?.playerMinutes?.length) return { dateStr, minutes: 0 };
        let minutes = 0;
        (matchData.playerMinutes as PlayerMinutes[]).forEach((pm) => {
          if (pm.playerId === selectedPlayerForTable) {
            minutes += (pm.endMinute ?? pm.startMinute) - (pm.startMinute ?? 0) + 1;
          }
        });
        return { dateStr, minutes };
      })
    ).then((results) => {
      if (cancelled) return;
      const byDate: Record<string, number> = {};
      results.forEach(({ dateStr, minutes }) => {
        byDate[dateStr] = minutes;
      });
      setPlayerMinutesForPlayerView(byDate);
    });
    return () => { cancelled = true; };
  }, [selectedTeam, selectedPlayerForTable, playerTableData, teamMatches, toDateStr]);

  // Przypisz dane GPS do innego zawodnika (edycja bez wgrywania od zera)
  const handleReassignGPSData = async (entryId: string, newPlayerId: string) => {
    if (!newPlayerId || !selectedTeam) return;
    const teamPlayers = players.filter(
      (p) => selectedTeam && (p.teams?.includes(selectedTeam) || (p as any).teamId === selectedTeam)
    );
    if (!teamPlayers.some((p) => p.id === newPlayerId)) return;

    setIsReassigning(true);
    setError(null);
    try {
      const db = getDB();
      const docRef = doc(db, GPS_DATA_COLLECTION, entryId);
      await updateDoc(docRef, { playerId: newPlayerId });
      const gpsData = await fetchGPSDataFromFirebase();
      setGpsDataFromFirebase(gpsData);
      setEditingAssignmentEntryId(null);
      setReassignPlayerId("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Błąd podczas przypisywania danych GPS";
      setError(errorMessage);
    } finally {
      setIsReassigning(false);
    }
  };

  // Zbiorcza zmiana dnia dla całej paczki (wszystkie wpisy z bieżącej daty)
  const handleBatchDayChange = async () => {
    if (!batchDayValue || gpsDataFromFirebase.length === 0) return;
    setIsSavingBatchDay(true);
    setError(null);
    try {
      const db = getDB();
      await Promise.all(
        gpsDataFromFirebase.map((entry) => updateDoc(doc(db, GPS_DATA_COLLECTION, entry.id), { day: batchDayValue }))
      );
      const gpsData = await fetchGPSDataFromFirebase();
      setGpsDataFromFirebase(gpsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Błąd podczas zmiany dnia";
      setError(errorMessage);
    } finally {
      setIsSavingBatchDay(false);
    }
  };

  // Funkcja do usuwania danych GPS
  const handleDeleteGPSData = async (entryId: string, playerId: string, day: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć dane GPS dla ${getPlayerLabel(playerId, playersIndex)} (${day})?`)) {
      return;
    }

    setIsLoadingGPSData(true);
    setError(null);

    try {
      const db = getDB();
      
      // Sprawdź czy dokument istnieje przed usunięciem
      const docRef = doc(db, GPS_DATA_COLLECTION, entryId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        setError("Dokument nie istnieje w Firebase.");
        setIsLoadingGPSData(false);
        return;
      }

      // Usuń dokument
      await deleteDoc(docRef);
      console.log("Dokument usunięty z Firebase:", entryId);

      // Poczekaj chwilę, aby Firebase zaktualizował indeksy
      await new Promise(resolve => setTimeout(resolve, 500));

      // Odśwież dane - pobierz ponownie z Firebase
      const gpsData = await fetchGPSDataFromFirebase();
      console.log("Odświeżone dane GPS:", gpsData.length, "dokumentów");
      setGpsDataFromFirebase(gpsData);
      
      // Jeśli lista jest pusta, wyświetl komunikat sukcesu
      if (gpsData.length === 0) {
        console.log("Wszystkie dane GPS zostały usunięte.");
      }
    } catch (err) {
      console.error("Błąd podczas usuwania danych GPS:", err);
      const errorMessage = err instanceof Error ? err.message : 'Błąd podczas usuwania danych GPS';
      setError(errorMessage);
      
      // Spróbuj odświeżyć dane nawet po błędzie, aby zobaczyć aktualny stan
      try {
        const gpsData = await fetchGPSDataFromFirebase();
        setGpsDataFromFirebase(gpsData);
      } catch (refreshErr) {
        console.error("Błąd podczas odświeżania danych po błędzie usuwania:", refreshErr);
      }
    } finally {
      setIsLoadingGPSData(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Zespół i sezon */}
      <div className={styles.selectorsSection}>
        <div className={styles.formGroup}>
          <label htmlFor="team-select">Zespół</label>
          <select
            id="team-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className={styles.select}
          >
            <option value="">-- Wybierz zespół --</option>
            {allAvailableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label>Sezon</label>
          <SeasonSelector
            selectedSeason={selectedSeason}
            onChange={setSelectedSeason}
            availableSeasons={availableSeasons}
            showLabel={false}
            className={styles.select}
          />
        </div>
        <div className={`${styles.formGroup} ${styles.openDataButtonWrap}`}>
          <button
            type="button"
            className={styles.openDataButton}
            onClick={() => setDataModalOpen(true)}
            aria-label="Otwórz okno dodawania danych GPS (CSV)"
          >
            +
          </button>
        </div>
      </div>

      {/* Modal: Dane GPS (CSV) — zawartość wyświetlana tylko tutaj */}
      {dataModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setDataModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="data-modal-title"
        >
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4 id="data-modal-title" className={styles.combinedMetricsTitle}>Dane GPS</h4>
              <button type="button" className={styles.modalClose} onClick={() => setDataModalOpen(false)} aria-label="Zamknij">×</button>
            </div>

      {/* Data i Dostawca — przeniesione tutaj z góry */}
      <div className={`${styles.configHeader} ${styles.configHeaderRow}`}>
        <div className={styles.formGroup}>
          <label htmlFor="date-select">Data:</label>
          <input
            id="date-select"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={styles.select}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="provider-select">Dostawca:</label>
          <select
            id="provider-select"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as GPSProvider)}
            className={styles.select}
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Zapisane dane GPS — gdy są dane na wybrany dzień */}
      {selectedTeam && !isLoadingGPSData && gpsDataFromFirebase.length > 0 && (
        <div className={styles.savedDataBlock}>
          <div className={styles.gpsDataView}>
            <div className={styles.gpsDataViewHeader}>
              <h3>Zapisane dane GPS ({gpsDataFromFirebase.length} zawodników)</h3>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedTeam || !selectedDate) return;
                  setIsLoadingGPSData(true);
                  try {
                    const gpsData = await fetchGPSDataFromFirebase();
                    setGpsDataFromFirebase(gpsData);
                  } catch (err) {
                    console.error("Błąd podczas odświeżania:", err);
                  } finally {
                    setIsLoadingGPSData(false);
                  }
                }}
                className={styles.refreshButton}
                title="Odśwież dane"
                disabled={isLoadingGPSData}
              >
                🔄 Odśwież
              </button>
            </div>
            <div className={styles.batchDayRow}>
              <label htmlFor="batch-day-select" className={styles.batchDayLabel}>Dzień dla wszystkich z listy:</label>
              <select
                id="batch-day-select"
                value={batchDayValue}
                onChange={(e) => setBatchDayValue(e.target.value)}
                className={styles.select}
                disabled={isSavingBatchDay}
              >
                {dayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button type="button" className={styles.saveButton} disabled={isSavingBatchDay} onClick={handleBatchDayChange}>
                {isSavingBatchDay ? "Zapisywanie…" : "Zastosuj do wszystkich"}
              </button>
            </div>
            <div className={styles.gpsDataList}>
              {gpsDataFromFirebase.map((entry, index) => {
                const isExpanded = expandedGPSEntries.has(entry.id);
                const toggleExpanded = () => {
                  setExpandedGPSEntries(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(entry.id)) newSet.delete(entry.id);
                    else newSet.add(entry.id);
                    return newSet;
                  });
                };
                return (
                  <div key={entry.id || index} className={styles.gpsDataItem}>
                    <div
                      className={styles.gpsDataHeader}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={toggleExpanded}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpanded(); } }}
                    >
                      <div className={styles.gpsDataHeaderTop}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
                          className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''}`}
                          aria-label={isExpanded ? "Zwiń" : "Rozwiń"}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <h4>{getPlayerLabel(entry.playerId, playersIndex)}</h4>
                        <div className={styles.gpsDataMeta}>
                          <span>Dzień: {entry.day}</span>
                          <span>Dostawca: {entry.provider || "STATSports"}</span>
                          <span>Wczytano: {new Date(entry.uploadedAt).toLocaleString('pl-PL')}</span>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className={styles.gpsDataContent}>
                        <div className={styles.reassignRow}>
                          {editingAssignmentEntryId === entry.id ? (
                            <>
                              <label htmlFor={`reassign-${entry.id}`}>Przypisz te dane do zawodnika:</label>
                              <select
                                id={`reassign-${entry.id}`}
                                value={reassignPlayerId}
                                onChange={(e) => setReassignPlayerId(e.target.value)}
                                className={styles.select}
                                disabled={isReassigning}
                              >
                                <option value="">-- Wybierz zawodnika --</option>
                                {selectedTeam && sortPlayersByLastName(
                                  players.filter((p) => selectedTeam && (p.teams?.includes(selectedTeam) || (p as any).teamId === selectedTeam))
                                ).map((p) => (
                                  <option key={p.id} value={p.id}>{`${getPlayerLastName(p)} ${getPlayerFirstName(p)}`.trim()}</option>
                                ))}
                              </select>
                              <button type="button" className={styles.saveButton} disabled={!reassignPlayerId || isReassigning} onClick={() => handleReassignGPSData(entry.id, reassignPlayerId)}>
                                {isReassigning ? "Zapisywanie…" : "Zapisz"}
                              </button>
                              <button type="button" className={styles.clearButton} onClick={() => { setEditingAssignmentEntryId(null); setReassignPlayerId(""); }} disabled={isReassigning}>Anuluj</button>
                            </>
                          ) : (
                            <button type="button" className={styles.reassignLinkButton} onClick={() => { setEditingAssignmentEntryId(entry.id); setReassignPlayerId(entry.playerId || ""); }}>
                              Zmień zawodnika
                            </button>
                          )}
                        </div>
                        <div className={styles.periodTabs}>
                          <button type="button" className={`${styles.periodTab} ${selectedPeriod === "firstHalf" ? styles.periodTabActive : ""}`} onClick={() => setSelectedPeriod("firstHalf")} disabled={Object.keys(entry.firstHalf).length === 0}>I połowa</button>
                          <button type="button" className={`${styles.periodTab} ${selectedPeriod === "secondHalf" ? styles.periodTabActive : ""}`} onClick={() => setSelectedPeriod("secondHalf")} disabled={Object.keys(entry.secondHalf).length === 0}>II połowa</button>
                          <button type="button" className={`${styles.periodTab} ${selectedPeriod === "total" ? styles.periodTabActive : ""}`} onClick={() => setSelectedPeriod("total")} disabled={Object.keys(entry.total).length === 0}>Cały mecz</button>
                        </div>
                        {selectedPeriod === "firstHalf" && Object.keys(entry.firstHalf).length > 0 && (
                          <div className={styles.gpsDataPeriod}>
                            <div className={styles.gpsDataMetrics}>
                              {Object.entries(entry.firstHalf).map(([key, value]) => (
                                <div key={key} className={styles.gpsMetric}>
                                  <span className={styles.metricLabel} title={getGpsMetricTooltip(key, (entry.provider || selectedProvider) as GPSProvider)}>{key}:</span>
                                  <span className={styles.metricValue}>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedPeriod === "secondHalf" && Object.keys(entry.secondHalf).length > 0 && (
                          <div className={styles.gpsDataPeriod}>
                            <div className={styles.gpsDataMetrics}>
                              {Object.entries(entry.secondHalf).map(([key, value]) => (
                                <div key={key} className={styles.gpsMetric}>
                                  <span className={styles.metricLabel} title={getGpsMetricTooltip(key, (entry.provider || selectedProvider) as GPSProvider)}>{key}:</span>
                                  <span className={styles.metricValue}>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedPeriod === "total" && Object.keys(entry.total).length > 0 && (
                          <div className={styles.gpsDataPeriod}>
                            <div className={styles.gpsDataMetrics}>
                              {Object.entries(entry.total).map(([key, value]) => (
                                <div key={key} className={styles.gpsMetric}>
                                  <span className={styles.metricLabel} title={getGpsMetricTooltip(key, (entry.provider || selectedProvider) as GPSProvider)}>{key}:</span>
                                  <span className={styles.metricValue}>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {gpsDataFromFirebase.length > 0 && (
              <div className={styles.deleteAllSection}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Czy na pewno chcesz usunąć wszystkie dane GPS (${gpsDataFromFirebase.length} zawodników) z dnia ${selectedDate}?`)) return;
                    const entriesWithId = gpsDataFromFirebase.filter((e) => e?.id);
                    if (entriesWithId.length !== gpsDataFromFirebase.length) {
                      setError("Część wpisów nie ma poprawnego ID dokumentu. Odśwież listę i spróbuj ponownie.");
                      return;
                    }
                    setIsLoadingGPSData(true);
                    setError(null);
                    try {
                      const db = getDB();
                      await Promise.all(entriesWithId.map((entry) => deleteDoc(doc(db, GPS_DATA_COLLECTION, entry.id))));
                      await new Promise((resolve) => setTimeout(resolve, 500));
                      const gpsData = await fetchGPSDataFromFirebase();
                      setGpsDataFromFirebase(gpsData);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Błąd podczas usuwania danych GPS");
                    } finally {
                      setIsLoadingGPSData(false);
                    }
                  }}
                  className={styles.deleteAllButton}
                  disabled={isLoadingGPSData}
                >
                  🗑️ Usuń wszystkie dane z tego dnia
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.uploadSection}>
        <label htmlFor="csv-upload" className={styles.uploadLabel}>
          <input
            ref={fileInputRef}
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className={styles.fileInput}
          />
          <span className={styles.uploadButton}>
            {fileName ? `📄 ${fileName}` : '📁 Wybierz plik CSV'}
          </span>
        </label>
        {fileName && (
          <button
            type="button"
            onClick={handleClearData}
            className={styles.clearButton}
          >
            Wyczyść
          </button>
        )}
      </div>

      {/* Selektor dnia tygodnia i zawodnika */}
      {csvData.length > 0 && selectedTeam && csvStructure && (
        <div className={styles.selectionSection}>
          <h3>Przypisz dane GPS</h3>

          {/* Lista zmapowanych zawodników */}
          {mappedPlayers.length > 0 && (
            <div className={styles.mappedPlayersSection}>
              <h4>Zmapowani zawodnicy ({mappedPlayers.filter(mp => mp.player || mp.manualPlayerId).length}/{mappedPlayers.length})</h4>
              <div className={styles.mappedPlayersList}>
                {mappedPlayers.map((mapped, index) => {
                  // Pobierz informacje o wierszach (I połowa, II połowa, Entire Session)
                  const periodNames = mapped.rows
                    .map(row => periodColumn ? String(row[periodColumn] || '').trim() : '')
                    .filter(title => title)
                    .join(', ');

                  return (
                    <div
                      key={index}
                      className={`${styles.mappedPlayerItem} ${mapped.matched ? styles.matched : styles.unmatched}`}
                    >
                      <div className={styles.playerInfo}>
                        <div className={styles.playerNameRow}>
                          <strong>{mapped.playerName}</strong>
                          {mapped.player ? (
                            <span className={styles.matchedLabel}>
                              → {getPlayerLabel(mapped.player.id, playersIndex)}
                            </span>
                          ) : (
                            <span className={styles.unmatchedLabel}>❌ Nie znaleziono w bazie</span>
                          )}
                        </div>
                        <div className={styles.drillInfo}>
                          <small>Wiersze: {mapped.rows.length} ({periodNames || `brak ${periodColumn}`})</small>
                        </div>
                        {selectedTeam && (
                          <div className={styles.manualSelect}>
                            <label htmlFor={`player-select-${index}`}>
                              {mapped.matched ? 'Zweryfikuj/zmień zawodnika:' : 'Wybierz zawodnika:'}
                            </label>
                            <select
                              id={`player-select-${index}`}
                              value={mapped.manualPlayerId || (mapped.player?.id || '')}
                              onChange={(e) => handleManualPlayerSelect(mapped.playerName, e.target.value)}
                              className={styles.select}
                            >
                              <option value="">-- Wybierz zawodnika --</option>
                              {sortPlayersByLastName(
                                players.filter(
                                  (player) =>
                                    selectedTeam &&
                                    (player.teams?.includes(selectedTeam) || player.teamId === selectedTeam)
                                )
                              ).map((player) => (
                                  <option key={player.id} value={player.id}>
                                    {`${getPlayerLastName(player)} ${getPlayerFirstName(player)}`.trim()}
                                  </option>
                                ))}
                            </select>
                            {mapped.matched && mapped.player && !mapped.manualPlayerId && (
                              <small className={styles.suggestionHint}>
                                💡 Sugestia aplikacji: {getPlayerLabel(mapped.player.id, playersIndex)}
                              </small>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.selectionRow}>
            <div className={styles.formGroup}>
              <label htmlFor="day-select">Dzień (MD)</label>
              <select
                id="day-select"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className={styles.select}
              >
                {dayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <button
                type="button"
                onClick={handleSaveToFirebase}
                disabled={isSaving || !selectedTeam || !selectedDate || mappedPlayers.filter(mp => mp.player || mp.manualPlayerId).length === 0}
                className={styles.saveButton}
              >
                {isSaving ? 'Zapisywanie...' : `Zapisz ${mappedPlayers.filter(mp => mp.player || mp.manualPlayerId).length} zawodników`}
              </button>
            </div>
          </div>
          {saveSuccess && (
            <div className={styles.successMessage}>
              ✅ Dane GPS zostały zapisane do Firebase!
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className={styles.loading}>Analizowanie pliku CSV...</div>
      )}

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {csvStructure && (
        <div className={styles.structureInfo}>
          <button
            type="button"
            className={styles.collapseHeader}
            onClick={() => setExpandedStructure((v) => !v)}
            aria-expanded={expandedStructure}
          >
            <h3>Struktura pliku CSV</h3>
            <span className={styles.collapseSummary}>
              Kolumny: {csvStructure.headers.length}, Wiersze: {csvStructure.rowCount}
            </span>
            <span className={`${styles.collapseIcon} ${expandedStructure ? styles.collapseIconOpen : ""}`} aria-hidden>▼</span>
          </button>
          {expandedStructure && (
            <>
              <div className={styles.stats}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Kolumny:</span>
                  <span className={styles.statValue}>{csvStructure.headers.length}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Wiersze:</span>
                  <span className={styles.statValue}>{csvStructure.rowCount}</span>
                </div>
              </div>
              <div className={styles.columnsInfo}>
                <h4>Kolumny w pliku:</h4>
                <div className={styles.columnsList}>
                  {csvStructure.headers.map((header, index) => (
                    <div key={index} className={styles.columnItem}>
                      <div className={styles.columnHeader}>
                        <strong>{header}</strong>
                        <span className={styles.columnType}>{csvStructure.columnTypes[header]}</span>
                      </div>
                      {csvStructure.columnSamples[header].length > 0 && (
                        <div className={styles.columnSamples}>
                          <span className={styles.samplesLabel}>Przykłady:</span>
                          {csvStructure.columnSamples[header].slice(0, 3).map((sample, i) => (
                            <span key={i} className={styles.sampleValue}>
                              {String(sample).substring(0, 30)}
                              {String(sample).length > 30 ? "…" : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {csvData.length > 0 && (
        <div className={styles.dataPreview}>
          <button
            type="button"
            className={styles.collapseHeader}
            onClick={() => setExpandedPreview((v) => !v)}
            aria-expanded={expandedPreview}
          >
            <h3>Podgląd danych ({csvData.length} wierszy)</h3>
            <span className={`${styles.collapseIcon} ${expandedPreview ? styles.collapseIconOpen : ""}`} aria-hidden>▼</span>
          </button>
          {expandedPreview && (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    {csvStructure?.headers.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 20).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {csvStructure?.headers.map((header, colIndex) => (
                        <td key={colIndex}>{row[header] || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvData.length > 20 && (
                <div className={styles.moreRows}>… i {csvData.length - 20} więcej wierszy</div>
              )}
            </div>
          )}
        </div>
      )}
          </div>
        </div>
      )}

      {/* Zakładki */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "norms" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("norms")}
        >
          Metryki na dzień
        </button>
        <button
          className={`${styles.tab} ${activeTab === "table" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("table")}
        >
          Tabela
        </button>
        <button
          className={`${styles.tab} ${activeTab === "player" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("player")}
        >
          Widok zawodnika
        </button>
      </div>

      {/* Zakładka: Metryki na dzień */}
      {activeTab === "norms" && (
        <div className={styles.configSection}>
          <p className={styles.helpText}>Dane przypisane do dnia treningowego: wybierz dostawcę i dzień (MD), zaznacz metryki, które mają być wyświetlane w tabelach. Zaznaczenia zapisują się w przeglądarce; „Zapisz wybór” zapisuje w Firebase (gps_norms).</p>
          <div className={`${styles.configHeader} ${styles.configHeaderRow}`}>
            <div className={styles.formGroup}>
              <label htmlFor="norms-provider-select">Dostawca (dane):</label>
              <select
                id="norms-provider-select"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as GPSProvider)}
                className={styles.select}
              >
                {providers.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="norms-day-select">Dzień (MD)</label>
              <select
                id="norms-day-select"
                value={selectedDayNorms}
                onChange={(e) => setSelectedDayNorms(e.target.value)}
                className={styles.select}
              >
                {dayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.configSaveRow}>
              <button
                type="button"
                className={styles.saveButton}
                onClick={saveNormsToFirebase}
                disabled={normsSaving || !selectedTeam}
              >
                {normsSaving ? "Zapisywanie…" : "Zapisz wybór"}
              </button>
              {normsSaveFeedback && (
                <span className={styles.saveNormsOk} role="status">Zapisano!</span>
              )}
            </div>
          </div>
          <div className={styles.combinedMetricsSection}>
            <div className={styles.configHeaderRow}>
              <button
                type="button"
                className={styles.saveButton}
                onClick={() => setCombinedMetricsModalOpen(true)}
              >
                Połącz metryki (2–6)
              </button>
            </div>
            {combinedMetricsModalOpen && (
              <div className={styles.modalOverlay} onClick={() => setCombinedMetricsModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="combined-metrics-modal-title">
                <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalHeader}>
                    <h4 id="combined-metrics-modal-title" className={styles.combinedMetricsTitle}>Połącz metryki (2–6)</h4>
                    <button type="button" className={styles.modalClose} onClick={() => setCombinedMetricsModalOpen(false)} aria-label="Zamknij">×</button>
                  </div>
                  <p className={styles.helpText}>Wpisz nazwę, wybierz operację i przeciągnij lub kliknij metryki w jednym polu.</p>
            <div ref={combinedMetricsCardRef} className={styles.combinedMetricsCard}>
              <div className={styles.combinedDropRow}>
                <input
                  type="text"
                  value={newCombinedName}
                  onChange={(e) => setNewCombinedName(e.target.value)}
                  placeholder="Nazwa połączonej metryki"
                  className={styles.combinedNameInput}
                  aria-label="Nazwa połączonej metryki"
                />
                <span className={styles.combinedDropLabel}>Operacja:</span>
                <select
                  value={newCombinedOperation}
                  onChange={(e) => setNewCombinedOperation(e.target.value as CombinedOperation)}
                  className={styles.combinedOperationSelect}
                  aria-label="Operacja łączenia"
                >
                  {COMBINED_OPERATIONS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <span className={styles.combinedDropLabel}>Definicja (tooltip):</span>
                <input
                  type="text"
                  value={newCombinedDefinition}
                  onChange={(e) => setNewCombinedDefinition(e.target.value)}
                  placeholder="Opcjonalny opis wskaźnika w tooltipie"
                  className={styles.combinedNameInput}
                  aria-label="Definicja połączonej metryki"
                />
              </div>
              <div className={styles.combinedDropRow}>
                <span className={styles.combinedDropLabel}>Formuła (2–6 metryk{newCombinedOperation === "ratio" ? ", dokładnie 2" : ""}):</span>
                <div
                  className={styles.combinedDropBox}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(styles.combinedSlotOver); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove(styles.combinedSlotOver); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(styles.combinedSlotOver);
                    const key = e.dataTransfer.getData("metric");
                    if (!key) return;
                    setNewCombinedParts((prev) => {
                      if (prev.includes(key) || prev.length >= MAX_COMBINED_PARTS) return prev;
                      if (newCombinedOperation === "ratio" && prev.length >= 2) return prev;
                      return [...prev, key];
                    });
                  }}
                >
                  {newCombinedParts.length === 0 ? (
                    <span className={styles.combinedSlotPlaceholder}>Upuść lub kliknij metryki (max 6)</span>
                  ) : (
                    <>
                      {newCombinedParts.map((key, i) => (
                        <span key={`${key}-${i}`} className={styles.combinedSlotChip}>
                          {getMetricShortLabel(key)}
                          <button type="button" className={styles.combinedSlotRemove} onClick={(ev) => { ev.stopPropagation(); setNewCombinedParts((prev) => prev.filter((_, idx) => idx !== i)); }} aria-label="Usuń z formuły">×</button>
                        </span>
                      ))}
                      {newCombinedParts.length >= 2 && (
                        <span className={styles.combinedSlotPlus}>
                          = {newCombinedOperation === "sum" ? "suma" : newCombinedOperation === "diff" ? "różnica" : newCombinedOperation === "ratio" ? "iloraz" : "iloczyn"}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.saveButton}
                  disabled={(() => {
                    const name = newCombinedName.trim();
                    const parts = newCombinedParts;
                    const uniq = new Set(parts);
                    if (!name || parts.length > MAX_COMBINED_PARTS || uniq.size !== parts.length) return true;
                    if (newCombinedOperation === "ratio") return parts.length !== 2;
                    if (parts.length < 2) return true;
                    const isEdit = editingCombinedName !== null;
                    if (!isEdit && !!combinedMetrics[name]) return true;
                    return false;
                  })()}
                  onClick={() => {
                    const name = newCombinedName.trim();
                    const parts = newCombinedParts;
                    const uniq = new Set(parts);
                    if (!name || parts.length > MAX_COMBINED_PARTS || uniq.size !== parts.length) return;
                    if (newCombinedOperation === "ratio" && parts.length !== 2) return;
                    if (parts.length < 2) return;
                    const definition = newCombinedDefinition.trim() || undefined;
                    const payload: CombinedMetricDef = { parts, operation: newCombinedOperation, definition };
                    setCombinedMetrics((prev) => {
                      const next = { ...prev };
                      if (editingCombinedName && editingCombinedName !== name) delete next[editingCombinedName];
                      next[name] = payload;
                      return next;
                    });
                    setNewCombinedName("");
                    setNewCombinedParts([]);
                    setNewCombinedDefinition("");
                    setEditingCombinedName(null);
                  }}
                >
                  {editingCombinedName ? "Zapisz" : "Dodaj"}
                </button>
                {editingCombinedName && (
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => {
                      setNewCombinedName("");
                      setNewCombinedParts([]);
                      setNewCombinedDefinition("");
                      setEditingCombinedName(null);
                    }}
                  >
                    Anuluj
                  </button>
                )}
              </div>
              <div className={styles.combinedPool}>
                {availableMetricsForNorms
                  .filter((m) => !newCombinedParts.includes(m))
                  .map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={styles.combinedPoolChip}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("metric", m); e.dataTransfer.effectAllowed = "copy"; }}
                      onClick={() => {
                        if (newCombinedParts.includes(m) || newCombinedParts.length >= MAX_COMBINED_PARTS) return;
                        if (newCombinedOperation === "ratio" && newCombinedParts.length >= 2) return;
                        setNewCombinedParts((prev) => [...prev, m]);
                      }}
                    >
                      {getMetricShortLabel(m)}
                    </button>
                  ))}
              </div>
            </div>
            </div>
              </div>
            )}
            {Object.keys(combinedMetrics).length > 0 && (
              <div className={styles.combinedChips}>
                {Object.entries(combinedMetrics).map(([name, def]) => (
                  <span
                    key={name}
                    role="button"
                    tabIndex={0}
                    className={styles.combinedChip}
                    onClick={() => {
                      setCombinedMetricsModalOpen(true);
                      setEditingCombinedName(name);
                      setNewCombinedName(name);
                      setNewCombinedParts([...def.parts]);
                      setNewCombinedOperation(def.operation);
                      setNewCombinedDefinition(def.definition ?? "");
                      combinedMetricsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLSpanElement).click(); } }}
                    aria-label={`Edytuj ${name}`}
                  >
                    <span className={styles.combinedChipName}>{name}</span>
                    <span className={styles.combinedChipFormula}>
                      {def.parts.map((p) => getMetricShortLabel(p)).join(def.operation === "sum" ? " + " : def.operation === "diff" ? " − " : def.operation === "ratio" ? " / " : " × ")}
                    </span>
                    <button type="button" className={styles.combinedChipRemove} onClick={(ev) => { ev.stopPropagation(); setCombinedMetrics((prev) => { const next = { ...prev }; delete next[name]; return next; }); if (editingCombinedName === name) { setEditingCombinedName(null); setNewCombinedName(""); setNewCombinedParts([]); setNewCombinedDefinition(""); } }} aria-label="Usuń">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.metricsConfigList}>
            <h4 className={styles.combinedMetricsTitle}>Metryki do wyświetlenia w tabelach</h4>
            {availableMetricsForNorms.length === 0 && Object.keys(combinedMetrics).length === 0 ? (
              <p className={styles.helpText}>Brak metryk dla wybranego dostawcy.</p>
            ) : (
              <>
                {availableMetricsForNorms.map((metric) => (
                  <div key={metric} className={styles.metricConfigRow}>
                    <label className={styles.metricConfigLabel} htmlFor={`norm-${metric}`}>
                      <input
                        id={`norm-${metric}`}
                        type="checkbox"
                        checked={normsForSelectedDay.includes(metric)}
                        onChange={() => toggleNormForDay(selectedDayNorms, metric)}
                      />
                      <span className={styles.metricConfigName}>{metric}</span>
                    </label>
                  </div>
                ))}
                {Object.keys(combinedMetrics).map((name) => (
                  <div key={name} className={styles.metricConfigRow}>
                    <label className={styles.metricConfigLabel} htmlFor={`norm-combined-${name}`}>
                      <input
                        id={`norm-combined-${name}`}
                        type="checkbox"
                        checked={normsForSelectedDay.includes(name)}
                        onChange={() => toggleNormForDay(selectedDayNorms, name)}
                      />
                      <span className={styles.metricConfigName}>{name} ({COMBINED_OPERATIONS.find((o) => o.value === combinedMetrics[name]?.operation)?.label ?? "suma"})</span>
                    </label>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Zakładka: Tabela (zespołu) */}
      {activeTab === "table" && (
        <div className={styles.configSection}>
          <div className={styles.tablePanel}>
            <h3 className={styles.tablePanelTitle}>Tabela zespołu</h3>
            <div className={`${styles.configHeader} ${styles.configHeaderRow}`}>
                <div className={styles.formGroup}>
                  <label htmlFor="table-position">Pozycja</label>
                  <select
                    id="table-position"
                    value={selectedPositionTable}
                    onChange={(e) => setSelectedPositionTable(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">-- Wszystkie pozycje --</option>
                    {POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="table-day">Dzień (MD)</label>
                  <select
                    id="table-day"
                    value={selectedDayTable}
                    onChange={(e) => setSelectedDayTable(e.target.value)}
                    className={styles.select}
                  >
                    {dayOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {selectedDayTable === "MD" && teamMatchesWithData.length > 0 && (
                  <div className={`${styles.formGroup} ${styles.tableMatchesSelectWrap}`} ref={tableMatchesDropdownRef}>
                    <label className={styles.tableMatchesLabel}>Mecze z danymi GPS (MD)</label>
                    <button
                      type="button"
                      className={styles.tableMatchesSelectButton}
                      onClick={(e) => { e.stopPropagation(); setTableMatchesDropdownOpen((v) => !v); }}
                      aria-expanded={tableMatchesDropdownOpen}
                      aria-haspopup="listbox"
                    >
                      <span>
                        {selectedTableMatchIds.length === 0
                          ? "Wybierz mecze…"
                          : selectedTableMatchIds.length === 1
                            ? teamMatchesWithData.find((m) => m.matchId === selectedTableMatchIds[0])?.opponent + " (" + teamMatchesWithData.find((m) => m.matchId === selectedTableMatchIds[0])?.dateStr + ")"
                            : `${selectedTableMatchIds.length} mecz(e/y)`}
                      </span>
                      <span className={`${styles.tableMatchesSelectChevron} ${tableMatchesDropdownOpen ? styles.tableMatchesSelectChevronOpen : ""}`} aria-hidden>▼</span>
                    </button>
                    {tableMatchesDropdownOpen && (
                      <div className={styles.tableMatchesDropdownPanel} role="listbox">
                        {teamMatchesWithData.map((m) => {
                          const selected = selectedTableMatchIds.includes(m.matchId);
                          return (
                            <label key={m.matchId} className={styles.tableMatchesDropdownItem}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => setSelectedTableMatchIds((prev) => selected ? prev.filter((id) => id !== m.matchId) : [...prev, m.matchId])}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span>{m.opponent}</span>
                              <span className={styles.tableMatchChipDate}>{m.dateStr}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.configSaveRow}>
                  <button
                    type="button"
                    className={`${styles.perMinuteToggle} ${tablePerMinute ? styles.perMinuteToggleActive : ""}`}
                    onClick={() => setTablePerMinute((v) => !v)}
                    title="Przelicz wartości na minutę gry (czas gry z meczu w aplikacji)"
                  >
                    {tablePerMinute ? "Na minutę ✓" : "Wartości na minutę"}
                  </button>
                </div>
              </div>
              {normsForTableDaySorted.length === 0 ? (
                <p className={styles.helpText}>Wybierz metryki w zakładce „Metryki na dzień” dla wybranego dnia (MD).</p>
              ) : selectedDayTable === "MD" && teamMatchesWithData.length === 0 ? (
                <p className={styles.helpText}>Brak meczów z zapisanymi danymi GPS (MD). Dodaj dane przyciskiem „+” (sekcja Zespół/Sezon), wybierz dzień meczu i ustaw „Dzień” na MD.</p>
              ) : selectedDayTable === "MD" && selectedTableMatchIds.length === 0 ? (
                <p className={styles.helpText}>Wybierz co najmniej jeden mecz z listy powyżej.</p>
              ) : selectedDayTable === "MD" && isLoadingTableMD ? (
                <p className={styles.helpText}>Ładowanie danych meczów…</p>
              ) : (
                <div className={styles.tableCollapsible}>
                  <button
                    type="button"
                    className={styles.tableMatchHeaderToggle}
                    onClick={() => setTablePanelExpanded((v) => !v)}
                    aria-expanded={tablePanelExpanded}
                  >
                    <span className={styles.tableMatchHeaderText}>
                      {selectedDayTable === "MD" && selectedTableMatchIds.length > 0
                        ? `Mecz MD — ${selectedTableMatchIds.length === 1
                          ? teamMatchesWithData.find((m) => m.matchId === selectedTableMatchIds[0])?.dateStr ?? ""
                          : `suma ${selectedTableMatchIds.length} meczów`}`
                        : selectedDayTable !== "MD" && selectedDate
                          ? `Dzień ${selectedDayTable} — ${selectedDate.slice(0, 10)}`
                          : "Tabela"}
                    </span>
                    <span className={`${styles.tableMatchHeaderChevron} ${tablePanelExpanded ? styles.tableMatchHeaderChevronOpen : ""}`} aria-hidden>▼</span>
                  </button>
                  {tablePanelExpanded && (
                  <div className={styles.tableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th
                            className={`${styles.sortable} ${tableSort.key === "player" ? styles.sortableActive : ""}`}
                            onClick={() => setTableSort((prev) => ({ key: "player", dir: prev.key === "player" && prev.dir === "asc" ? "desc" : "asc" }))}
                            title="Sortuj"
                          >
                            Zawodnik
                          </th>
                          <th
                            className={`${styles.sortable} ${tableSort.key === "position" ? styles.sortableActive : ""}`}
                            onClick={() => setTableSort((prev) => ({ key: "position", dir: prev.key === "position" && prev.dir === "asc" ? "desc" : "asc" }))}
                            title="Sortuj"
                          >
                            Pozycja
                          </th>
                          <th
                            className={`${styles.sortable} ${tableSort.key === "minutes" ? styles.sortableActive : ""}`}
                            title="Czas. Kliknij, by sortować."
                            onClick={() => setTableSort((prev) => ({ key: "minutes", dir: prev.key === "minutes" && prev.dir === "asc" ? "desc" : "asc" }))}
                          >
                            Czas
                          </th>
                          {normsForTableDaySorted.map((m) => (
                            <th
                              key={m}
                              className={`${styles.sortable} ${tableSort.key === m ? styles.sortableActive : ""}`}
                              title={`${getMetricHeaderTitle(m, selectedProvider, combinedMetrics)} Kliknij, by sortować.`}
                              onClick={() => setTableSort((prev) => ({ key: m, dir: prev.key === m && prev.dir === "asc" ? "desc" : "asc" }))}
                            >
                              {getMetricShortLabel(m)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const isMD = selectedDayTable === "MD";
                          const formatValue = (raw: unknown, divisorMinutes: number | undefined): string => {
                            if (raw == null || raw === "") return "—";
                            const num = Number(raw);
                            if (Number.isNaN(num)) return String(raw);
                            let value: number;
                            if (tablePerMinute && divisorMinutes != null && divisorMinutes > 0) {
                              value = num / divisorMinutes;
                            } else {
                              value = num;
                            }
                            if (Number.isInteger(value)) return String(value);
                            return value.toFixed(2);
                          };
                          const matchMins = selectedDayTable === "MD" ? playerMinutesForTableMD : playerMinutesFromMatch;
                          const getTeamSortVal = (entry: any): string | number => {
                            if (tableSort.key === "player") return getPlayerLabel(entry.playerId, playersIndex);
                            if (tableSort.key === "position") return players.find((p) => p.id === entry.playerId)?.position ?? "";
                            if (tableSort.key === "minutes") {
                              const m = matchMins[entry.playerId];
                              if (typeof m === "number" && !Number.isNaN(m)) return m;
                              const csv = parseTotalTimeToMinutes(entry.total?.["Total Time"]);
                              return csv ?? -1;
                            }
                            const v = getMetricValue(entry.total ?? {}, tableSort.key, combinedMetrics);
                            const n = Number(v);
                            return Number.isNaN(n) ? -Infinity : n;
                          };
                          const sortedEntries = tableSort.key
                            ? [...tableEntriesForDay].sort((a, b) => {
                                const va = getTeamSortVal(a);
                                const vb = getTeamSortVal(b);
                                const cmp = typeof va === "string" ? String(va).localeCompare(String(vb), "pl") : (va as number) - (vb as number);
                                return tableSort.dir === "asc" ? (cmp < 0 ? -1 : cmp > 0 ? 1 : 0) : cmp > 0 ? -1 : cmp < 0 ? 1 : 0;
                              })
                            : tableEntriesForDay;
                        return sortedEntries.map((entry) => {
                            const player = players.find((p) => p.id === entry.playerId);
                            const data = entry.total ?? {};
                            const minsFromMatch = matchMins[entry.playerId];
                            const totalTimeRaw = data["Total Time"];
                            const minsFromCsv = parseTotalTimeToMinutes(totalTimeRaw);
                            const minsNum = isMD ? minsFromMatch : minsFromCsv;
                            const displayMins = minsNum != null && !Number.isNaN(minsNum) ? String(Math.round(minsNum)) : "—";
                            const divisorMins = isMD ? minsFromMatch : minsFromCsv;
                            return (
                              <tr key={entry.id}>
                                <td>{getPlayerLabel(entry.playerId, playersIndex)}</td>
                                <td>{player?.position ?? "—"}</td>
                                <td>{displayMins}</td>
                                {normsForTableDaySorted.map((metric) => (
                                  <td key={metric}>{formatValue(getMetricValue(data, metric, combinedMetrics), divisorMins)}</td>
                                ))}
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                      <tfoot>
                        <tr className={styles.tableFooterRow}>
                          <td className={styles.tableFooterCell}>Zespół</td>
                          <td className={styles.tableFooterCell} />
                          <td className={styles.tableFooterCell}>
                            {tableTeamSums.totalMinutes > 0 ? Math.round(tableTeamSums.totalMinutes) : "—"}
                          </td>
                          {normsForTableDaySorted.map((metric) => {
                            const aggLabel = metric === MAX_AGGREGATION_METRIC ? " (max)" : AVG_AGGREGATION_METRICS.has(metric) ? " (śr.)" : null;
                            const val = tableTeamSums.metrics[metric];
                            const display = val != null && !Number.isNaN(val) ? (Number.isInteger(val) ? String(val) : val.toFixed(2)) : "—";
                            return (
                              <td
                                key={metric}
                                className={styles.tableFooterCell}
                                title={metric === MAX_AGGREGATION_METRIC ? "Maksymalna wartość" : AVG_AGGREGATION_METRICS.has(metric) ? "Średnia" : undefined}
                              >
                                {display}{aggLabel ?? ""}
                              </td>
                            );
                          })}
                        </tr>
                        {tableEntryCount > 0 && (
                          <tr className={styles.tableFooterRow}>
                            <td className={styles.tableFooterCell}>Średnia</td>
                            <td className={styles.tableFooterCell} />
                            <td className={styles.tableFooterCell}>
                              {tableTeamAvgs.avgMinutes > 0 ? Math.round(tableTeamAvgs.avgMinutes) : "—"}
                            </td>
                            {normsForTableDaySorted.map((metric) => {
                              const val = tableTeamAvgs.metrics[metric];
                              const display = val != null && !Number.isNaN(val) ? (Number.isInteger(val) ? String(val) : val.toFixed(2)) : "—";
                              return <td key={metric} className={styles.tableFooterCell}>{display}</td>;
                            })}
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                  )}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Zakładka: Widok zawodnika — ostatnie dni treningowe */}
      {activeTab === "player" && (
        <div className={styles.configSection}>
          <div className={styles.tablePanel}>
            <h3 className={styles.tablePanelTitle}>Widok zawodnika</h3>
            <div className={`${styles.configHeader} ${styles.configHeaderRow}`}>
              <div className={styles.formGroup}>
                <label htmlFor="table-player-select">Zawodnik</label>
                <select
                  id="table-player-select"
                  value={selectedPlayerForTable}
                  onChange={(e) => setSelectedPlayerForTable(e.target.value)}
                  className={styles.select}
                >
                  <option value="">-- Wybierz zawodnika --</option>
                  {selectedTeam && sortPlayersByLastName(
                    players.filter((p) => p.teams?.includes(selectedTeam) || (p as any).teamId === selectedTeam)
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {`${getPlayerLastName(p)} ${getPlayerFirstName(p)}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="table-player-day-filter">Pokaż dni</label>
                <select
                  id="table-player-day-filter"
                  value={selectedDayFilterForPlayer}
                  onChange={(e) => setSelectedDayFilterForPlayer(e.target.value)}
                  className={styles.select}
                >
                  <option value="all">Wszystkie</option>
                  {dayOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="table-player-last-x-days">Pokaż ostatnie (dni)</label>
                <input
                  id="table-player-last-x-days"
                  type="number"
                  min={1}
                  placeholder="wszystkie"
                  value={lastXDaysPlayer}
                  onChange={(e) => setLastXDaysPlayer(e.target.value.replace(/[^0-9]/g, ""))}
                  className={styles.select}
                />
              </div>
            </div>
            {selectedPlayerForTable && (
              <div className={`${styles.configHeader} ${styles.configHeaderRow}`}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Mecze do targetu (1–5)</label>
                  <div
                    className={styles.combinedDropBox}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(styles.combinedSlotOver); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove(styles.combinedSlotOver); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove(styles.combinedSlotOver);
                      try {
                        const raw = e.dataTransfer.getData("application/json");
                        if (!raw) return;
                        const payload = JSON.parse(raw) as { dateStr: string; minutes?: number };
                        const { dateStr, minutes } = payload;
                        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
                        if (typeof minutes === "number" && minutes < MIN_MATCH_MINUTES) {
                          setError("Nie można dodać meczu: w tym meczu jest mniej niż 75 min gry.");
                          return;
                        }
                        setError(null);
                        setTargetMatchDateStrs((prev) => {
                          if (prev.includes(dateStr) || prev.length >= 5) return prev;
                          return [...prev, dateStr].sort();
                        });
                      } catch (_) {}
                    }}
                  >
                    {targetMatchDateStrs.length === 0 ? (
                      <span className={styles.combinedSlotPlaceholder}>Przeciągnij mecze z tabeli (min. 1, max. 5, co najmniej 75 min w meczu)</span>
                    ) : (
                      targetMatchDateStrs.map((dateStr) => {
                        const m = teamMatches.find((x) => x.dateStr === dateStr);
                        const label = m ? `${m.opponent} (${dateStr})` : dateStr;
                        return (
                          <span key={dateStr} className={styles.combinedSlotChip}>
                            {label}
                            <button type="button" className={styles.combinedSlotRemove} onClick={() => setTargetMatchDateStrs((prev) => prev.filter((d) => d !== dateStr))} aria-label="Usuń">×</button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.saveButton}
                  disabled={targetMatchDateStrs.length < 1 || targetMatchDateStrs.length > 5 || savingTargetMatches}
                  onClick={saveTargetMatchesToFirebase}
                >
                  {savingTargetMatches ? "Zapisywanie…" : "Zapisz mecze do targetu"}
                </button>
              </div>
            )}
            {!selectedPlayerForTable ? (
              <p className={styles.helpText}>Wybierz zawodnika, aby zobaczyć jego ostatnie dni treningowe.</p>
            ) : isLoadingPlayerTable ? (
              <div className={styles.loading}>Ładowanie danych zawodnika…</div>
            ) : normsForTableDaySorted.length === 0 ? (
              <p className={styles.helpText}>Wybierz metryki w zakładce „Metryki na dzień”, aby zobaczyć kolumny.</p>
            ) : (() => {
              const byDay = selectedDayFilterForPlayer === "all"
                ? playerTableData
                : playerTableData.filter((e) => e.day === selectedDayFilterForPlayer);
              const sorted = [...byDay].sort((a, b) => {
                const da = toDateStr(a.date);
                const db = toDateStr(b.date);
                return da > db ? -1 : da < db ? 1 : 0;
              });
              const xDays = parseInt(lastXDaysPlayer, 10);
              const filtered = (() => {
                if (!Number.isInteger(xDays) || xDays < 1) return sorted;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const lastXDatesSet = new Set<string>();
                for (let i = 0; i < xDays; i++) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  lastXDatesSet.add(d.toISOString().slice(0, 10));
                }
                return sorted.filter((e) => lastXDatesSet.has(toDateStr(e.date)));
              })();
              if (filtered.length === 0) {
                return <p className={styles.helpText}>Brak danych dla wybranego filtra dni.</p>;
              }
              const getPlayerSortVal = (entry: any): string | number => {
                if (playerTableSort.key === "date") return toDateStr(entry.date) || "";
                if (playerTableSort.key === "day") {
                  const d = entry.day === "MD" ? (teamMatches.find((m) => m.dateStr === toDateStr(entry.date))?.opponent ?? "MD") : (entry.day ?? "");
                  return `${d} ${toDateStr(entry.date)}`;
                }
                if (playerTableSort.key === "minutes") {
                  if (entry.day === "MD") return playerMinutesForPlayerView[toDateStr(entry.date)] ?? -1;
                  const m = parseTotalTimeToMinutes(entry.total?.["Total Time"]);
                  return m ?? -1;
                }
                const v = getMetricValue(entry.total ?? {}, playerTableSort.key, combinedMetrics);
                const n = Number(v);
                return Number.isNaN(n) ? -Infinity : n;
              };
              const sortedFiltered = playerTableSort.key
                ? [...filtered].sort((a, b) => {
                    const va = getPlayerSortVal(a);
                    const vb = getPlayerSortVal(b);
                    const cmp = typeof va === "string" ? String(va).localeCompare(String(vb), "pl") : (va as number) - (vb as number);
                    return playerTableSort.dir === "asc" ? (cmp < 0 ? -1 : cmp > 0 ? 1 : 0) : cmp > 0 ? -1 : cmp < 0 ? 1 : 0;
                  })
                : filtered;
              const playerSums: Record<string, number> = {};
              const playerAvgAccum: Record<string, { s: number; n: number }> = {};
              const playerSumForAvg: Record<string, number> = {};
              normsForTableDaySorted.forEach((m) => {
                if (AVG_AGGREGATION_METRICS.has(m)) playerAvgAccum[m] = { s: 0, n: 0 };
                playerSumForAvg[m] = 0;
              });
              let timeSum: number | null = null;
              filtered.forEach((entry) => {
                const data = entry.total ?? {};
                const mins = entry.day === "MD"
                  ? (playerMinutesForPlayerView[toDateStr(entry.date)] ?? null)
                  : parseTotalTimeToMinutes(data["Total Time"]);
                if (mins != null) timeSum = (timeSum ?? 0) + mins;
                normsForTableDaySorted.forEach((metric) => {
                  const v = getMetricValue(data, metric, combinedMetrics);
                  const n = typeof v === "number" && !Number.isNaN(v) ? v : Number(v);
                  if (Number.isNaN(n)) return;
                  playerSumForAvg[metric] = (playerSumForAvg[metric] ?? 0) + n;
                  if (metric === MAX_AGGREGATION_METRIC) {
                    playerSums[metric] = Math.max(playerSums[metric] ?? -Infinity, n);
                  } else if (AVG_AGGREGATION_METRICS.has(metric)) {
                    playerAvgAccum[metric].s += n;
                    playerAvgAccum[metric].n += 1;
                  } else {
                    playerSums[metric] = (playerSums[metric] ?? 0) + n;
                  }
                });
              });
              normsForTableDaySorted.forEach((m) => {
                if (AVG_AGGREGATION_METRICS.has(m) && playerAvgAccum[m].n > 0) playerSums[m] = playerAvgAccum[m].s / playerAvgAccum[m].n;
              });
              const nPlayer = filtered.length;
              const playerAvgs: Record<string, number> = {};
              normsForTableDaySorted.forEach((m) => {
                playerAvgs[m] = nPlayer > 0 && Number.isFinite(playerSumForAvg[m]) ? playerSumForAvg[m] / nPlayer : NaN;
              });
              const timeAvg = nPlayer > 0 && timeSum != null ? timeSum / nPlayer : null;
              return (
                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th
                          className={`${styles.sortable} ${playerTableSort.key === "date" ? styles.sortableActive : ""}`}
                          onClick={() => setPlayerTableSort((prev) => ({ key: "date", dir: prev.key === "date" && prev.dir === "asc" ? "desc" : "asc" }))}
                          title="Sortuj"
                        >
                          Data
                        </th>
                        <th
                          className={`${styles.sortable} ${playerTableSort.key === "day" ? styles.sortableActive : ""}`}
                          onClick={() => setPlayerTableSort((prev) => ({ key: "day", dir: prev.key === "day" && prev.dir === "asc" ? "desc" : "asc" }))}
                          title="Sortuj"
                        >
                          Dzień
                        </th>
                        <th
                          className={`${styles.sortable} ${playerTableSort.key === "minutes" ? styles.sortableActive : ""}`}
                          title="Czas. Kliknij, by sortować."
                          onClick={() => setPlayerTableSort((prev) => ({ key: "minutes", dir: prev.key === "minutes" && prev.dir === "asc" ? "desc" : "asc" }))}
                        >
                          Czas
                        </th>
                        {normsForTableDaySorted.map((m) => (
                          <th
                            key={m}
                            className={`${styles.sortable} ${playerTableSort.key === m ? styles.sortableActive : ""}`}
                            title={`${getMetricHeaderTitle(m, selectedProvider, combinedMetrics)} Kliknij, by sortować.`}
                            onClick={() => setPlayerTableSort((prev) => ({ key: m, dir: prev.key === m && prev.dir === "asc" ? "desc" : "asc" }))}
                          >
                            {getMetricShortLabel(m)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFiltered.map((entry) => {
                        const data = entry.total ?? {};
                        const totalTimeRaw = data["Total Time"];
                        const dateStr = entry.date ? new Date(entry.date).toLocaleDateString("pl-PL") : "—";
                        const dayOrOpponent = entry.day === "MD"
                          ? (teamMatches.find((m) => m.dateStr === toDateStr(entry.date))?.opponent ?? "MD")
                          : (entry.day ?? "—");
                        const dayOfWeek = entry.date
                          ? (() => { const w = new Date(entry.date).toLocaleDateString("pl-PL", { weekday: "long" }); return w.charAt(0).toUpperCase() + w.slice(1); })()
                          : "";
                        const minsPlayer = entry.day === "MD"
                          ? (playerMinutesForPlayerView[toDateStr(entry.date)] ?? null)
                          : parseTotalTimeToMinutes(totalTimeRaw);
                        const displayTime = minsPlayer != null && !Number.isNaN(minsPlayer) ? String(Math.round(minsPlayer)) : "—";
                        const entryDateStr = toDateStr(entry.date);
                        const isMD = entry.day === "MD";
                        const canDragMatch = isMD && minsPlayer != null && !Number.isNaN(minsPlayer) && minsPlayer >= MIN_MATCH_MINUTES;
                        return (
                          <tr key={entry.id}>
                            <td>{dateStr}</td>
                            <td
                              draggable={canDragMatch}
                              onDragStart={canDragMatch ? (ev) => { ev.dataTransfer.setData("application/json", JSON.stringify({ dateStr: entryDateStr, opponent: dayOrOpponent, minutes: minsPlayer })); ev.dataTransfer.effectAllowed = "copy"; } : undefined}
                              className={isMD ? (canDragMatch ? styles.draggableCell : styles.draggableCellDisabled) : undefined}
                              title={isMD ? (canDragMatch ? "Przeciągnij do „Mecze do targetu”" : "Nie można dodać: w meczu mniej niż 75 min gry") : undefined}
                            >
                              <span>{dayOrOpponent}</span>
                              {dayOfWeek ? <span className={styles.dayCellSub}>{dayOfWeek}</span> : null}
                            </td>
                            <td>{displayTime}</td>
                            {normsForTableDaySorted.map((metric) => {
                              const val = getMetricValue(data, metric, combinedMetrics);
                              if (val == null || val === "") return <td key={metric}>—</td>;
                              const num = Number(val);
                              if (!Number.isNaN(num)) return <td key={metric}>{Number.isInteger(num) ? String(num) : num.toFixed(2)}</td>;
                              return <td key={metric}>{String(val)}</td>;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className={styles.tableFooterRow}>
                        <td className={styles.tableFooterCell}>Suma</td>
                        <td className={styles.tableFooterCell} />
                        <td className={styles.tableFooterCell}>{timeSum != null ? String(Math.round(timeSum)) : "—"}</td>
                        {normsForTableDaySorted.map((metric) => {
                          const aggLabel = metric === MAX_AGGREGATION_METRIC ? " (max)" : AVG_AGGREGATION_METRICS.has(metric) ? " (śr.)" : null;
                          const val = playerSums[metric];
                          const display = val != null && !Number.isNaN(val) && val !== -Infinity
                            ? (Number.isInteger(val) ? String(val) : val.toFixed(2))
                            : "—";
                          return (
                            <td
                              key={metric}
                              className={styles.tableFooterCell}
                              title={metric === MAX_AGGREGATION_METRIC ? "Maksymalna wartość" : AVG_AGGREGATION_METRICS.has(metric) ? "Średnia" : undefined}
                            >
                              {display}{aggLabel ?? ""}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className={styles.tableFooterRow}>
                        <td className={styles.tableFooterCell}>Średnia</td>
                        <td className={styles.tableFooterCell} />
                        <td className={styles.tableFooterCell}>{timeAvg != null ? String(Math.round(timeAvg)) : "—"}</td>
                        {normsForTableDaySorted.map((metric) => {
                          const val = playerAvgs[metric];
                          const display = val != null && !Number.isNaN(val) ? (Number.isInteger(val) ? String(val) : val.toFixed(2)) : "—";
                          return <td key={metric} className={styles.tableFooterCell}>{display}</td>;
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default GPSDataSection;
