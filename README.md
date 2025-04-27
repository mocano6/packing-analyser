# Packing Analyzer

Aplikacja do analizy piłkarskich akcji boiskowych, z wykorzystaniem metryki "Packing" oraz Expected Threat (xT).

## Funkcjonalności

- Dodawanie meczów, drużyn i zawodników
- Rejestrowanie akcji boiskowych (podania, drybling, strzały)
- Analiza akcji z wykorzystaniem metryki Packing i Expected Threat (xT)
- Praca w trybie offline
- Synchronizacja danych z Firebase Firestore
- Eksport danych do CSV

## Instalacja

1. Sklonuj repozytorium:
```bash
git clone https://github.com/your-username/packing-analyzer.git
cd packing-analyzer
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Utwórz plik `.env` na podstawie pliku `.env.example` i uzupełnij wartości kluczy Firebase:
```bash
cp .env.example .env
```

4. Uruchom aplikację w trybie deweloperskim:
```bash
npm run dev
```

## Konfiguracja Firebase

1. Utwórz projekt w [Firebase Console](https://console.firebase.google.com/)
2. Włącz usługi Authentication i Firestore
3. Dodaj reguły bezpieczeństwa Firestore z pliku `firestore.rules`
4. Skopiuj dane konfiguracyjne do pliku `.env`

## Struktura danych

Aplikacja używa następujących kolekcji w Firestore:

- `matches`: Informacje o meczach
- `players`: Informacje o zawodnikach
- `actions`: Zarejestrowane akcje z wynikami analiz

## Technologie

- Next.js 14
- React 18
- Firebase (Authentication, Firestore)
- TypeScript
- CSS Modules
- UUID
- React Hot Toast
- React Icons

## Tryb offline

Aplikacja obsługuje pracę w trybie offline:

1. Dane są przechowywane lokalnie w pamięci przeglądarki
2. Po przywróceniu połączenia następuje automatyczna synchronizacja z Firebase
3. Można wymusić tryb offline poprzez odpowiednią opcję w interfejsie

## Wdrożenie

Szczegółowe instrukcje wdrożenia znajdują się w pliku [DEPLOYMENT.md](DEPLOYMENT.md).

## Rozwijanie projektu

1. Utwórz fork repozytorium
2. Utwórz branch dla nowej funkcjonalności (`git checkout -b feature/nazwa-funkcji`)
3. Zatwierdź zmiany (`git commit -am 'Dodaj nową funkcję'`)
4. Wypchnij zmiany do swojego forka (`git push origin feature/nazwa-funkcji`)
5. Utwórz Pull Request

## Licencja

Copyright © 2023-2024 Autor Projektu
