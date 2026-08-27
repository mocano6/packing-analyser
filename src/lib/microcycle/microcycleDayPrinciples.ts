/**
 * Zasady amatorskiego mikrocyklu: 4 jednostki, trening o 18:00.
 * Domyślny układ = mecz w niedzielę. Wariant sobotni na końcu.
 */

export interface AmateurDayBlock {
  minutes: string;
  name: string;
}

export interface AmateurDayGuide {
  id: string;
  weekday: string;
  mdLabel: string;
  title: string;
  goal: string;
  minutes: string;
  load: string;
  do: string[];
  dont: string[];
  blocks: AmateurDayBlock[];
  keyNote: string;
}

export interface AmateurPlacementRow {
  topic: string;
  day: string;
  why: string;
}

export interface AmateurPlacementDayGroup {
  day: string;
  topics: string[];
}

/** Grupuje tematy po dniu — ściągawka „co kiedy”, bez powtarzania uzasadnień. */
export function groupAmateurPlacementByDay(
  rows: AmateurPlacementRow[]
): AmateurPlacementDayGroup[] {
  const order: string[] = [];
  const topicsByDay = new Map<string, string[]>();
  for (const row of rows) {
    const day = row.day.trim();
    const topic = row.topic.trim();
    if (!day || !topic) continue;
    if (!topicsByDay.has(day)) {
      order.push(day);
      topicsByDay.set(day, []);
    }
    const list = topicsByDay.get(day);
    if (list && !list.includes(topic)) list.push(topic);
  }
  return order.map((day) => ({ day, topics: topicsByDay.get(day) ?? [] }));
}

export interface AmateurExceptionRow {
  situation: string;
  change: string;
}

export interface AmateurSaturdayShiftRow {
  weekday: string;
  role: string;
  note: string;
}

export const AMATEUR_KICKOFF_SESSION_TIME = "18:00";

export const AMATEUR_WEEK_INTRO =
  "Koniec o 19:30, posiłek 20:00, sen 22:30 — to realny, zdrowy mikrocykl. Przy starcie 19:30 walczysz o resztki. Trzymaj 18:00 tak długo, jak możesz.";

export const AMATEUR_PEAK_PRINCIPLE =
  "Największe obciążenie umieszczasz najdalej od meczu — a potem systematycznie schodzisz. Nie odwrotnie, nie równomiernie. Każdy z czterech dni ma jeden wyraźny cel.";

export const AMATEUR_FOURTH_SESSION_DEFAULT =
  "Domyślnie: wtorek–środa–czwartek + sobota (MD-1). Wariant: wt–śr–cz–pt, gdy sobota jest niemożliwa — wtedy piątek to lekki priming, max 50′.";

export const AMATEUR_SUNDAY_DAY_GUIDES: AmateurDayGuide[] = [
  {
    id: "md-plus-1",
    weekday: "Pn",
    mdLabel: "MD+1",
    title: "Regeneracja",
    goal: "Zero treningu zespołowego. Mikrouszkodzenia są 24–48 h po meczu.",
    minutes: "—",
    load: "brak",
    do: [
      "Komunikat do drużyny: 2 rzeczy dobre, 1 do poprawy — bez rozliczania",
      "Zbierz urazy dziś, nie we wtorek o 18:00",
      "Zawodnicy: spacer / rower / rozciąganie 20–30 min",
      "Ty: analiza + konspekty na cały tydzień",
    ],
    dont: ["Trening zespołowy", "Rozliczanie meczu na grupie"],
    blocks: [],
    keyNote:
      "Poniedziałek to jedyny dzień z jedną rolą. Wykorzystaj go na planowanie — reszta tygodnia to wykonanie.",
  },
  {
    id: "strength",
    weekday: "Wt",
    mdLabel: "MD-5 / MD-4",
    title: "Siła + technika",
    goal: "Wytrzymałość siłowa, technika indywidualna, prewencja. Mała objętość biegowa.",
    minutes: "75–85′",
    load: "umiarkowane, wysokie obciążenie mięśniowe",
    do: [
      "Objętość biegowa 50–60% środy",
      "Nordic 2×5–8, raz w tygodniu — tu, nie później",
      "Technika w parach/trójkach, mała przestrzeń",
    ],
    dont: ["Duże pole i HSR", "Siła w czwartek lub piątek"],
    blocks: [
      { minutes: "12′", name: "Rozgrzewka: mobilność + aktywacja" },
      { minutes: "15′", name: "Blok siłowy / prewencyjny: Nordic, przysiad, wykrok, core, jednonóż" },
      { minutes: "20′", name: "Technika indywidualna: przyjęcie, podanie, uderzenie" },
      { minutes: "20′", name: "Gra pozycyjna: posiadanie, średnie pole, umiarkowane tempo" },
      { minutes: "8′", name: "Rozciąganie" },
    ],
    keyNote:
      "DOMS 24–48 h po sile. We wtorek ból ląduje w środę/czwartek, nie w niedzielę. Nordic to najlepiej udokumentowana prewencja hamstringów (~50% w metaanalizach).",
  },
  {
    id: "volume",
    weekday: "Śr",
    mdLabel: "MD-4 / MD-3",
    title: "Objętość + taktyka zespołowa",
    goal: "Najważniejszy trening tygodnia. Wytrzymałość specjalna i 11v11. Punkt odniesienia 100% dystansu.",
    minutes: "85–95′",
    load: "najwyższe",
    do: [
      "Tu wprowadzasz wszystko nowe — jest 4 dni na utrwalenie",
      "Największe pola, najdłuższe serie",
      "Zaakceptuj zmęczenie — to jest cel dnia",
    ],
    dont: ["Praca szybkościowa na zmęczeniu (to RSA, nie szybkość)", "Nowe treści po środzie"],
    blocks: [
      { minutes: "12′", name: "Rozgrzewka dynamiczna z piłką" },
      { minutes: "25′", name: "Gra na dużym polu: 8v8 / 9v9 / 11v11, serie 6–8′, krótkie przerwy" },
      { minutes: "25′", name: "Taktyka zespołowa: presing, ustawienie, wyjście z rozegrania" },
      { minutes: "15′", name: "Gra kierunkowa z bramkami, wysokie tempo" },
      { minutes: "8′", name: "Cooldown" },
    ],
    keyNote:
      "Jeśli masz w tygodniu jeden trening, na którym naprawdę zależy Ci na frekwencji — to środa. Zawodnik bez śród nie ma bazy wytrzymałościowej.",
  },
  {
    id: "speed",
    weekday: "Cz",
    mdLabel: "MD-3 / MD-2",
    title: "Szybkość + taktyka w małych grupach",
    goal: "Maksymalna prędkość przy niskiej objętości. Zaczynasz zjeżdżać.",
    minutes: "75′",
    load: "najwyższa intensywność, 60–70% objętości środy",
    do: [
      "6–8 × 20–30 m, pełna przerwa 60–90 s",
      "Sprint przed grą, na świeżości",
      "Taktyka sektorowa: detale, nie objętość",
    ],
    dont: [
      "10 × 30 m z przerwą 20 s",
      "Sprint po grze",
      "Kontynuowanie, gdy 6. powtórzenie jest wolniejsze od 1.",
    ],
    blocks: [
      { minutes: "15′", name: "Rozgrzewka dłuższa niż zwykle — przed szybkością obowiązkowa" },
      { minutes: "15′", name: "Blok szybkościowy: 6–8 × 20–30 m, przerwa 60–90 s" },
      { minutes: "10′", name: "Zmiany kierunku: 3–5 powtórzeń, pełna prędkość" },
      { minutes: "20′", name: "Taktyka sektorowa: linia obrony, trójki, czwórki" },
      { minutes: "12′", name: "4v4 / 5v5, wysoka intensywność, krótkie serie" },
      { minutes: "5′", name: "Cooldown" },
    ],
    keyNote:
      "Stoją, bo muszą — pełna przerwa jest częścią treningu. Lepiej 4 powtórzenia idealne niż 10 przeciętnych.",
  },
  {
    id: "md-minus-2-rest",
    weekday: "Pt",
    mdLabel: "MD-2",
    title: "Wolne",
    goal: "Regeneracja przed weekendem po trzech dniach pracy.",
    minutes: "—",
    load: "brak",
    do: [
      "Zawodnicy: lekka aktywność albo nic",
      "Ty: komunikat organizacyjny — zbiórka, wyjazd, strój, nieobecności",
    ],
    dont: [
      "Dodawanie treningu „bo jest miejsce” — trzy dni + MD-1 + mecz to już 5 obciążeń",
    ],
    blocks: [],
    keyNote:
      "Jeśli sobota odpada: piątek = priming max 50′, małe gry i stałe fragmenty. Zero nowych treści i dużego pola.",
  },
  {
    id: "priming",
    weekday: "So",
    mdLabel: "MD-1",
    title: "Priming + stałe fragmenty",
    goal: "Pobudzenie neuromięśniowe. Zero nowych informacji.",
    minutes: "45–55′ (twardy limit)",
    load: "30–40% objętości środy",
    do: [
      "4–6 sprintów 15–25 m, pełna przerwa",
      "Małe pola, serie 2–3′, pełne przerwy",
      "Stałe fragmenty: tylko znane warianty, statycznie",
    ],
    dont: ["Nowe ćwiczenia i nowa taktyka", "Gra na dużym polu", "Jednostka powyżej 55′"],
    blocks: [
      { minutes: "10′", name: "Aktywacja + 4–6 sprintów 15–25 m" },
      { minutes: "12′", name: "Małe gry: rytm i decyzje bez objętości" },
      { minutes: "15′", name: "SFG — znane warianty" },
      { minutes: "8′", name: "Cooldown / odprawa organizacyjna" },
    ],
    keyNote: "Ostatnie 24 h: nic nowego, ani taktycznie, ani żywieniowo.",
  },
  {
    id: "match",
    weekday: "Nd",
    mdLabel: "MD",
    title: "Mecz",
    goal: "Jakość niedzieli jest sędzią całego tygodnia.",
    minutes: "—",
    load: "mecz",
    do: ["Trzymaj plan z tygodnia — nie dokładaj nowości w rozgrzewce"],
    dont: ["Ciężkie nogi z siły lub objętości w meczu"],
    blocks: [],
    keyNote: "Siłownia ma podnosić jakość niedzieli. Ciężkie nogi w meczu = plan źle wykonany.",
  },
];

export const AMATEUR_SESSION_PLACEMENT: AmateurPlacementRow[] = [
  { topic: "Siła, prewencja, Nordic", day: "Wtorek", why: "DOMS zdąży zniknąć" },
  { topic: "Technika indywidualna", day: "Wtorek", why: "Świeżość i precyzja" },
  { topic: "Wytrzymałość specjalna", day: "Środa", why: "Jedyny dzień na objętość" },
  { topic: "Taktyka 11v11 i nowości", day: "Środa", why: "Pełne pole + 4 dni na utrwalenie" },
  { topic: "Szybkość i akceleracja", day: "Czwartek", why: "Świeżość względna + 3 dni do meczu" },
  { topic: "Zmiany kierunku", day: "Czwartek", why: "Ekscentryka z czasem na regenerację" },
  { topic: "Taktyka w małych grupach", day: "Czwartek", why: "Detale, mała objętość" },
  { topic: "SFG — nauka", day: "Środa", why: "Wymaga powtórzeń" },
  { topic: "SFG — odświeżenie", day: "Sobota", why: "Pewność przed meczem" },
];

export const AMATEUR_SATURDAY_SHIFT: AmateurSaturdayShiftRow[] = [
  {
    weekday: "Pn",
    role: "MD-5: siła + technika",
    note: "Tylko 2 dni po meczu — zmniejsz blok siłowy",
  },
  { weekday: "Wt", role: "MD-4: objętość", note: "Główny trening tygodnia" },
  { weekday: "Śr", role: "Wolne", note: "Regeneracja w środku tygodnia" },
  { weekday: "Cz", role: "MD-2: szybkość", note: "Pełna świeżość" },
  {
    weekday: "Pt",
    role: "MD-1: priming 45′",
    note: "Mecz sobota 15:00+ — standard. 11:00–13:00 — max 40′, koniec 19:10. Przed 11:00 rozważ rezygnację.",
  },
  { weekday: "So", role: "Mecz", note: "Szczyt tygodnia" },
];

export const AMATEUR_MODEL_EXCEPTIONS: AmateurExceptionRow[] = [
  {
    situation: "Przerwa 2+ tygodnie",
    change: "Zapomnij o MD. Dwa dni objętości, blok rozwojowy, więcej techniki",
  },
  {
    situation: "Mecz w środku tygodnia",
    change: "Tylko regeneracja + priming. Zero objętości między meczami",
  },
  {
    situation: "Frekwencja 10–12 osób",
    change: "Zamień duże pole na intensywne małe gry + biegi",
  },
  {
    situation: "Mecz z outsiderem",
    change: "Zachowaj środową objętość, skróć MD-1 do 35′",
  },
  {
    situation: "Trzy mecze w 8 dni",
    change: "Wypada środa. Zostaje regeneracja + priming",
  },
  {
    situation: "Mróz / fatalne warunki",
    change: "Skróć, zwiększ rozgrzewkę, wytnij pracę szybkościową",
  },
];

export const AMATEUR_WEEK_SUMMARY_PRINCIPLES: string[] = [
  "Każdy dzień ma jeden cel: wtorek siła, środa objętość, czwartek szybkość, sobota priming.",
  "Środa to szczyt: największa objętość, największe pole, wszystko nowe.",
  "Od czwartku tylko schodzisz — objętość maleje, intensywność rośnie.",
  "Siła we wtorek — DOMS zdąży zniknąć. Nigdy w czwartek/piątek.",
  "Szybkość na świeżości, z pełną przerwą. 6 idealnych > 12 przeciętnych.",
  "Nordic hamstring w każdy wtorek — najlepiej udokumentowana prewencja.",
  "MD-1: 45–55 min, zero nowości, 4–6 sprintów.",
  "Nowa taktyka do środy albo w ogóle.",
];
