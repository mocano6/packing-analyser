#!/usr/bin/env node
/**
 * Jednorazowa konfiguracja lokalna: jeśli nie ma .env.local, kopiuje szablon z .env.example.
 * Uruchom: npm run setup:local
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const envLocal = path.join(root, ".env.local");
const envExample = path.join(root, ".env.example");

if (fs.existsSync(envLocal)) {
  console.log("OK — .env.local już istnieje:", envLocal);
  console.log("   (pomijam kopiowanie; edytuj plik ręcznie jeśli potrzeba)");
  process.exit(0);
}

if (!fs.existsSync(envExample)) {
  console.error("Brak pliku .env.example — nie można utworzyć szablonu.");
  process.exit(1);
}

fs.copyFileSync(envExample, envLocal);
console.log("Utworzono .env.local z szablonu .env.example");
console.log("");
console.log("UWAGA: wartości typu your_api_key_here to TYLKO placeholdery — zastąp je prawdziwymi danymi z Firebase.");
console.log("");
console.log("Następne kroki:");
console.log("  1. Uzupełnij zmienne NEXT_PUBLIC_FIREBASE_* (Firebase Console → Project settings → Your apps).");
console.log("  2. Dodaj klucz Admin SDK (patrz komentarze w .env.local) — np. FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-service-account.json");
console.log("  3. npm run check:firebase-admin");
console.log("  4. npm run dev");
