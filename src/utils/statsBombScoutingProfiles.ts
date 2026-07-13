import type { StatsBombReportPhase } from "./statsBombTeamReport";

export type StatsBombScoutingPositionId = "defensive_midfielder";

export type StatsBombScoutingCriterion = {
  id: string;
  /** Opis wymagania taktycznego (PL). */
  label: string;
  /** Krótkie uzasadnienie mapowania na dane StatsBomb. */
  rationale: string;
  phase: StatsBombReportPhase;
  /** Kolumny Squad STATS — pierwsza dostępna w eksporcie wygrywa. */
  metricCandidates: string[];
  /** Domyślnie z reguł raportu zawodnika; nadpisz gdy trzeba. */
  higherIsBetter?: boolean;
};

export type StatsBombScoutingPositionProfile = {
  id: StatsBombScoutingPositionId;
  label: string;
  subtitle: string;
  criteria: StatsBombScoutingCriterion[];
};

export const STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING: StatsBombScoutingPositionProfile = {
  id: "defensive_midfielder",
  label: "Defensywny pomocnik (6)",
  subtitle:
    "Profil łącznika defensywno-ofensywnego: jakość podań, progresja, gra pod presją oraz intensywny pressing i odbiór.",
  criteria: [
    {
      id: "pass_quality",
      label: "Jakość podań (krótkie, długie, diagonalne, progresywne)",
      rationale: "Skuteczność podań ogółem, długich podań oraz progresji głębokiej.",
      phase: "attack",
      metricCandidates: [
        "Passing%",
        "Successful Long Balls",
        "Long Ball%",
        "Deep Progressions",
        "Successful Pass Length",
      ],
    },
    {
      id: "under_pressure",
      label: "Gra pod presją",
      rationale: "Skuteczność podań pod presją rywala — utrzymanie piłki w sytuacjach pressingu.",
      phase: "attack",
      metricCandidates: [
        "Pressured Pass%",
        "Passes Being Pressured%",
        "Successful Pressured Pass Length",
      ],
      higherIsBetter: undefined,
    },
    {
      id: "ball_retention",
      label: "Retencja piłki (brak strat)",
      rationale:
        "Dispossessed (utrata przez odbiór) i Turnovers (miscontrol / nieudany dribbling) — im mniej, tym lepiej.",
      phase: "attack",
      metricCandidates: ["Dispossessed", "Turnovers"],
      higherIsBetter: undefined,
    },
    {
      id: "support_activity",
      label: "Stała aktywność we wsparciu partnerów",
      rationale: "Wolumen podań i odebranych podań — zaangażowanie w budowanie gry.",
      phase: "attack",
      metricCandidates: ["Received Passes", "Open Play Passes", "Passes", "Non Throw-in Passes"],
    },
    {
      id: "central_links",
      label: "Tworzenie centralnych połączeń w grze",
      rationale: "Podań w ostatniej tercji i łamanie linii — łączenie stref centralnych.",
      phase: "attack",
      metricCandidates: [
        "Open Play Passes in Final Third",
        "Non Throw-in Passes Into Final Third",
        "Line Breaking Passes Completed",
        "Line Breaking Passes Completed%",
      ],
    },
    {
      id: "sector_linker",
      label: "Łączenie sektorów zespołu",
      rationale: "Progresja między tercjami i wartość podań (OBV).",
      phase: "attack",
      metricCandidates: [
        "Deep Progressions",
        "Line Breaking Passes Completed",
        "Non Throw-in Passes from Defensive Third",
        "Pass OBV",
      ],
    },
    {
      id: "scanning",
      label: "Orientacja i skanowanie przed odbiorem",
      rationale: "Odbiory w wolnej przestrzeni — sygnał wcześniejszego skanowania.",
      phase: "attack",
      metricCandidates: [
        "Ball Receipts in Space 10m%",
        "Ball Receipts in Space 10m% in Opposing Half",
        "Space Received In",
        "Ball Receipts in Space 5m%",
      ],
    },
    {
      id: "tempo_control",
      label: "Kontrolowanie tempa gry",
      rationale: "Podań w tył (recykling) oraz długość podań — zarządzanie tempem.",
      phase: "attack",
      metricCandidates: [
        "Pass Backward%",
        "Open Play Pass Backward% in Final Third",
        "Pass Length",
        "Open Play Passes",
      ],
      higherIsBetter: undefined,
    },
    {
      id: "ball_progression",
      label: "Progresja piłki podaniem lub prowadzeniem",
      rationale: "Deep progressions, carries i OBV z prowadzenia.",
      phase: "attack",
      metricCandidates: [
        "Deep Progressions",
        "Carries",
        "Dribble & Carry OBV",
        "Successful Dribbles",
      ],
    },
    {
      id: "progressive_seeking",
      label: "Szukanie podań progresywnych",
      rationale: "Podań do przodu, through balls i line breaking.",
      phase: "attack",
      metricCandidates: [
        "Pass Forward%",
        "Open Play Pass Forward% in Final Third",
        "Line Breaking Passes",
        "Non Throw-in Through Balls",
        "Successful Through Balls",
      ],
    },
    {
      id: "pressing_intensity",
      label: "Intensywność w pressingu",
      rationale: "Pressures, akcje agresywne i kontrpressing.",
      phase: "defense",
      metricCandidates: [
        "Counterpressures in Opposing Half",
        "Counterpressures",
        "Pressures",
        "Aggressive Actions",
      ],
    },
    {
      id: "on_ball_value",
      label: "Wartość akcji z piłką (OBV)",
      rationale:
        "OBV — metryka często silnie skorelowana z wynikiem drużyny; wkład zawodnika w wartość akcji z piłką.",
      phase: "attack",
      metricCandidates: ["OBV", "Pass OBV", "Dribble & Carry OBV", "Shot OBV"],
    },
    {
      id: "clearances",
      label: "Wybicia i czyszczenie strefy (Clearances)",
      rationale: "Clearances — wolumen wybicia piłki z strefy defensywnej.",
      phase: "defense",
      metricCandidates: ["Clearances"],
    },
    {
      id: "counterpress_opposing_half",
      label: "Kontrpressing w połowie rywala",
      rationale: "Counterpressures in Opposing Half — odzysk wysoko na boisku.",
      phase: "defense",
      metricCandidates: [
        "Counterpressures in Opposing Half",
        "Counterpressures in Opposing Half%",
        "Counterpressures",
      ],
    },
    {
      id: "space_closing",
      label: "Przesuwanie i zamykanie przestrzeni",
      rationale: "Pressing wysoko (dystans akcji defensywnych) i kontrpressing w połowie rywala.",
      phase: "defense",
      metricCandidates: [
        "Counterpressures in Opposing Half",
        "Counterpressures in Opposing Half%",
        "Defensive Action Distance",
        "Pressures",
      ],
    },
    {
      id: "anticipation",
      label: "Antycypacja gry",
      rationale: "Przechwycenia i odzyskania piłki.",
      phase: "defense",
      metricCandidates: ["Interceptions", "Tackles & Interceptions", "Ball Recoveries"],
    },
    {
      id: "zone_mobility",
      label: "Mobilność w zabezpieczaniu wyznaczonych stref",
      rationale: "Akcje defensywne wysoko na boisku oraz wolumen odbiorów.",
      phase: "defense",
      metricCandidates: [
        "Defensive Action Distance",
        "Tackles & Interceptions",
        "Ball Recoveries in Opposing Half",
        "Pressures",
      ],
    },
    {
      id: "space_filling",
      label: "Wypełnianie przestrzeni",
      rationale: "Odzyskania i przechwycenia — zamykanie linii przekazań.",
      phase: "defense",
      metricCandidates: ["Ball Recoveries", "Interceptions", "Tackles & Interceptions"],
    },
    {
      id: "duels",
      label: "Skuteczność w pojedynkach 1v1 i 1v2",
      rationale: "Tackles & interceptions, minięcia (mniej = lepiej) oraz pojedynki powietrzne.",
      phase: "defense",
      metricCandidates: [
        "Tackles & Interceptions",
        "Dribbled Past",
        "Aerial Win%",
        "Aerial Wins",
      ],
      higherIsBetter: undefined,
    },
    {
      id: "forward_defense",
      label: "Aktywność w odbiorze i działaniach defensywnych do przodu",
      rationale: "Kontrpressing, OBV defensywny i odzyskania w połowie rywala.",
      phase: "defense",
      metricCandidates: [
        "Counterpressures in Opposing Half",
        "Defensive Action OBV",
        "Counterpressures",
        "Tackles & Interceptions",
        "Ball Recoveries in Opposing Half",
      ],
    },
  ],
};

export const STATSBOMB_SCOUTING_POSITIONS: StatsBombScoutingPositionProfile[] = [
  STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING,
];

export function getStatsBombScoutingPosition(
  positionId: StatsBombScoutingPositionId,
): StatsBombScoutingPositionProfile | undefined {
  return STATSBOMB_SCOUTING_POSITIONS.find((profile) => profile.id === positionId);
}
