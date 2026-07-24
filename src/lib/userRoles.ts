/**
 * Role kont LOOKBALL (pole users/{uid}.role w Firestore).
 * Admin systemu: JWT claim admin LUB role === "admin".
 * Operator: jak zwykły user + odczyt weryfikacji meczów i bazy wiedzy (tylko assigned teams).
 * User = analityk (zwykły dostęp do aplikacji).
 */
export type UserRole = "user" | "admin" | "operator" | "coach" | "player";

export const USER_ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> = [
  { value: "user", label: "Analityk" },
  { value: "operator", label: "Operator" },
  { value: "admin", label: "Admin" },
  { value: "coach", label: "Trener" },
  { value: "player", label: "Zawodnik" },
];

/** Role personelu (bez zawodnika) — np. konwersja oczekującego konta Google. */
export const STAFF_ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> =
  USER_ROLE_OPTIONS.filter((option) => option.value !== "player");

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
