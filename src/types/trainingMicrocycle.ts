import type { GameModelPhaseId, GameModelRuleLevel } from "@/types/gameModel";

export interface TrainingMicrocycleSeason {
  id: string;
  name: string;
  /** Kolejność wyświetlania (rosnąco). */
  order: number;
}

export type MicrocycleMatchVenue = "home" | "away";
export type MicrocycleMatchCompetition = "friendly" | "league" | "cup";

export const MICROCYCLE_MATCH_VENUE_LABELS: Record<MicrocycleMatchVenue, string> = {
  home: "Dom",
  away: "Wyjazd",
};

export const MICROCYCLE_MATCH_COMPETITION_LABELS: Record<MicrocycleMatchCompetition, string> = {
  friendly: "Towarzyski",
  league: "Ligowy",
  cup: "Puchar",
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
  competition: MicrocycleMatchCompetition;
  /** Adres obiektu / miejsca rozgrywania meczu. */
  venueAddress: string;
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

export interface TrainingMicrocycleState {
  seasons: TrainingMicrocycleSeason[];
  microcycles: TrainingMicrocycle[];
  assignments: MicrocycleDayAssignment[];
  dayPlans: MicrocycleDayPlan[];
  /** Łączna liczba treningów danego elementu modelu (po templateId). */
  trainingCounts: Record<string, number>;
  activeSeasonId: string | null;
  activeMicrocycleId: string | null;
}

/** Biblioteka szablonów tytułów dni — wspólna per użytkownik (nie per zespół). */
export interface TrainingDayTitleTemplatesState {
  templates: TrainingDayTitleTemplate[];
}

export const TRAINING_MICROCYCLE_VERSION = 6 as const;

/** Dokument w `teams/{teamId}/staff/` — nie pokazuj w kwadrancie Eisenhowera. */
export const TRAINING_MICROCYCLE_TASKS_DOC_ID = "trainingMicrocycleState" as const;

/** Dokument w `users/{uid}/tasks/` — biblioteka szablonów tytułów dni. */
export const TRAINING_DAY_TITLE_TEMPLATES_DOC_ID = "trainingDayTitleTemplatesState" as const;

export const TRAINING_DAY_TITLE_TEMPLATES_VERSION = 1 as const;
