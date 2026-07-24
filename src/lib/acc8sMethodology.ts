/**
 * Metodologia liczenia 8s ACC — treść panelu informacyjnego w Acc8sModal.
 * Edytuj sekcje poniżej, gdy ustalicie ostateczną definicję kodowania.
 */

export interface Acc8sMethodologySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

/** Okno czasowe skutku od startu akcji 8s ACC. */
export const ACC8S_OUTCOME_WINDOW_SECONDS = 8;

export const ACC8S_METHODOLOGY_TITLE = "Metodologia 8s ACC";

export const ACC8S_METHODOLOGY_INTRO =
  "Definicja przyspieszenia od połowy boiska oraz warunki zaliczenia akcji.";

export const ACC8S_METHODOLOGY_SECTIONS: Acc8sMethodologySection[] = [
  {
    id: "definition",
    title: "Definicja przyspieszenia",
    paragraphs: [
      "W aplikacji tagujemy moment pierwszego kontaktu — chwili, w której zawodnik dotyka piłki stopą po przekroczeniu połowy. To ten moment startuje okno 8 sekund.",
    ],
  },
  {
    id: "success",
    title: "Kiedy przyspieszenie jest zaliczone",
    paragraphs: [
      `Przyspieszenie jest uznawane za zaliczone, gdy w ciągu ${ACC8S_OUTCOME_WINDOW_SECONDS} sekund od jego rozpoczęcia zawodnik zdoła wejść w pole karne rywala, oddać strzał na bramkę lub strzelić gola.`,
    ],
  },
];
