import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/apiRequireAdmin';

/**
 * Usuwa użytkownika: Firebase Auth + dokument users/{uid} (Admin SDK — omija reguły klienta).
 * Wymaga nagłówka Authorization: Bearer <idToken> oraz roli admin w Firestore.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdminApi(request);
    if (!adminResult.ok) {
      return adminResult.response;
    }
    const { auth, db, callerUid } = adminResult;

    const body = await request.json();
    const { uid } = body as { uid?: string };

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Brak uid użytkownika' }, { status: 400 });
    }

    if (callerUid === uid) {
      return NextResponse.json({ error: 'Nie możesz usunąć własnego konta z tego panelu.' }, { status: 400 });
    }

    try {
      await auth.deleteUser(uid);
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      if (code !== 'auth/user-not-found') {
        throw e;
      }
    }

    await db.collection('users').doc(uid).delete();

    return NextResponse.json({
      success: true,
      message: 'Użytkownik został usunięty z Authentication i Firestore',
    });
  } catch (error: unknown) {
    console.error('Błąd API delete-user-auth:', error);
    const message = error instanceof Error ? error.message : 'Błąd podczas usuwania użytkownika';
    return NextResponse.json({ error: message, code: (error as { code?: string })?.code }, { status: 500 });
  }
}
