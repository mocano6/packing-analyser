import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { FirebaseAdminConfigError, getFirebaseAdminApp } from "@/lib/firebaseAdminServer";
import { parseAuthorizationBearer, FIREBASE_ADMIN_CONFIG_HINT } from "@/lib/apiRequireAdmin";
import { isAdminRoleFromFirestore } from "@/lib/firestoreAdminRole";
import { canCallerSaveMatch } from "@/lib/matchSavePolicy";
import { prepareMatchDocumentForFirestore } from "@/lib/prepareMatchDocumentForFirestore";
import type { TeamInfo } from "@/types";
import {
  computeFirestoreWriteForMatchImport,
  type MatchImportMergeBody,
} from "@/lib/matchImportMergeApply";

function normalizeTeamKey(doc: TeamInfo): string {
  return String(doc.teamId ?? doc.team ?? "").trim();
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

  const b = body as Partial<MatchImportMergeBody>;
  const matchId = typeof b.matchId === "string" ? b.matchId.trim() : "";
  if (!matchId) {
    return NextResponse.json({ error: "Brak matchId." }, { status: 400 });
  }
  if (!b.matchMeta || typeof b.matchMeta !== "object") {
    return NextResponse.json({ error: "Brak matchMeta." }, { status: 400 });
  }
  if (!b.incomingByField || typeof b.incomingByField !== "object") {
    return NextResponse.json({ error: "Brak incomingByField." }, { status: 400 });
  }

  const mergeBody: MatchImportMergeBody = {
    matchId,
    matchMeta: b.matchMeta as TeamInfo,
    incomingByField: b.incomingByField as MatchImportMergeBody["incomingByField"],
  };

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
        { status: 503 },
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

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null;
  const tokenAdmin = decoded.admin === true;
  const firestoreAdmin = isAdminRoleFromFirestore(userData?.role);

  const ref = db.collection("matches").doc(matchId);
  const snap = await ref.get();
  const existing = snap.exists ? ({ id: snap.id, ...snap.data() } as TeamInfo) : null;

  if (existing) {
    const docTeam = normalizeTeamKey(existing);
    const metaTeam = normalizeTeamKey(mergeBody.matchMeta);
    if (docTeam && metaTeam && docTeam !== metaTeam) {
      return NextResponse.json(
        { error: "Plik dotyczy innego zespołu niż dokument meczu w bazie." },
        { status: 409 },
      );
    }
  }

  const teamForPolicy = existing ? normalizeTeamKey(existing) : normalizeTeamKey(mergeBody.matchMeta);
  if (!teamForPolicy) {
    return NextResponse.json({ error: "Brak team / teamId w meczu." }, { status: 400 });
  }

  if (!tokenAdmin && !firestoreAdmin && !canCallerSaveMatch(userData, teamForPolicy)) {
    return NextResponse.json({ error: "Brak uprawnień do zapisu tego meczu." }, { status: 403 });
  }

  const write = computeFirestoreWriteForMatchImport(existing, mergeBody);
  if (!write) {
    return NextResponse.json({ ok: true, matchId, noop: true });
  }

  try {
    if (write.op === "set") {
      const payload = prepareMatchDocumentForFirestore(write.data as TeamInfo);
      await ref.set(payload as DocumentData);
    } else {
      await ref.update(write.data as DocumentData);
    }
  } catch (e) {
    console.error("[matches/import-merge]", e);
    const message = e instanceof Error ? e.message : "Błąd zapisu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, matchId, op: write.op });
}
