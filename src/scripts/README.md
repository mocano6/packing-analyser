# Skrypty pomocnicze

Ten katalog zawiera skrypty pomocnicze używane do różnych zadań administracyjnych lub migracji danych.

## migrateActionsToDocs.js

Skrypt służący do migracji akcji między kolekcjami w Firebase. Może być używany do przenoszenia danych między różnymi strukturami dokumentów.

### Użycie

```bash
node src/scripts/migrateActionsToDocs.js
```

**Uwaga:** Skrypt powinien być uruchamiany z głównego katalogu projektu.

## migrateRegainLosesOppositeValues.js

Skrypt migracyjny, który uzupełnia brakujące wartości `oppositeXT`, `oppositeZone` i `isAttack` w istniejących akcjach regain i loses.

### Użycie

```bash
node src/scripts/migrateRegainLosesOppositeValues.js
```

**Co robi skrypt:**
- Pobiera wszystkie mecze z bazy danych
- Dla każdego meczu sprawdza akcje regain i loses
- Dla akcji, które nie mają wartości `oppositeXT`, `oppositeZone` i `isAttack`, oblicza i dodaje te wartości
- Aktualizuje akcje w bazie danych

**Wymagania konfiguracji Firebase Admin SDK:**

Skrypt używa Firebase Admin SDK, który wymaga jednej z następujących metod autentykacji:

**Opcja 1: Service Account Key (zalecane)**
1. Przejdź do Firebase Console → Project Settings → Service Accounts
2. Kliknij "Generate New Private Key"
3. Zapisz plik JSON (np. `serviceAccountKey.json`)
4. Ustaw zmienną środowiskową:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
   ```

**Opcja 2: Zmienna środowiskowa**
1. Dodaj do `.env.local`:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...",...}'
   ```
   (cały JSON jako string)

**Opcja 3: Application Default Credentials**
- Jeśli używasz `gcloud` CLI, możesz użyć ADC:
  ```bash
  gcloud auth application-default login
  ```

**Uwaga:** 
- Skrypt powinien być uruchamiany z głównego katalogu projektu
- Upewnij się, że masz odpowiednie uprawnienia do Firebase
- Skrypt można uruchomić wielokrotnie - nie zmienia akcji, które już mają wszystkie potrzebne wartości 