import { NextRequest, NextResponse } from "next/server";
import type { Auth } from "firebase-admin/auth";
import { FirebaseAdminConfigError, getFirebaseAdminApp } from "@/lib/firebaseAdminServer";
import { parseAuthorizationBearer } from "@/lib/authorizationBearer";
import { FIREBASE_ADMIN_CONFIG_HINT } from "@/lib/apiRequireAdmin";

export type SignedInApiOk = { ok: true; auth: Auth; callerUid: string };
export type SignedInApiFail = { ok: false; response: NextResponse };

/** Weryfikuje Authorization: Bearer (idToken) — dowolny zalogowany użytkownik. */
export async function requireSignedInApi(
  request: NextRequest,
): Promise<SignedInApiOk | SignedInApiFail> {
  try {
    const idToken = parseAuthorizationBearer(request.headers.get("Authorization"));
    if (!idToken) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Brak tokenu autoryzacji (Authorization: Bearer)." },
          { status: 401 },
        ),
      };
    }

    const { auth } = await getFirebaseAdminApp();
    try {
      const decoded = await auth.verifyIdToken(idToken);
      return { ok: true, auth, callerUid: decoded.uid };
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "Nieprawidłowy lub wygasły token." }, { status: 401 }),
      };
    }
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
