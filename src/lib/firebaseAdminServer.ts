import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Rzucane gdy brak żadnej z konfiguracji Admin SDK (łapane w API route). */
export class FirebaseAdminConfigError extends Error {
  constructor() {
    super("FIREBASE_ADMIN_CONFIG_MISSING");
    this.name = "FirebaseAdminConfigError";
  }
}

function parseJsonKey(raw: string, label: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${label} nie jest poprawnym JSON.`);
  }
}

/**
 * Ładuje obiekt service account z env / pliku (tylko Node — API routes).
 * Kolejność: FIREBASE_SERVICE_ACCOUNT_KEY → _BASE64 → FIREBASE_SERVICE_ACCOUNT_PATH →
 * plik ./firebase-admin-service-account.json w katalogu projektu (wygodnie lokalnie) → null
 */
export function loadServiceAccountFromEnv(): Record<string, unknown> | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) {
    return parseJsonKey(inline, "FIREBASE_SERVICE_ACCOUNT_KEY");
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      return parseJsonKey(decoded, "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64");
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 — błąd dekodowania Base64.");
    }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    try {
      const fileContent = readFileSync(resolved, "utf8");
      return parseJsonKey(fileContent, `plik ${resolved}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Nie można odczytać FIREBASE_SERVICE_ACCOUNT_PATH (${resolved}): ${msg}`);
    }
  }

  const defaultLocal = path.join(process.cwd(), "firebase-admin-service-account.json");
  if (existsSync(defaultLocal)) {
    try {
      const fileContent = readFileSync(defaultLocal, "utf8");
      return parseJsonKey(fileContent, `domyślny plik ${defaultLocal}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Nie można odczytać domyślnego klucza Admin (${defaultLocal}): ${msg}`);
    }
  }

  return null;
}

export async function getFirebaseAdminApp() {
  const admin = await import("firebase-admin");

  if (admin.apps.length > 0) {
    return { auth: admin.auth(), db: admin.firestore(), admin };
  }

  const serviceAccount = loadServiceAccountFromEnv();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as Parameters<typeof admin.credential.cert>[0]),
      projectId:
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (serviceAccount.project_id as string | undefined),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    throw new FirebaseAdminConfigError();
  }

  return { auth: admin.auth(), db: admin.firestore(), admin };
}
