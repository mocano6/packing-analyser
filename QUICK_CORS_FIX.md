# 🚀 Szybka naprawa CORS - KROK PO KROKU

## ⚠️ Problem
Firebase Storage blokuje uploady z `http://localhost:3000` - **to wymaga konfiguracji po stronie serwera**.

## ✅ Rozwiązanie w 5 minut

### ⚠️ WAŻNE: Firebase Console NIE ma opcji CORS

Firebase Storage używa Google Cloud Storage pod spodem, więc **konfiguracja CORS musi być zrobiona w Google Cloud Console**, nie w Firebase Console.

### Metoda 1: Google Cloud Console (NAJPROSTSZE - bez terminala)

**Opcja A: Bezpośredni link**
1. **Otwórz**: https://console.cloud.google.com/storage/browser?project=rakow-academy-657d6
   - Jeśli nie jesteś zalogowany, zaloguj się do Google

**Opcja B: Przez Firebase Console**
1. Otwórz [Firebase Console](https://console.firebase.google.com/project/rakow-academy-657d6)
2. Przejdź do **Storage**
3. W prawym górnym rogu kliknij **"Open in Google Cloud Console"** (Otwórz w Google Cloud Console)
   - Lub kliknij link do Google Cloud Console

2. **Znajdź bucket Firebase Storage**:
   - W liście bucketów znajdź ten związany z Firebase
   - Może być nazwany: `rakow-academy-657d6.firebasestorage.app` lub podobnie
   - **Kliknij na nazwę bucketa**

3. **Przejdź do konfiguracji CORS**:
   - W górnym menu kliknij **"Configuration"** (Konfiguracja)
   - Przewiń w dół do sekcji **"CORS configuration"**
   - Kliknij **"Edit CORS configuration"** (Edytuj konfigurację CORS)

4. **Wklej konfigurację**:
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

5. **Zapisz**:
   - Kliknij **"Save"** (Zapisz)
   - Poczekaj 1-2 minuty na propagację

6. **Przetestuj**:
   - Odśwież stronę w przeglądarce (Ctrl+Shift+R / Cmd+Shift+R)
   - Spróbuj ponownie wgrać wideo

---

### Metoda 2: Przez Cloud Shell (ZALECANE jeśli Google Cloud Console nie działa)

**To działa nawet jeśli Google Cloud Console ma błędy!**

1. Otwórz [Firebase Console](https://console.firebase.google.com/project/rakow-academy-657d6)
2. Kliknij ikonę **Cloud Shell** (terminal) w prawym górnym rogu
   - Jeśli nie widzisz ikony, spróbuj: https://console.cloud.google.com/home/dashboard?project=rakow-academy-657d6
   - Następnie kliknij ikonę terminala w prawym górnym rogu
3. W Cloud Shell wykonaj (skopiuj i wklej całość):
   ```bash
   # Utwórz plik cors.json
   cat > cors.json << 'EOF'
   [
     {
       "origin": ["http://localhost:3000", "http://localhost:3001", "https://*.web.app", "https://*.firebaseapp.com"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"]
     }
   ]
   EOF
   
   # Zastosuj CORS (sprawdź nazwę bucketa w Firebase Console → Storage)
   gsutil cors set cors.json gs://rakow-academy-657d6.firebasestorage.app
   
   # Sprawdź czy działa
   gsutil cors get gs://rakow-academy-657d6.firebasestorage.app
   ```

**Jeśli bucket ma inną nazwę:**
- Sprawdź dokładną nazwę w Firebase Console → Storage
- Zamień `rakow-academy-657d6.firebasestorage.app` na właściwą nazwę w komendzie

---

### Metoda 3: Przez terminal lokalny (jeśli masz gsutil)

```bash
# 1. Zaloguj się (otworzy się przeglądarka)
gcloud auth login

# 2. Ustaw projekt
gcloud config set project rakow-academy-657d6

# 3. Zastosuj CORS (musisz być w katalogu projektu)
gsutil cors set cors.json gs://rakow-academy-657d6.firebasestorage.app

# 4. Sprawdź czy działa
gsutil cors get gs://rakow-academy-657d6.firebasestorage.app
```

---

## 🔍 Jak sprawdzić czy CORS działa?

Po skonfigurowaniu:
1. Odśwież stronę (Ctrl+Shift+R)
2. Otwórz konsolę przeglądarki (F12)
3. Spróbuj wgrać wideo
4. **Nie powinno być** błędów typu:
   ```
   Access to XMLHttpRequest ... has been blocked by CORS policy
   ```

---

## ❓ Częste problemy

### "Błąd podczas wczytywania strony w Google Cloud Console"
Jeśli widzisz błąd typu "Podczas wczytywania trasy /storage/... wystąpił błąd":
- **Rozwiązanie 1**: Użyj Cloud Shell (najprostsze)
  1. Otwórz [Firebase Console](https://console.firebase.google.com/project/rakow-academy-657d6)
  2. Kliknij ikonę **Cloud Shell** (terminal) w prawym górnym rogu
  3. Wykonaj komendy z **Metody 2** poniżej
  
- **Rozwiązanie 2**: Zainstaluj gsutil lokalnie
  ```bash
  # macOS
  brew install google-cloud-sdk
  
  # Następnie wykonaj komendy z Metody 3
  ```

- **Rozwiązanie 3**: Spróbuj innej przeglądarki lub wyczyść cache
  - Wyczyść cache przeglądarki (Ctrl+Shift+Delete)
  - Spróbuj w trybie incognito
  - Spróbuj w innej przeglądarce

### "Nie widzę opcji CORS w Google Cloud Console"
- Upewnij się, że jesteś w zakładce **Configuration** (nie Permissions)
- Sprawdź czy masz uprawnienia do edycji bucketa
- Jeśli nie widzisz opcji, użyj Cloud Shell lub gsutil

### "Bucket ma inną nazwę"
- Sprawdź dokładną nazwę w Firebase Console → Storage
- Użyj tej nazwy w komendach gsutil (zamień `rakow-academy-657d6.firebasestorage.app`)

### "Nadal nie działa po 5 minutach"
- Sprawdź czy konfiguracja została zapisana (odśwież stronę w Google Cloud Console)
- Upewnij się, że odświeżyłeś stronę aplikacji (Ctrl+Shift+R)
- Sprawdź konsolę przeglądarki czy są inne błędy

---

## 📝 Ważne informacje

### Dlaczego nie w Firebase Console?
- Firebase Console **nie ma** bezpośredniej opcji konfiguracji CORS dla Storage
- Firebase Storage używa Google Cloud Storage pod spodem
- CORS musi być skonfigurowany w **Google Cloud Console** (lub przez gsutil/Cloud Shell)

### Firebase Console vs Google Cloud Console
- **Firebase Console**: https://console.firebase.google.com - zarządzanie projektem Firebase
- **Google Cloud Console**: https://console.cloud.google.com - zarządzanie infrastrukturą (w tym CORS dla Storage)

### Co można zrobić z Firebase Console?
- ✅ Zobaczyć bucket Storage
- ✅ Przejść do Google Cloud Console (link "Open in Google Cloud Console")
- ✅ Otworzyć Cloud Shell (terminal w przeglądarce)
- ❌ **NIE można** skonfigurować CORS bezpośrednio

**To NIE jest błąd w kodzie** - wymaga konfiguracji po stronie Google Cloud. Bez tej konfiguracji upload nie będzie działał z localhost.

