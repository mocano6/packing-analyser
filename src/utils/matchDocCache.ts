import { doc, getDoc } from "firebase/firestore";
import { getDB } from "@/lib/firebase";
import type { TeamInfo } from "@/types";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<
  string,
  { ts: number; exists: boolean; data: TeamInfo | null }
>();

export async function getMatchDocCached(matchId: string): Promise<{
  exists: boolean;
  data: TeamInfo | null;
}> {
  const now = Date.now();
  const cached = cache.get(matchId);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return { exists: cached.exists, data: cached.data };
  }

  const snap = await getDoc(doc(getDB(), "matches", matchId));
  if (!snap.exists()) {
    cache.set(matchId, { ts: now, exists: false, data: null });
    return { exists: false, data: null };
  }

  const data = snap.data() as TeamInfo;
  cache.set(matchId, { ts: now, exists: true, data });
  return { exists: true, data };
}

export function invalidateMatchCache(matchId?: string): void {
  if (!matchId) {
    cache.clear();
    return;
  }
  cache.delete(matchId);
}
