import type { Action } from "@/types";
import { getActionReceiverIdFromRaw, getActionSenderIdFromRaw } from "./matchActionPlayerIds";

/** Normalizacja pól nadawcy/odbiorcy i minuty w tablicy packing już zapisanej w dokumencie meczu (stare nazwy pól). */
export function normalizePackingActionsInMatchDoc(matchId: string, packingActions: Action[]): Action[] {
  return packingActions.map((a) => {
    const anyA = a as unknown as Record<string, unknown>;
    const raw = { ...anyA, senderId: a.senderId, receiverId: a.receiverId };
    return {
      ...a,
      matchId,
      minute: a.minute ?? (anyA.min as number | undefined) ?? 0,
      actionType: a.actionType ?? (anyA.type as string | undefined) ?? "pass",
      packingPoints: a.packingPoints ?? (anyA.packing as number | undefined) ?? 0,
      fromZone: a.fromZone ?? (anyA.startZone as string | undefined),
      toZone: a.toZone ?? (anyA.endZone as string | undefined),
      senderId: getActionSenderIdFromRaw(raw) ?? "",
      receiverId: getActionReceiverIdFromRaw(raw),
    } as Action;
  });
}
