/**
 * Role kont LOOKBALL (pole users/{uid}.role w Firestore).
 * Admin systemu: JWT claim admin LUB role === "admin".
 * Operator: jak zwykły user + odczyt weryfikacji meczów i bazy wiedzy (tylko assigned teams).
 * Scout: porównywarka, statystyki zespołu, profil, GPS + podgląd scoutingu (bez sync).
 * User = analityk (zwykły dostęp do aplikacji).
 */
export type UserRole = "user" | "admin" | "operator" | "coach" | "scout" | "player";

export const USER_ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> = [
  { value: "user", label: "Analityk" },
  { value: "operator", label: "Operator" },
  { value: "admin", label: "Admin" },
  { value: "coach", label: "Trener" },
  { value: "scout", label: "Scout" },
  { value: "player", label: "Zawodnik" },
];

/** Role personelu (bez zawodnika) — np. konwersja oczekującego konta Google. */
export const STAFF_ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> =
  USER_ROLE_OPTIONS.filter((option) => option.value !== "player");

/** Domyślna strona startowa dla roli scout. */
export function getScoutHomePath(): string {
  return "/zawodnicy";
}

/** Allowlist ścieżek dla roli scout (twardy guard w AuthGuard). */
export function isScoutPathAllowed(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === "/login" || pathname === "/") return true;
  if (pathname === "/zawodnicy") return true;
  if (pathname === "/statystyki-zespolu") return true;
  if (pathname === "/gps") return true;
  if (pathname === "/scouting") return true;
  if (pathname.startsWith("/profile")) return true;
  return false;
}

export function normalizeUserRole(role: unknown): UserRole {
  if (typeof role !== "string") return "user";
  const normalized = role.trim().toLowerCase();
  switch (normalized) {
    case "admin":
      return "admin";
    case "operator":
      return "operator";
    case "coach":
      return "coach";
    case "scout":
      return "scout";
    case "player":
      return "player";
    case "user":
    case "analyst":
    case "analityk":
      return "user";
    default:
      return "user";
  }
}

/**
 * Patch Firestore przy zmianie roli.
 * Wyjście z roli zawodnika czyści status oczekujący i powiązanie z profilem gracza.
 */
export function buildRoleChangePatch(newRole: UserRole): {
  role: UserRole;
  status?: "approved";
  linkedPlayerId?: null;
} {
  if (newRole === "player") {
    return { role: "player" };
  }
  return {
    role: newRole,
    status: "approved",
    linkedPlayerId: null,
  };
}

export function isOperatorRoleFromFirestore(role: unknown): boolean {
  return typeof role === "string" && role.trim().toLowerCase() === "operator";
}

/** Admin systemu lub Operator — dostęp do weryfikacji meczów (odczyt). */
export function canAccessMatchVerification(params: {
  isAdmin: boolean;
  userRole: UserRole | null | undefined;
}): boolean {
  return params.isAdmin || params.userRole === "operator";
}

/** Admin systemu lub Operator — dostęp do bazy wiedzy (odczyt). */
export function canAccessKnowledgeBase(params: {
  isAdmin: boolean;
  userRole: UserRole | null | undefined;
}): boolean {
  return params.isAdmin || params.userRole === "operator";
}

/** Admin systemu lub Scout — dostęp do strony scoutingu (scout: tylko podgląd w UI). */
export function canAccessScouting(params: {
  isAdmin: boolean;
  userRole: UserRole | null | undefined;
}): boolean {
  return params.isAdmin || params.userRole === "scout";
}
