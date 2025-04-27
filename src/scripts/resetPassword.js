const { initializeApp } = require('firebase/app');
const { getFirestore, doc, deleteDoc, getDoc } = require('firebase/firestore');
require('dotenv').config();

// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetPassword() {
  console.log('🔄 Rozpoczynam resetowanie hasła...');
  
  try {
    // Sprawdź, czy dokument hasła istnieje
    const passwordRef = doc(db, 'settings', 'password');
    const passwordDoc = await getDoc(passwordRef);
    
    if (passwordDoc.exists()) {
      console.log('🔑 Znaleziono dokument hasła - usuwam...');
      
      // Usuń dokument hasła
      await deleteDoc(passwordRef);
      console.log('✅ Hasło zostało pomyślnie zresetowane!');
    } else {
      console.log('ℹ️ Dokument hasła nie istnieje - nie ma potrzeby resetowania.');
    }
    
    console.log('\n📋 Instrukcje:');
    console.log('1. Wyczyść dane lokalne przeglądarki (localStorage)');
    console.log('2. Odśwież stronę aplikacji');
    console.log('3. Ustaw nowe hasło przy pierwszym logowaniu');
    
  } catch (error) {
    console.error('❌ Błąd podczas resetowania hasła:', error);
  }
}

// Uruchom reset hasła
resetPassword(); 