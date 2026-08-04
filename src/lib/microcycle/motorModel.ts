import type {
  MicrocycleDayLoadTargets,
  MotorDominantId,
  MotorTagId,
} from "@/types/microcycleMotor";

/** Domyślny blok w presecie dnia (bez id — id nadaje się przy tworzeniu). */
export interface MotorPresetBlock {
  name: string;
  minutes: number;
  tags: MotorTagId[];
  /** Format gry z tabeli referencyjnej, jeśli blok to gra. */
  formatId?: SsgFormatId | null;
  notes?: string;
}

export interface MotorDayPreset {
  /** Offset względem głównego dnia meczu: -5 … +1. */
  offset: number;
  dominant: MotorDominantId;
  title: string;
  motorGoal: string;
  tacticalGoal: string;
  targets: MicrocycleDayLoadTargets;
  /** Tagi, które powinny pojawić się w tym dniu. */
  expectedTags: MotorTagId[];
  /** Tagi, których w tym dniu unikamy. */
  avoidedTags: MotorTagId[];
  blocks: MotorPresetBlock[];
}

export type SsgFormatId =
  | "1v1"
  | "2v2"
  | "3v3"
  | "4v4"
  | "5v5"
  | "6v6"
  | "7v7"
  | "8v8"
  | "10v10"
  | "11v11";

export interface SsgFormat {
  id: SsgFormatId;
  label: string;
  playersPerSide: number;
  length: number;
  width: number;
  /** Powierzchnia na gracza bez bramkarzy, m². */
  areaPerPlayer: number;
  physiological: string;
  tactical: string;
  /** Offsety MD, w których format ma sens. */
  recommendedOffsets: number[];
}

function areaPerPlayerOf(length: number, width: number, playersPerSide: number): number {
  if (playersPerSide <= 0) return 0;
  return Math.round((length * width) / (playersPerSide * 2));
}

/** Powierzchnia na gracza (bez bramkarzy) — kluczowa zmienna doboru boiska. */
export function areaPerPlayer(
  length: number | null | undefined,
  width: number | null | undefined,
  playersPerSide: number | null | undefined
): number | null {
  if (!length || !width || !playersPerSide) return null;
  if (length <= 0 || width <= 0 || playersPerSide <= 0) return null;
  return areaPerPlayerOf(length, width, playersPerSide);
}

export const SSG_FORMATS: SsgFormat[] = [
  {
    id: "1v1",
    label: "1v1",
    playersPerSide: 1,
    length: 15,
    width: 12,
    areaPerPlayer: areaPerPlayerOf(15, 12, 1),
    physiological: "Maksymalne Acc/Dec, bardzo wysokie tętno, HSR bliskie zera.",
    tactical: "Pojedynek, praca ciałem, drybling.",
    recommendedOffsets: [-4],
  },
  {
    id: "2v2",
    label: "2v2",
    playersPerSide: 2,
    length: 24,
    width: 18,
    areaPerPlayer: areaPerPlayerOf(24, 18, 2),
    physiological: "Jak 1v1 plus krótkie współdziałanie.",
    tactical: "Ściana, mijanka, wsparcie najbliższego.",
    recommendedOffsets: [-4],
  },
  {
    id: "3v3",
    label: "3v3",
    playersPerSide: 3,
    length: 30,
    width: 20,
    areaPerPlayer: areaPerPlayerOf(30, 20, 3),
    physiological: "Najwyższe tętno (~90–92% HRmax), duży RPE.",
    tactical: "Trójkąt, wsparcie, głębia.",
    recommendedOffsets: [-4],
  },
  {
    id: "4v4",
    label: "4v4",
    playersPerSide: 4,
    length: 40,
    width: 30,
    areaPerPlayer: areaPerPlayerOf(40, 30, 4),
    physiological: "Wysokie tętno, umiarkowany HSR.",
    tactical: "Zasady gry pozycyjnej.",
    recommendedOffsets: [-4, -2],
  },
  {
    id: "5v5",
    label: "5v5",
    playersPerSide: 5,
    length: 45,
    width: 35,
    areaPerPlayer: areaPerPlayerOf(45, 35, 5),
    physiological: "Tętno wysokie, rośnie dystans.",
    tactical: "Struktura, szerokość.",
    recommendedOffsets: [-4, -2],
  },
  {
    id: "6v6",
    label: "6v6",
    playersPerSide: 6,
    length: 55,
    width: 40,
    areaPerPlayer: areaPerPlayerOf(55, 40, 6),
    physiological: "Zbalansowane obciążenie.",
    tactical: "Przenoszenie gry między sektorami.",
    recommendedOffsets: [-3, -2],
  },
  {
    id: "7v7",
    label: "7v7",
    playersPerSide: 7,
    length: 60,
    width: 45,
    areaPerPlayer: areaPerPlayerOf(60, 45, 7),
    physiological: "Pojawia się sprint.",
    tactical: "Przejścia, kontratak.",
    recommendedOffsets: [-2],
  },
  {
    id: "8v8",
    label: "8v8",
    playersPerSide: 8,
    length: 70,
    width: 55,
    areaPerPlayer: areaPerPlayerOf(70, 55, 8),
    physiological: "Wysoki dystans i HSR.",
    tactical: "Fazy gry, kompaktowość.",
    recommendedOffsets: [-3],
  },
  {
    id: "10v10",
    label: "10v10",
    playersPerSide: 10,
    length: 80,
    width: 64,
    areaPerPlayer: areaPerPlayerOf(80, 64, 10),
    physiological: "Najbliżej obciążenia meczowego.",
    tactical: "Pełny model gry.",
    recommendedOffsets: [-3],
  },
  {
    id: "11v11",
    label: "11v11",
    playersPerSide: 11,
    length: 100,
    width: 64,
    areaPerPlayer: areaPerPlayerOf(100, 64, 11),
    physiological: "Maksymalny HSR i sprint.",
    tactical: "Organizacja meczowa.",
    recommendedOffsets: [-3, -1],
  },
];

export const SSG_FORMAT_BY_ID: Record<SsgFormatId, SsgFormat> = SSG_FORMATS.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<SsgFormatId, SsgFormat>
);

export function findSsgFormat(id: string | null | undefined): SsgFormat | null {
  if (!id) return null;
  return SSG_FORMAT_BY_ID[id as SsgFormatId] ?? null;
}

/**
 * Presety dni względem meczu — % obciążenia meczowego zgodnie z modelem
 * Martín-García / Buchheit (mikrocykl: 1 mecz w tygodniu, 5–6 jednostek).
 */
export const MOTOR_DAY_PRESETS: MotorDayPreset[] = [
  {
    offset: 1,
    dominant: "recovery",
    title: "Regeneracja aktywna / rozdzielenie grupy",
    motorGoal: "Przyspieszenie regeneracji, obniżenie DOMS, diagnostyka.",
    tacticalGoal: "Krótka analiza meczu — 4–5 klipów, nie więcej.",
    targets: {
      totalDistancePct: 25,
      hsrPct: 5,
      sprintPct: 0,
      accDecPct: 20,
      srpe: 125,
      minutes: 35,
    },
    expectedTags: ["recovery"],
    avoidedTags: ["strength_max"],
    blocks: [
      { name: "Monitoring (wellness, HRV, CMJ)", minutes: 15, tags: ["recovery"] },
      { name: "Grupa 1 — regeneracja (basen / rower / mobility)", minutes: 25, tags: ["recovery", "mobility"] },
      {
        name: "Grupa 2 — jednostka kompensacyjna (siła + gra + sprinty)",
        minutes: 60,
        tags: ["compensation", "strength_max", "nordic", "sprint_max"],
        formatId: "7v7",
      },
      { name: "Analiza wideo meczu", minutes: 15, tags: ["video"] },
    ],
  },
  {
    offset: -5,
    dominant: "off",
    title: "Dzień wolny",
    motorGoal: "Pełny odpoczynek: sen ≥8,5 h, nawodnienie, białko 1,8–2,2 g/kg.",
    tacticalGoal: "Brak.",
    targets: {
      totalDistancePct: 0,
      hsrPct: 0,
      sprintPct: 0,
      accDecPct: 0,
      srpe: 0,
      minutes: 0,
    },
    expectedTags: [],
    avoidedTags: [],
    blocks: [],
  },
  {
    offset: -4,
    dominant: "tension",
    title: "Napięcie / siła — mikrostruktura taktyczna",
    motorGoal:
      "Obciążenie mechaniczne: akceleracje, deceleracje, zmiany kierunku, praca ekscentryczna. Mało metrów, dużo akcji.",
    tacticalGoal:
      "Detale i mikrozasady: 1v1, 2v2, para stoperów, trójki w sektorze. Poziom mikro.",
    targets: {
      totalDistancePct: 80,
      hsrPct: 45,
      sprintPct: 30,
      accDecPct: 125,
      srpe: 600,
      minutes: 90,
    },
    expectedTags: ["strength_max", "nordic", "acceleration", "ssg"],
    avoidedTags: ["sprint_max", "rsa"],
    blocks: [
      { name: "Aktywacja: mobility, core, skoki niskie, ZK 45°/90°", minutes: 15, tags: ["mobility", "prevention"] },
      {
        name: "Siła na boisku: sled, Nordic, Copenhagen, hop&stick",
        minutes: 20,
        tags: ["strength_max", "nordic", "prevention"],
      },
      { name: "Rondo 5v2 / 6v3 — ciało otwarte, podanie w wolną stopę", minutes: 15, tags: ["positional"] },
      {
        name: "Blok główny SSG: 1v1 / 2v2 / 3v3 na bramki, 4× 4 min",
        minutes: 26,
        tags: ["ssg", "acceleration"],
        formatId: "3v3",
      },
      { name: "Blok pozycyjny po liniach (obrona / środek / atak)", minutes: 20, tags: ["positional"] },
      { name: "Wyjście: rozluźnienie, stretching", minutes: 10, tags: ["recovery"] },
    ],
  },
  {
    offset: -3,
    dominant: "duration",
    title: "Trwanie / wytrzymałość specjalna — makrostruktura",
    motorGoal:
      "Największa objętość tygodnia: dystans całkowity, strefa 4, powtarzalne wysiłki.",
    tacticalGoal: "Model gry jako całość: 11v11, fazy gry, pressing kolektywny, przejścia.",
    targets: {
      totalDistancePct: 125,
      hsrPct: 90,
      sprintPct: 60,
      accDecPct: 100,
      srpe: 750,
      minutes: 105,
    },
    expectedTags: ["ssg", "positional"],
    avoidedTags: [],
    blocks: [
      { name: "Aktywacja: rozgrzewka dynamiczna + rondo 8v2 w ruchu", minutes: 15, tags: ["mobility", "positional"] },
      {
        name: "Gra pozycyjna 6v6+3 jokers, 3× 4 min",
        minutes: 16,
        tags: ["positional"],
        formatId: "6v6",
      },
      {
        name: "Blok główny: gra duża 8v8 / 10v10, 4× 6 min",
        minutes: 32,
        tags: ["ssg"],
        formatId: "10v10",
      },
      {
        name: "Faza gry / schematy 11v11 na 3/4 boiska",
        minutes: 20,
        tags: ["positional"],
        formatId: "11v11",
      },
      { name: "RSA: 2× 6× 20 m ze zmianą kierunku (opcjonalnie)", minutes: 8, tags: ["rsa"] },
      { name: "Wyjście: cooldown + mobility", minutes: 10, tags: ["recovery", "mobility"] },
    ],
  },
  {
    offset: -2,
    dominant: "velocity",
    title: "Szybkość — mezostruktura i jakość",
    motorGoal:
      "Maksymalna intensywność, minimalna objętość. Sprinty ≥90–95% Vmax, długie przerwy.",
    tacticalGoal: "Przejścia, kontratak, finalizacja, gra pod przewagę.",
    targets: {
      totalDistancePct: 65,
      hsrPct: 105,
      sprintPct: 110,
      accDecPct: 85,
      srpe: 500,
      minutes: 80,
    },
    expectedTags: ["sprint_max", "transitions"],
    avoidedTags: [],
    blocks: [
      {
        name: "Aktywacja neuro: skoki + sprinty progresywne do 95–100%",
        minutes: 20,
        tags: ["mobility", "sprint_max"],
      },
      { name: "Technika szybka: podania i uderzenia w tempie", minutes: 12, tags: ["mobility"] },
      {
        name: "Blok główny — przewagi 4v3 / 5v4 / 3v2 na bramkę",
        minutes: 18,
        tags: ["transitions", "sprint_max"],
        formatId: "7v7",
      },
      {
        name: "Transitions: 7v7 z przeciwbramkami, 4× 3 min",
        minutes: 20,
        tags: ["transitions", "ssg"],
        formatId: "7v7",
      },
      { name: "Stałe fragmenty ofensywne", minutes: 15, tags: ["set_pieces"] },
      { name: "Wyjście: cooldown", minutes: 8, tags: ["recovery"] },
    ],
  },
  {
    offset: -1,
    dominant: "activation",
    title: "Aktywacja i priming",
    motorGoal:
      "Przygotowanie neuromięśniowe bez zmęczenia. Maksymalnie 55–65 min.",
    tacticalGoal: "Plan na przeciwnika, SFG obronne, komfort psychiczny.",
    targets: {
      totalDistancePct: 45,
      hsrPct: 30,
      sprintPct: 25,
      accDecPct: 40,
      srpe: 275,
      minutes: 60,
    },
    expectedTags: ["set_pieces", "video"],
    avoidedTags: ["strength_max", "rsa"],
    blocks: [
      { name: "Odprawa: wideo przeciwnika (3 słabości, 2 zagrożenia)", minutes: 10, tags: ["video"] },
      { name: "Aktywacja + priming: CMJ, 3 sprinty 15–20 m @90%", minutes: 15, tags: ["mobility", "sprint_max"] },
      {
        name: "Rondo / gra na utrzymanie 4v4+3",
        minutes: 10,
        tags: ["positional"],
        formatId: "4v4",
      },
      {
        name: "Taktyka meczowa 11v11 — walk-through i półtempo",
        minutes: 15,
        tags: ["positional"],
        formatId: "11v11",
      },
      { name: "SFG obronne + wolne", minutes: 10, tags: ["set_pieces"] },
      { name: "Zakończenie: skład, rozmowy", minutes: 5, tags: [] },
    ],
  },
  {
    offset: 0,
    dominant: "match",
    title: "Mecz",
    motorGoal: "Punkt odniesienia dla obciążeń tygodnia.",
    tacticalGoal: "Realizacja modelu gry.",
    targets: {
      totalDistancePct: 100,
      hsrPct: 100,
      sprintPct: 100,
      accDecPct: 100,
      srpe: 850,
      minutes: 90,
    },
    expectedTags: [],
    avoidedTags: [],
    blocks: [
      { name: "Rozgrzewka meczowa (mobility → przewagi → sprinty → SFG)", minutes: 28, tags: ["mobility", "sprint_max"] },
      { name: "Mecz", minutes: 90, tags: [] },
      { name: "Praca dodatkowa dla niegrających (<20 min)", minutes: 15, tags: ["compensation", "sprint_max"] },
    ],
  },
];

export const MOTOR_PRESET_BY_OFFSET = new Map<number, MotorDayPreset>(
  MOTOR_DAY_PRESETS.map((p) => [p.offset, p])
);

const OFF_DAY_PRESET: MotorDayPreset = MOTOR_DAY_PRESETS.find((p) => p.offset === -5)!;

/**
 * Preset dla dnia. Offsety poza modelem (np. MD-6 w tygodniu z jednym meczem)
 * traktujemy jak dzień wolny — nie zgadujemy dominanty.
 */
export function presetForOffset(offset: number): MotorDayPreset {
  return MOTOR_PRESET_BY_OFFSET.get(offset) ?? OFF_DAY_PRESET;
}

/** Progi alarmowe monitoringu (Gabbett, Foster). */
export const MICROCYCLE_ALERT_THRESHOLDS = {
  acwrMin: 0.8,
  acwrMax: 1.3,
  acwrCriticalMax: 1.5,
  weeklyJumpPctMax: 15,
  monotonyMax: 2.0,
  strainMax: 6000,
  /**
   * sRPE, od którego dzień uznajemy za ciężki. Próg leży powyżej górnej granicy
   * MD-4 (550–650 AU), bo w modelu MD-4 i MD-3 stoją obok siebie —
   * zasada „dwóch ciężkich dni pod rząd" dotyczy dni szczytowych.
   */
  heavyDaySrpe: 650,
  /** Maksymalny czas jednostki MD-1 w minutach. */
  md1MaxMinutes: 65,
  /** Minimalna liczba ekspozycji na sprint ≥90% Vmax w mikrocyklu. */
  minSprintExposures: 1,
  /** Nordic Hamstring w mikrocyklu. */
  minNordicSessions: 1,
  maxNordicSessions: 2,
  minStrengthSessions: 1,
  maxStrengthSessions: 2,
  /** Deload co N mikrocykli. */
  deloadEveryWeeks: 4,
  /** Obciążenie tygodnia deload jako % poprzedniego. */
  deloadMaxPctOfPrevious: 80,
} as const;

/** Dziesięć zasad chroniących plan — wyświetlane w panelu metodyki. */
export const MICROCYCLE_PRINCIPLES: string[] = [
  "MD-3 to najcięższy dzień, MD-1 najlżejszy. Nigdy odwrotnie.",
  "Nigdy dwóch ciężkich dni pod rząd w tygodniu z meczem.",
  "Nie ma treningu ogólnego bez piłki poza siłownią i prewencją.",
  "Sprint w każdym mikrocyklu — to prewencja, nie luksus.",
  "Objętość taktyczna też jest obciążeniem — stanie na taktyce kosztuje.",
  "Rozdzielaj grupy: grający i niegrający.",
  "Deload co 4 tygodnie, bezwarunkowo.",
  "Regeneracja to sen i jedzenie. Sauna i lodówka są dodatkiem.",
  "Ostatnie 24 h przed meczem: nic nowego, ani taktycznie, ani żywieniowo.",
  "Plan służy zawodnikom — wellness i CMJ mają prawo zmienić dzisiejszy trening.",
];

/** Reguły manipulacji obciążeniem przez organizację ćwiczenia. */
export const PITCH_MANIPULATION_RULES: { rule: string; effect: string }[] = [
  { rule: "Mniej m²/gracz", effect: "więcej akcji i tętna, technika pod presją, mniej sprintu → napięcie" },
  { rule: "Więcej m²/gracz", effect: "więcej dystansu, HSR i sprintu, mniej dotknięć → trwanie / szybkość" },
  { rule: "Boisko wąskie i długie", effect: "więcej biegu w głąb, więcej HSR" },
  { rule: "Boisko szerokie i krótkie", effect: "więcej przenoszenia gry i zmian kierunku, mniej sprintu" },
  { rule: "Ograniczone dotknięcia", effect: "wyższe tempo i tętno, mniej kreatywności" },
  { rule: "Bramkarze i bramki", effect: "dłuższa gra, tętno niżej o 3–5%, większy realizm" },
  { rule: "Dodatkowi jokerzy", effect: "niższa intensywność obronna, łatwiejsze utrzymanie" },
  { rule: "Krycie indywidualne", effect: "największy wzrost intensywności, nawet +10% tętna" },
];
