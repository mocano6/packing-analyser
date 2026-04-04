import { Timestamp } from "firebase/firestore";

/**
 * Konwertuje wartość pola czasu z Firestore (Timestamp, Date, ISO string, { seconds }) na Date.
 */
export function coerceFirestoreToDate(value: unknown): Date | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value instanceof Timestamp) {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") {
      try {
        const d = fn.call(value);
        if (d instanceof Date && !Number.isNaN(d.getTime())) {
          return d;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const s = Number((value as { seconds: unknown }).seconds);
    if (Number.isFinite(s)) {
      const d = new Date(s * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/** Etykieta ostatniego logowania do UI (pl-PL). */
export function formatLastLoginPl(value: unknown): string {
  const d = coerceFirestoreToDate(value);
  if (!d) {
    return "Nigdy";
  }
  return d.toLocaleString("pl-PL");
}
