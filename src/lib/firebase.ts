import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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

// Używamy prostej konfiguracji - inicjalizujemy Firestore bez zaawansowanych ustawień
const db = getFirestore(app);

// Funkcja do włączania persistencji
const enablePersistence = async () => {
  if (typeof window !== 'undefined') {
    try {
      // Najprostszy sposób włączenia persistencji dla wielu zakładek
      await enableMultiTabIndexedDbPersistence(db);
      console.log('Persistencja dla wielu zakładek włączona pomyślnie');
    } catch (err: any) {
      if (err.code === 'failed-precondition') {
        console.warn('Persistencja offline nie może być włączona - aplikacja jest otwarta w wielu kartach.');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistencja offline nie jest dostępna w tej przeglądarce.');
      } else {
        console.error('Błąd przy włączaniu persistencji offline:', err);
      }
    }
  }
};

// Włączamy persistencję tylko po stronie klienta
if (typeof window !== 'undefined') {
  // Używamy setTimeout, aby dać aplikacji czas na inicjalizację
  setTimeout(() => {
    enablePersistence();
  }, 1000);
}

// Eksport instancji usług
export const auth = getAuth(app);
export const storage = getStorage(app);
export { db };
export default app; 