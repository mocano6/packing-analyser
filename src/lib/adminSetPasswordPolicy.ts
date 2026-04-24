/** Minimalna długość hasła zgodna z Firebase Auth (client + Admin SDK). */
export const FIREBASE_AUTH_PASSWORD_MIN_LENGTH = 6;

export type ParsedAdminSetPassword =
  | { ok: true; uid: string; newPassword: string }
  | { ok: false; error: string; status: number };

/**
 * Walidacja body dla POST /api/admin-set-user-password (testowalna bez Firebase).
 */
export function parseAdminSetPasswordBody(body: unknown): ParsedAdminSetPassword {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Nieprawidłowe body żądania.", status: 400 };
  }
  const { uid, newPassword } = body as { uid?: unknown; newPassword?: unknown };

  if (typeof uid !== "string" || !uid.trim()) {
    return { ok: false, error: "Brak uid użytkownika.", status: 400 };
  }
  if (typeof newPassword !== "string") {
    return { ok: false, error: "Brak hasła.", status: 400 };
  }

  const trimmed = newPassword.trim();
  if (trimmed.length < FIREBASE_AUTH_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Hasło musi mieć co najmniej ${FIREBASE_AUTH_PASSWORD_MIN_LENGTH} znaków.`,
      status: 400,
    };
  }

  return { ok: true, uid: uid.trim(), newPassword: trimmed };
}
