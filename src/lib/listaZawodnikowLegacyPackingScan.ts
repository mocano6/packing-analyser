/**
 * Gdy tablice w dokumentach matches są puste, a dane packing są tylko w root `actions_packing`
 * (lub cache zwrócił puste zapytania per matchId), jednorazowy skan całej kolekcji uzupełnia liczniki.
 * Dedup po `${matchId}|${actionId}` względem akcji już zebranych z dokumentów meczów.
 */

import type { Firestore } from "firebase/firestore";
import type { Action } from "@/types";
import { collection, getDocs, getDocsFromServer } from "./firestoreWithMetrics";
import type { GlobalPlayerDataCounts } from "./globalPlayerDataCounts";
import { bumpGlobalMapFromLegacyPackingDoc } from "./globalPlayerDataCounts";
import { normalizeLegacyPackingDocToAction } from "./matchDocumentCache";

function embeddedKey(matchId: string, actionId: string): string {
  return `${String(matchId).trim()}|${String(actionId).trim()}`;
}

/**
 * Dodaje do mapy liczniki i zwraca akcje, których nie było w zbiorze `embeddedKeys` (modyfikuje ten zbiór).
 */
export async function appendUnembeddedLegacyActionsPacking(
  db: Firestore,
  globalMap: Map<string, GlobalPlayerDataCounts>,
  embeddedKeys: Set<string>,
): Promise<Action[]> {
  const extra: Action[] = [];
  let snap;
  try {
    snap = await getDocsFromServer(collection(db, "actions_packing"));
  } catch (err) {
    console.warn("[lista-zawodnikow] getDocsFromServer(actions_packing), fallback cache:", err);
    try {
      snap = await getDocs(collection(db, "actions_packing"));
    } catch (e2) {
      console.warn("[lista-zawodnikow] getDocs(actions_packing) failed:", e2);
      return extra;
    }
  }

  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const mid = String(data.matchId ?? "").trim();
    if (!mid) continue;
    const aid = String((data.id as string | undefined) ?? d.id).trim();
    const key = embeddedKey(mid, aid);
    if (embeddedKeys.has(key)) continue;
    embeddedKeys.add(key);
    bumpGlobalMapFromLegacyPackingDoc(globalMap, data);
    const a = normalizeLegacyPackingDocToAction(data, d.id, mid);
    extra.push({ ...a, sourceMatchArray: "actions_packing" });
  }
  return extra;
}
