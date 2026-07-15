import type { UserData } from "@/hooks/useAuth";
import { normalizeAllowedTeams } from "@/utils/userAllowedTeams";

export type AdminAuthUserSummary = {
  uid: string;
  email: string | null;
  providerIds: string[];
  creationTime: string | null;
  lastSignInTime: string | null;
  disabled: boolean;
};

export type UserWithAuthMeta = UserData & {
  id: string;
  /** Brak dokumentu users/{uid} w Firestore — konto istnieje tylko w Firebase Authentication. */
  hasFirestoreProfile: boolean;
  authProviders: string[];
};

const PROVIDER_LABELS: Record<string, string> = {
  "google.com": "Google",
  password: "Email/hasło",
  "apple.com": "Apple",
  "facebook.com": "Facebook",
  "github.com": "GitHub",
  "microsoft.com": "Microsoft",
  phone: "Telefon",
};

export function formatAuthProviderLabels(providerIds: string[]): string {
  const unique = [...new Set(providerIds.filter(Boolean))];
  if (unique.length === 0) {
    return "Nieznany";
  }
  return unique.map((id) => PROVIDER_LABELS[id] ?? id).join(", ");
}

export function authUserIsManageable(user: AdminAuthUserSummary): boolean {
  if (user.disabled) {
    return false;
  }
  if (user.providerIds.includes("google.com") || user.providerIds.includes("password")) {
    return true;
  }
  return Boolean(user.email?.trim());
}

export function authUserHasPasswordProvider(providerIds: string[]): boolean {
  return providerIds.includes("password");
}

function parseAuthTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Łączy dokumenty Firestore users/* z kontami Firebase Authentication (np. Google bez profilu Firestore).
 */
export function mergeFirestoreUsersWithAuthUsers(
  firestoreUsers: Array<UserData & { id: string }>,
  authUsers: AdminAuthUserSummary[],
): UserWithAuthMeta[] {
  const firestoreById = new Map<string, UserData & { id: string }>();
  for (const user of firestoreUsers) {
    firestoreById.set(user.id, user);
  }

  const merged = new Map<string, UserWithAuthMeta>();

  for (const user of firestoreUsers) {
    merged.set(user.id, {
      ...user,
      allowedTeams: normalizeAllowedTeams(user.allowedTeams),
      hasFirestoreProfile: true,
      authProviders: [],
    });
  }

  for (const authUser of authUsers) {
    if (!authUserIsManageable(authUser)) {
      continue;
    }

    const existing = merged.get(authUser.uid);
    if (existing) {
      merged.set(authUser.uid, {
        ...existing,
        email: existing.email || authUser.email || "",
        authProviders: authUser.providerIds,
        lastLogin: existing.lastLogin ?? parseAuthTimestamp(authUser.lastSignInTime),
      });
      continue;
    }

    merged.set(authUser.uid, {
      id: authUser.uid,
      email: authUser.email || "",
      allowedTeams: [],
      role: "user",
      createdAt: parseAuthTimestamp(authUser.creationTime) ?? new Date(),
      lastLogin: parseAuthTimestamp(authUser.lastSignInTime),
      hasFirestoreProfile: false,
      authProviders: authUser.providerIds,
    });
  }

  return [...merged.values()].sort((a, b) =>
    (a.email || a.id).localeCompare(b.email || b.id, "pl", { sensitivity: "base" }),
  );
}
