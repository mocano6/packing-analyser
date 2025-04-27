/**
 * UWAGA: Ten plik to tylko wskazówka, jak wdrożyć reguły Firestore.
 * W rzeczywistości wdrożenie reguł wymaga użycia Firebase CLI z linii poleceń
 * lub ręcznego ustawienia reguł w konsoli Firebase.
 */

// Reguły do wdrożenia w konsoli Firebase
export const firestoreRules = `
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Reguła dla wersji produkcyjnej - pełny dostęp do wszystkich dokumentów
    match /{document=**} {
      allow read, write: if true;
    }
    
    // Kolekcja meczów - pełny dostęp dla wszystkich
    match /matches/{matchId} {
      allow read, write: if true;
    }
    
    // Kolekcja graczy - pełny dostęp dla wszystkich
    match /players/{playerId} {
      allow read, write: if true;
    }
    
    // Kolekcja akcji - pełny dostęp dla wszystkich
    match /actions/{actionId} {
      allow read, write: if true;
    }
    
    // Kolekcja zespołów - pełny dostęp dla wszystkich
    match /teams/{teamId} {
      allow read, write: if true;
    }
    
    // Kolekcja testów - dostępna dla wszystkich (do testowania połączenia)
    match /permission_tests/{document} {
      allow read, write: if true;
    }
    
    // Kolekcja ustawień - dostępna dla wszystkich
    match /settings/{document} {
      allow read, write: if true;
    }
  }
}
`;

/**
 * Instrukcja wdrożenia reguł Firestore:
 * 
 * 1. Przejdź do konsoli Firebase: https://console.firebase.google.com/
 * 2. Wybierz swój projekt
 * 3. W menu po lewej wybierz "Firestore Database"
 * 4. Kliknij zakładkę "Rules"
 * 5. Skopiuj i wklej powyższe reguły
 * 6. Kliknij "Publish"
 * 
 * Alternatywnie, jeśli masz Firebase CLI:
 * 1. Zapisz reguły do pliku firestore.rules
 * 2. Uruchom komendę: firebase deploy --only firestore:rules
 */ 