import { NextRequest, NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { FirebaseAdminConfigError, getFirebaseAdminApp } from "@/lib/firebaseAdminServer";
import { parseAuthorizationBearer } from "@/lib/authorizationBearer";
import { isAdminRoleFromFirestore } from "@/lib/firestoreAdminRole";
import { normalizeAllowedTeamsForApi } from "@/lib/playerSoftDeletePolicy";
import {
  staffAllowedToCreatePlayer,
  staffAllowedToUpdatePlayer,
} from "@/lib/playerSavePolicy";
import { FIREBASE_ADMIN_CONFIG_HINT } from "@/lib/apiRequireAdmin";

export type PlayerSaveAuth =
  | { ok: true; db: Firestore; uid: string }
  | { ok: false; response: NextResponse };

type Decoded = { uid: string; admin?: boolean };

async function verifyAndLoadContext(request: NextRequest): Promise<
  | { ok: true; db: Firestore; uid: string; decoded: Decoded; uData: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  const idToken = parseAuthorizationBearer(request.headers.get("Authorization"));
  if (!idToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Brak tokenu (Authorization: Bearer)." }, { status: 401 }),
    };
  }

  const { auth, db } = await getFirebaseAdminApp();
  let decoded: Decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nieprawidłowy lub wygasły token." }, { status: 401 }),
    };
  }

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Brak dokumentu użytkownika." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    db,
    uid: decoded.uid,
    decoded,
    uData: userSnap.data() as Record<string, unknown>,
  };
}

export async function requirePlayerUpdateSaveAccess(
  request: NextRequest,
  playerId: string,
  updatePayload: Record<string, unknown>,
): Promise<PlayerSaveAuth> {
  try {
    const ctx = await verifyAndLoadContext(request);
    if (!ctx.ok) return ctx;

    const { db, decoded, uData } = ctx;
    const role = uData.role;

    if (decoded.admin === true || isAdminRoleFromFirestore(role)) {
      return { ok: true, db, uid: ctx.uid };
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

    const oldData = playerSnap.data() as Record<string, unknown>;
    if (!staffAllowedToUpdatePlayer(oldData, updatePayload, allowedTeams)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Brak uprawnień do zapisu tego zawodnika lub wybranych zespołów." },
          { status: 403 },
        ),
      };
    }

    return { ok: true, db, uid: ctx.uid };
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

export async function requirePlayerCreateSaveAccess(
  request: NextRequest,
  createPayload: Record<string, unknown>,
): Promise<PlayerSaveAuth> {
  try {
    const ctx = await verifyAndLoadContext(request);
    if (!ctx.ok) return ctx;

    const { db, decoded, uData } = ctx;
    const role = uData.role;

    if (decoded.admin === true || isAdminRoleFromFirestore(role)) {
      return { ok: true, db, uid: ctx.uid };
    }

    if (typeof role === "string" && role.trim().toLowerCase() === "player") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Brak uprawnień." }, { status: 403 }),
      };
    }

    const allowedTeams = normalizeAllowedTeamsForApi(uData.allowedTeams);
    if (!staffAllowedToCreatePlayer(createPayload, allowedTeams)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Możesz tworzyć zawodników tylko w swoich zespołach." },
          { status: 403 },
        ),
      };
    }

    return { ok: true, db, uid: ctx.uid };
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
