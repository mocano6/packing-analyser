/**
 * Spójnie z useAuth: trim + case — unika rozjechania z regułami Firestore (regex)
 * i starego `callerRole !== "admin"` w API.
 */
export function isAdminRoleFromFirestore(role: unknown): boolean {
  return typeof role === "string" && role.trim().toLowerCase() === "admin";
}
