/**
 * Czy błąd Firestore/transportu wygląda na brak sieci (kolejka offline ma sens),
 * a nie np. permission-denied czy zły request.
 */
export function isFirestoreOfflineLikeError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  if (
    code === "permission-denied" ||
    code === "unauthenticated" ||
    code === "invalid-argument" ||
    code === "failed-precondition" ||
    code === "not-found" ||
    code === "already-exists"
  ) {
    return false;
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("permission-denied") || (lower.includes("permission") && lower.includes("denied"))) {
    return false;
  }

  return (
    code === "unavailable" ||
    lower.includes("offline") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("err_network") ||
    lower.includes("internet disconnected") ||
    lower.includes("connection refused") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed")
  );
}

/** Błędy zapisu, których nie wrzucamy do pending (trwałe odrzucenie / zły request). */
const NON_QUEUE_FIRESTORE_CODES = new Set([
  "permission-denied",
  "unauthenticated",
  "invalid-argument",
  "not-found",
  "already-exists",
  "failed-precondition",
]);

/**
 * Czy po nieudanej transakcji / zapisie tablicy meczu zapisać stan do pending (localStorage).
 * Szerzej niż isFirestoreOfflineLikeError: obejmuje aborted, deadline-exceeded itd.
 * Wyklucza typowe błędy auth/rules/walidacji — tam kolejka i tak nie pomoże.
 */
export function shouldQueuePendingOnMatchWriteFailure(err: unknown): boolean {
  if (err instanceof Error && err.message === "MATCH_DOCUMENT_NOT_FOUND") {
    return false;
  }

  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";

  if (NON_QUEUE_FIRESTORE_CODES.has(code)) {
    return false;
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("permission-denied") || (lower.includes("permission") && lower.includes("denied"))) {
    return false;
  }

  if (isFirestoreOfflineLikeError(err)) {
    return true;
  }

  const transientRetryCodes = new Set([
    "aborted",
    "deadline-exceeded",
    "resource-exhausted",
    "cancelled",
    "internal",
  ]);
  if (transientRetryCodes.has(code)) {
    return true;
  }

  // Nieznany błąd — wolimy kolejkę niż utratę danych po odświeżeniu.
  return true;
}
