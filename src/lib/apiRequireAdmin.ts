import { NextRequest, NextResponse } from "next/server";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { FirebaseAdminConfigError, getFirebaseAdminApp } from "@/lib/firebaseAdminServer";
import { parseAuthorizationBearer } from "@/lib/authorizationBearer";

/** Komunikat do .env / Vercel — wspólny dla API wymagających Admin SDK. */
export const FIREBASE_ADMIN_CONFIG_HINT =
  "Lokalnie: w .env.local ustaw FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-service-account.json (plik z Firebase Console → Project settings → Service accounts → Generate new private key) albo wklej cały JSON w FIREBASE_SERVICE_ACCOUNT_KEY (jedna linia). Na Vercel: dodaj tę samą zmienną w Settings → Environment Variables (albo FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 = base64 całego pliku JSON).";

export { parseAuthorizationBearer } from "@/lib/authorizationBearer";

export type AdminApiOk = { ok: true; auth: Auth; db: Firestore; callerUid: string };
export type AdminApiFail = { ok: false; response: NextResponse };

/**
 * Weryfikuje nagłówek Authorization: Bearer (idToken) oraz rolę admin w Firestore (Admin SDK).
 */
export async function requireAdminApi(request: NextRequest): Promise<AdminApiOk | AdminApiFail> {
  try {
    const idToken = parseAuthorizationBearer(request.headers.get('Authorization'));
    if (!idToken) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Brak tokenu autoryzacji (Authorization: Bearer)." },
          { status: 401 }
        ),
      };
    }

    const { auth, db } = await getFirebaseAdminApp();
    let decoded: { uid: string };
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "Nieprawidłowy lub wygasły token." }, { status: 401 }),
      };
    }

    const callerSnap = await db.collection("users").doc(decoded.uid).get();
    const callerRole = callerSnap.exists ? (callerSnap.data()?.role as string | undefined) : undefined;
    if (callerRole !== "admin") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Tylko administrator może wykonać tę operację." }, { status: 403 }),
      };
    }

    return { ok: true, auth, db, callerUid: decoded.uid };
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
          { status: 503 }
        ),
      };
    }
    throw error;
  }
}
