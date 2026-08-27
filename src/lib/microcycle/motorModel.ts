import type {
  GymSessionCharacter,
  MicrocycleDayLoadTargets,
  MotorDominantId,
  MotorSessionRole,
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
  /** Charakter siłowni otwierającej jednostkę. */
  gymCharacter: GymSessionCharacter;
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

/** Pełne boisko meczowe FIFA/UEFA (zalecane wymiary). */
export const FULL_PITCH_LENGTH_M = 105;
export const FULL_PITCH_WIDTH_M = 68;
export const FULL_PITCH_AREA_M2 = FULL_PITCH_LENGTH_M * FULL_PITCH_WIDTH_M;

function areaPerPlayerOf(length: number, width: number, playersPerSide: number): number {
  if (playersPerSide <= 0) return 0;
  return Math.round((length * width) / (playersPerSide * 2));
}

/** Powierzchnia boiska ćwiczenia jako % pełnego 105×68. */
export function pitchAreaPctOfFull(
  length: number | null | undefined,
  width: number | null | undefined
): number | null {
  if (!length || !width || length <= 0 || width <= 0) return null;
  return Math.round((length * width * 100) / FULL_PITCH_AREA_M2);
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
    recommendedOffsets: [-5],
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
    recommendedOffsets: [-5],
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
    recommendedOffsets: [-5],
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
    recommendedOffsets: [-5, -2],
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
    recommendedOffsets: [-5, -2],
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
    recommendedOffsets: [-4, -2],
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
    recommendedOffsets: [-4],
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
    recommendedOffsets: [-4],
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
    recommendedOffsets: [-4, -1],
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
 * Presety dni — siłownia otwiera jednostkę, potem transfer 10–15', potem boisko.
 * Tydzień amatorski (mecz w niedzielę): MD+1 ciężki, MD-5 moc, MD-4 objętość, MD-3 wolne, MD-2 priming.
 */
export const MOTOR_DAY_PRESETS: MotorDayPreset[] = [
  {
    offset: 1,
    dominant: "recovery",
    gymCharacter: "heavy",
    title: "MD+1 — dzień siłowni (grający / niegrający)",
    motorGoal:
      "Główna sesja siłowa tygodnia na świeżym CNS. Piłka lekka. Dwie grupy: grający objętość −30%, niegrający pełna sesja + blok kompensacyjny.",
    tacticalGoal: "Krótka analiza meczu — 4–5 klipów. Technika i żonglerka, bez gier o dużej objętości.",
    targets: {
      totalDistancePct: 25,
      hsrPct: 5,
      sprintPct: 0,
      accDecPct: 20,
      srpe: 280,
      minutes: 90,
    },
    expectedTags: ["gym", "strength_max", "nordic", "transfer", "recovery"],
    avoidedTags: ["ssg", "sprint_max", "rsa"],
    blocks: [
      {
        name: "Siłownia ciężka: Nordic, przysiad, RDL, wykrok, prewencja",
        minutes: 50,
        tags: ["gym", "strength_max", "nordic", "prevention"],
        notes:
          "Pary A1/A2. Grający: 3 serie (objętość −30%). Niegrający: 4–5 serii. Przesunięcie startu o 45 min, jeśli logistyka pozwala.",
      },
      {
        name: "Transfer: woda, przejście, mobilność dynamiczna",
        minutes: 10,
        tags: ["transfer", "mobility"],
      },
      {
        name: "Boisko: mobilność, rozruch, żonglerka, technika",
        minutes: 30,
        tags: ["mobility", "recovery"],
        notes: "Niegrający: 4v4 4× 4 min + 6 sprintów 30 m zamiast techniki.",
      },
    ],
  },
  {
    offset: -5,
    dominant: "tension",
    gymCharacter: "power",
    title: "MD-5 — moc + intensywność krótka",
    motorGoal:
      "Moc i góra ciała na świeżym układzie nerwowym, potem małe formaty. Ciężka siła dolnej części ciała — nie, dzień przed objętością.",
    tacticalGoal: "Mikrostruktura: 3v3 / 5v5, trójkąt, wsparcie, tempo.",
    targets: {
      totalDistancePct: 80,
      hsrPct: 45,
      sprintPct: 30,
      accDecPct: 125,
      srpe: 600,
      minutes: 100,
    },
    expectedTags: ["gym", "power", "transfer", "ssg", "acceleration"],
    avoidedTags: ["sprint_max", "strength_max", "rsa"],
    blocks: [
      {
        name: "Siłownia moc: CMJ/box jump, hip thrust, wyciskanie, step-up",
        minutes: 30,
        tags: ["gym", "power", "prevention"],
        notes: "Intencja maksymalnej prędkości. Jeśli skok jest ciężki — przerwij serię.",
      },
      {
        name: "Transfer: woda, przejście, mobilność dynamiczna",
        minutes: 15,
        tags: ["transfer", "mobility"],
      },
      {
        name: "Rozgrzewka boiskowa skrócona (A/B-skip, 4 akceleracje)",
        minutes: 8,
        tags: ["mobility", "acceleration"],
      },
      { name: "Technika / koordynacja", minutes: 12, tags: ["mobility"] },
      {
        name: "3v3 na 30×20 m — 6× 2,5 min / 1,5' przerwy",
        minutes: 24,
        tags: ["ssg", "acceleration"],
        formatId: "3v3",
      },
      {
        name: "5v5+2 na 40×35 m",
        minutes: 15,
        tags: ["ssg", "positional"],
        formatId: "5v5",
      },
      { name: "Wyjście", minutes: 6, tags: ["recovery"] },
    ],
  },
  {
    offset: -4,
    dominant: "duration",
    gymCharacter: "minimal",
    title: "MD-4 — dzień objętości, siłownia symboliczna",
    motorGoal:
      "Największa objętość tygodnia. Siłownia tylko core i mobilność — ciężka dolna część zniszczyłaby ekonomię biegu.",
    tacticalGoal: "Makrostruktura: 8v8, 10v10, 11v11, fazy gry, pressing kolektywny.",
    targets: {
      totalDistancePct: 125,
      hsrPct: 90,
      sprintPct: 60,
      accDecPct: 100,
      srpe: 750,
      minutes: 115,
    },
    expectedTags: ["gym", "transfer", "ssg", "positional", "nordic"],
    avoidedTags: ["strength_max", "sprint_max"],
    blocks: [
      {
        name: "Siłownia minimalna: Pallof, dead bug, wiosłowanie lekko, mobilność biodra",
        minutes: 12,
        tags: ["gym", "prevention", "mobility"],
      },
      { name: "Transfer", minutes: 8, tags: ["transfer", "mobility"] },
      {
        name: "Rozgrzewka boiskowa: rondo 6v2 + aktywacja + 3 akceleracje",
        minutes: 15,
        tags: ["mobility", "positional"],
      },
      {
        name: "8v8 na 70×55 m — 4× 4 min / 2' przerwy",
        minutes: 18,
        tags: ["ssg"],
        formatId: "8v8",
      },
      {
        name: "Taktyka: 10v10 na ¾ boiska",
        minutes: 20,
        tags: ["positional"],
        formatId: "10v10",
      },
      {
        name: "Gra główna 11v11, 2× 10 min",
        minutes: 25,
        tags: ["positional"],
        formatId: "11v11",
      },
      {
        name: "Nordic 3× 5 + Copenhagen 2× 8 (na murawie, po grze)",
        minutes: 8,
        tags: ["nordic", "prevention"],
        notes: "Do meczu ≥72 h. Jeśli zakwasy w MD-2 — przenieś całkowicie na MD+1.",
      },
      { name: "Cooldown", minutes: 8, tags: ["recovery", "mobility"] },
    ],
  },
  {
    offset: -3,
    dominant: "off",
    gymCharacter: "none",
    title: "MD-3 — dzień wolny (amatorski tydzień 4 jednostek)",
    motorGoal: "Odpoczynek między objętością a szybkością. Sen ≥8,5 h, nawodnienie, białko 1,8–2,2 g/kg.",
    tacticalGoal: "Brak. Jeśli zespół trenuje w ten dzień — wstaw preset MD-3 z biblioteki.",
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
    offset: -2,
    dominant: "velocity",
    gymCharacter: "priming",
    title: "MD-2 — priming + szybkość",
    motorGoal:
      "Siłownia nie buduje siły — podnosi jakość sprintu (PAPE). Zero ekscentryki, zero serii powyżej 5 powtórzeń.",
    tacticalGoal: "Przejścia, kontratak, finalizacja, SFG.",
    targets: {
      totalDistancePct: 65,
      hsrPct: 105,
      sprintPct: 110,
      accDecPct: 85,
      srpe: 500,
      minutes: 95,
    },
    expectedTags: ["gym", "priming", "transfer", "sprint_max", "transitions"],
    avoidedTags: ["nordic", "strength_max", "rsa"],
    blocks: [
      {
        name: "Aktywacja: miniband, mobility, pogo hops",
        minutes: 10,
        tags: ["mobility", "priming"],
      },
      {
        name: "Blok primingu: hip thrust 2×3, box jump 3×3, skok w dal",
        minutes: 12,
        tags: ["gym", "priming", "power"],
        notes:
          "Max 15–18 podniesień na dolną część. Nowicjusze: tylko skoki. Jeśli ciężkie nogi — skoki bez obciążenia.",
      },
      {
        name: "Transfer + rozgrzewka boiskowa: A/B-skip, 4 akceleracje 20 m",
        minutes: 13,
        tags: ["transfer", "mobility", "sprint_max"],
        notes: "Okno PAPE: 5–10 min po ostatniej serii.",
      },
      {
        name: "Blok szybkości — karuzela: flying 20 m, finalizacja, mobility",
        minutes: 18,
        tags: ["sprint_max"],
      },
      {
        name: "Przejścia 7v7 na 60×45 m",
        minutes: 15,
        tags: ["transitions", "ssg"],
        formatId: "7v7",
      },
      { name: "Rondo 8v2, 1–2 dotknięcia", minutes: 8, tags: ["positional"] },
      { name: "SFG ofensywne + obronne", minutes: 12, tags: ["set_pieces"] },
      { name: "Odprawa", minutes: 7, tags: ["video"] },
    ],
  },
  {
    offset: -1,
    dominant: "activation",
    gymCharacter: "none",
    title: "Aktywacja — bez siłowni",
    motorGoal: "Przygotowanie neuromięśniowe bez zmęczenia. Maksymalnie 55–65 min. Zero siłowni.",
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
    avoidedTags: ["strength_max", "rsa", "gym", "nordic"],
    blocks: [
      { name: "Odprawa: wideo przeciwnika (3 słabości, 2 zagrożenia)", minutes: 10, tags: ["video"] },
      { name: "Aktywacja: CMJ, 3 sprinty 15–20 m @90%", minutes: 15, tags: ["mobility", "sprint_max"] },
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
    gymCharacter: "none",
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
    avoidedTags: ["gym", "nordic", "strength_max"],
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

const OFF_DAY_PRESET: MotorDayPreset = {
  offset: -6,
  dominant: "off",
  gymCharacter: "none",
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
};

/**
 * Preset dla dnia. Offsety poza modelem (np. MD-6 w tygodniu z jednym meczem)
 * traktujemy jak dzień wolny — nie zgadujemy dominanty.
 */
export function presetForOffset(offset: number): MotorDayPreset {
  return MOTOR_PRESET_BY_OFFSET.get(offset) ?? OFF_DAY_PRESET;
}

/** Preset jednostki opisany rolą — działa dla dowolnego dnia meczu. */
export interface MotorSessionPreset {
  role: MotorSessionRole;
  dominant: MotorDominantId;
  gymCharacter: GymSessionCharacter;
  /** Krótka nazwa do karty presetu. */
  title: string;
  motorGoal: string;
  tacticalGoal: string;
  targets: MicrocycleDayLoadTargets;
  expectedTags: MotorTagId[];
  avoidedTags: MotorTagId[];
  blocks: MotorPresetBlock[];
}

/**
 * Cztery jednostki treningowe tygodnia. Aktywacja MD-1 zostaje w bibliotece
 * jako preset ręczny — „Rozpisz tydzień” nie wstawia jej jako piątej jednostki.
 * Kolejność ról od najdalszej od meczu: siła → napięcie → objętość → prędkość.
 * `targets.minutes` jest zawsze sumą minut bloków — jedna liczba, jedno źródło prawdy.
 */
export const MOTOR_SESSION_PRESETS: MotorSessionPreset[] = [
  {
    role: "strength",
    dominant: "recovery",
    gymCharacter: "heavy",
    title: "Siła + technika",
    motorGoal:
      "Główna sesja siłowa tygodnia — jedyne miejsce na ekscentrykę o wysokiej objętości, bo do meczu zostaje ≥4 dni. Piłka lekka, bez HSR i sprintu.",
    tacticalGoal: "Technika w parach, rondo, kontrola tempa w małym formacie.",
    targets: {
      totalDistancePct: 45,
      hsrPct: 12,
      sprintPct: 5,
      accDecPct: 45,
      srpe: 500,
      minutes: 100,
    },
    expectedTags: ["gym", "strength_max", "nordic", "prevention", "transfer"],
    avoidedTags: ["sprint_max", "rsa"],
    blocks: [
      {
        name: "Siłownia ciężka: przysiad/RDL, Nordic 3×5, Copenhagen, prewencja",
        minutes: 45,
        tags: ["gym", "strength_max", "nordic", "prevention"],
        notes:
          "Pary A1/A2. Grający w ostatnim meczu: objętość −30%. Nordic tylko tutaj — do meczu ≥72 h.",
      },
      {
        name: "Transfer: woda, przejście, mobilność dynamiczna",
        minutes: 12,
        tags: ["transfer", "mobility"],
      },
      {
        name: "Rozgrzewka boiskowa skrócona (A/B-skip, 3 akceleracje)",
        minutes: 8,
        tags: ["mobility", "acceleration"],
      },
      { name: "Rondo 8v2 / technika w parach", minutes: 15, tags: ["positional"] },
      {
        name: "4v4 na 40×30 m — 4× 3 min, kontrola tempa",
        minutes: 12,
        tags: ["ssg"],
        formatId: "4v4",
        notes: "Niska objętość: gra ma utrwalić technikę, nie dodać zmęczenia po siłowni.",
      },
      { name: "Cooldown i mobilność", minutes: 8, tags: ["recovery", "mobility"] },
    ],
  },
  {
    role: "tension",
    dominant: "tension",
    gymCharacter: "power",
    title: "Napięcie i moc",
    motorGoal:
      "Moc na świeżym układzie nerwowym i szczyt Acc/Dec tygodnia w małych formatach. Bez ciężkiej siły dolnej części — dzień objętości jest zaraz po.",
    tacticalGoal: "Mikrostruktura: trójkąt, wsparcie, wyjście z presji, tempo.",
    targets: {
      totalDistancePct: 80,
      hsrPct: 45,
      sprintPct: 30,
      accDecPct: 130,
      srpe: 600,
      minutes: 94,
    },
    expectedTags: ["gym", "power", "transfer", "ssg", "acceleration"],
    avoidedTags: ["strength_max", "sprint_max", "rsa"],
    blocks: [
      {
        name: "Siłownia moc: CMJ/box jump, hip thrust, wyciskanie, step-up",
        minutes: 28,
        tags: ["gym", "power", "prevention"],
        notes: "Intencja maksymalnej prędkości. Jeśli skok jest ciężki — przerwij serię.",
      },
      {
        name: "Transfer: woda, przejście, mobilność dynamiczna",
        minutes: 12,
        tags: ["transfer", "mobility"],
      },
      {
        name: "Rozgrzewka boiskowa: A/B-skip + 4 akceleracje 20 m",
        minutes: 10,
        tags: ["mobility", "acceleration"],
      },
      {
        name: "3v3 na 30×20 m — 6× 2,5 min / 1,5′ przerwy",
        minutes: 22,
        tags: ["ssg", "acceleration"],
        formatId: "3v3",
      },
      {
        name: "5v5+2 na 45×35 m",
        minutes: 16,
        tags: ["ssg", "positional"],
        formatId: "5v5",
      },
      { name: "Wyjście", minutes: 6, tags: ["recovery"] },
    ],
  },
  {
    role: "volume",
    dominant: "duration",
    gymCharacter: "minimal",
    title: "Objętość",
    motorGoal:
      "Największa objętość tygodnia: dystans, HSR, powtarzalne wysiłki w dużych formatach. Siłownia tylko core i mobilność — ciężka dolna zniszczyłaby ekonomię biegu.",
    tacticalGoal: "Makrostruktura: fazy gry, pressing kolektywny, organizacja 11v11.",
    targets: {
      totalDistancePct: 125,
      hsrPct: 95,
      sprintPct: 60,
      accDecPct: 100,
      srpe: 750,
      minutes: 106,
    },
    expectedTags: ["gym", "transfer", "ssg", "positional"],
    avoidedTags: ["strength_max", "nordic", "sprint_max"],
    blocks: [
      {
        name: "Siłownia minimalna: Pallof, dead bug, mobilność biodra",
        minutes: 12,
        tags: ["gym", "prevention", "mobility"],
      },
      { name: "Transfer", minutes: 8, tags: ["transfer", "mobility"] },
      {
        name: "Rozgrzewka boiskowa: rondo 6v2 + aktywacja + 3 akceleracje",
        minutes: 15,
        tags: ["mobility", "positional"],
      },
      {
        name: "8v8 na 70×55 m — 4× 4 min / 2′ przerwy",
        minutes: 18,
        tags: ["ssg"],
        formatId: "8v8",
      },
      {
        name: "Taktyka: 10v10 na ¾ boiska",
        minutes: 20,
        tags: ["positional"],
        formatId: "10v10",
      },
      {
        name: "Gra główna 11v11, 2× 10 min",
        minutes: 25,
        tags: ["positional"],
        formatId: "11v11",
      },
      { name: "Cooldown", minutes: 8, tags: ["recovery", "mobility"] },
    ],
  },
  {
    role: "speed",
    dominant: "velocity",
    gymCharacter: "priming",
    title: "Sprint i SFG",
    motorGoal:
      "Ostatni mocny bodziec: sprint ≥95% Vmax przy pełnej świeżości, priming zamiast budowania siły. Zero ekscentryki, zero serii powyżej 5 powtórzeń.",
    tacticalGoal: "Przejścia, kontratak, finalizacja, SFG, plan na przeciwnika.",
    targets: {
      totalDistancePct: 65,
      hsrPct: 105,
      sprintPct: 110,
      accDecPct: 85,
      srpe: 480,
      minutes: 85,
    },
    expectedTags: ["gym", "priming", "transfer", "sprint_max", "transitions", "set_pieces"],
    avoidedTags: ["nordic", "strength_max", "rsa"],
    blocks: [
      { name: "Aktywacja: miniband, mobility, pogo hops", minutes: 10, tags: ["mobility", "priming"] },
      {
        name: "Blok primingu: hip thrust 2×3, box jump 3×3",
        minutes: 12,
        tags: ["gym", "priming", "power"],
        notes:
          "Max 15–18 podniesień na dolną część. Okno PAPE: 5–10 min po ostatniej serii. Nowicjusze: tylko skoki.",
      },
      {
        name: "Transfer + rozgrzewka: A/B-skip, 4 akceleracje 20 m",
        minutes: 12,
        tags: ["transfer", "mobility", "acceleration"],
      },
      {
        name: "Blok szybkości: flying 20 m ≥95% Vmax, 6× / 90″ przerwy",
        minutes: 16,
        tags: ["sprint_max"],
        notes: "Ekspozycja na maksymalną prędkość — prewencja, nie luksus.",
      },
      {
        name: "Przejścia 7v7 na 60×45 m",
        minutes: 15,
        tags: ["transitions", "ssg"],
        formatId: "7v7",
      },
      { name: "SFG ofensywne + obronne", minutes: 12, tags: ["set_pieces"] },
      { name: "Odprawa: plan na przeciwnika", minutes: 8, tags: ["video"] },
    ],
  },
  {
    role: "activation",
    dominant: "activation",
    gymCharacter: "none",
    title: "Aktywacja przed meczem",
    motorGoal: "Przygotowanie neuromięśniowe bez zmęczenia. Maksymalnie 60 min. Zero siłowni.",
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
    avoidedTags: ["strength_max", "rsa", "gym", "nordic"],
    blocks: [
      { name: "Odprawa: wideo przeciwnika (3 słabości, 2 zagrożenia)", minutes: 10, tags: ["video"] },
      { name: "Aktywacja: CMJ, 3 sprinty 15–20 m @90%", minutes: 15, tags: ["mobility", "sprint_max"] },
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
    ],
  },
];

export const MOTOR_SESSION_PRESET_BY_ROLE = new Map<MotorSessionRole, MotorSessionPreset>(
  MOTOR_SESSION_PRESETS.map((p) => [p.role, p])
);

export function sessionPresetForRole(role: MotorSessionRole): MotorSessionPreset {
  const preset = MOTOR_SESSION_PRESET_BY_ROLE.get(role);
  if (!preset) throw new Error(`Brak presetu dla roli ${role}`);
  return preset;
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
   * sRPE, od którego dzień uznajemy za ciężki. MD-5 (moc, ~600 AU) leży poniżej,
   * MD-4 (objętość, ~750 AU) powyżej — poniedziałek i wtorek mogą stać obok siebie.
   */
  heavyDaySrpe: 650,
  /** Maksymalny czas jednostki MD-1 w minutach. */
  md1MaxMinutes: 65,
  /** Powyżej tej wartości praca na nogi pożycza z jednostki piłkarskiej (poza MD+1). */
  gymLowerBodyMaxMinutes: 40,
  /** Minimalna przerwa transferowa po siłowni (minuty). */
  gymTransferMinMinutes: 10,
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
  "Siłownia otwiera jednostkę: siłownia → transfer 10–15' → boisko. Rozgrzewka na murawie spada do 6–8 min.",
  "Dzień objętości (trwanie) jest najcięższy, MD-1 najlżejszy. Nigdy odwrotnie.",
  "Ciężka siła dolnej części ciała nigdy przed dniem objętościowym.",
  "Nigdy dwóch ciężkich dni pod rząd w tygodniu z meczem.",
  "Nordic min. 72 h przed meczem — nigdy w MD-2 ani MD-1.",
  "Sprint w każdym mikrocyklu — to prewencja, nie luksus.",
  "Rozdzielaj grupy: grający i niegrający (MD+1: przesunięcie startu o 45 min).",
  "Deload co 4 tygodnie, bezwarunkowo.",
  "Ostatnie 24 h przed meczem: nic nowego, ani taktycznie, ani żywieniowo.",
  "Siłownia ma podnosić jakość niedzieli. Ciężkie nogi w meczu = plan źle wykonany.",
];

/** Krótkie etykiety do kontroli zasad — ta sama kolejność co MICROCYCLE_PRINCIPLES. */
export const MICROCYCLE_CONTROL_PRINCIPLES = [
  { id: "gym_first", shortLabel: "Siłownia otwiera jednostkę" },
  { id: "load_shape", shortLabel: "Objętość najcięższa, MD-1 najlżejszy" },
  { id: "no_heavy_before_volume", shortLabel: "Siła nigdy przed objętością" },
  { id: "no_two_heavy", shortLabel: "Nie dwa ciężkie dni pod rząd" },
  { id: "nordic_timing", shortLabel: "Nordic ≥72 h przed meczem" },
  { id: "sprint_week", shortLabel: "Sprint w każdym mikrocyklu" },
  { id: "split_groups", shortLabel: "Grający i niegrający osobno" },
  { id: "deload", shortLabel: "Deload co 4 tygodnie" },
  { id: "nothing_new_md1", shortLabel: "Ostatnie 24 h: nic nowego" },
  { id: "gym_serves_match", shortLabel: "Siłownia pod jakość meczu" },
] as const;

export type MicrocycleControlPrincipleId =
  (typeof MICROCYCLE_CONTROL_PRINCIPLES)[number]["id"];

export function methodologyPrincipleCatalog(): {
  id: MicrocycleControlPrincipleId;
  shortLabel: string;
  text: string;
}[] {
  return MICROCYCLE_CONTROL_PRINCIPLES.map((p, i) => ({
    id: p.id,
    shortLabel: p.shortLabel,
    text: MICROCYCLE_PRINCIPLES[i] ?? p.shortLabel,
  }));
}

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
