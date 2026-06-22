/**
 * Definicje metryk StatsBomb / Wyscout (glossary z raportu SSA + nazewnictwo MatchStats CSV).
 * Klucze: znormalizowana nazwa kolumny (trim + lowercase).
 */

const GLOSSARY_XG =
  "xG (Expected Goals): prawdopodobieństwo goła ze strzału na podstawie pozycji, typu asysty i kontekstu akcji — mierzy jakość stworzonych sytuacji, nie szczęście.";

const GLOSSARY_PASS_FINAL_THIRD =
  "Pass to final third (Wyscout): podanie do strefy w odległości ≤35 m od linii bramkowej przeciwnika.";

const GLOSSARY_PROGRESSIVE =
  "Progressive pass (Wyscout): podanie znacząco przesuwające piłkę do przodu (min. 30 m w własnej połowie, 15 m między połowami, 10 m w połowie przeciwnika).";

const GLOSSARY_DEEP_COMPLETION =
  "Deep completion (Wyscout): podanie (bez centry) odebrane w promieniu 20 m od linii bramkowej przeciwnika.";

const GLOSSARY_PPDA =
  "PPDA (Wyscout): liczba podań rywala na akcję defensywną w ostatnich 60% boiska — intensywność pressingu (niżej = agresywniej).";

const GLOSSARY_MATCH_TEMPO =
  "Match tempo (Wyscout): liczba podań na minutę posiadania piłki.";

const GLOSSARY_COUNTERATTACK =
  "Counterattack (Wyscout): atak z szybką zmianą posiadania, wykorzystujący niegotowość rywala.";

const GLOSSARY_OBV =
  "OBV (On-Ball Value, StatsBomb): wartość dodana akcji z piłką w modelu StatsBomb (podania, dryblingi, strzały, akcje defensywne).";

/** Dokładne dopasowania po normalizacji klucza. */
export const STATSBOMB_METRIC_DEFINITIONS: Record<string, string> = {
  // wynik (pochodne)
  wygrana: "1 gdy zdobyto więcej bramek niż przeciwnik, inaczej 0.",
  remis: "1 gdy liczba bramek obu drużyn jest równa, inaczej 0.",
  przegrana: "1 gdy stracono więcej bramek niż zdobyto, inaczej 0.",
  punkty: "Punkty ligowe z meczu: 3 wygrana, 1 remis, 0 porażka.",
  gd: "Bilans bramek (gole zdobyte − gole stracone) w meczu.",
  xgd: "Różnica xG − xGA (expected goal difference) w meczu.",
  gole: "Gole zdobyte w meczu (kolumna Goals & Penalty Goals).",
  "gole stracone": "Gole stracone w meczu (Goals Conceded).",
  xga: "Suma xG przeciwnika ze strzałów (Opposition xG).",

  // CSV — atak / strzały
  "cumulative xg": GLOSSARY_XG + " Suma xG wszystkich strzałów drużyny w meczu.",
  "goals & penalty goals": "Gole zdobyte w meczu, łącznie z karnymi.",
  shots: "Łączna liczba strzałów drużyny w meczu.",
  "shots outside box": "Strzały spoza pola karnego.",
  "open play shots": "Strzały z gry otwartej (bez stałych fragmentów).",
  "open play shots outside box": "Strzały z gry otwartej spoza pola karnego.",
  "open play xg": GLOSSARY_XG + " Suma xG ze strzałów z gry otwartej.",
  "counter attacking shots": GLOSSARY_COUNTERATTACK + " Strzały po kontrataku.",
  "clear shots": "Strzały bez blokady i bez znaczącej deflekcji (StatsBomb).",
  "non penalty shots": "Strzały z gry (bez karnych).",
  "shots from corners": "Strzały po rzutach rożnych.",
  "shots from throw-ins": "Strzały po rzutach z autu.",
  "touches in box": "Dotknięcia piłki w polu karnym rywala.",
  goals:
    "Gole zdobyte w meczu (kolumna Goals w MatchStats). Udział zawodników: Squad STATS „Goals & Penalty Goals” (per 90).",
  "non penalty goals": "Gole z gry bez karnych (Non Penalty Goals).",
  "penalty goals": "Gole z rzutów karnych.",
  "shot distance": "Średnia odległość strzałów drużyny od bramki (metry).",
  "xg/shot": "Średnie xG na strzał — jakość pozycji strzeleckich.",
  "non penalty shots & key passes": "Strzały bez karnych plus kluczowe podania.",
  xg: GLOSSARY_XG + " W tym eksporcie: skumulowane xG drużyny (jak Cumulative xG).",

  // podania
  "non throw-in passes into final third": GLOSSARY_PASS_FINAL_THIRD + " Bez rzutów z autu.",
  "non throw-in passes from defensive third": "Podania (bez autów) rozpoczęte w tercji obronnej własnej.",
  "non throw-in through balls": "Podania proste za linię obrony (bez autów).",
  "non throw-in key passes": "Kluczowe podania (bez autów) — bezpośrednio poprzedzające strzał.",
  "non throw-in passes": "Wszystkie podania z gry z wyłączeniem rzutów z autu.",
  "open play passes": "Podania z gry otwartej.",
  passes: "Łączna liczba podań drużyny.",
  "passes inside box": "Podania kończące się w polu karnym rywala.",
  "passes into box": "Podania wprowadzające piłkę do pola karnego.",
  "passing%": "Skuteczność podań (udane / wszystkie).",
  "received passes": "Odebrane podania przez zawodników drużyny.",
  "successful passes": "Podań udanych.",
  "long balls": "Długie podania (StatsBomb).",
  "long ball%": "Udział długich podań we wszystkich podaniach.",
  "successful long balls": "Udane długie podania.",
  "pressured long balls": "Długie podania wykonane pod presją.",
  "unpressured long balls": "Długie podania bez presji rywala.",

  // line breaking / deep
  "line breaking passes": "Podań StatsBomb łamiących linię struktury defensywnej rywala.",
  "line breaking passes completed": "Udane podania łamiące linię.",
  "line breaking passes completed%": "Skuteczność podań łamiących linię.",
  "line breaking passes on ball value": GLOSSARY_OBV + " Suma OBV podań łamiących linię.",
  "deep progressions": GLOSSARY_PROGRESSIVE + " Wejścia piłki głęboko w strefę rywala (StatsBomb).",
  "deep completions": GLOSSARY_DEEP_COMPLETION,

  // presja / obrona
  pressures: "Akcje pressingu: zawodnik zamyka rywala z piłką (StatsBomb).",
  "pressures in opposing half": "Pressing w połowie boiska rywala.",
  "pressured passes in defensive third": "Podania rywala pod presją w tercji obronnej.",
  counterpressures: "Pressing w ciągu kilku sekund po utracie piłki (kontrpressing).",
  "counterpressures in opposing half": "Kontrpressing w połowie rywala.",
  "counterpressures in opposing half%": "Udział kontrpressingu w połowie rywala.",
  "pressures in opposing half%": "Udział pressingu w połowie rywala.",
  tackles: "Wślizgi / odbiory (tackles).",
  interceptions: "Przechwycenia podań.",
  "blocked shots": "Bloki strzałów.",
  "ball recoveries": "Odzyskania piłki.",
  clearances: "Wybicia / clearances.",
  "defensive action distance": "Średnia odległość akcji defensywnych od własnej bramki.",
  "defensive action obv": GLOSSARY_OBV + " Akcje defensywne.",
  aggression: "Wskaźnik agresywności pressingu (StatsBomb).",
  "aggressive actions": "Akcje defensywne o wysokiej intensywności pressingu.",

  // drybling / pojedynki
  dribbles: "Próby dryblingu.",
  "successful dribbles": "Udane dryblingi.",
  "failed dribbles": "Nieudane dryblingi.",
  "dribble%": "Skuteczność dryblingu.",
  "dribbled past": "Razy dryblingiem minięto zawodnika drużyny.",
  "all aerials": "Pojedynki powietrzne (wszystkie).",
  "non aerial duels": "Pojedynki naziemne (Wyscout: offensive/defensive duels).",

  // stałe fragmenty
  crosses: "Centrowania.",
  corners: "Rzuty rożne wykonane.",
  "corner xg": GLOSSARY_XG + " xG ze strzałów po rogach.",
  "goals from corners": "Gole po rzutach rożnych.",
  "goals/corner": "Gole na jeden rzut rożny.",
  "shots/corner": "Strzały na jeden rzut rożny.",
  "xg/corner": "xG na jeden rzut rożny.",
  "set pieces": "Stałe fragmenty gry (rogi, wolne, rzuty karne itd.).",
  "set piece goals": "Gole ze stałych fragmentów.",
  "set piece shots": "Strzały ze stałych fragmentów.",
  "set piece xg": GLOSSARY_XG + " Ze stałych fragmentów.",
  "throw-in xg": GLOSSARY_XG + " Ze strzałów po autach.",
  "goals from throw-ins": "Gole po rzutach z autu.",
  "throw-ins": "Rzuty z autu wykonane.",

  // przeciwnik (OPP)
  "opposition xg": GLOSSARY_XG + " Suma xG strzałów rywala.",
  "goals conceded": "Gole stracone.",
  "non penalty shots faced": "Strzały rywala z gry (bez karnych) — perspektywa bramkarza/obrony.",
  "opposition clear shots": "Czyste strzały rywala (bez bloku).",
  "opposition open play shots": "Strzały rywala z gry otwartej.",
  "opposition counter attacking shots": GLOSSARY_COUNTERATTACK + " Strzały rywala.",
  "opposition passes": "Podania rywala.",
  "opposition passing%": "Skuteczność podań rywala.",
  "opposition deep progressions": "Deep progressions rywala.",
  "opposition deep completions": GLOSSARY_DEEP_COMPLETION + " (rywal).",
  "opposition obv": GLOSSARY_OBV + " (rywal).",

  // OBV
  obv: GLOSSARY_OBV + " Suma wartości akcji z piłką drużyny.",
  "pass obv": GLOSSARY_OBV + " Podania.",
  "shot obv": GLOSSARY_OBV + " Strzały.",
  "dribble & carry obv": GLOSSARY_OBV + " Dryblingi i prowadzenia.",

  // przestrzeń / odbiory
  "ball receipts in space 10m%":
    "Odsetek odbiorów piłki z co najmniej 10 m wolnej przestrzeni wokół zawodnika (StatsBomb).",
  "ball receipts in space 2m%":
    "Odsetek odbiorów z co najmniej 2 m wolnej przestrzeni (StatsBomb).",
  "ball receipts in space 5m%":
    "Odsetek odbiorów z co najmniej 5 m wolnej przestrzeni (StatsBomb).",
  "space received in": "Średnia wolna przestrzeń przy odbiorze piłki (metry, StatsBomb).",

  // dyscyplina / meta
  fouls: "Faule popełnione.",
  "fouls won": "Faule wymuszone na rywalu.",
  "yellow cards": "Żółte kartki.",
  "red cards": "Czerwone kartki.",
  "second yellow cards": "Drugie żółte kartki (czerwona).",
  minutes: "Rzeczywisty czas gry w minutach.",
  "game week": "Numer kolejki rozgrywek.",
  "neutral ground": "1 = mecz na neutralnym boisku, 0 = dom/wyjazd.",

  // bramkarz
  "goalkeeper long ball%": "Udział długich wykopów bramkarza.",
  "goalkeeper pass length": "Średnia długość podań bramkarza (metry).",
};

/** Prefiksy/sufiksy dla wariantów strefowych i % — doprecyzowanie po dopasowaniu bazowym. */
const STATSBOMB_PARTIAL_HINTS: { match: RegExp; suffix: string }[] = [
  {
    match: /^line breaking passes/i,
    suffix: " Wariant metryki Line Breaking Passes ze StatsBomb MatchStats.",
  },
  {
    match: /^opposition /i,
    suffix: " Metryka liczona dla drużyny przeciwnej.",
  },
  {
    match: / in final third$/i,
    suffix: " " + GLOSSARY_PASS_FINAL_THIRD,
  },
  {
    match: / in opposing half$/i,
    suffix: " Ograniczone do połowy boiska rywala.",
  },
  {
    match: /%$/,
    suffix: " Wartość procentowa (udane/wszystkie lub udział w całości).",
  },
];

const OUTCOME_ID_DEFINITIONS: Record<string, string> = {
  sb_win: STATSBOMB_METRIC_DEFINITIONS.wygrana,
  sb_draw: STATSBOMB_METRIC_DEFINITIONS.remis,
  sb_loss: STATSBOMB_METRIC_DEFINITIONS.przegrana,
  sb_points: STATSBOMB_METRIC_DEFINITIONS.punkty,
  sb_gd: STATSBOMB_METRIC_DEFINITIONS.gd,
  sb_xgd: STATSBOMB_METRIC_DEFINITIONS.xgd,
  sb_goals: STATSBOMB_METRIC_DEFINITIONS.gole,
  sb_goals_conceded: STATSBOMB_METRIC_DEFINITIONS["gole stracone"],
  sb_xg: STATSBOMB_METRIC_DEFINITIONS["cumulative xg"],
  sb_xga: STATSBOMB_METRIC_DEFINITIONS["opposition xg"],
};

export function normalizeStatsBombMetricKey(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Zwraca definicję metryki (tooltip) jeśli znana. */
export function getStatsBombMetricDefinition(label: string, metricId?: string): string | undefined {
  if (metricId && OUTCOME_ID_DEFINITIONS[metricId]) {
    return OUTCOME_ID_DEFINITIONS[metricId];
  }

  const key = normalizeStatsBombMetricKey(label);
  const exact = STATSBOMB_METRIC_DEFINITIONS[key];
  if (exact) return exact;

  for (const { match, suffix } of STATSBOMB_PARTIAL_HINTS) {
    if (match.test(label.trim())) {
      const baseKey = key.replace(/^opposition /, "").replace(/ in final third$/, "").replace(/ in opposing half$/, "").replace(/%$/, "");
      const base = STATSBOMB_METRIC_DEFINITIONS[baseKey];
      if (base) return base + suffix;
      return `Metryka StatsBomb: ${label.trim()}.${suffix}`;
    }
  }

  return undefined;
}

/** Liczba zdefiniowanych metryk (do UI). */
export function countStatsBombDefinedMetrics(labels: string[]): number {
  return labels.filter((l) => getStatsBombMetricDefinition(l) !== undefined).length;
}
