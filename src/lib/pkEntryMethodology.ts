/**
 * Metodologia wejścia w pole karne (PK) — treść panelu informacyjnego w PKEntryModal.
 */

export interface PkEntryMethodologySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const PK_ENTRY_METHODOLOGY_TITLE = "Metodologia wejścia w pole karne";

export const PK_ENTRY_METHODOLOGY_INTRO =
  "Kiedy oznaczamy wejście w PK i jaki moment zapisujemy na osi czasu wideo.";

export const PK_ENTRY_METHODOLOGY_SECTIONS: PkEntryMethodologySection[] = [
  {
    id: "tagging",
    title: "Moment tagowania",
    paragraphs: [
      "Tagujemy w momencie pierwszego kontaktu każde pierwsze dotknięcie piłki w PK.",
    ],
  },
];
