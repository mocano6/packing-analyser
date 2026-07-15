import { doc, type DocumentReference } from "firebase/firestore";
import { getDB } from "@/lib/firebase";

/** Subkolekcja danych sztabu przypisanych do zespołu (mikrocykl, model gry). */
export const TEAM_STAFF_COLLECTION = "staff" as const;

/** Ścieżka dokumentu staff bez inicjalizacji Firebase (np. testy). */
export function teamStaffDocPath(teamId: string, docId: string): string {
  return `teams/${teamId}/${TEAM_STAFF_COLLECTION}/${docId}`;
}

export function teamStaffStateDocRef(teamId: string, docId: string): DocumentReference {
  return doc(getDB(), "teams", teamId, TEAM_STAFF_COLLECTION, docId);
}

/** Legacy: stan per użytkownik przed migracją na zespół. */
export function userLegacyTasksDocRef(uid: string, docId: string): DocumentReference {
  return doc(getDB(), "users", uid, "tasks", docId);
}
