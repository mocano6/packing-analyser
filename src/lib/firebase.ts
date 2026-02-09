'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, enableNetwork, disableNetwork, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

/** Inicjalizacja Firebase po stronie klienta (lazy) — przy pierwszym wywołaniu getDB/isFirebaseReady. Unika 5s blokady gdy moduł załadował się na SSR. */
function ensureFirebaseInitialized(): void {
  if (typeof window === 'undefined' || db) return;
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

// Funkcja do wymuszenia trybu offline - użyta w komponentach
export const forceOfflineMode = async () => {
  ensureFirebaseInitialized();
  if (typeof window !== 'undefined' && db) {
    try {
      await disableNetwork(db);
      localStorage.setItem('firestore_offline_mode', 'true');
      return true;
    } catch (err) {
      console.error('❌ Błąd przy wymuszaniu trybu offline:', err);
      return false;
    }
  }
  return false;
};

// Funkcja do przywrócenia trybu online
export const enableOnlineMode = async () => {
  ensureFirebaseInitialized();
  if (typeof window !== 'undefined' && db) {
    try {
      await enableNetwork(db);
      localStorage.removeItem('firestore_offline_mode');
      return true;
    } catch (err) {
      console.error('❌ Błąd przy przywracaniu trybu online:', err);
      return false;
    }
  }
  return false;
};

// Eksport instancji usług - UWAGA: db może być undefined po stronie serwera
export { db, auth, storage };

// Helper funkcje dla łatwiejszego dostępu (wywołują lazy init na kliencie)
export const getDB = (): Firestore => {
  ensureFirebaseInitialized();
  if (!db) {
    throw new Error('Firestore nie jest zainicjalizowane. Upewnij się, że kod działa po stronie klienta.');
  }
  return db;
};

export const isFirebaseReady = (): boolean => {
  ensureFirebaseInitialized();
  return typeof window !== 'undefined' && !!db;
};

export default app; 