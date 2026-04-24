import { NextRequest, NextResponse } from "next/server";
import {
  requirePlayerCreateSaveAccess,
  requirePlayerUpdateSaveAccess,
} from "@/lib/apiRequirePlayerSave";

const ALLOWED_PLAYER_KEYS = new Set([
  "firstName",
  "lastName",
  "name",
  "number",
  "position",
  "birthYear",
  "imageUrl",
  "teams",
  "isTestPlayer",
]);

function sanitizePlayerPayload(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!ALLOWED_PLAYER_KEYS.has(k) || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nieprawidłowe body." }, { status: 400 });
  }

  const action = (body as { action?: unknown }).action;
  const rawData = (body as { data?: unknown }).data;

  if (typeof rawData !== "object" || rawData === null) {
    return NextResponse.json({ error: "Brak lub nieprawidłowe pole data." }, { status: 400 });
  }

  const data = sanitizePlayerPayload(rawData as Record<string, unknown>);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Brak dozwolonych pól do zapisu." }, { status: 400 });
  }

  if (action === "update") {
    const playerId =
      typeof (body as { playerId?: unknown }).playerId === "string"
        ? (body as { playerId: string }).playerId.trim()
        : "";
    if (!playerId) {
      return NextResponse.json({ error: "Brak playerId." }, { status: 400 });
    }

    const gate = await requirePlayerUpdateSaveAccess(request, playerId, data);
    if (!gate.ok) {
      return gate.response;
    }

    try {
      await gate.db.collection("players").doc(playerId).update(data);
    } catch (e) {
      console.error("[players-save] update", e);
      const message = e instanceof Error ? e.message : "Błąd zapisu.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true, playerId });
  }

  if (action === "create") {
    const gate = await requirePlayerCreateSaveAccess(request, data);
    if (!gate.ok) {
      return gate.response;
    }

    try {
      const ref = await gate.db.collection("players").add(data);
      return NextResponse.json({ success: true, playerId: ref.id });
    } catch (e) {
      console.error("[players-save] create", e);
      const message = e instanceof Error ? e.message : "Błąd zapisu.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Nieobsługiwane action (oczekiwane: update | create)." }, { status: 400 });
}
