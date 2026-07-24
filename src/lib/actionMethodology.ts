/**
 * Metodologia podań progresywnych (packing) — treść panelu informacyjnego w ActionModal.
 */

export interface ActionMethodologySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const ACTION_METHODOLOGY_TITLE = "Metodologia podań progresywnych";

export const ACTION_METHODOLOGY_INTRO =
  "Kiedy oznaczamy akcję packing, jaki moment zapisujemy na wideo i jak liczymy miniętych przeciwników.";

export const ACTION_METHODOLOGY_SECTIONS: ActionMethodologySection[] = [
  {
    id: "what",
    title: "Co tagujemy",
    paragraphs: [
      "Tagujemy tylko podania progresywne, które minęły przeciwników.",
    ],
    bullets: [
      "Wyjątek: podania na wysokości pola karnego — liczymy w poprzek.",
    ],
  },
  {
    id: "tagging",
    title: "Moment tagowania",
    paragraphs: [
      "Moment tagu to moment przyjęcia piłki (podanie) lub ostatniego kontaktu przy dribbingu.",
    ],
  },
  {
    id: "opponents",
    title: "Minięci przeciwnicy",
    paragraphs: [
      "Liczymy miniętych przeciwników w drodze do bramki.",
    ],
  },
];
