# Instrukcja wdrożenia Packing Analyzer

## Wymagania wstępne
- Node.js w wersji 18 lub nowszej
- Konto Firebase
- Git
- Dostęp do konsoli administracyjnej
- Znajomość podstaw zarządzania bazą danych Firebase

## Przygotowanie środowiska produkcyjnego

### 1. Konfiguracja Firebase
1. Utwórz nowy projekt w [Firebase Console](https://console.firebase.google.com/)
2. Aktywuj Firestore Database
   - Wybierz lokalizację bazy danych najbliższą użytkownikom końcowym (np. `europe-west3`)
   - Rozpocznij w trybie produkcyjnym
3. Aktywuj Firebase Authentication
   - Włącz metody uwierzytelniania (Email/Password, Google)
4. Uzyskaj klucze API Firebase:
   - Przejdź do ustawień projektu > Ogólne > Aplikacje Web > Dodaj aplikację
   - Skopiuj dane konfiguracyjne (apiKey, authDomain, projectId, itd.)

### 2. Konfiguracja pliku środowiskowego
Utwórz plik `.env.production.local` w głównym katalogu projektu z następującymi zmiennymi:

```
NEXT_PUBLIC_FIREBASE_API_KEY=twój_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=twój_projekt.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=twój_projekt_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=twój_projekt.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=twój_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=twój_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=twój_measurement_id
```

### 3. Kopia zapasowa danych (jeśli migrujesz z istniejącego środowiska)
1. Wykonaj eksport danych z bieżącego środowiska Firestore:
   ```bash
   firebase firestore:export ./firestore-backup
   ```

### 4. Konfiguracja reguł bezpieczeństwa Firestore
1. Wgraj plik `firestore.rules` do projektu Firebase:
   ```bash
   firebase deploy --only firestore:rules
   ```

### 5. Przygotowanie buildu produkcyjnego
1. Zainstaluj zależności:
   ```bash
   npm install
   ```
2. Utwórz build produkcyjny:
   ```bash
   npm run build
   ```

## Wdrożenie aplikacji

### Metoda 1: Firebase Hosting (zalecana)
1. Zainstaluj Firebase CLI (jeśli jeszcze nie zainstalowano):
   ```bash
   npm install -g firebase-tools
   ```
2. Zaloguj się do Firebase:
   ```bash
   firebase login
   ```
3. Zainicjuj projekt Firebase:
   ```bash
   firebase init
   ```
   - Wybierz hosting
   - Wybierz swój projekt Firebase
   - Ustaw katalog publiczny na `out` (dla Next.js z exportem statycznym) lub `build` (dla innych konfiguracji)
   - Skonfiguruj jako SPA: `y`
   - Nie nadpisuj pliku `index.html`: `n`

4. Wdróż aplikację:
   ```bash
   firebase deploy
   ```

### Metoda 2: Wdrożenie przez Vercel (alternatywa)
1. Utwórz konto na [Vercel](https://vercel.com) (jeśli jeszcze nie masz)
2. Zainstaluj narzędzie Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. Zaloguj się do Vercel:
   ```bash
   vercel login
   ```
4. Wdróż aplikację:
   ```bash
   vercel
   ```
   - Po zakończeniu konfiguracji, wykonaj wdrożenie produkcyjne:
   ```bash
   vercel --prod
   ```

## Po wdrożeniu

### 1. Przywrócenie danych (jeśli migrujesz z istniejącego środowiska)
1. Importuj dane do nowego środowiska Firestore:
   ```bash
   firebase firestore:import ./firestore-backup
   ```

### 2. Usuń niebezpieczne konfiguracje testowe
1. Sprawdź czy wszystkie środowiska testowe zostały usunięte
2. Upewnij się, że reguły bezpieczeństwa są właściwie skonfigurowane
3. Sprawdź, czy w kodzie nie ma zapisanych na stałe kluczy API i poświadczeń

### 3. Monitorowanie i konserwacja
1. Skonfiguruj cykliczne kopie zapasowe danych
2. Monitoruj użycie aplikacji i zasobów Firebase
3. Ustaw alerty dla nietypowego użycia lub błędów

## Rozwiązywanie problemów

### Problemy z uwierzytelnianiem
1. Sprawdź, czy metody uwierzytelniania są włączone w konsoli Firebase
2. Upewnij się, że używasz poprawnych kluczy API Firebase
3. Sprawdź logi konsoli przeglądarki pod kątem błędów

### Problemy z dostępem do danych
1. Sprawdź reguły bezpieczeństwa Firestore
2. Zweryfikuj, czy użytkownicy mają odpowiednie uprawnienia
3. Użyj konsoli Firebase do sprawdzenia struktury danych

### Problemy z wydajnością
1. Zoptymalizuj zapytania do bazy danych
2. Rozważ implementację paginacji dla dużych zbiorów danych
3. Zaimplementuj mechanizmy buforowania danych po stronie klienta

### Informacje dodatkowe
1. Dokumentacja Firebase: https://firebase.google.com/docs
2. Dokumentacja Next.js: https://nextjs.org/docs
3. Kontakt do pomocy technicznej: [wpisz kontakt]

# Instrukcja wdrażania aplikacji Packing Analyzer na serwer vh.pl

## Przygotowanie plików do wdrożenia

1. Zbuduj aplikację komendą:
   ```
   npm run build:server
   ```

   Ta komenda wykonuje następujące kroki:
   - Buduje aplikację Next.js
   - Naprawia ścieżki w plikach (zamienia ścieżki absolutne na względne)
   - Tworzy ulepszony plik index.html z obsługą błędów
   - Tworzy plik index.php dla lepszej integracji z serwerem
   - Pakuje wszystko do pliku ZIP gotowego do wgrania na serwer

2. Po zakończeniu procesu budowania, w głównym katalogu projektu powstanie plik `packing-analyzer-server.zip`, który jest gotowy do wgrania na serwer.

## Wdrażanie na serwer vh.pl

1. Zaloguj się do panelu administracyjnego vh.pl
2. Przejdź do menedżera plików
3. Utwórz katalog dla aplikacji (np. `packing`) jeśli jeszcze nie istnieje
4. Wgraj plik `packing-analyzer-server.zip` do utworzonego katalogu
5. Rozpakuj plik ZIP bezpośrednio na serwerze (można użyć opcji "Rozpakuj" w menedżerze plików)
6. Upewnij się, że plik `.htaccess` został poprawnie wgrany i ma odpowiednie uprawnienia (644)

## Rozwiązywanie problemów

Jeśli po wdrożeniu aplikacja nie działa poprawnie:

1. **Problem z białą stroną**:
   - Sprawdź czy wszystkie pliki zostały poprawnie wypakowane
   - Sprawdź w konsoli przeglądarki (F12) czy nie ma błędów ładowania plików
   - Sprawdź czy plik `.htaccess` jest poprawny i ma odpowiednie uprawnienia

2. **Problem z ładowaniem zasobów (skrypty, style)**:
   - Sprawdź czy pliki w katalogu `_next` są dostępne
   - Upewnij się, że serwer ma włączoną obsługę CORS i poprawnie ustawione typy MIME

3. **Problem z routingiem**:
   - Upewnij się, że moduł `mod_rewrite` jest włączony na serwerze
   - Sprawdź czy plik `.htaccess` ma poprawną konfigurację przekierowań

4. **Inne problemy**:
   - Aplikacja posiada mechanizm awaryjnego ładowania, który powinien pojawić się po 5 sekundach w przypadku problemów
   - Kliknięcie "Załaduj aplikację ręcznie" może pomóc w diagnostyce problemów

## Uwagi dodatkowe

- Aplikacja używa względnych ścieżek do zasobów, więc powinna działać niezależnie od katalogu, w którym jest zainstalowana
- W przypadku konfiguracji subdomeny, upewnij się, że DocumentRoot wskazuje na katalog z aplikacją
- Jeśli aplikacja działa niepoprawnie, sprawdź logi serwera w poszukiwaniu błędów

## Kontakt

W przypadku problemów z wdrożeniem, skontaktuj się z administratorem aplikacji. 