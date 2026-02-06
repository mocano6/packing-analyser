/**
 * Moduł obsługi uwierzytelniania Firebase
 * 
 * Zarządza uwierzytelnianiem użytkowników, stanem sesji i powiązanymi funkcjami.
 */

import { 
  getAuth, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

import { handleFirebaseError } from './errorHandler';
import { isFirebaseReady } from '@/lib/firebase';

// Typy uwierzytelniania
export type AuthMode = 'anonymous' | 'email';

// Stan uwierzytelniania
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAnonymous: boolean;
  error: string | null;
}

// Początkowy stan uwierzytelniania
export const initialAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAnonymous: false,
  error: null
};

// Klasa usługi uwierzytelniania
export class AuthService {
  private static instance: AuthService;
  private listeners: Array<(state: AuthState) => void> = [];
  private _authState: AuthState = { ...initialAuthState };
  private preferredAuthMode: AuthMode = 'anonymous';
  private isInitialized = false;

  // Konstruktor prywatny dla implementacji wzorca Singleton
  private constructor() {
    this.initializeWhenReady();
  }

  // Inicjalizuje Auth Service gdy Firebase jest gotowy
  private async initializeWhenReady() {
    // Czekaj aż Firebase będzie gotowy (tylko po stronie klienta)
    if (typeof window === 'undefined') {
      return;
    }

    // Sprawdź czy Firebase jest gotowy, jeśli nie - czekaj
    let attempts = 0;
    while (!isFirebaseReady() && attempts < 50) { // Max 5 sekund oczekiwania
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!isFirebaseReady()) {
      console.error('Firebase nie został zainicjalizowany w czasie');
      this.updateAuthState({
        ...this._authState,
        isLoading: false,
        error: 'Błąd inicjalizacji Firebase'
      });
      return;
    }

    try {
      // Inicjalizacja nasłuchiwania stanu uwierzytelniania
      const auth = getAuth();
      
      onAuthStateChanged(auth, (user) => {
        this.updateAuthState({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          isAnonymous: user ? user.isAnonymous : false,
          error: null
        });
      }, (error) => {
        console.error('Błąd monitorowania stanu uwierzytelniania:', error);
        this.updateAuthState({
          ...this._authState,
          isLoading: false,
          error: error.message
        });
      });
      
      // Ustaw trwałość sesji
      setPersistence(auth, browserLocalPersistence)
        .catch(error => {
          console.error('Błąd ustawiania trwałości sesji:', error);
        });
        
      // Sprawdź, czy mamy zapisany tryb uwierzytelniania
      this.loadPreferredAuthMode();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Błąd inicjalizacji AuthService:', error);
      this.updateAuthState({
        ...this._authState,
        isLoading: false,
        error: 'Błąd inicjalizacji uwierzytelniania'
      });
    }
  }
  
  // Metoda pobierania instancji (wzorzec Singleton)
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  // Aktualizuje stan uwierzytelniania i powiadamia subskrybentów
  private updateAuthState(newState: Partial<AuthState>): void {
    this._authState = { ...this._authState, ...newState };
    
    // Powiadom wszystkich subskrybentów
    this.listeners.forEach(listener => listener(this._authState));
  }
  
  // Pobiera aktualny stan uwierzytelniania
  public get authState(): AuthState {
    return { ...this._authState };
  }
  
  // Dodaje nasłuchiwacza stanu uwierzytelniania
  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    
    // Od razu powiadom o aktualnym stanie
    listener(this._authState);
    
    // Zwróć funkcję do wypisania się z subskrypcji
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  // Zapisuje preferowany tryb uwierzytelniania
  private savePreferredAuthMode(mode: AuthMode): void {
    try {
      localStorage.setItem('auth_mode', mode);
      this.preferredAuthMode = mode;
    } catch (error) {
      console.error('Błąd zapisywania trybu uwierzytelniania:', error);
    }
  }
  
  // Wczytuje preferowany tryb uwierzytelniania
  private loadPreferredAuthMode(): void {
    try {
      const savedMode = localStorage.getItem('auth_mode') as AuthMode | null;
      if (savedMode && (savedMode === 'anonymous' || savedMode === 'email')) {
        this.preferredAuthMode = savedMode;
      }
    } catch (error) {
      console.error('Błąd wczytywania trybu uwierzytelniania:', error);
    }
  }

  // Sprawdza czy service jest zainicjalizowany
  private async waitForInitialization(): Promise<void> {
    let attempts = 0;
    while (!this.isInitialized && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.isInitialized) {
      throw new Error('AuthService nie został zainicjalizowany');
    }
  }
  
  // Loguje użytkownika anonimowo
  public async signInAnonymously(): Promise<void> {
    await this.waitForInitialization();
    
    try {
      this.updateAuthState({ isLoading: true, error: null });
      
      const auth = getAuth();
      await signInAnonymously(auth);
      
      this.savePreferredAuthMode('anonymous');

    } catch (error) {
      const response = handleFirebaseError(error, 'anonimowe logowanie');
      
      this.updateAuthState({
        isLoading: false,
        error: response.message
      });
      
      throw error;
    }
  }
  
  // Loguje użytkownika przez email i hasło
  public async signInWithEmail(email: string, password: string): Promise<void> {
    await this.waitForInitialization();
    
    try {
      this.updateAuthState({ isLoading: true, error: null });
      
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      
      this.savePreferredAuthMode('email');

    } catch (error) {
      const response = handleFirebaseError(error, 'logowanie przez email');
      
      this.updateAuthState({
        isLoading: false,
        error: response.message
      });
      
      throw error;
    }
  }
  
  // Rejestruje nowego użytkownika przez email i hasło
  public async registerWithEmail(email: string, password: string): Promise<User> {
    await this.waitForInitialization();
    
    try {
      this.updateAuthState({ isLoading: true, error: null });
      
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      this.savePreferredAuthMode('email');
      return userCredential.user;
    } catch (error) {
      const response = handleFirebaseError(error, 'rejestracja');
      
      this.updateAuthState({
        isLoading: false,
        error: response.message
      });
      
      throw error;
    }
  }
  
  // Wylogowuje użytkownika
  public async signOut(): Promise<void> {
    await this.waitForInitialization();
    
    try {
      this.updateAuthState({ isLoading: true, error: null });
      
      const auth = getAuth();
      await firebaseSignOut(auth);
      

    } catch (error) {
      const response = handleFirebaseError(error, 'wylogowanie');
      
      this.updateAuthState({
        isLoading: false,
        error: response.message
      });
      
      throw error;
    }
  }
  
  // Automatycznie loguje użytkownika używając preferowanego trybu
  public async autoSignIn(): Promise<void> {
    await this.waitForInitialization();
    
    // Jeśli użytkownik jest już zalogowany, nic nie rób
    if (this._authState.isAuthenticated) {
      return;
    }
    
    try {
      // Dla trybu anonimowego logujemy od razu
      if (this.preferredAuthMode === 'anonymous') {
        await this.signInAnonymously();
      }
      // Dla trybu email potrzebne są dane logowania, więc nie robimy nic automatycznie
    } catch (error) {
      console.error('Błąd automatycznego logowania:', error);
    }
  }
  
  // Sprawdza, czy użytkownik jest zalogowany
  public isAuthenticated(): boolean {
    return this._authState.isAuthenticated;
  }
  
  // Pobiera aktualnego użytkownika
  public getCurrentUser(): User | null {
    return this._authState.user;
  }
  
  // Pobiera identyfikator użytkownika lub null
  public getUserId(): string | null {
    return this._authState.user?.uid || null;
  }
}

// Eksportuj pojedynczą instancję jako domyślny eksport
export default AuthService.getInstance(); 