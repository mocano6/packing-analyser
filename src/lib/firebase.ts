import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
  enableNetwork,
  disableNetwork,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicjalizacja Firebase - sprawdzamy, czy nie jest już zainicjalizowana
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Nowa konfiguracja Firestore - bezpośrednio w trybie offline z lokalną pamięcią podręczną
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Inicjalizacja auth
export const auth = getAuth(app);

// Włączamy sieć Firestore przy inicjalizacji
if (typeof window !== 'undefined') {
  // Usuń flagę trybu offline z localStorage
  localStorage.removeItem('firestore_offline_mode');
  
  // Włącz sieć
  enableNetwork(db)
    .then(() => {
      console.log('🌐 Sieć Firestore włączona przy inicjalizacji');
    })
    .catch(err => {
      console.error('❌ Błąd przy włączaniu sieci Firestore:', err);
    });
}

// Funkcja do wymuszenia trybu offline - użyta w komponentach
export const forceOfflineMode = async () => {
  if (typeof window !== 'undefined') {
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
  if (typeof window !== 'undefined') {
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
export const storage = getStorage(app);
export { db };
export default app; 