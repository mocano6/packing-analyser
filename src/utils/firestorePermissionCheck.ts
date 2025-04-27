import { db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";

/**
 * Sprawdza uprawnienia do zapisu w Firebase Firestore
 * @returns Promise<{canWrite: boolean, error?: string}>
 */
export const checkFirestoreWritePermission = async (): Promise<{canWrite: boolean, error?: string}> => {
  const testDocId = `permission_test_${Date.now()}`;
  const testCollectionName = "permission_tests";
  
  try {
    console.log(`Sprawdzanie uprawnień Firestore z użyciem testowego dokumentu ${testDocId}...`);
    
    // Test 1: Próba dodania dokumentu
    const testDoc = await addDoc(collection(db, testCollectionName), {
      timestamp: new Date(),
      testId: testDocId
    });
    
    console.log(`✅ Dodanie dokumentu powiodło się: ${testDoc.id}`);
    
    // Test 2: Próba usunięcia dokumentu
    await deleteDoc(doc(db, testCollectionName, testDoc.id));
    console.log(`✅ Usunięcie dokumentu powiodło się`);
    
    return { canWrite: true };
  } catch (error) {
    console.error("❌ Test uprawnień nie powiódł się:", error);
    
    let errorMessage = "Nieznany błąd";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Sprawdź kod błędu jeśli to błąd Firebase
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const firebaseError = error as { code: string, message: string };
        
        if (firebaseError.code === 'permission-denied') {
          errorMessage = "Brak uprawnień do zapisu. Sprawdź reguły bezpieczeństwa w Firebase.";
        } else if (firebaseError.code === 'unauthenticated') {
          errorMessage = "Użytkownik niezalogowany. Zaloguj się, aby uzyskać uprawnienia.";
        } else if (firebaseError.code === 'unavailable') {
          errorMessage = "Usługa Firebase jest niedostępna. Sprawdź połączenie z internetem.";
        } else if (firebaseError.code === 'resource-exhausted') {
          errorMessage = "Przekroczono limit zapytań do Firebase. Spróbuj ponownie później.";
        } else if (firebaseError.code === 'deadline-exceeded') {
          errorMessage = "Przekroczono limit czasu operacji. Sprawdź połączenie z internetem.";
        }
      }
    }
    
    return { 
      canWrite: false, 
      error: errorMessage
    };
  }
}; 