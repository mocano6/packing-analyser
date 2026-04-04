#!/usr/bin/env node
/**
 * Sprawdza, czy w katalogu projektu jest plik klucza Firebase Admin SDK.
 * Uruchom: npm run check:firebase-admin
 */
const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "firebase-admin-service-account.json");

function guessProjectId() {
  for (const name of [".env.development", ".env.local", ".env"]) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=["']?([^"'\s]+)/);
    if (m) return m[1];
  }
  return null;
}

if (!fs.existsSync(file)) {
  const pid = guessProjectId();
  const consoleUrl = pid
    ? `https://console.firebase.google.com/project/${pid}/settings/serviceaccounts/adminsdk`
    : "https://console.firebase.google.com/ → Twój projekt → Project settings → Service accounts";
  console.error("Brak pliku:", file);
  console.error("");
  console.error("1. Otwórz:", consoleUrl);
  console.error("2. „Generate new private key” → zapisz jako firebase-admin-service-account.json w katalogu głównym projektu.");
  console.error("3. Uruchom ponownie: npm run dev");
  process.exit(1);
}

try {
  const raw = fs.readFileSync(file, "utf8");
  const j = JSON.parse(raw);
  if (j.type !== "service_account" || !j.private_key || !j.client_email) {
    console.error("Plik nie wygląda na prawidłowy service account JSON Firebase.");
    process.exit(1);
  }
  console.log("OK — Firebase Admin SDK:", file);
  console.log("   client_email:", j.client_email);
} catch (e) {
  console.error("Błąd odczytu JSON:", e.message);
  process.exit(1);
}
