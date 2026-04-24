import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiRequireAdmin";
import { parseAdminSetPasswordBody } from "@/lib/adminSetPasswordPolicy";

/**
 * Ustawia hasło użytkownika w Firebase Auth (Admin SDK).
 * Wymaga Authorization: Bearer <idToken> oraz roli admin w Firestore.
 */
export async function POST(request: NextRequest) {
  const adminResult = await requireAdminApi(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }
  const { auth } = adminResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  const parsed = parseAdminSetPasswordBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { uid, newPassword } = parsed;

  try {
    await auth.updateUser(uid, { password: newPassword });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "auth/user-not-found") {
      return NextResponse.json(
        { error: "Użytkownik o tym uid nie istnieje w Firebase Authentication." },
        { status: 404 }
      );
    }
    if (code === "auth/weak-password") {
      return NextResponse.json(
        { error: "Hasło jest zbyt słabe (wymagania Firebase)." },
        { status: 400 }
      );
    }
    console.error("Błąd API admin-set-user-password (updateUser):", e);
    const message = e instanceof Error ? e.message : "Nie udało się ustawić hasła.";
    return NextResponse.json({ error: message, code: code || undefined }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Hasło zostało ustawione w Firebase Authentication.",
  });
}
