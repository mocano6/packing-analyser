# Konfiguracja CORS dla Firebase Storage

## Problem
Firebase Storage blokuje uploady z `http://localhost:3000` z powodu braku konfiguracji CORS.

## Rozwiązanie

### ⚠️ WAŻNE: Musisz skonfigurować CORS w Google Cloud Storage

To **NIE** jest problem z kodem - wymaga konfiguracji po stronie serwera.

### Opcja 1: Użyj gsutil (Zalecane)

1. **Zainstaluj Google Cloud SDK** (jeśli jeszcze nie masz):
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Lub pobierz z: https://cloud.google.com/sdk/docs/install
   ```

2. **Zaloguj się do Google Cloud**:
   ```bash
   gcloud auth login
   ```

3. **Ustaw projekt Firebase**:
   ```bash
   gcloud config set project rakow-academy-657d6
   ```

4. **Zastosuj konfigurację CORS**:
   ```bash
   # Upewnij się, że jesteś w katalogu projektu
   gsutil cors set cors.json gs://rakow-academy-657d6.firebasestorage.app
   ```

5. **Sprawdź konfigurację**:
   ```bash
   gsutil cors get gs://rakow-academy-657d6.firebasestorage.app
   ```

6. **Jeśli bucket name jest inny, sprawdź w Firebase Console**:
   - Przejdź do Firebase Console > Storage
   - Sprawdź dokładną nazwę bucketa (może być bez `.firebasestorage.app`)
   - Użyj tej nazwy w komendzie gsutil

### Opcja 2: Przez Google Cloud Console (Najprostsze)

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Wybierz projekt: `rakow-academy-657d6`
3. Przejdź do **Cloud Storage** > **Buckets**
4. Znajdź bucket Firebase Storage (może być `rakow-academy-657d6.firebasestorage.app` lub inna nazwa)
5. Kliknij na bucket
6. Przejdź do zakładki **Configuration** (Konfiguracja) lub **Permissions** (Uprawnienia)
7. Przewiń w dół do sekcji **CORS configuration**
8. Kliknij **Edit CORS configuration** (Edytuj konfigurację CORS)
9. Wklej zawartość z pliku `cors.json`:
   ```json
   [
     {
       "origin": ["http://localhost:3000", "http://localhost:3001", "https://*.web.app", "https://*.firebaseapp.com"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"]
     }
   ]
   ```
10. Kliknij **Save** (Zapisz)
11. Poczekaj 1-2 minuty na propagację zmian

### Opcja 3: Przez Firebase CLI (jeśli dostępne)

```bash
firebase storage:cors:set cors.json
```

## Weryfikacja

Po zastosowaniu konfiguracji CORS:
1. **Poczekaj 1-2 minuty** na propagację zmian
2. **Odśwież stronę** w przeglądarce (Ctrl+Shift+R lub Cmd+Shift+R)
3. Spróbuj ponownie wgrać wideo
4. Błąd CORS powinien zniknąć

## Sprawdzenie czy CORS działa

Możesz sprawdzić w konsoli przeglądarki (F12) - nie powinno być już błędów:
```
Access to XMLHttpRequest ... has been blocked by CORS policy
```

## Uwagi

- ⏱️ Konfiguracja CORS może zająć **1-5 minut**, zanim zacznie działać
- 🔍 Upewnij się, że bucket name jest poprawny - sprawdź w Firebase Console
- 🌐 W produkcji dodaj również domenę produkcyjną do `origin` w `cors.json`
- 🔄 Po zmianie CORS, **odśwież stronę** w przeglądarce

## Jeśli nadal nie działa

1. Sprawdź czy bucket name jest poprawny:
   ```bash
   gsutil ls
   ```

2. Sprawdź aktualną konfigurację CORS:
   ```bash
   gsutil cors get gs://rakow-academy-657d6.firebasestorage.app
   ```

3. Jeśli bucket ma inną nazwę, użyj tej nazwy w komendach

