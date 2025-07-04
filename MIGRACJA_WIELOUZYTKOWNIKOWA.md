# Migracja na system wieloużytkownikowy

Aplikacja została zmodyfikowana aby obsługiwać wielokontowy system z indywidualnymi logami (email + hasło) i dostępem do różnych zespołów dla każdego użytkownika.

## Co się zmieniło

### 1. System uwierzytelniania
- **PRZED**: Jeden wspólny login z hasłem
- **TERAZ**: Każdy użytkownik ma swój email i hasło (Firebase Auth)

### 2. Dostęp do zespołów
- **PRZED**: Wszyscy mieli dostęp do wszystkich zespołów
- **TERAZ**: Każdy użytkownik ma dostęp tylko do przypisanych mu zespołów

### 3. Struktura bazy danych
Nowa kolekcja `users`:
```
users/{userId} = {
  email: string,
  allowedTeams: string[], // np. ['lks-lodz', 'widzew-lodz']
  role: 'user' | 'admin',
  createdAt: Date,
  lastLogin: Date
}
```

## Instrukcje wdrożenia

### Krok 1: Zaktualizuj reguły Firestore
1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Wybierz swój projekt
3. Idź do **Firestore Database → Rules**
4. Skopiuj i wklej nowe reguły z pliku `firestore.rules`
5. Kliknij **Publish**

### Krok 2: Pierwszy administrator
1. Odwiedź stronę `/login`
2. Kliknij "Nie masz konta? Zarejestruj się"
3. Wprowadź email i hasło administratora
4. Po zalogowaniu przejdź do `/admin`
5. W sekcji "Zarządzanie użytkownikami" nadaj sobie rolę "Admin"
6. Przypisz sobie dostęp do zespołów

### Krok 3: Dodawanie użytkowników
Administrator może:
1. Poczekać aż nowi użytkownicy się zarejestrują
2. Następnie w panelu admin nadać im uprawnienia do zespołów

## Funkcje systemu

### Dla użytkowników
- Logowanie email + hasło
- Dostęp tylko do przypisanych zespołów
- Rejestracja nowych kont

### Dla administratorów
- Wszystkie funkcje użytkownika
- Dostęp do wszystkich zespołów
- Zarządzanie użytkownikami w `/admin`
- Nadawanie uprawnień do zespołów
- Zmiana ról użytkowników
- Usuwanie użytkowników

## Uprawnienia zespołów

Każdy użytkownik może mieć dostęp do wielu zespołów jednocześnie. Administrator przypisuje zespoły w panelu administracyjnym poprzez zaznaczanie checkboxów przy nazwach zespołów.

## Bezpieczeństwo

Nowy system wykorzystuje Firebase Auth i reguły Firestore które zapewniają:
- Dostęp tylko dla zalogowanych użytkowników
- Izolację danych między zespołami
- Kontrolę dostępu na poziomie bazy danych
- Automatyczne zarządzanie sesjami

## Migracja istniejących danych

Istniejące dane (gracze, mecze, akcje) pozostają nietknięte. Pierwszych użytkowników trzeba będzie ręcznie przypisać do odpowiednich zespołów w panelu administracyjnym.

## Rozwiązywanie problemów

### Brak dostępu do aplikacji
Jeśli użytkownik nie ma dostępu do żadnych zespołów, zobaczy komunikat "Brak uprawnień" i będzie mógł się tylko wylogować.

### Pierwszy admin
Pierwszy zarejestrowany użytkownik musi:
1. Samodzielnie nadać sobie rolę admin w panelu `/admin`
2. Przypisać sobie dostęp do zespołów

### Problemy z regułami Firestore
Jeśli aplikacja nie działa po zmianie reguł, sprawdź w konsoli Firebase czy reguły zostały poprawnie wdrożone.

## Wsparcie

W przypadku problemów sprawdź:
1. Konsola przeglądarki (F12) - błędy JavaScript
2. Firebase Console - reguły i dane
3. Panel admin - uprawnienia użytkowników 