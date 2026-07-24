/**
 * Metodologia Regain / Loses — treść panelu informacyjnego w RegainActionModal i LosesActionModal.
 */

export interface RegainLoseMethodologySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

/** Okno oceny reakcji pressingowej od momentu tagu. */
export const REGAIN_LOSE_REACTION_WINDOW_SECONDS = 5;

export const REGAIN_LOSE_METHODOLOGY_TITLE = "Metodologia Regain / Loses";

export const REGAIN_LOSE_METHODOLOGY_INTRO =
  "Kiedy oznaczamy przechwyt lub stratę piłki i jaki moment zapisujemy na wideo.";

export const REGAIN_LOSE_METHODOLOGY_SECTIONS: RegainLoseMethodologySection[] = [
  {
    id: "tagging",
    title: "Moment tagowania",
    paragraphs: ["Tagujemy moment przechwytu (Regain) lub straty piłki (Loses)."],
  },
  {
    id: "regain",
    title: "Regain — przechwyt",
    paragraphs: [
      "Moment przechwytu to pierwszy kontakt naszego zawodnika z piłką.",
    ],
  },
  {
    id: "lose",
    title: "Loses — strata",
    paragraphs: [
      "Moment straty to pierwszy kontakt przeciwnika z piłką albo moment, w którym piłka wyszła na aut.",
    ],
  },
  {
    id: "reaction",
    title: "Reakcja pressingowa",
    paragraphs: [
      `Od momentu tagu liczymy ${REGAIN_LOSE_REACTION_WINDOW_SECONDS} sekund — w tym oknie oceniamy reakcję pressingową.`,
      "Regain i Loses mają te same parametry.",
    ],
  },
];
