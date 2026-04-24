import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdminApi } from "@/lib/apiRequireAdmin";
import { planPlayerTeamRemoval } from "@/lib/playerTeamRemoval";

/**
 * Wypisuje zawodnika z zespołu (aktualizacja players + opcjonalnie teams/{id}/members) — Admin SDK,
 * pomija problemy z regułami klienta przy skomplikowanych rolach / tokenach.
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nieprawidłowe body." }, { status: 400 });
  }

  const { playerId, teamId } = body as { playerId?: unknown; teamId?: unknown };
  if (typeof playerId !== "string" || !playerId.trim()) {
    return NextResponse.json({ error: "Brak playerId." }, { status: 400 });
  }
  if (typeof teamId !== "string" || !teamId.trim()) {
    return NextResponse.json({ error: "Brak teamId." }, { status: 400 });
  }

  const pid = playerId.trim();
  const tid = teamId.trim();

  try {
    const playerRef = db.collection("players").doc(pid);
    const snap = await playerRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Nie znaleziono zawodnika w bazie." }, { status: 404 });
    }

    const data = snap.data() as Record<string, unknown>;
    const plan = planPlayerTeamRemoval(data, tid);
    if (!plan.ok) {
      return NextResponse.json(
        { error: "Zawodnik nie jest przypisany do tego zespołu (dane mogły się zmienić)." },
        { status: 409 },
      );
    }

    const payload: Record<string, unknown> = { teams: plan.nextTeamsStored };
    if (plan.deleteTeamField) {
      payload.team = FieldValue.delete();
    }
    if (plan.deleteTeamIdField) {
      payload.teamId = FieldValue.delete();
    }

    await playerRef.update(payload);

    try {
      await db.collection("teams").doc(tid).collection("members").doc(pid).delete();
    } catch (e) {
      console.warn("[admin-remove-player-from-team] members delete (opcjonalne):", e);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin-remove-player-from-team]", e);
    const message = e instanceof Error ? e.message : "Błąd zapisu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
