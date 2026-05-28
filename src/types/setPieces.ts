/** Identyfikatory stałych fragmentów (MVP: atak z rzutu rożnego i wolnego). */
export type SetPieceTypeId = "corner_attack" | "free_kick_attack";

/** Numer wariantu ustawienia (np. „1”, „5”) — osobny układ na boisku. */
export type SetPieceVariantId = string;

export type SetPieceZoneKind = "movement" | "target";

export interface SetPiecePlayerOverride {
  displayName?: string;
  imageUrl?: string;
}

export type SetPieceMarkerSide = "own" | "opponent";

export interface SetPieceMarker {
  playerId: string;
  /** Pozycja X na boisku w procentach (0 = lewa linia, 100 = prawa). */
  x: number;
  y: number;
  /** Domyślnie „own” — nasz zespół. */
  side?: SetPieceMarkerSide;
}

export interface SetPieceOpponentPlayer {
  id: string;
  label: string;
  number: number;
}

export interface SetPieceZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Nazwa strefy widoczna na boisku (np. „Bliski słupek”). */
  label: string;
  kind: SetPieceZoneKind;
  /** Opis zadania dla tej strefy (np. wybieg, zagranie na słupek). */
  task?: string;
}

export interface SetPiecePlayerAssignment {
  playerId: string;
  task?: string;
}

/** Jedna klatka (moment) animacji w ramach wariantu. */
export interface SetPieceFrame {
  id: string;
  label: string;
  markers: SetPieceMarker[];
  zones: SetPieceZone[];
  assignments: SetPiecePlayerAssignment[];
}

/** Konfiguracja jednego typu + wariantu stałego fragmentu dla meczu. */
export interface SetPieceSetup {
  type: SetPieceTypeId;
  variant: SetPieceVariantId;
  matchId: string;
  teamId: string;
  updatedAt: string;
  /** Wspólna lista zawodników dla wszystkich klatek wariantu. */
  selectedPlayerIds: string[];
  opponentPlayers: SetPieceOpponentPlayer[];
  selectedOpponentIds: string[];
  frames: SetPieceFrame[];
}

/** Dokument lokalny dla meczu — wspólne podmiany twarzy/nazwisk między typami SF. */
export interface SetPieceMatchDocument {
  matchId: string;
  teamId: string;
  playerOverrides: Record<string, SetPiecePlayerOverride>;
  /** Klucz: `buildSetupStorageKey(type, variant)` */
  setups: Record<string, SetPieceSetup>;
}
