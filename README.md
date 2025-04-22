# Packing Analyzer

Aplikacja do analizy metryki "packing" dla drużyn piłkarskich. Umożliwia zarządzanie drużynami, zawodnikami, meczami oraz rejestrowanie i analizowanie akcji meczowych w kontekście wskaźnika xT (expected threat).

## Funkcje

- Zarządzanie zawodnikami i drużynami
- Rejestrowanie meczów i czas gry zawodników
- Dodawanie i edycja akcji w czasie rzeczywistym
- Analiza wskaźnika xT i metryki packing
- Zabezpieczenie aplikacji hasłem
- Wsparcie dla pracy offline z synchronizacją Firebase

## Technologie

- React 19
- Next.js 15
- Firebase (Firestore)
- TypeScript
- GitHub Pages (hosting)

## Wdrożenie na GitHub Pages

Aplikacja jest skonfigurowana do automatycznego wdrażania na GitHub Pages poprzez GitHub Actions.

### Automatyczne wdrażanie

1. Pobierz sekrety Firebase i dodaj je do ustawień repozytorium GitHub:
   - NEXT_PUBLIC_FIREBASE_API_KEY
   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   - NEXT_PUBLIC_FIREBASE_PROJECT_ID
   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - NEXT_PUBLIC_FIREBASE_APP_ID

2. Włącz GitHub Pages w ustawieniach repozytorium, wybierając źródło "GitHub Actions".

3. Wypchnij zmiany do gałęzi `main`, aby uruchomić automatyczny proces wdrażania.

### Ręczne wdrażanie

Możesz również ręcznie wdrożyć aplikację:

```bash
# Zbuduj aplikację
npm run build

# Wdróż na GitHub Pages
npm run deploy
```

## Rozwój lokalny

```bash
# Instalacja zależności
npm install

# Uruchomienie serwera deweloperskiego
npm run dev
```

Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

## Pierwsze logowanie

Przy pierwszym uruchomieniu aplikacji zostaniesz poproszony o ustawienie hasła, które będzie używane do zabezpieczenia dostępu do aplikacji.
