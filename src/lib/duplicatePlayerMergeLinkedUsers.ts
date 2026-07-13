/**
 * Po scaleniu duplikatów — przepisanie users.linkedPlayerId z karty źródłowej na docelową.
 */

import type { Firestore } from "firebase/firestore";
import { collection, getDocs, query, where, writeBatch } from "@/lib/firestoreWithMetrics";

const USERS_BATCH_MAX = 400;

export type DuplicateIdToMainIdMap = Map<string, string>;

/**
 * Dla każdego duplikatu szuka użytkowników z linkedPlayerId === dupId i ustawia mainId.
 * @returns liczba zaktualizowanych dokumentów users
 */
export async function rewriteUsersLinkedPlayerIdForDuplicateMerge(
  db: Firestore,
  dupToMain: DuplicateIdToMainIdMap,
): Promise<number> {
  if (dupToMain.size === 0) return 0;

  let updated = 0;
  let batch = writeBatch(db);
  let batchOps = 0;

  const flush = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    batchOps = 0;
  };

  for (const [dupId, mainId] of dupToMain) {
    if (!dupId || !mainId || dupId === mainId) continue;
    const usersSnap = await getDocs(
      query(collection(db, "users"), where("linkedPlayerId", "==", dupId)),
    );
    for (const userDoc of usersSnap.docs) {
      batch.update(userDoc.ref, { linkedPlayerId: mainId });
      batchOps++;
      updated++;
      if (batchOps >= USERS_BATCH_MAX) {
        await flush();
      }
    }
  }

  await flush();
  return updated;
}
