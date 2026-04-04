import { NextRequest, NextResponse } from 'next/server';
import { FirebaseAdminConfigError, getFirebaseAdminApp } from '@/lib/firebaseAdminServer';

const CONFIG_HINT =
  'Lokalnie: w .env.local ustaw FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-service-account.json (plik z Firebase Console → Project settings → Service accounts → Generate new private key) albo wklej cały JSON w FIREBASE_SERVICE_ACCOUNT_KEY (jedna linia). Na Vercel: dodaj tę samą zmienną w Settings → Environment Variables (albo FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 = base64 całego pliku JSON).';

async function getAdmin() {
  const { auth, db } = await getFirebaseAdminApp();
  return { auth, db };
}

/**
 * Usuwa użytkownika: Firebase Auth + dokument users/{uid} (Admin SDK — omija reguły klienta).
 * Wymaga nagłówka Authorization: Bearer <idToken> oraz roli admin w Firestore.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji (Authorization: Bearer).' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (!idToken) {
      return NextResponse.json({ error: 'Pusty token.' }, { status: 401 });
    }

    const body = await request.json();
    const { uid } = body as { uid?: string };

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Brak uid użytkownika' }, { status: 400 });
    }

    const { auth, db } = await getAdmin();

    let decoded: { uid: string };
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Nieprawidłowy lub wygasły token.' }, { status: 401 });
    }

    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    const callerRole = callerSnap.exists ? (callerSnap.data()?.role as string | undefined) : undefined;
    if (callerRole !== 'admin') {
      return NextResponse.json({ error: 'Tylko administrator może usuwać konta użytkowników.' }, { status: 403 });
    }

    if (decoded.uid === uid) {
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
    if (error instanceof FirebaseAdminConfigError) {
      return NextResponse.json(
        {
          error: 'Brak konfiguracji Firebase Admin SDK na serwerze.',
          hint: CONFIG_HINT,
          code: 'admin-config-missing',
        },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : 'Błąd podczas usuwania użytkownika';
    return NextResponse.json({ error: message, code: (error as { code?: string })?.code }, { status: 500 });
  }
}
