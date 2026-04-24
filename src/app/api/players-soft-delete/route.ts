import { NextRequest, NextResponse } from "next/server";
import { requirePlayerSoftDeleteAccess } from "@/lib/apiRequirePlayerSoftDelete";

/** Soft delete zawodnika (isDeleted: true) — Admin SDK, omija permission-denied klienta. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  const playerId =
    body && typeof body === "object" && typeof (body as { playerId?: unknown }).playerId === "string"
      ? (body as { playerId: string }).playerId.trim()
      : "";

  if (!playerId) {
    return NextResponse.json({ error: "Brak playerId." }, { status: 400 });
  }

  const gate = await requirePlayerSoftDeleteAccess(request, playerId);
  if (!gate.ok) {
    return gate.response;
  }

  const { db } = gate;

  try {
    await db.collection("players").doc(playerId).update({ isDeleted: true });
  } catch (e) {
    console.error("[players-soft-delete]", e);
    const message = e instanceof Error ? e.message : "Błąd zapisu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
