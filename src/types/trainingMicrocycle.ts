import type { GameModelPhaseId, GameModelRuleLevel } from "@/types/gameModel";
import type {
  MicrocycleDayLoadTargets,
  MotorDominantId,
  MotorTagId,
} from "@/types/microcycleMotor";

export interface TrainingMicrocycleSeason {
  id: string;
  name: string;
  /** Kolejność wyświetlania (rosnąco). */
  order: number;
}

export type MicrocycleMatchVenue = "home" | "away";
export type MicrocycleMatchCompetition = "friendly" | "league" | "cup";
export type MicrocycleMatchSurface = "natural" | "artificial" | "hybrid" | "indoor";
export type MicrocycleWeatherCondition =
  | "sunny"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "wind"
  | "unknown";

export const MICROCYCLE_MATCH_VENUE_LABELS: Record<MicrocycleMatchVenue, string> = {
  home: "Dom",
  away: "Wyjazd",
};

export const MICROCYCLE_MATCH_COMPETITION_LABELS: Record<MicrocycleMatchCompetition, string> = {
  friendly: "Towarzyski",
  league: "Ligowy",
  cup: "Puchar",
};

export const MICROCYCLE_MATCH_SURFACE_LABELS: Record<MicrocycleMatchSurface, string> = {
  natural: "Naturalna",
  artificial: "Sztuczna",
  hybrid: "Hybrydowa",
  indoor: "Hala",
};

export const MICROCYCLE_WEATHER_CONDITION_LABELS: Record<MicrocycleWeatherCondition, string> = {
  sunny: "Słonecznie",
  cloudy: "Pochmurno",
  rain: "Deszcz",
  storm: "Burza",
  snow: "Śnieg",
  wind: "Wiatr",
  unknown: "Nieznana",
};

/** Godziny treningu w danym dniu mikrocyklu. */
export interface MicrocycleDaySchedule {
  /** 0 = pn … 6 = nd */
  dayIndex: number;
  /** Godzina rozpoczęcia treningu (HH:MM), puste = brak. */
  startTime: string;
  /** Godzina zakończenia treningu (HH:MM), puste = brak. */
  endTime: string;
}

export interface MicrocycleMatch {
  /** 0 = pn … 6 = nd */
  dayIndex: number;
  /** Godzina rozpoczęcia (HH:MM). */
  kickoffTime: string;
  opponent: string;
  venue: MicrocycleMatchVenue;
  /**
   * Godzina wyjazdu na mecz (HH:MM).
   * Ma sens tylko przy `venue === "away"`; przy meczu domowym puste.
   */
  departureTime: string;
  competition: MicrocycleMatchCompetition;
  /** Adres obiektu / miejsca rozgrywania meczu. */
  venueAddress: string;
  /** Typ nawierzchni boiska. */
  surface: MicrocycleMatchSurface | null;
  /** Przewidywane warunki pogodowe. */
  weatherCondition: MicrocycleWeatherCondition | null;
  /** Przewidywana temperatura (°C). */
  weatherTempC: number | null;
}

/**
 * Obciążenie motoryczne dnia. Zapisujemy tylko odstępstwa od presetu MD —
 * brak wpisu = wartości wynikające z offsetu względem meczu.
 */
export interface MicrocycleDayLoad {
  /** 0 = pn … 6 = nd */
  dayIndex: number;
  /** null = dominanta z presetu dla offsetu MD. */
  dominant: MotorDominantId | null;
  /** Nadpisane cele obciążenia (tylko podane klucze). */
  targets?: Partial<MicrocycleDayLoadTargets>;
}

/** Blok treningowy w dniu mikrocyklu (rozgrzewka, SSG, siła…). */
export interface MicrocycleTrainingBlock {
  id: string;
  microcycleId: string;
  /** 0 = pn … 6 = nd */
  dayIndex: number;
  /** Kolejność w dniu (rosnąco). */
  order: number;
  name: string;
  minutes: number;
  /** Format gry z tabeli referencyjnej (np. "6v6") albo null. */
  formatId: string | null;
  /** Wymiary boiska w metrach — domyślnie z formatu, edytowalne. */
  pitchLength: number | null;
  pitchWidth: number | null;
  /** Graczy w zespole (bez bramkarzy) — potrzebne do m²/gracz. */
  playersPerSide: number | null;
  tags: MotorTagId[];
  notes: string;
}

export interface TrainingMicrocycle {
  id: string;
  seasonId: string;
  /** Numer mikrocyklu w sezonie: 1, 2, 3… */
  number: number;
  /** Poniedziałek tygodnia (YYYY-MM-DD). */
  weekStartIso: string;
  /** 1–2 mecze w tygodniu (posortowane po dniu). */
  matches: MicrocycleMatch[];
  /** Godziny treningów w poszczególnych dniach (sparse — tylko dni z wpisanymi godzinami). */
  daySchedules: MicrocycleDaySchedule[];
  /** Odstępstwa od presetów motorycznych (sparse). */
  dayLoads?: MicrocycleDayLoad[];
}

export interface MicrocycleDayAssignment {
  id: string;
  microcycleId: string;
  /** 0 = pn … 6 = nd */
  dayIndex: number;
  templateId: string;
  title: string;
  level: GameModelRuleLevel;
}

/** Szablon tytułu dnia treningowego (biblioteka nad siatką). */
export interface TrainingDayTitleTemplate {
  id: string;
  /** Ogólny charakter dnia — co trenujemy. */
  generalFocus: string;
  /** Jakie momenty w grze. */
  gameMoments: string;
  /**
   * Stałe przypisanie względem głównego dnia meczu (MD):
   * -1 = MD-1, -2 = MD-2, 0 = MD, null = bez domyślnego dnia.
   * Przy nowym mikrocyklu tytuł ląduje automatycznie na odpowiednim dniu.
   */
  defaultMatchDayOffset?: number | null;
}

/** Przypisanie tytułu dnia do konkretnego dnia w mikrocyklu. */
export interface MicrocycleDayPlan {
  id: string;
  microcycleId: string;
  dayIndex: number;
  templateId: string | null;
  generalFocus: string;
  gameMoments: string;
  /** Faza modelu gry, wokół której budujemy dzień (opcjonalnie). */
  phaseId?: GameModelPhaseId | null;
}

/** Szablon stałego zadania procesowego (biblioteka per użytkownik). */
export interface TrainingProceduralTaskTemplate {
  id: string;
  title: string;
  notes?: string;
  /**
   * Stałe przypisanie względem głównego dnia meczu (MD):
   * -5 = MD-5, -1 = MD-1, 0 = MD, null = bez domyślnego dnia.
   */
  defaultMatchDayOffset?: number | null;
}

/** Instancja zadania procesowego w konkretnym mikrocyklu. */
export interface MicrocycleProceduralTask {
  id: string;
  microcycleId: string;
  /** 0 = pn … 6 = nd */
  dayIndex: number;
  templateId: string | null;
  title: string;
  notes?: string;
  done: boolean;
}

/** Mecz z terminarza ŁNP (zapisany przy zespole). */
export interface LaczyTeamFixture {
  matchId: string;
  dateTime: string;
  state: string;
  playId: string;
  playName: string;
  hostId: string;
  hostName: string;
  guestId: string;
  guestName: string;
  stadium?: string;
  scoreFinal?: string | null;
}

export interface TrainingMicrocycleState {
  seasons: TrainingMicrocycleSeason[];
  microcycles: TrainingMicrocycle[];
  assignments: MicrocycleDayAssignment[];
  dayPlans: MicrocycleDayPlan[];
  /** Zadania procesowe wszystkich mikrocykli (filtrowane po microcycleId). */
  proceduralTasks?: MicrocycleProceduralTask[];
  /** Bloki treningowe wszystkich mikrocykli (filtrowane po microcycleId). */
  trainingBlocks?: MicrocycleTrainingBlock[];
  /** Łączna liczba treningów danego elementu modelu (po templateId). */
  trainingCounts: Record<string, number>;
  activeSeasonId: string | null;
  activeMicrocycleId: string | null;
  /** Link do drużyny ŁNP (rozgrywki/druzyna/…). */
  lnpTeamUrl?: string;
  lnpTeamId?: string | null;
  lnpTeamName?: string | null;
  /** Zapisany terminarz — nie trzeba pobierać przy każdym wejściu. */
  lnpFixtures?: LaczyTeamFixture[];
  /** ISO ostatniego udanego pobrania terminarza. */
  lnpFixturesFetchedAt?: string | null;
  /**
   * Podgląd terminarza innego zespołu (np. pierwsza drużyna przy pracy z rezerwami).
   * Tylko wgląd w mecze — bez uzupełniania mikrocykli.
   */
  lnpWatchTeamUrl?: string;
  lnpWatchTeamId?: string | null;
  lnpWatchTeamName?: string | null;
  lnpWatchFixtures?: LaczyTeamFixture[];
  lnpWatchFixturesFetchedAt?: string | null;
}

/** Biblioteka szablonów tytułów dni — wspólna per użytkownik (nie per zespół). */
export interface TrainingDayTitleTemplatesState {
  templates: TrainingDayTitleTemplate[];
}

/** Biblioteka szablonów zadań procesowych — wspólna per użytkownik. */
export interface TrainingProceduralTaskTemplatesState {
  templates: TrainingProceduralTaskTemplate[];
}

export const TRAINING_MICROCYCLE_VERSION = 10 as const;

/** Dokument w `teams/{teamId}/staff/` — nie pokazuj w kwadrancie Eisenhowera. */
export const TRAINING_MICROCYCLE_TASKS_DOC_ID = "trainingMicrocycleState" as const;

/** Dokument w `users/{uid}/tasks/` — biblioteka szablonów tytułów dni. */
export const TRAINING_DAY_TITLE_TEMPLATES_DOC_ID = "trainingDayTitleTemplatesState" as const;

export const TRAINING_DAY_TITLE_TEMPLATES_VERSION = 1 as const;

/** Dokument w `users/{uid}/tasks/` — biblioteka zadań procesowych. */
export const TRAINING_PROCEDURAL_TASK_TEMPLATES_DOC_ID =
  "trainingProceduralTaskTemplatesState" as const;

export const TRAINING_PROCEDURAL_TASK_TEMPLATES_VERSION = 1 as const;
