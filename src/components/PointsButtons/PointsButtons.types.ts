// src/components/PointsButtons/PointsButtons.types.ts

/**
 * Props dla komponentu PointsButtons
 */
export interface PointsButtonsProps {
  /** Aktualna liczba punktów */
  currentPoints: number;
  /** Funkcja wywoływana przy dodawaniu punktów */
  onAddPoints: (points: number) => void;
  /** Czy podanie do P3 jest aktywne */
  isP3Active: boolean;
  /** Funkcja przełączająca status P3 */
  onP3Toggle: () => void;
  /** Czy akcja zakończyła się strzałem */
  isShot: boolean;
  /** Funkcja przełączająca status strzału */
  onShotToggle: (newValue: boolean) => void;
  /** Czy strzał zakończył się bramką */
  isGoal: boolean;
  /** Funkcja przełączająca status bramki */
  onGoalToggle: (newValue: boolean) => void;
  /** Funkcja zapisująca całą akcję */
  onSaveAction: () => void;
  /** Funkcja resetująca wszystkie wartości */
  onReset: () => void;
}

/**
 * Definicja przycisku akcji używanego w komponencie PointsButtons
 */
export interface ActionButton {
  /** Liczba punktów przyznawana po kliknięciu przycisku */
  points: number;
  /** Etykieta wyświetlana na przycisku */
  label: string;
  /** Opis przycisku (podpowiedź) */
  description: string;
  /** Typ przycisku: punktowy lub przełącznik */
  type?: "points" | "toggle";
}
