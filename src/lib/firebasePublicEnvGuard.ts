/**
 * Walidacja NEXT_PUBLIC_FIREBASE_* przed initializeApp — unika „auth/api-key-not-valid”
 * gdy w .env.local zostaną wartości z szablonu .env.example.
 *
 * UWAGA (Next.js): na kliencie webpack tylko wtedy wstrzykuje NEXT_PUBLIC_*,
 * gdy w kodzie jest **literał** `process.env.NEXT_PUBLIC_FOO`. Dostęp dynamiczny
 * `process.env[key]` w przeglądarce daje undefined — stąd snapshot z jawnych pól.
 */

export const FIREBASE_REQUIRED_PUBLIC_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export type FirebasePublicEnvKey = (typeof FIREBASE_REQUIRED_PUBLIC_KEYS)[number];

export type FirebasePublicEnvSnapshot = Record<FirebasePublicEnvKey, string | undefined>;

/** Odczyt z process.env — wyłącznie jawne nazwy (wymagane przez Next.js po stronie klienta). */
export function getFirebasePublicEnvFromProcess(): FirebasePublicEnvSnapshot {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/** Dokładne wartości z .env.example — jeśli env je zawiera, klient nie zadziała. */
const PLACEHOLDER_BY_KEY: Record<FirebasePublicEnvKey, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "your_api_key_here",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "your_auth_domain_here",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "your_project_id_here",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "your_storage_bucket_here",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "your_messaging_sender_id_here",
  NEXT_PUBLIC_FIREBASE_APP_ID: "your_app_id_here",
};

export function getMissingFirebasePublicEnvKeys(snapshot: FirebasePublicEnvSnapshot): FirebasePublicEnvKey[] {
  return FIREBASE_REQUIRED_PUBLIC_KEYS.filter((k) => !String(snapshot[k] ?? "").trim());
}

export function getFirebasePublicEnvPlaceholderKeys(snapshot: FirebasePublicEnvSnapshot): FirebasePublicEnvKey[] {
  return FIREBASE_REQUIRED_PUBLIC_KEYS.filter((k) => {
    const v = String(snapshot[k] ?? "").trim();
    return PLACEHOLDER_BY_KEY[k] === v;
  });
}

/**
 * Rzuca na kliencie, gdy brak zmiennych lub zostały placeholdery z .env.example.
 */
export function assertFirebasePublicEnvForClient(): void {
  const snapshot = getFirebasePublicEnvFromProcess();
  const missing = getMissingFirebasePublicEnvKeys(snapshot);
  if (missing.length > 0) {
    throw new Error(
      `Brak zmiennych środowiskowych Firebase: ${missing.join(", ")}. Uzupełnij plik .env.local wartościami z Firebase Console → Project settings → Your apps (Web). Następnie zatrzymaj i uruchom ponownie: npm run dev`,
    );
  }
  const placeholders = getFirebasePublicEnvPlaceholderKeys(snapshot);
  if (placeholders.length > 0) {
    throw new Error(
      `W .env.local (lub .env) są nadal placeholdery z szablonu .env.example: ${placeholders.join(", ")}. Zastąp je prawdziwymi wartościami z Firebase Console → Project settings → Your apps → konfiguracja aplikacji Web. Zatrzymaj i uruchom ponownie: npm run dev`,
    );
  }
}
