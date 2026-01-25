import { NextRequest, NextResponse } from 'next/server';

// Funkcja inicjalizująca Firebase Admin SDK
async function getAdminAuth() {
  try {
    // Dynamiczny import firebase-admin (tylko po stronie serwera)
    const admin = await import('firebase-admin');
    
    // Sprawdź czy Admin SDK jest już zainicjalizowany
    if (admin.apps.length === 0) {
      // Spróbuj zainicjalizować z service account key
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Użyj Application Default Credentials
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        });
      } else {
        throw new Error('Brak konfiguracji Firebase Admin SDK. Ustaw FIREBASE_SERVICE_ACCOUNT_KEY lub GOOGLE_APPLICATION_CREDENTIALS.');
      }
    }
    
    return admin.auth();
  } catch (error) {
    console.error('Błąd inicjalizacji Firebase Admin SDK:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json(
        { error: 'Brak uid użytkownika' },
        { status: 400 }
      );
    }

    const auth = await getAdminAuth();
    
    // Usuń użytkownika z Firebase Authentication
    await auth.deleteUser(uid);
    
    return NextResponse.json({ 
      success: true,
      message: 'Użytkownik został usunięty z Firebase Authentication'
    });
  } catch (error: any) {
    console.error('Błąd podczas usuwania użytkownika z Auth:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Błąd podczas usuwania użytkownika',
        code: error.code
      },
      { status: 500 }
    );
  }
}
