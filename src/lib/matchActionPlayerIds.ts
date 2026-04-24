/**
 * Normalizacja ID zawodników w surowych obiektach akcji z Firestore.
 * Starsze dane / migracje mogły używać playerId, receiverPlayerId itd.
 */

import { DocumentReference } from "firebase/firestore";

/** Jednolity klucz do map liczników — string z Firestore lub liczba (rzadkie legacy). */
export function normalizeFirestorePlayerId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof DocumentReference) {
    const t = value.id.trim();
    return t || undefined;
  }
  if (typeof value === "string") {
    let t = value.trim();
    if (t.startsWith("players/")) {
      t = t.slice("players/".length).trim().split("/")[0] ?? "";
    }
    return t || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function getActionSenderIdFromRaw(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const cands = [
    o.senderId,
    o.playerId,
    o.sender_id,
    o.player_id,
    o.senderPlayerId,
    o.fromPlayerId,
  ];
  for (const c of cands) {
    const id = normalizeFirestorePlayerId(c);
    if (id) return id;
  }
  return undefined;
}

export function getActionReceiverIdFromRaw(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const cands = [o.receiverId, o.receiverPlayerId, o.receiver_id, o.toPlayerId, o.targetPlayerId];
  for (const c of cands) {
    const id = normalizeFirestorePlayerId(c);
    if (id) return id;
  }
  return undefined;
}
