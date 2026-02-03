// src/components/GPSDataSection/GPSDataSection.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { TeamInfo, Player, GPSDataEntry, GPSProvider } from "@/types";
import { analyzeCSVStructure, parseCSV, CSVStructure } from "@/utils/csvAnalyzer";
import { buildPlayersIndex, getPlayerFirstName, getPlayerFullName, getPlayerLabel, getPlayerLastName, sortPlayersByLastName } from "@/utils/playerUtils";
import { getDB } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import styles from "./GPSDataSection.module.css";

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

const GPS_DAY_KEYS = ["MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2", "MD+3"] as const;
type GPSDayKey = (typeof GPS_DAY_KEYS)[number];

const GPS_DATA_COLLECTION = "gps";

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
  const [activeTab, setActiveTab] = useState<"add" | "view">("add");
  const [expandedGPSEntries, setExpandedGPSEntries] = useState<Set<string>>(new Set());
  const [editingAssignmentEntryId, setEditingAssignmentEntryId] = useState<string | null>(null);
  const [reassignPlayerId, setReassignPlayerId] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);
  const playersIndex = React.useMemo(() => buildPlayersIndex(players), [players]);

  const [gpsDataFromFirebase, setGpsDataFromFirebase] = useState<any[]>([]);
  const [isLoadingGPSData, setIsLoadingGPSData] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"firstHalf" | "secondHalf" | "total">("total");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = () => {
    setCsvData([]);
    setCsvStructure(null);
    setFileName(null);
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

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const db = getDB();

      // Przygotuj dane GPS dla wszystkich zmapowanych zawodników
      const savePromises = matchedPlayers.map(async ({ rows, player, manualPlayerId }) => {
        // Użyj ręcznie wybranego zawodnika jeśli dostępny, w przeciwnym razie użyj automatycznie dopasowanego
        const finalPlayer = manualPlayerId 
          ? players.find(p => p.id === manualPlayerId) || player
          : player;

        if (!finalPlayer) return null;

        const { firstHalf, secondHalf, total } = extractGPSDataByPeriod(rows);

        // Zapisz jako osobny dokument w kolekcji "gps"
        await addDoc(collection(db, GPS_DATA_COLLECTION), {
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
        });
      });

      await Promise.all(savePromises.filter(p => p !== null));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd podczas zapisywania danych GPS do Firebase';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchGPSDataFromFirebase = async () => {
    if (!selectedTeam || !selectedDate) return [];
    const db = getDB();

    const fetchWithProvider = async (withProvider: boolean) => {
      const constraints: any[] = [
        where("teamId", "==", selectedTeam),
        where("date", "==", selectedDate),
      ];
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

    // Preferuj rekordy z provider. Fallback: stare dane bez provider (tylko dla STATSports)
    let gpsData: any[] = [];
    try {
      gpsData = await fetchWithProvider(true);
    } catch (e) {
      console.warn("Nie udało się pobrać danych z filtrem provider (prawdopodobnie brak indeksu). Fallback bez provider.", e);
      gpsData = [];
    }

    // Fallback: stare dane bez provider (lub brak indeksu na provider)
    if (gpsData.length === 0 && selectedProvider === "STATSports") {
      try {
        gpsData = await fetchWithProvider(false);
      } catch (e) {
        console.error("Nie udał się fallback bez provider:", e);
        gpsData = [];
      }
    }
    return gpsData;
  };

  // Pobierz dane GPS z Firebase dla podglądu
  useEffect(() => {
    const loadGPSData = async () => {
      if (!selectedTeam || !selectedDate || activeTab !== "view") {
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
  }, [selectedTeam, selectedDate, activeTab, selectedProvider]);

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
      {/* Selektor zespołu i daty */}
      <div className={styles.selectorsSection}>
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
        <div className={styles.formGroup}>
          <label htmlFor="team-select">Zespół:</label>
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
          <label htmlFor="date-select">Data:</label>
          <input
            id="date-select"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={styles.select}
          />
        </div>
      </div>

      {/* Zakładki */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "add" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("add")}
        >
          Dodaj dane
        </button>
        <button
          className={`${styles.tab} ${activeTab === "view" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("view")}
        >
          Podgląd danych
        </button>
      </div>

      {/* Zakładka: Dodaj dane */}
      {activeTab === "add" && (
        <>

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
                {isSaving ? 'Zapisywanie...' : `Zapisz ${mappedPlayers.filter(mp => mp.player || mp.manualPlayerId).length} zawodników do Firebase`}
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
          <h3>Struktura pliku CSV</h3>
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
                    <span className={styles.columnType}>
                      {csvStructure.columnTypes[header]}
                    </span>
                  </div>
                  {csvStructure.columnSamples[header].length > 0 && (
                    <div className={styles.columnSamples}>
                      <span className={styles.samplesLabel}>Przykłady:</span>
                      {csvStructure.columnSamples[header].slice(0, 3).map((sample, i) => (
                        <span key={i} className={styles.sampleValue}>
                          {String(sample).substring(0, 30)}
                          {String(sample).length > 30 ? '...' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {csvData.length > 0 && (
        <div className={styles.dataPreview}>
          <h3>Podgląd danych ({csvData.length} wierszy)</h3>
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
                      <td key={colIndex}>
                        {row[header] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.length > 20 && (
              <div className={styles.moreRows}>
                ... i {csvData.length - 20} więcej wierszy
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* Zakładka: Podgląd danych */}
      {activeTab === "view" && (
        <div className={styles.viewSection}>
          {!selectedTeam || !selectedDate ? (
            <div className={styles.noMatchSelected}>
              <p>Wybierz zespół i datę, aby zobaczyć zapisane dane GPS.</p>
            </div>
          ) : isLoadingGPSData ? (
            <div className={styles.loading}>Ładowanie danych GPS...</div>
          ) : gpsDataFromFirebase.length === 0 ? (
            <div className={styles.noData}>
              <p>Brak zapisanych danych GPS dla tego meczu.</p>
            </div>
          ) : (
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
              <div className={styles.gpsDataList}>
                {gpsDataFromFirebase.map((entry, index) => {
                  const player = players.find(p => p.id === entry.playerId);
                  const isExpanded = expandedGPSEntries.has(entry.id);
                  const toggleExpanded = () => {
                    setExpandedGPSEntries(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(entry.id)) {
                        newSet.delete(entry.id);
                      } else {
                        newSet.add(entry.id);
                      }
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpanded();
                          }
                        }}
                      >
                        <div className={styles.gpsDataHeaderTop}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded();
                            }}
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
                        {/* Przypisz do innego zawodnika */}
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
                                {selectedTeam &&
                                  sortPlayersByLastName(
                                    players.filter(
                                      (p) =>
                                        selectedTeam &&
                                        (p.teams?.includes(selectedTeam) || (p as any).teamId === selectedTeam)
                                    )
                                  ).map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {`${getPlayerLastName(p)} ${getPlayerFirstName(p)}`.trim()}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                className={styles.saveButton}
                                disabled={!reassignPlayerId || isReassigning}
                                onClick={() => handleReassignGPSData(entry.id, reassignPlayerId)}
                              >
                                {isReassigning ? "Zapisywanie…" : "Zapisz"}
                              </button>
                              <button
                                type="button"
                                className={styles.clearButton}
                                onClick={() => {
                                  setEditingAssignmentEntryId(null);
                                  setReassignPlayerId("");
                                }}
                                disabled={isReassigning}
                              >
                                Anuluj
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={styles.reassignLinkButton}
                              onClick={() => {
                                setEditingAssignmentEntryId(entry.id);
                                setReassignPlayerId(entry.playerId || "");
                              }}
                            >
                              Zmień zawodnika
                            </button>
                          )}
                        </div>
                        {/* Przełącznik okresu */}
                        <div className={styles.periodTabs}>
                          <button
                            type="button"
                            className={`${styles.periodTab} ${selectedPeriod === "firstHalf" ? styles.periodTabActive : ""}`}
                            onClick={() => setSelectedPeriod("firstHalf")}
                            disabled={Object.keys(entry.firstHalf).length === 0}
                          >
                            I połowa
                          </button>
                          <button
                            type="button"
                            className={`${styles.periodTab} ${selectedPeriod === "secondHalf" ? styles.periodTabActive : ""}`}
                            onClick={() => setSelectedPeriod("secondHalf")}
                            disabled={Object.keys(entry.secondHalf).length === 0}
                          >
                            II połowa
                          </button>
                          <button
                            type="button"
                            className={`${styles.periodTab} ${selectedPeriod === "total" ? styles.periodTabActive : ""}`}
                            onClick={() => setSelectedPeriod("total")}
                            disabled={Object.keys(entry.total).length === 0}
                          >
                            Cały mecz
                          </button>
                        </div>

                        {/* Wyświetl wybrany okres */}
                        {selectedPeriod === "firstHalf" && Object.keys(entry.firstHalf).length > 0 && (
                          <div className={styles.gpsDataPeriod}>
                            <div className={styles.gpsDataMetrics}>
                              {Object.entries(entry.firstHalf).map(([key, value]) => (
                                <div key={key} className={styles.gpsMetric}>
                                  <span
                                    className={styles.metricLabel}
                                    title={getGpsMetricTooltip(key, (entry.provider || selectedProvider) as GPSProvider)}
                                  >
                                    {key}:
                                  </span>
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
                                  <span
                                    className={styles.metricLabel}
                                    title={getGpsMetricTooltip(key, (entry.provider || selectedProvider) as GPSProvider)}
                                  >
                                    {key}:
                                  </span>
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
                                  <span
                                    className={styles.metricLabel}
                                    title={getGpsMetricTooltip(key, (entry.provider || selectedProvider) as GPSProvider)}
                                  >
                                    {key}:
                                  </span>
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
              
              {/* Przycisk usuwania wszystkich danych z dnia */}
              {gpsDataFromFirebase.length > 0 && (
                <div className={styles.deleteAllSection}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Czy na pewno chcesz usunąć wszystkie dane GPS (${gpsDataFromFirebase.length} zawodników) z dnia ${selectedDate}?`)) {
                        return;
                      }

                      const entriesWithId = gpsDataFromFirebase.filter((e) => e?.id);
                      if (entriesWithId.length !== gpsDataFromFirebase.length) {
                        setError("Część wpisów nie ma poprawnego ID dokumentu. Odśwież listę i spróbuj ponownie.");
                        return;
                      }

                      setIsLoadingGPSData(true);
                      setError(null);

                      try {
                        const db = getDB();
                        const deletePromises = entriesWithId.map((entry) =>
                          deleteDoc(doc(db, GPS_DATA_COLLECTION, entry.id))
                        );

                        await Promise.all(deletePromises);
                        console.log("Wszystkie dane GPS usunięte z Firebase");

                        // Odśwież dane
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        const gpsData = await fetchGPSDataFromFirebase();
                        setGpsDataFromFirebase(gpsData);
                      } catch (err) {
                        console.error("Błąd podczas usuwania wszystkich danych GPS:", err);
                        const errorMessage =
                          err instanceof Error ? err.message : "Błąd podczas usuwania danych GPS";
                        setError(errorMessage);
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
          )}
        </div>
      )}
    </div>
  );
};

export default GPSDataSection;
