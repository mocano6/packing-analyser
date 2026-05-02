/**
 * Moduł obsługi błędów Firebase
 * 
 * Zapewnia spójny sposób obsługi błędów Firebase w całej aplikacji,
 * wraz z odpowiednimi komunikatami dla użytkowników.
 */

import { FirebaseError } from 'firebase/app';

// Typy dla opcji obsługi błędów
export interface ErrorHandlerOptions {
  // Określa, czy pokazać komunikat użytkownikowi
  showNotification?: boolean;
  // Określa, czy wyciszyć logowanie do konsoli
  silent?: boolean;
  // Funkcja do wywołania w przypadku sieci
  onRetry?: () => void;
  // Funkcja do wywołania po obsłużeniu błędu
  onError?: (response: ErrorResponse) => void;
  // Niestandardowy komunikat (nadpisuje domyślny)
  customMessage?: string;
}

// Odpowiedź z obsługi błędu
export interface ErrorResponse {
  // Oryginalny błąd
  error: any;
  // Kod błędu (jeśli Firebase)
  code?: string;
  // Przyjazny komunikat dla użytkownika
  message: string;
  // Czy to błąd uprawnień
  isPermissionError: boolean;
  // Czy to błąd sieci
  isNetworkError: boolean;
  // Czy zostało podjęte działanie naprawcze
  wasHandled: boolean;
}

// Domyślne opcje
const defaultOptions: ErrorHandlerOptions = {
  showNotification: true,
  silent: false,
  onRetry: undefined,
  onError: undefined,
  customMessage: undefined
};

/**
 * Główna funkcja obsługi błędów Firebase
 * 
 * @param error - Obiekt błędu (najczęściej FirebaseError)
 * @param context - Kontekst, w którym wystąpił błąd (np. "logowanie", "pobieranie danych")
 * @param options - Opcje obsługi błędu
 * @returns Obiekt z informacjami o obsłużonym błędzie
 */
export const handleFirebaseError = (
  error: any,
  context: string = "operacja",
  options: ErrorHandlerOptions = {}
): ErrorResponse => {
  // Połącz opcje z domyślnymi
  const opts = { ...defaultOptions, ...options };
  
  // Inicjalizuj odpowiedź
  const response: ErrorResponse = {
    error,
    code: undefined,
    message: opts.customMessage || "Wystąpił nieznany błąd",
    isPermissionError: false,
    isNetworkError: false,
    wasHandled: false
  };
  
  // Sprawdź, czy to błąd Firebase
  if (error instanceof FirebaseError) {
    response.code = error.code;
    
    // Ustal komunikat błędu na podstawie kodu
    switch (error.code) {
      // Błędy uprawnień
      case 'permission-denied':
      case 'storage/unauthorized':
      case 'permission/denied':
        response.isPermissionError = true;
        response.message = opts.customMessage || 
          `Brak uprawnień do wykonania operacji: ${context}`;
        break;
        
      // Błędy sieci
      case 'unavailable':
      case 'network-request-failed':
      case 'storage/retry-limit-exceeded':
        response.isNetworkError = true;
        response.message = opts.customMessage || 
          `Problem z połączeniem internetowym podczas: ${context}`;
        break;
        
      // Nieznaleziono dokumentu
      case 'not-found':
      case 'storage/object-not-found':
        response.message = opts.customMessage || 
          `Nie znaleziono wymaganych danych podczas: ${context}`;
        break;
        
      // Błędy uwierzytelniania
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        response.message =
          opts.customMessage ||
          "Nieprawidłowe dane logowania (sprawdź e-mail i hasło; konto z Google — przycisk „Kontynuuj z Google”).";
        break;
        
      case 'auth/too-many-requests':
        response.message = opts.customMessage || 
          "Zbyt wiele prób logowania. Spróbuj ponownie później";
        break;

      case 'auth/operation-not-allowed':
        response.message =
          opts.customMessage ||
          "Logowanie e-mailem i hasłem jest wyłączone w projekcie Firebase. Włącz: Authentication → Sign-in method → Email/Password.";
        break;

      case "auth/invalid-api-key":
      case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
        response.message =
          opts.customMessage ||
          "Nieprawidłowy klucz API Firebase (NEXT_PUBLIC_FIREBASE_API_KEY). Sprawdź .env.local i dopasowanie do projektu w konsoli.";
        break;

      case 'auth/app-not-authorized':
        response.message =
          opts.customMessage ||
          "Ta domena nie jest autoryzowana dla tego klucza OAuth. Dodaj domenę w Firebase Console → Authentication → Settings → Authorized domains.";
        break;

      case 'auth/configuration-not-found':
        response.message =
          opts.customMessage ||
          "Brak konfiguracji Auth dla tego projektu (sprawdź NEXT_PUBLIC_* i czy Authentication jest włączone w Firebase).";
        break;

      case 'auth/user-disabled':
        response.message = opts.customMessage || "To konto zostało wyłączone. Skontaktuj się z administratorem.";
        break;

      case 'auth/internal-error':
        response.message =
          opts.customMessage ||
          "Błąd wewnętrzny Firebase Auth. Często to zła konfiguracja projektu lub sieć — sprawdź konsolę przeglądarki.";
        break;
        
      // Błędy transakcji
      case 'failed-precondition':
        response.message = opts.customMessage || 
          `Nie można wykonać operacji: ${context} - warunki wstępne nie zostały spełnione`;
        break;
        
      // Błędy ogólne
      default:
        response.message =
          opts.customMessage ||
          (error.code
            ? `Wystąpił błąd (${error.code}) podczas: ${context}. Szczegóły w konsoli przeglądarki.`
            : `Wystąpił błąd podczas: ${context}`);
        break;
    }
    
    response.wasHandled = true;
  } else if (error instanceof Error) {
    // Dla zwykłych błędów JavaScript
    response.message = opts.customMessage || 
      `Błąd: ${error.message} podczas: ${context}`;
    
    // Sprawdź, czy to błąd sieciowy
    if (
      error.message.includes('network') || 
      error.message.includes('internet') ||
      error.message.includes('offline') ||
      error.message.includes('connection')
    ) {
      response.isNetworkError = true;
    }
    
    response.wasHandled = true;
  }
  
  // Pokaż odpowiedni komunikat użytkownikowi
  if (opts.showNotification) {
    showNotification(response.message, response.isNetworkError && !!opts.onRetry, opts.onRetry);
  }
  
  // Logowanie do konsoli (jeśli nie wyciszone)
  if (!opts.silent) {
    if (response.isPermissionError) {
      console.warn(`⚠️ Błąd uprawnień: ${response.message}`, error);
    } else if (response.isNetworkError) {
      console.warn(`🌐 Błąd sieci: ${response.message}`, error);
    } else {
      console.error(`❌ Błąd: ${response.message}`, error);
    }
  }
  
  // Wywołaj callback jeśli zdefiniowany
  if (opts.onError) {
    opts.onError(response);
  }
  
  return response;
};

/**
 * Sprawdza, czy błąd jest związany z uprawnieniami
 * 
 * @param error - Obiekt błędu do sprawdzenia
 * @returns true jeśli to błąd uprawnień
 */
export const isPermissionError = (error: any): boolean => {
  if (error instanceof FirebaseError) {
    const permissionErrorCodes = [
      'permission-denied',
      'storage/unauthorized',
      'permission/denied'
    ];
    return permissionErrorCodes.includes(error.code);
  }
  return false;
};

/**
 * Sprawdza, czy błąd jest związany z siecią
 * 
 * @param error - Obiekt błędu do sprawdzenia
 * @returns true jeśli to błąd sieci
 */
export const isNetworkError = (error: any): boolean => {
  if (error instanceof FirebaseError) {
    const networkErrorCodes = [
      'unavailable',
      'network-request-failed',
      'storage/retry-limit-exceeded'
    ];
    return networkErrorCodes.includes(error.code);
  }
  
  if (error instanceof Error) {
    return (
      error.message.includes('network') || 
      error.message.includes('internet') ||
      error.message.includes('offline') ||
      error.message.includes('connection')
    );
  }
  
  return false;
};

/**
 * Wyświetla powiadomienie dla użytkownika
 * 
 * @param message - Komunikat do wyświetlenia
 * @param showRetry - Czy pokazać przycisk ponowienia
 * @param onRetry - Funkcja do wywołania po kliknięciu przycisku ponowienia
 */
const showNotification = (
  message: string, 
  showRetry: boolean = false, 
  onRetry?: () => void
): void => {
  // Wykorzystaj istniejący system powiadomień, jeśli istnieje
  if (typeof window !== 'undefined') {
    if (window.alert && !showRetry) {
      window.alert(message);
      return;
    }
    
    // Jeśli potrzebujemy przycisku ponowienia, tworzymy niestandardowe powiadomienie
    const notificationContainer = document.createElement('div');
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.backgroundColor = '#f44336';
    notificationContainer.style.color = 'white';
    notificationContainer.style.padding = '15px';
    notificationContainer.style.borderRadius = '4px';
    notificationContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notificationContainer.style.zIndex = '9999';
    notificationContainer.style.display = 'flex';
    notificationContainer.style.flexDirection = 'column';
    notificationContainer.style.maxWidth = '300px';
    
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.marginBottom = showRetry ? '10px' : '0';
    notificationContainer.appendChild(messageElement);
    
    if (showRetry && onRetry) {
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Spróbuj ponownie';
      retryButton.style.padding = '5px 10px';
      retryButton.style.background = 'white';
      retryButton.style.border = 'none';
      retryButton.style.borderRadius = '4px';
      retryButton.style.cursor = 'pointer';
      retryButton.style.alignSelf = 'flex-end';
      retryButton.style.color = '#f44336';
      retryButton.style.fontWeight = 'bold';
      
      retryButton.onclick = () => {
        document.body.removeChild(notificationContainer);
        if (onRetry) onRetry();
      };
      
      notificationContainer.appendChild(retryButton);
    }
    
    document.body.appendChild(notificationContainer);
    
    // Automatycznie ukryj po 5 sekundach
    setTimeout(() => {
      if (document.body.contains(notificationContainer)) {
        document.body.removeChild(notificationContainer);
      }
    }, 5000);
  }
};

export default handleFirebaseError; 