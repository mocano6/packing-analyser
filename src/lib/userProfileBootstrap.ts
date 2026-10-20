import type { RegistrationData, UserData } from "@/hooks/useAuth";

/**
 * Pierwsze wejście bez dokumentu users/{uid} (np. Google).
 * Konto czeka na akceptację administratora — nie dostaje od razu roli analityka.
 */
export function buildBootstrapUserProfile(email: string, now: Date = new Date()): UserData {
  return {
    email,
    allowedTeams: [],
    role: "player",
    status: "pending",
    linkedPlayerId: null,
    createdAt: now,
    lastLogin: now,
  };
}

export function buildPlayerRegistrationProfile(input: {
  email: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  now?: Date;
}): UserData {
  const now = input.now ?? new Date();
  const registrationData: RegistrationData = {
    firstName: input.firstName,
    lastName: input.lastName,
    birthYear: input.birthYear,
  };
  return {
    ...buildBootstrapUserProfile(input.email, now),
    registrationData,
  };
}

/** Domyślny profil tworzymy tylko gdy dokumentu jeszcze nie ma — nigdy nie nadpisujemy rejestracji. */
export function shouldCreateDefaultUserProfile(documentExists: boolean): boolean {
  return !documentExists;
}

/** Kolejka „Oczekujące konta” w panelu admina. */
export function isPendingApprovalUser(user: { status?: string | null }): boolean {
  return user.status === "pending";
}
