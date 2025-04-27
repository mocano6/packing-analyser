/**
 * Moduł inicjalizujący Firebase w aplikacji produkcyjnej
 * 
 * Ten plik zawiera logikę potrzebną do inicjalizacji Firebase,
 * wsparcia dla trybu offline i obsługi błędów połączenia.
 */

import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { 
  getFirestore, 
  Firestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { 
  getAuth, 
  connectAuthEmulator,
  Auth
} from 'firebase/auth';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { handleFirebaseError } from './errorHandler';

// Interfejs dla konfiguracji inicjalizacji Firebase
export interface FirebaseInitConfig {
  // Czy włączyć tryb offline
  enableOfflineMode?: boolean;
  // Czy używać emulatorów lokalnych
  useEmulators?: boolean;
  // Hosty dla emulatorów
  emulatorHosts?: {
    auth?: string;
    firestore?: string;
    storage?: string;
  };
  // Czy włączyć debugowanie
  debug?: boolean;
}

// Domyślne ustawienia
const defaultConfig: FirebaseInitConfig = {
  enableOfflineMode: true,
  useEmulators: false,
  emulatorHosts: {
    auth: 'localhost:9099',
    firestore: 'localhost:8080',
    storage: 'localhost:9199'
  },
  debug: false
};

// Klasa zarządzająca inicjalizacją Firebase
export class FirebaseInitializer {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private storage: FirebaseStorage | null = null;
  private isOfflineEnabled: boolean = false;
  private isDebugEnabled: boolean = false;
  
  // Konstruktor przyjmujący konfigurację Firebase
  constructor(
    private firebaseConfig: FirebaseOptions,
    private initConfig: FirebaseInitConfig = {}
  ) {
    this.initConfig = { ...defaultConfig, ...initConfig };
    this.isDebugEnabled = this.initConfig.debug || false;
  }
  
  // Główna metoda inicjalizująca Firebase
  public async initialize(): Promise<{
    app: FirebaseApp;
    db: Firestore;
    auth: Auth;
    storage: FirebaseStorage;
  }> {
    if (this.isDebugEnabled) {
      console.log('🔥 Inicjalizacja Firebase...');
    }
    
    try {
      // Inicjalizacja Firebase
      this.app = initializeApp(this.firebaseConfig);
      
      // Inicjalizacja usług
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      this.storage = getStorage(this.app);
      
      // Konfiguracja emulatorów (jeśli włączone)
      if (this.initConfig.useEmulators) {
        this.setupEmulators();
      }
      
      // Konfiguracja trybu offline (jeśli włączone)
      if (this.initConfig.enableOfflineMode) {
        await this.setupOfflineMode();
      }
      
      if (this.isDebugEnabled) {
        console.log('✅ Firebase zainicjalizowane pomyślnie');
      }
      
      // Zwrócenie zainicjalizowanych usług
      return {
        app: this.app,
        db: this.db,
        auth: this.auth,
        storage: this.storage
      };
    } catch (error) {
      handleFirebaseError(
        error, 
        'inicjalizacja Firebase',
        { showNotification: true }
      );
      
      console.error('❌ Błąd podczas inicjalizacji Firebase:', error);
      
      // Zwróć puste obiekty, aby uniknąć błędów w aplikacji
      throw new Error('Nie udało się zainicjalizować Firebase');
    }
  }
  
  // Konfiguracja emulatorów lokalnych
  private setupEmulators(): void {
    if (this.isDebugEnabled) {
      console.log('🧪 Konfiguracja emulatorów Firebase...');
    }
    
    try {
      // Konfiguracja emulatora Auth
      if (this.auth && this.initConfig.emulatorHosts?.auth) {
        connectAuthEmulator(
          this.auth, 
          `http://${this.initConfig.emulatorHosts.auth}`, 
          { disableWarnings: !this.isDebugEnabled }
        );
      }
      
      // Konfiguracja emulatora Firestore
      if (this.db && this.initConfig.emulatorHosts?.firestore) {
        const [host, portStr] = this.initConfig.emulatorHosts.firestore.split(':');
        const port = parseInt(portStr, 10);
        
        if (!isNaN(port)) {
          connectFirestoreEmulator(this.db, host, port);
        }
      }
      
      // Konfiguracja emulatora Storage
      if (this.storage && this.initConfig.emulatorHosts?.storage) {
        const [host, portStr] = this.initConfig.emulatorHosts.storage.split(':');
        const port = parseInt(portStr, 10);
        
        if (!isNaN(port)) {
          connectStorageEmulator(this.storage, host, port);
        }
      }
      
      if (this.isDebugEnabled) {
        console.log('✅ Emulatory Firebase skonfigurowane');
      }
    } catch (error) {
      console.error('❌ Błąd podczas konfiguracji emulatorów Firebase:', error);
    }
  }
  
  // Konfiguracja trybu offline
  private async setupOfflineMode(): Promise<void> {
    if (typeof window === 'undefined' || !this.db) {
      return;
    }
    
    if (this.isDebugEnabled) {
      console.log('🔄 Konfiguracja trybu offline dla Firestore...');
    }
    
    try {
      // Włącz persistencję dla wielu zakładek
      await enableMultiTabIndexedDbPersistence(this.db);
      this.isOfflineEnabled = true;
      
      if (this.isDebugEnabled) {
        console.log('✅ Tryb offline dla Firestore włączony');
      }
      
      // Nasłuchuj na zmiany stanu połączenia
      this.setupConnectionListeners();
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        console.warn('⚠️ Tryb offline nie mógł zostać włączony - aplikacja jest otwarta w wielu zakładkach.');
        
        // Spróbuj włączyć zwykłą persistencję
        try {
          await enableIndexedDbPersistence(this.db);
          this.isOfflineEnabled = true;
          
          if (this.isDebugEnabled) {
            console.log('✅ Podstawowy tryb offline dla Firestore włączony');
          }
        } catch (innerError) {
          console.error('❌ Nie udało się włączyć trybu offline dla Firestore:', innerError);
        }
      } else if (error.code === 'unimplemented') {
        console.warn('⚠️ Twoja przeglądarka nie obsługuje trybu offline dla Firestore.');
      } else {
        console.error('❌ Błąd podczas włączania trybu offline dla Firestore:', error);
      }
    }
  }
  
  // Obsługa nasłuchiwania na zmiany stanu połączenia
  private setupConnectionListeners(): void {
    if (typeof window === 'undefined' || !this.db) {
      return;
    }
    
    // Obsługa zdarzeń online/offline
    window.addEventListener('online', () => {
      if (this.isDebugEnabled) {
        console.log('🌐 Przywrócono połączenie z siecią');
      }
      
      if (this.db) {
        enableNetwork(this.db).catch(error => {
          console.error('❌ Błąd podczas włączania sieci dla Firestore:', error);
        });
      }
    });
    
    window.addEventListener('offline', () => {
      if (this.isDebugEnabled) {
        console.log('🔌 Utracono połączenie z siecią');
      }
      
      if (this.db) {
        disableNetwork(this.db).catch(error => {
          console.error('❌ Błąd podczas wyłączania sieci dla Firestore:', error);
        });
      }
    });
  }
  
  // Sprawdza, czy tryb offline został włączony
  public isOfflineModeEnabled(): boolean {
    return this.isOfflineEnabled;
  }
}

// Domyślna konfiguracja Firebase
const defaultFirebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Utwórz i wyeksportuj instancję inicjalizatora
export const firebaseInitializer = new FirebaseInitializer(
  defaultFirebaseConfig,
  {
    enableOfflineMode: true,
    debug: process.env.NODE_ENV !== 'production'
  }
);

// Eksportuj funkcję do inicjalizacji Firebase
export const initializeFirebase = async () => {
  return await firebaseInitializer.initialize();
};

export default initializeFirebase; 