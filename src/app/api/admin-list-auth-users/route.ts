import { NextRequest, NextResponse } from "next/server";
import type { UserRecord } from "firebase-admin/auth";
import { requireAdminApi } from "@/lib/apiRequireAdmin";
import type { AdminAuthUserSummary } from "@/lib/adminAuthUserList";

function toSummary(user: UserRecord): AdminAuthUserSummary {
  return {
    uid: user.uid,
    email: user.email ?? null,
    providerIds: user.providerData.map((provider) => provider.providerId),
    creationTime: user.metadata.creationTime ?? null,
    lastSignInTime: user.metadata.lastSignInTime ?? null,
    disabled: user.disabled,
  };
}

/**
 * Zwraca wszystkich użytkowników Firebase Authentication (Admin SDK).
 * Wymaga Authorization: Bearer <idToken> oraz roli admin.
 */
export async function GET(request: NextRequest) {
  const adminResult = await requireAdminApi(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const { auth } = adminResult;

  try {
    const users: AdminAuthUserSummary[] = [];
    let pageToken: string | undefined;

    do {
      const listResult = await auth.listUsers(1000, pageToken);
      for (const user of listResult.users) {
        users.push(toSummary(user));
      }
      pageToken = listResult.pageToken;
    } while (pageToken);

    return NextResponse.json({ users, count: users.length });
  } catch (error: unknown) {
    console.error("Błąd API admin-list-auth-users:", error);
    const message = error instanceof Error ? error.message : "Błąd podczas pobierania użytkowników Auth";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
