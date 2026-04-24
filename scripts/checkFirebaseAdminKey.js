#!/usr/bin/env node
/**
 * Sprawdza konfigurację Firebase Admin SDK (zgodnie z src/lib/firebaseAdminServer.ts).
 * Wczytuje .env, .env.local, .env.development — tak jak typowy workflow Next.js.
 * Uruchom: npm run check:firebase-admin
 */
const fs = require("fs");
const path = require("path");
const { loadStandardEnvFiles } = require("./loadEnvFilesForScripts.js");

function guessProjectId() {
  loadStandardEnvFiles();
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (pid) return pid;
  for (const name of [".env.development", ".env.local", ".env"]) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=["']?([^"'\s#]+)/);
    if (m) return m[1];
  }
  return null;
}

function validateServiceAccountJson(obj, label) {
  if (!obj || typeof obj !== "object") {
    console.error(`${label}: niepoprawny JSON obiektu.`);
    return false;
  }
  if (obj.type !== "service_account" || !obj.private_key || !obj.client_email) {
    console.error(`${label}: oczekiwano pola type, private_key, client_email (service account Firebase).`);
    return false;
  }
  return true;
}

function tryInlineKey() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!validateServiceAccountJson(j, "FIREBASE_SERVICE_ACCOUNT_KEY")) return "invalid";
    return { label: "FIREBASE_SERVICE_ACCOUNT_KEY (inline JSON)", j };
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY nie jest poprawnym JSON.");
    return "invalid";
  }
}

function tryBase64Key() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?.trim();
  if (!b64) return null;
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const j = JSON.parse(decoded);
    if (!validateServiceAccountJson(j, "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64")) return "invalid";
    return { label: "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64", j };
  } catch (e) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 — błąd dekodowania lub JSON:", e.message);
    return "invalid";
  }
}

function tryPathKey() {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!filePath) return null;
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    console.error("Brak pliku w FIREBASE_SERVICE_ACCOUNT_PATH:", resolved);
    return "invalid";
  }
  try {
    const j = JSON.parse(fs.readFileSync(resolved, "utf8"));
    if (!validateServiceAccountJson(j, `plik ${resolved}`)) return "invalid";
    return { label: `FIREBASE_SERVICE_ACCOUNT_PATH → ${resolved}`, j };
  } catch (e) {
    console.error("Błąd odczytu FIREBASE_SERVICE_ACCOUNT_PATH:", e.message);
    return "invalid";
  }
}

function tryGoogleApplicationCredentials() {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!p) return null;
  if (!fs.existsSync(p)) {
    console.error("GOOGLE_APPLICATION_CREDENTIALS wskazuje na brakujący plik:", p);
    return "invalid";
  }
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!validateServiceAccountJson(j, `GOOGLE_APPLICATION_CREDENTIALS (${p})`)) return "invalid";
    return { label: `GOOGLE_APPLICATION_CREDENTIALS → ${p}`, j };
  } catch (e) {
    console.error("Błąd odczytu GOOGLE_APPLICATION_CREDENTIALS:", e.message);
    return "invalid";
  }
}

function tryDefaultJsonInRepoRoot() {
  const file = path.join(process.cwd(), "firebase-admin-service-account.json");
  if (!fs.existsSync(file)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!validateServiceAccountJson(j, file)) return "invalid";
    return {
      label: `domyślny plik w projekcie: ${path.basename(file)} (ładowany automatycznie jak brak zmiennych env)`,
      j,
    };
  } catch (e) {
    console.error("Błąd odczytu firebase-admin-service-account.json:", e.message);
    return "invalid";
  }
}

// --- main ---
loadStandardEnvFiles();

const attempts = [
  tryInlineKey,
  tryBase64Key,
  tryPathKey,
  tryGoogleApplicationCredentials,
  tryDefaultJsonInRepoRoot,
];

for (const fn of attempts) {
  const r = fn();
  if (r === "invalid") {
    process.exit(1);
  }
  if (r && typeof r === "object" && "j" in r) {
    console.log("OK — Firebase Admin SDK:", r.label);
    console.log("   client_email:", r.j.client_email);
    console.log("");
    console.log("API z Admin SDK (m.in. import/zapis meczu, użytkownicy, zawodnicy) są gotowe przy npm run dev.");
    process.exit(0);
  }
}

const pid = guessProjectId();
const consoleUrl = pid
  ? `https://console.firebase.google.com/project/${pid}/settings/serviceaccounts/adminsdk`
  : "https://console.firebase.google.com/ → Twój projekt → Project settings → Service accounts";

console.error("Brak poprawnej konfiguracji Firebase Admin SDK.");
console.error("");
console.error("1. Otwórz:", consoleUrl);
console.error('2. „Generate new private key” → zapisz jako firebase-admin-service-account.json w katalogu głównym projektu.');
console.error("3. W .env.local dodaj np.:");
console.error("   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-service-account.json");
console.error("4. npm run setup:local   # jeśli nie masz jeszcze .env.local");
console.error("5. npm run check:firebase-admin");
console.error("");
console.error("Alternatywy: FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, GOOGLE_APPLICATION_CREDENTIALS — patrz .env.example");
process.exit(1);
