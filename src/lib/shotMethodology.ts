/**
 * Metodologia strzału (xG) — treść panelu informacyjnego w ShotModal.
 */

export interface ShotMethodologySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const SHOT_METHODOLOGY_TITLE = "Metodologia strzału";

export const SHOT_METHODOLOGY_INTRO =
  "Kiedy oznaczamy strzał i jaki moment zapisujemy na osi czasu wideo.";

export const SHOT_METHODOLOGY_SECTIONS: ShotMethodologySection[] = [
  {
    id: "tagging",
    title: "Moment tagowania",
    paragraphs: [
      "Tagujemy każdy moment strzału — moment tagu to moment strzału na wideo.",
    ],
  },
];
