import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

/**
 * Funkcja do testowania połączenia z Firestore i uprawnień
 * @returns Promise<boolean> - true jeśli test przeszedł pomyślnie
 */
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    console.log("🔍 Uruchamiam test połączenia z Firestore...");
    
    // 1. Tworzymy testowy dokument
    const testDocRef = doc(db, "permission_tests", "test_connection");
    const testData = {
      timestamp: new Date().toISOString(),
      message: "Test połączenia z Firestore"
    };
    
    // 2. Zapisujemy dokument
    console.log("💾 Próba zapisu testowego dokumentu...");
    await setDoc(testDocRef, testData);
    console.log("✅ Zapis testowego dokumentu udany");
    
    // 3. Odczytujemy dokument
    console.log("📖 Próba odczytu testowego dokumentu...");
    const docSnap = await getDoc(testDocRef);
    
    if (docSnap.exists()) {
      console.log("✅ Odczyt testowego dokumentu udany");
      
      // 4. Usuwamy dokument
      console.log("🗑️ Próba usunięcia testowego dokumentu...");
      await deleteDoc(testDocRef);
      console.log("✅ Usunięcie testowego dokumentu udane");
      
      return true;
    } else {
      console.error("❌ Dokument nie istnieje po zapisie");
      return false;
    }
    
  } catch (error) {
    console.error("❌ Test połączenia nie powiódł się:", error);
    
    // Szczegółowe informacje o błędzie
    if (error instanceof Error) {
      if (error.message.includes("permission-denied") || error.message.includes("Missing or insufficient permissions")) {
        console.error("❌ Problem z uprawnieniami Firestore. Upewnij się, że reguły są poprawnie skonfigurowane.");
      } else if (error.message.includes("network")) {
        console.error("❌ Problem z połączeniem sieciowym. Sprawdź, czy masz dostęp do internetu.");
      }
    }
    
    return false;
  }
};

/**
 * Funkcja do sprawdzania dostępu do kolekcji
 * @param collectionPath - ścieżka do kolekcji
 * @returns Promise<boolean> - true jeśli dostęp jest możliwy
 */
export const testCollectionAccess = async (collectionPath: string): Promise<boolean> => {
  try {
    console.log(`🔍 Sprawdzam dostęp do kolekcji: ${collectionPath}...`);
    
    // Tworzymy testowy dokument w podanej kolekcji
    const testDocRef = doc(db, collectionPath, `test_access_${Date.now()}`);
    const testData = {
      timestamp: new Date().toISOString(),
      message: `Test dostępu do kolekcji ${collectionPath}`
    };
    
    // Próba zapisu
    await setDoc(testDocRef, testData);
    console.log(`✅ Zapis testowy do kolekcji ${collectionPath} udany`);
    
    // Próba odczytu
    const docSnap = await getDoc(testDocRef);
    if (docSnap.exists()) {
      console.log(`✅ Odczyt testowy z kolekcji ${collectionPath} udany`);
      
      // Usuwamy dokument testowy
      await deleteDoc(testDocRef);
      console.log(`✅ Usunięcie testowego dokumentu z kolekcji ${collectionPath} udane`);
      
      return true;
    } else {
      console.error(`❌ Dokument w kolekcji ${collectionPath} nie istnieje po zapisie`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Test dostępu do kolekcji ${collectionPath} nie powiódł się:`, error);
    return false;
  }
};

// Funkcja uruchamiająca testy dostępu do wszystkich używanych kolekcji
export const testAllCollections = async (): Promise<Record<string, boolean>> => {
  const results: Record<string, boolean> = {};
  
  // Lista kolekcji do sprawdzenia
  const collections = [
    "matches",
    "players",
    "actions",
    "settings"
  ];
  
  // Testujemy każdą kolekcję
  for (const collection of collections) {
    results[collection] = await testCollectionAccess(collection);
  }
  
  // Wyświetlamy podsumowanie
  console.log("📊 Podsumowanie testów dostępu do kolekcji:");
  for (const [collection, result] of Object.entries(results)) {
    console.log(`${result ? "✅" : "❌"} ${collection}: ${result ? "Dostęp OK" : "Brak dostępu"}`);
  }
  
  return results;
}; 