import type { Acc8sEntry, Action, PKEntry, PossessionSegment, Shot, TeamInfo } from "@/types";
import { deleteField, doc, getDoc, runTransaction, type UpdateData } from "@/lib/firestoreWithMetrics";
import { getDB } from "@/lib/firebase";
import { setMatchDocumentInCache } from "@/lib/matchDocumentCache";
import { clearPendingMatchUpdate, getPendingField } from "@/lib/offlineMatchPending";
import { mergeByIdPreferPending } from "@/lib/mergeMatchArrayById";
import { ensureEachEntryHasId } from "@/lib/ensureMatchArrayIds";
import { normalizeHalfStartTimeSeconds } from "@/utils/normalizeTeamInfoHalfStarts";
import {
  describeMatchClockChanges,
  recalculateMatchRecording,
  type MatchClockChangePreview,
  type MatchHalfStarts,
  type RecalculateMatchRecordingInput,
  type RecalculateMatchRecordingResult,
} from "@/utils/recalculateMatchClock";

const ARRAY_FIELDS = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
  "shots",
  "pkEntries",
  "acc8sEntries",
] as const;

type ArrayField = (typeof ARRAY_FIELDS)[number];

export type PersistRecalculatedMatchClockResult = RecalculateMatchRecordingResult & {
  matchId: string;
  firstHalfStartTime?: number;
  secondHalfStartTime?: number;
};

function removeUndefinedDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(value as object)) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) cleaned[key] = removeUndefinedDeep(nested);
    }
    return cleaned;
  }
  return value;
}

function overlayPending<T extends { id?: string }>(matchId: string, field: ArrayField, server: T[]): T[] {
  const pending = getPendingField<T[]>(matchId, field);
  if (!pending || pending.length === 0) return server;
  return mergeByIdPreferPending(server, pending);
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function collectMatchRecording(matchId: string, server: TeamInfo): RecalculateMatchRecordingInput {
  return {
    actions_packing: overlayPending<Action>(matchId, "actions_packing", asList<Action>(server.actions_packing)),
    actions_unpacking: overlayPending<Action>(matchId, "actions_unpacking", asList<Action>(server.actions_unpacking)),
    actions_regain: overlayPending<Action>(matchId, "actions_regain", asList<Action>(server.actions_regain)),
    actions_loses: overlayPending<Action>(matchId, "actions_loses", asList<Action>(server.actions_loses)),
    shots: overlayPending<Shot>(matchId, "shots", asList<Shot>(server.shots)),
    pkEntries: overlayPending<PKEntry>(matchId, "pkEntries", asList<PKEntry>(server.pkEntries)),
    acc8sEntries: overlayPending<Acc8sEntry>(matchId, "acc8sEntries", asList<Acc8sEntry>(server.acc8sEntries)),
    possessionSegments: asList<PossessionSegment>(server.matchData?.possessionSegments),
  };
}

function rethrowMatchClockError(error: unknown): never {
  if (error instanceof Error && error.message === "MATCH_DOCUMENT_NOT_FOUND") {
    throw new Error("Nie znaleziono meczu.");
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/offline|unavailable|network|failed to fetch/i.test(message)) {
    throw new Error("Brak połączenia. Przeliczenie zapisuje się w bazie — spróbuj ponownie, gdy sieć wróci.");
  }
  throw error instanceof Error ? error : new Error("Nie udało się przeliczyć czasów zdarzeń.");
}

/** Podgląd zmian minut i połówek, bez zapisu. */
export async function loadMatchClockChangePreview(
  matchId: string,
  timing: MatchHalfStarts
): Promise<MatchClockChangePreview> {
  try {
    const db = getDB();
    const snap = await getDoc(doc(db, "matches", matchId));
    if (!snap.exists()) {
      throw new Error("MATCH_DOCUMENT_NOT_FOUND");
    }
    return describeMatchClockChanges(collectMatchRecording(matchId, snap.data() as TeamInfo), timing);
  } catch (error) {
    rethrowMatchClockError(error);
  }
}

/**
 * Zapisuje starty połów i przeliczone minuty/połówki zdarzeń jednego meczu.
 * Czyta świeży dokument w transakcji, dokleja lokalną kolejkę offline i nadpisuje tylko zmienione tablice.
 */
export async function persistRecalculatedMatchClock(
  matchId: string,
  timing: MatchHalfStarts
): Promise<PersistRecalculatedMatchClockResult> {
  const firstHalfStartTime = normalizeHalfStartTimeSeconds(timing.firstHalfStartTime);
  const secondHalfStartTime = normalizeHalfStartTimeSeconds(timing.secondHalfStartTime);
  const db = getDB();
  const matchRef = doc(db, "matches", matchId);

  try {
    const written = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) {
        throw new Error("MATCH_DOCUMENT_NOT_FOUND");
      }
      const server = snap.data() as TeamInfo;
      const recording = collectMatchRecording(matchId, server);
      const recalculated = recalculateMatchRecording(recording, { firstHalfStartTime, secondHalfStartTime });

      const updates: Record<string, unknown> = {
        lastUpdated: new Date().toISOString(),
        firstHalfStartTime: firstHalfStartTime === undefined ? deleteField() : firstHalfStartTime,
        secondHalfStartTime: secondHalfStartTime === undefined ? deleteField() : secondHalfStartTime,
      };

      const writeArray = (field: ArrayField, next: unknown[] | undefined, previousLength: number) => {
        if (!next) return;
        if (previousLength === 0 && next.length === 0) return;
        updates[field] = removeUndefinedDeep(ensureEachEntryHasId(next as Array<{ id?: string }>));
      };

      writeArray("actions_packing", recalculated.actions_packing, recording.actions_packing?.length ?? 0);
      writeArray("actions_unpacking", recalculated.actions_unpacking, recording.actions_unpacking?.length ?? 0);
      writeArray("actions_regain", recalculated.actions_regain, recording.actions_regain?.length ?? 0);
      writeArray("actions_loses", recalculated.actions_loses, recording.actions_loses?.length ?? 0);
      writeArray("shots", recalculated.shots, recording.shots?.length ?? 0);
      writeArray("pkEntries", recalculated.pkEntries, recording.pkEntries?.length ?? 0);
      writeArray("acc8sEntries", recalculated.acc8sEntries, recording.acc8sEntries?.length ?? 0);

      if (recalculated.possession && recalculated.possessionSegments) {
        updates["matchData.possessionSegments"] = removeUndefinedDeep(recalculated.possessionSegments);
        updates["matchData.possession"] = recalculated.possession;
      }

      transaction.update(matchRef, updates as UpdateData<TeamInfo>);

      const nextDoc: TeamInfo = {
        ...server,
        lastUpdated: updates.lastUpdated as string,
        matchData: {
          ...(server.matchData ?? {}),
          ...(recalculated.possession ? { possession: recalculated.possession } : {}),
          ...(recalculated.possession
            ? { possessionSegments: recalculated.possessionSegments }
            : {}),
        },
        actions_packing: recalculated.actions_packing,
        actions_unpacking: recalculated.actions_unpacking,
        actions_regain: recalculated.actions_regain,
        actions_loses: recalculated.actions_loses,
        shots: recalculated.shots,
        pkEntries: recalculated.pkEntries,
        acc8sEntries: recalculated.acc8sEntries,
      };
      if (firstHalfStartTime === undefined) delete nextDoc.firstHalfStartTime;
      else nextDoc.firstHalfStartTime = firstHalfStartTime;
      if (secondHalfStartTime === undefined) delete nextDoc.secondHalfStartTime;
      else nextDoc.secondHalfStartTime = secondHalfStartTime;

      return { nextDoc, recalculated };
    });

    setMatchDocumentInCache(matchId, written.nextDoc);
    for (const field of ARRAY_FIELDS) {
      clearPendingMatchUpdate(matchId, field);
    }

    return {
      ...written.recalculated,
      matchId,
      firstHalfStartTime,
      secondHalfStartTime,
    };
  } catch (error) {
    rethrowMatchClockError(error);
  }
}
