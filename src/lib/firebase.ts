'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
  enableNetwork,
  disableNetwork,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
  
  // Nowa konfiguracja Firestore - bezpośrednio w trybie offline z lokalną pamięcią podręczną
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });

  // Inicjalizacja auth i storage
  auth = getAuth(app);
  storage = getStorage(app);

  // Włączamy sieć Firestore przy inicjalizacji
  localStorage.removeItem('firestore_offline_mode');
  
  if (db) {
    enableNetwork(db)
      .then(() => {
        console.log('🌐 Sieć Firestore włączona przy inicjalizacji');
      })
      .catch(err => {
        console.error('❌ Błąd przy włączaniu sieci Firestore:', err);
      });
  }
}

// Funkcja do wymuszenia trybu offline - użyta w komponentach
export const forceOfflineMode = async () => {
  if (typeof window !== 'undefined' && db) {
    try {
      await disableNetwork(db);
      localStorage.setItem('firestore_offline_mode', 'true');
      console.log('📴 Tryb offline wymuszony pomyślnie');
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
      console.log('🌐 Tryb online przywrócony pomyślnie');
      return true;
    } catch (err) {
      console.error('❌ Błąd przy przywracaniu trybu online:', err);
      return false;
    }
  }
  return false;
};

// Eksport instancji usług
export { db, auth, storage };
export default app; 