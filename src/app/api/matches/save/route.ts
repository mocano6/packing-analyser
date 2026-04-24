import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { FirebaseAdminConfigError, getFirebaseAdminApp } from "@/lib/firebaseAdminServer";
import { parseAuthorizationBearer, FIREBASE_ADMIN_CONFIG_HINT } from "@/lib/apiRequireAdmin";
import { isAdminRoleFromFirestore } from "@/lib/firestoreAdminRole";
import { canCallerSaveMatch } from "@/lib/matchSavePolicy";
import { prepareMatchDocumentForFirestore } from "@/lib/prepareMatchDocumentForFirestore";
import { stripEmptyHeavyArraysThatWouldWipeServer } from "@/lib/matchDocumentMergeForSave";
import type { TeamInfo } from "@/types";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  const rawMatch = body && typeof body === "object" ? (body as { match?: unknown }).match : undefined;
  if (!rawMatch || typeof rawMatch !== "object") {
    return NextResponse.json({ error: "Brak pola match." }, { status: 400 });
  }

  const matchId =
    typeof (rawMatch as { matchId?: unknown }).matchId === "string"
      ? (rawMatch as { matchId: string }).matchId.trim()
      : "";
  if (!matchId) {
    return NextResponse.json({ error: "Brak matchId." }, { status: 400 });
  }

  let auth: Awaited<ReturnType<typeof getFirebaseAdminApp>>["auth"];
  let db: Awaited<ReturnType<typeof getFirebaseAdminApp>>["db"];
  try {
    const app = await getFirebaseAdminApp();
    auth = app.auth;
    db = app.db;
  } catch (e) {
    if (e instanceof FirebaseAdminConfigError) {
      return NextResponse.json(
        { error: "Brak konfiguracji Firebase Admin SDK.", hint: FIREBASE_ADMIN_CONFIG_HINT, code: "admin-config-missing" },
        { status: 503 }
      );
    }
    throw e;
  }

  const idToken = parseAuthorizationBearer(request.headers.get("Authorization"));
  if (!idToken) {
    return NextResponse.json({ error: "Brak tokenu autoryzacji (Authorization: Bearer)." }, { status: 401 });
  }

  let decoded: { uid: string; admin?: boolean };
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy lub wygasły token." }, { status: 401 });
  }

  const payload = prepareMatchDocumentForFirestore(rawMatch as TeamInfo);
  const team = String(payload.team ?? payload.teamId ?? "").trim();
  if (!team) {
    return NextResponse.json({ error: "Brak team w dokumencie meczu." }, { status: 400 });
  }

  let serverData: Record<string, unknown> | undefined;
  try {
    const serverSnap = await db.collection("matches").doc(matchId).get();
    serverData = serverSnap.exists ? (serverSnap.data() as Record<string, unknown>) : undefined;
  } catch {
    serverData = undefined;
  }
  const safePayload = stripEmptyHeavyArraysThatWouldWipeServer(payload, serverData);

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null;

  const tokenAdmin = decoded.admin === true;
  const firestoreAdmin = isAdminRoleFromFirestore(userData?.role);

  if (!tokenAdmin && !firestoreAdmin && !canCallerSaveMatch(userData, team)) {
    return NextResponse.json(
      { error: "Brak uprawnień do zapisu meczu dla tego zespołu." },
      { status: 403 }
    );
  }

  try {
    await db.collection("matches").doc(matchId).set(safePayload as DocumentData, { merge: true });
  } catch (e) {
    console.error("[matches/save]", e);
    const message = e instanceof Error ? e.message : "Błąd zapisu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, matchId });
}
