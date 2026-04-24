import { NextRequest, NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { FirebaseAdminConfigError, getFirebaseAdminApp } from "@/lib/firebaseAdminServer";
import { parseAuthorizationBearer } from "@/lib/authorizationBearer";
import { isAdminRoleFromFirestore } from "@/lib/firestoreAdminRole";
import {
  normalizeAllowedTeamsForApi,
  playerDocTeamsOverlapAllowed,
} from "@/lib/playerSoftDeletePolicy";
import { FIREBASE_ADMIN_CONFIG_HINT } from "@/lib/apiRequireAdmin";

export type PlayerSoftDeleteAuth =
  | { ok: true; db: Firestore; uid: string }
  | { ok: false; response: NextResponse };

/**
 * Soft delete: admin (claim lub users.role) albo staff z przecięciem teams zawodnika z allowedTeams.
 */
export async function requirePlayerSoftDeleteAccess(
  request: NextRequest,
  playerId: string,
): Promise<PlayerSoftDeleteAuth> {
  try {
    const idToken = parseAuthorizationBearer(request.headers.get("Authorization"));
    if (!idToken) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Brak tokenu (Authorization: Bearer)." }, { status: 401 }),
      };
    }

    const { auth, db } = await getFirebaseAdminApp();
    let decoded: { uid: string; admin?: boolean };
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "Nieprawidłowy lub wygasły token." }, { status: 401 }),
      };
    }

    const uid = decoded.uid;
    if (decoded.admin === true) {
      return { ok: true, db, uid };
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Brak dokumentu użytkownika." }, { status: 403 }),
      };
    }

    const uData = userSnap.data()!;
    const role = uData.role;

    if (isAdminRoleFromFirestore(role)) {
      return { ok: true, db, uid };
    }

    if (typeof role === "string" && role.trim().toLowerCase() === "player") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Brak uprawnień." }, { status: 403 }),
      };
    }

    const allowedTeams = normalizeAllowedTeamsForApi(uData.allowedTeams);
    const playerSnap = await db.collection("players").doc(playerId).get();
    if (!playerSnap.exists) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 }),
      };
    }

    const pData = playerSnap.data() as Record<string, unknown>;
    if (!playerDocTeamsOverlapAllowed(pData, allowedTeams)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Ten zawodnik nie należy do Twoich zespołów." },
          { status: 403 },
        ),
      };
    }

    return { ok: true, db, uid };
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "Brak konfiguracji Firebase Admin SDK na serwerze.",
            hint: FIREBASE_ADMIN_CONFIG_HINT,
            code: "admin-config-missing",
          },
          { status: 503 },
        ),
      };
    }
    throw error;
  }
}
