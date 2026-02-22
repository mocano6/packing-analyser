/**
 * Store metryk Firestore – zlicza odczyty i zapisy w sesji.
 * Używane przez wrapper firestoreWithMetrics oraz komponent FirestoreMetricsBadge (tylko admin).
 */

const MAX_LAST_OPERATIONS = 50;

export interface FirestoreOperation {
  type: "read" | "write";
  label: string;
  /** Ścieżka dokumentu (np. "matches/abc123") – brak dla getDocs (zapytanie) */
  path?: string;
  /** Liczba read/write units dodana przez operację (dla getDocs może być > 1). */
  units?: number;
  timestamp: number;
}

export interface FirestoreMetricsState {
  sessionReads: number;
  sessionWrites: number;
  lastOperations: FirestoreOperation[];
}

type Listener = (state: FirestoreMetricsState) => void;

let sessionReads = 0;
let sessionWrites = 0;
let lastOperations: FirestoreOperation[] = [];
const listeners = new Set<Listener>();

function getState(): FirestoreMetricsState {
  return {
    sessionReads,
    sessionWrites,
    lastOperations: [...lastOperations],
  };
}

function notify() {
  const state = getState();
  listeners.forEach((cb) => cb(state));
}

export function recordFirestoreRead(label: string = "read", path?: string, units: number = 1) {
  const safeUnits = Number.isFinite(units) ? Math.max(0, Math.round(units)) : 1;
  sessionReads += safeUnits;
  lastOperations.push({ type: "read", label, path, units: safeUnits, timestamp: Date.now() });
  if (lastOperations.length > MAX_LAST_OPERATIONS) {
    lastOperations.shift();
  }
  notify();
}

export function recordFirestoreWrite(label: string = "write", path?: string) {
  sessionWrites += 1;
  lastOperations.push({ type: "write", label, path, units: 1, timestamp: Date.now() });
  if (lastOperations.length > MAX_LAST_OPERATIONS) {
    lastOperations.shift();
  }
  notify();
}

export function resetFirestoreMetrics() {
  sessionReads = 0;
  sessionWrites = 0;
  lastOperations = [];
  notify();
}

export function subscribeFirestoreMetrics(listener: Listener): () => void {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

export function getFirestoreMetricsSnapshot(): FirestoreMetricsState {
  return getState();
}
