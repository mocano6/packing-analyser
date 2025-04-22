# Reguły bezpieczeństwa Firebase dla kolekcji Teams

Aby umożliwić poprawne działanie aplikacji z kolekcją teams, należy skonfigurować odpowiednie reguły bezpieczeństwa w Firebase Firestore.

## Instrukcja konfiguracji

1. Zaloguj się do panelu Firebase: https://console.firebase.google.com/
2. Wybierz swój projekt
3. Przejdź do sekcji "Firestore Database"
4. Kliknij zakładkę "Rules"
5. Wprowadź poniższe reguły i kliknij "Publish"

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Pozwól na odczyt wszystkim, ale ograniczony zapis tylko dla zalogowanych użytkowników
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Specjalna reguła dla kolekcji teams - pozwala na odczyt wszystkim
    match /teams/{teamId} {
      allow read: if true;
      
      // Opcja 1: Zezwól na zapis tylko dla zalogowanych użytkowników
      allow write: if request.auth != null;
      
      // Opcja 2 (bardziej otwarta): Zezwól wszystkim na zapis do kolekcji teams
      // Odkomentuj poniższą linię tylko jeśli nie wymagasz uwierzytelniania
      // allow write: if true;
    }
    
    // Kolekcja testowa do sprawdzania uprawnień
    match /permission_tests/{document} {
      allow read, write: if true;
    }
  }
}
```

## Opcje reguł

1. **Opcja standardowa (zalecana)**: Wymaga zalogowania użytkownika do zapisywania zespołów
   - Większe bezpieczeństwo
   - Potrzebna implementacja logowania

2. **Opcja uproszczona**: Pozwala wszystkim na zapis do kolekcji teams
   - Mniejsze bezpieczeństwo
   - Prostsza implementacja bez logowania

## Uwagi

- Opcja uproszczona powinna być używana tylko w wersji testowej lub wewnętrznej aplikacji
- W środowisku produkcyjnym zalecane jest używanie opcji standardowej z uwierzytelnianiem
- Reguła dla kolekcji `permission_tests` jest potrzebna do testowania uprawnień
- Po udanej inicjalizacji kolekcji teams, można ograniczyć uprawnienia zapisu, jeśli kolekcja nie będzie modyfikowana 