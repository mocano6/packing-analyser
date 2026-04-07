/**
 * Usuwa dokument settings/password (wymaga Firebase Admin SDK — omija reguły Firestore).
 * Uruchomienie: FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-service-account.json node src/scripts/resetPassword.js
 * (lub FIREBASE_SERVICE_ACCOUNT_KEY / _BASE64 jak w .env.example)
 */
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

function initAdmin() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?.trim();
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  if (inline) {
    const sa = JSON.parse(inline);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || sa.project_id,
    });
    return admin.firestore();
  }
  if (b64) {
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const sa = JSON.parse(decoded);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || sa.project_id,
    });
    return admin.firestore();
  }
  if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const sa = require(resolved);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || sa.project_id,
    });
    return admin.firestore();
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    return admin.firestore();
  }
  console.error(
    'Brak konfiguracji Admin SDK. Ustaw FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_KEY lub GOOGLE_APPLICATION_CREDENTIALS (patrz .env.example).'
  );
  process.exit(1);
}

async function resetPassword() {
  console.log('🔄 Rozpoczynam resetowanie hasła (Admin SDK)...');

  try {
    const db = initAdmin();
    const ref = db.collection('settings').doc('password');
    const snap = await ref.get();

    if (snap.exists) {
      console.log('🔑 Znaleziono dokument hasła — usuwam...');
      await ref.delete();
      console.log('✅ Hasło zostało pomyślnie zresetowane!');
    } else {
      console.log('ℹ️ Dokument hasła nie istnieje — nie ma potrzeby resetowania.');
    }

    console.log('\n📋 Instrukcje:');
    console.log('1. Wyczyść dane lokalne przeglądarki (localStorage)');
    console.log('2. Odśwież stronę aplikacji');
    console.log('3. Ustaw nowe hasło przy pierwszym logowaniu');
  } catch (error) {
    console.error('❌ Błąd podczas resetowania hasła:', error);
    process.exit(1);
  }
}

resetPassword();
