import type { Action, TeamInfo } from "@/types";
import { mergeByIdPreferPending } from "./mergeMatchArrayById";
import type { MatchDocumentActionFieldKey } from "./inferActionMatchField";

/** Eksport/import JSON i dokumenty Firestore używają teamId / time — nie wszystkie są w interfejsie TeamInfo. */
type MatchImportMeta = TeamInfo & { teamId?: string; time?: string };

const ACTION_FIELDS: MatchDocumentActionFieldKey[] = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
];

function removeUndefinedFields<T extends object>(obj: T): T {
  const result = { ...obj };
  Object.keys(result).forEach((key) => {
    if (result[key as keyof T] === undefined) {
      delete result[key as keyof T];
    }
  });
  return result;
}

function stripPIIFromAction(action: Action): Action {
  const {
    senderName,
    senderNumber,
    receiverName,
    receiverNumber,
    ...rest
  } = action as Action & {
    senderName?: string;
    senderNumber?: number;
    receiverName?: string;
    receiverNumber?: number;
  };
  return rest as Action;
}

export function cleanImportedActionForFirestore(action: Action): Action {
  return removeUndefinedFields(stripPIIFromAction(action)) as Action;
}

export type MatchImportMergeBody = {
  matchId: string;
  matchMeta: MatchImportMeta;
  incomingByField: Partial<Record<MatchDocumentActionFieldKey, Action[]>>;
};

export type FirestoreMatchImportWrite =
  | { op: "set"; data: Record<string, unknown> }
  | { op: "update"; data: Record<string, unknown> }
  | null;

/**
 * Logika jak ImportButton.importMatchDocumentActions — używana po stronie serwera (Admin SDK),
 * żeby uniknąć odczytu matches/{id} zablokowanego przez reguły (np. brak dokumentu).
 */
export function computeFirestoreWriteForMatchImport(
  existing: TeamInfo | null | undefined,
  body: MatchImportMergeBody,
): FirestoreMatchImportWrite {
  const { matchId, matchMeta, incomingByField } = body;
  const meta = matchMeta as MatchImportMeta;
  const teamId = String(meta.teamId ?? meta.team ?? "").trim();

  const patch: Partial<Record<MatchDocumentActionFieldKey, Action[]>> = {};

  for (const field of ACTION_FIELDS) {
    const incoming = incomingByField[field];
    if (!incoming || incoming.length === 0) continue;
    const normalized = incoming.map((a) =>
      cleanImportedActionForFirestore({
        ...a,
        matchId,
        teamId: (a.teamId && String(a.teamId).trim()) || teamId,
        isSecondHalf: a.isSecondHalf === true,
      } as Action),
    );
    const server = existing
      ? ((((existing as TeamInfo)[field] as Action[]) || []) as Action[])
      : [];
    patch[field] = mergeByIdPreferPending(server, normalized);
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }

  if (!existing) {
    const skeleton: Record<string, unknown> = {
      matchId,
      team: meta.team ?? meta.teamId ?? teamId,
      opponent: meta.opponent ?? "",
      isHome: meta.isHome !== undefined ? meta.isHome : true,
      competition: meta.competition ?? "",
      date: meta.date ?? "",
      time: meta.time ?? "",
      actions_packing: [],
      actions_unpacking: [],
      actions_regain: [],
      actions_loses: [],
    };
    if (meta.teamId) {
      skeleton.teamId = meta.teamId;
    }
    if (meta.videoUrl) skeleton.videoUrl = meta.videoUrl;
    if (meta.firstHalfStartTime !== undefined) {
      skeleton.firstHalfStartTime = meta.firstHalfStartTime;
    }
    if (meta.secondHalfStartTime !== undefined) {
      skeleton.secondHalfStartTime = meta.secondHalfStartTime;
    }
    for (const field of ACTION_FIELDS) {
      const merged = patch[field];
      if (merged !== undefined) {
        skeleton[field] = merged.map(cleanImportedActionForFirestore);
      }
    }
    return { op: "set", data: skeleton };
  }

  const updatePayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    updatePayload[k] = (v as Action[]).map(cleanImportedActionForFirestore);
  }
  return { op: "update", data: updatePayload };
}
