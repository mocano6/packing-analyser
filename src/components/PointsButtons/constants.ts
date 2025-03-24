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
    description: "+1 punkt",
    type: "points",
  },
  {
    points: 0,
    label: "Podanie do P3",
    description: "Aktywuj/Dezaktywuj",
    type: "toggle",
  },
];
