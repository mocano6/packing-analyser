import { NextRequest, NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { requireAdminApi } from "@/lib/apiRequireAdmin";
import { buildGlobalPlayerCountsRecordAdmin } from "@/lib/server/buildGlobalPlayerCountsAdmin";
import { playerHasAnyGlobalDataContact } from "@/lib/playerHardDeleteEligibility";

const MAX_IDS_PER_REQUEST = 500;

type DeleteFailure = { playerId: string; error: string };

async function playerLinkedToUser(db: Firestore, playerId: string): Promise<boolean> {
  const snap = await db.collection("users").where("linkedPlayerId", "==", playerId).limit(1).get();
  return !snap.empty;
}

/**
 * Trwałe usunięcie dokumentów players — tylko admin.
 * Warunki: isDeleted, brak powiązań z danymi (jak globalDataTotal na liście), brak linkedPlayerId.
 */
export async function POST(request: NextRequest) {
  const adminResult = await requireAdminApi(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }
  const { db } = adminResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  const rawIds =
    body && typeof body === "object" && Array.isArray((body as { playerIds?: unknown }).playerIds)
      ? (body as { playerIds: unknown[] }).playerIds
      : null;

  if (!rawIds) {
    return NextResponse.json({ error: "Brak tablicy playerIds." }, { status: 400 });
  }

  const playerIds = [
    ...new Set(
      rawIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (playerIds.length === 0) {
    return NextResponse.json({ error: "Pusta lista playerIds." }, { status: 400 });
  }
  if (playerIds.length > MAX_IDS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Maksymalnie ${MAX_IDS_PER_REQUEST} ID na jedno żądanie.` },
      { status: 400 },
    );
  }

  let globalCountsRecord: Awaited<ReturnType<typeof buildGlobalPlayerCountsRecordAdmin>>;
  try {
    globalCountsRecord = await buildGlobalPlayerCountsRecordAdmin(db);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd odczytu meczów / GPS.";
    return NextResponse.json(
      { error: `Nie udało się zweryfikować powiązań z danymi: ${message}` },
      { status: 500 },
    );
  }

  const deleted: string[] = [];
  const failed: DeleteFailure[] = [];

  for (const playerId of playerIds) {
    try {
      const ref = db.collection("players").doc(playerId);
      const snap = await ref.get();
      if (!snap.exists) {
        failed.push({ playerId, error: "Nie znaleziono dokumentu." });
        continue;
      }
      const data = snap.data() as Record<string, unknown>;
      if (data.isDeleted !== true) {
        failed.push({
          playerId,
          error: "Karta nie ma statusu usuniętej (isDeleted !== true).",
        });
        continue;
      }
      if (playerHasAnyGlobalDataContact(globalCountsRecord, playerId)) {
        failed.push({
          playerId,
          error: "Istnieją powiązania z danymi (mecze, GPS, akcje itd.).",
        });
        continue;
      }
      if (await playerLinkedToUser(db, playerId)) {
        failed.push({
          playerId,
          error: "Zawodnik powiązany z kontem użytkownika (linkedPlayerId).",
        });
        continue;
      }

      await ref.delete();
      deleted.push(playerId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Błąd usuwania.";
      failed.push({ playerId, error: message });
    }
  }

  return NextResponse.json({
    success: failed.length === 0,
    deletedCount: deleted.length,
    deleted,
    failed,
  });
}
