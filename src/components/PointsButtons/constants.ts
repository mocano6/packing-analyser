// src/components/PointsButtons/constants.ts

// Definiujemy interfejs ActionButton bezpośrednio w pliku constants
export interface ActionButton {
  points: number;
  label: string;
  description: string;
  type: "points" | "toggle";
}

export const ACTION_BUTTONS: ActionButton[] = [
  {
    points: 1,
    label: "Minięty przeciwnik",
    description: "Dodaj punkt za minięcie obrońcy",
    type: "points",
  },
  {
    points: 0,
    label: "P1",
    description: "Aktywuj/Dezaktywuj P1",
    type: "toggle",
  },
  {
    points: 0,
    label: "P2", 
    description: "Aktywuj/Dezaktywuj P2",
    type: "toggle",
  },
  {
    points: 0,
    label: "P3-Box",
    description: "Aktywuj/Dezaktywuj P3-Box",
    type: "toggle",
  },
  {
    points: 0,
    label: "P3-Site",
    description: "Aktywuj/Dezaktywuj P3-Site",
    type: "toggle",
  },
  {
    points: 0,
    label: "1 kontakt",
    description: "Aktywuj/Dezaktywuj 1 kontakt z piłką",
    type: "toggle",
  },
  {
    points: 0,
    label: "2 kontakty",
    description: "Aktywuj/Dezaktywuj 2 kontakty z piłką",
    type: "toggle",
  },
  {
    points: 0,
    label: "3+ kontakty",
    description: "Aktywuj/Dezaktywuj 3+ kontakty z piłką",
    type: "toggle",
  },
];
