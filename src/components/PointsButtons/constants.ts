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
    label: "P3",
    description: "Aktywuj/Dezaktywuj P3",
    type: "toggle",
  },
  {
    points: 0,
    label: "1T",
    description: "Aktywuj/Dezaktywuj 1T",
    type: "toggle",
  },
  {
    points: 0,
    label: "2T",
    description: "Aktywuj/Dezaktywuj 2T",
    type: "toggle",
  },
  {
    points: 0,
    label: "3T+",
    description: "Aktywuj/Dezaktywuj 3T+",
    type: "toggle",
  },
];
