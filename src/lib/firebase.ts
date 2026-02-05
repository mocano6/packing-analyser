'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  enableNetwork,
  disableNetwork,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  Firestore
} from 'firebase/firestore';
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

if (typeof window !== 'undefined') {
  // Inicjalizacja Firebase tylko po stronie klienta
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  
  // Uproszę konfigurację Firestore - używam standardowej inicjalizacji
  db = getFirestore(app);

  // Włącz offline persistence (preferuj multi-tab, fallback do single-tab)
  enableMultiTabIndexedDbPersistence(db).catch((error) => {
    if (error?.code === 'failed-precondition') {
      enableIndexedDbPersistence(db).catch((fallbackError) => {
        console.warn('⚠️ Nie udało się włączyć offline persistence:', fallbackError);
      });
    } else if (error?.code === 'unimplemented') {
      console.warn('⚠️ Przeglądarka nie wspiera offline persistence Firestore.');
    } else {
      console.warn('⚠️ Błąd włączania offline persistence Firestore:', error);
    }
  });

  // Inicjalizacja auth i storage
  auth = getAuth(app);
  storage = getStorage(app);
}

// Funkcja do wymuszenia trybu offline - użyta w komponentach
export const forceOfflineMode = async () => {
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

// Helper funkcje dla łatwiejszego dostępu
export const getDB = (): Firestore => {
  if (!db) {
    throw new Error('Firestore nie jest zainicjalizowane. Upewnij się, że kod działa po stronie klienta.');
  }
  return db;
};

export const isFirebaseReady = (): boolean => {
  return typeof window !== 'undefined' && !!db;
};

export default app; 