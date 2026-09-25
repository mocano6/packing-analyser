import { isIn1TZoneCanonical, isInOpponent1TZoneCanonical } from "./pitchZones";

/** Kontakty liczone wyłącznie wewnątrz strefy 1T drużyny strzelającej. */
export type Zone1TContactKey = "1" | "2" | "3plus";

export interface Zone1TContactFlags {
  isZone1TContact1: boolean;
  isZone1TContact2: boolean;
  isZone1TContact3Plus: boolean;
}

export interface Zone1TContactShot {
  isContact1?: boolean;
  isZone1TContact1?: boolean;
  isZone1TContact2?: boolean;
  isZone1TContact3Plus?: boolean;
}

type ShotZoneLike = {
  x?: unknown;
  y?: unknown;
  teamContext?: string;
};

export function emptyZone1TContactFlags(): Zone1TContactFlags {
  return {
    isZone1TContact1: false,
    isZone1TContact2: false,
    isZone1TContact3Plus: false,
  };
}

export function zone1TContactFlagsFromShot(
  shot: Partial<Zone1TContactFlags> | null | undefined
): Zone1TContactFlags {
  return {
    isZone1TContact1: shot?.isZone1TContact1 === true,
    isZone1TContact2: shot?.isZone1TContact2 === true,
    isZone1TContact3Plus: shot?.isZone1TContact3Plus === true,
  };
}

type ActionContactFlags = {
  isContact1?: boolean;
  isContact2?: boolean;
  isContact3Plus?: boolean;
};

/**
 * Pytanie o kontakty w strefie ma sens tylko, gdy cała akcja ma więcej niż jeden kontakt.
 * Przy 1T w strefie też jest jeden kontakt, więc osobne oznaczenie jest zbędne.
 */
export function showsZone1TContactPicker(shot: ActionContactFlags, inZone: boolean): boolean {
  if (!inZone || shot.isContact1 === true) return false;
  return shot.isContact2 === true || shot.isContact3Plus === true;
}

/** Strefa kończenia drużyny strzelającej: atak po prawej, obrona po lewej. */
export function isShotInFinishing1TZone(shot: ShotZoneLike): boolean {
  return shot.teamContext === "defense"
    ? isInOpponent1TZoneCanonical(shot)
    : isIn1TZoneCanonical(shot);
}

export function hasZone1TContactTag(shot: Zone1TContactShot): boolean {
  return (
    shot.isZone1TContact1 === true ||
    shot.isZone1TContact2 === true ||
    shot.isZone1TContact3Plus === true
  );
}

/**
 * Czy strzał ze strefy 1T ma jeden kontakt w tej strefie.
 * Nowe oznaczenie ma pierwszeństwo. Brak oznaczenia zostawia dawną regułę `isContact1`.
 */
export function isOneContactIn1TZone(shot: Zone1TContactShot): boolean {
  if (hasZone1TContactTag(shot)) return shot.isZone1TContact1 === true;
  return shot.isContact1 === true;
}

export function zone1TContactLabel(shot: Zone1TContactShot): "1" | "2" | "3+" | null {
  if (shot.isZone1TContact1 === true) return "1";
  if (shot.isZone1TContact2 === true) return "2";
  if (shot.isZone1TContact3Plus === true) return "3+";
  return null;
}

export function toggleZone1TContact(
  current: Zone1TContactFlags,
  key: Zone1TContactKey
): Zone1TContactFlags {
  const isOn =
    key === "1"
      ? current.isZone1TContact1
      : key === "2"
        ? current.isZone1TContact2
        : current.isZone1TContact3Plus;
  if (isOn) return emptyZone1TContactFlags();
  return {
    isZone1TContact1: key === "1",
    isZone1TContact2: key === "2",
    isZone1TContact3Plus: key === "3plus",
  };
}
