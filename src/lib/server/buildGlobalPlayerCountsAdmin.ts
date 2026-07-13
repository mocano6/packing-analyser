import type { Firestore } from "firebase-admin/firestore";
import { buildGlobalCountsRecordFromMatchDocs } from "@/lib/playerHardDeleteEligibility";
import type { GlobalPlayerDataCounts } from "@/lib/globalPlayerDataCounts";

const MATCH_COLLECTIONS = ["matches", "matches_archive"] as const;

/**
 * Jednorazowy odczyt meczów + gps (Admin SDK) do weryfikacji trwałego usuwania kart.
 */
export async function buildGlobalPlayerCountsRecordAdmin(
  db: Firestore,
): Promise<Record<string, GlobalPlayerDataCounts>> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const col of MATCH_COLLECTIONS) {
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      byId.set(doc.id, doc.data());
    }
  }
  const gpsSnap = await db.collection("gps").get();
  const gpsDocs = gpsSnap.docs.map((d) => d.data());
  return buildGlobalCountsRecordFromMatchDocs([...byId.values()], gpsDocs);
}
