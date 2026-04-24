import { v4 as uuidv4 } from "uuid";

/** Nadaje brakującym wpisom stabilne `id` przed zapisem (Firestore / pending). */
export function ensureEachEntryHasId<T extends { id?: string }>(arr: T[]): T[] {
  return arr.map((item) => {
    const id = item.id;
    if (id !== undefined && id !== null && String(id).trim() !== "") {
      return item;
    }
    return { ...item, id: uuidv4() };
  });
}
