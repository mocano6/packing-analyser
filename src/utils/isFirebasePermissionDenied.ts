/**
 * Firestore zwraca błędy z code === "permission-denied", ale nie zawsze
 * `instanceof FirebaseError` z "firebase/app" (duplikaty pakietów / podklasy).
 */
export function isFirebasePermissionDenied(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "permission-denied") return true;
  const msg =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error);
  return (
    msg.includes("permission-denied") ||
    msg.includes("Missing or insufficient permissions") ||
    msg.includes("PERMISSION_DENIED")
  );
}
