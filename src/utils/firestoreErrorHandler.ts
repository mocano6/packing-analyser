import { disableNetwork, enableNetwork, Firestore, clearIndexedDbPersistence } from "firebase/firestore";

/**
 * Czyści lokalny cache Firestore, co może pomóc rozwiązać problemy z błędami wewnętrznymi
 * @param db Instancja Firestore
 * @returns Promise<boolean> Czy operacja się powiodła
 */
export const clearFirestoreCache = async (db: Firestore): Promise<boolean> => {
  try {
    
    // Najpierw wyłącz sieć, aby uniknąć synchronizacji podczas czyszczenia
    await disableNetwork(db);
    
    // Odczekaj chwilę po wyłączeniu sieci
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Usuń bazę danych IndexedDB dla Firestore
    const promises = [
      new Promise<boolean>((resolve) => {
        // Pobierz listę wszystkich baz danych IndexedDB
        indexedDB.databases().then((databases) => {
          const firestoreDbs = databases.filter(db => 
            db.name && (db.name.includes('firestore') || db.name.includes('firebase'))
          );
          
          if (firestoreDbs.length === 0) {
            resolve(false);
            return;
          }
          
          // Usuń wszystkie znalezione bazy danych Firestore
          let completed = 0;
          let success = true;
          
          firestoreDbs.forEach(database => {
            if (!database.name) return;
            
            const req = indexedDB.deleteDatabase(database.name);
            
            req.onsuccess = () => {
              completed++;
              if (completed === firestoreDbs.length) {
                resolve(success);
              }
            };
            
            req.onerror = () => {
              console.error(`❌ Błąd podczas czyszczenia bazy ${database.name}`);
              success = false;
              completed++;
              if (completed === firestoreDbs.length) {
                resolve(success);
              }
            };
          });
        }).catch(err => {
          console.error("❌ Błąd podczas pobierania listy baz danych:", err);
          resolve(false);
        });
      })
    ];
    
    const results = await Promise.all(promises);
    const allSuccess = results.every(result => result === true);
    
    // Odczekaj chwilę przed ponownym włączeniem sieci
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Ponownie włącz sieć
    try {
      await enableNetwork(db);
    } catch (err) {
      console.error("❌ Błąd podczas ponownego włączania sieci:", err);
      // Nie zwracaj błędu, kontynuuj
    }
    
    // Odczekaj chwilę po włączeniu sieci
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return allSuccess;
  } catch (error) {
    console.error("❌ Błąd podczas czyszczenia cache Firestore:", error);
    
    // Próba ponownego włączenia sieci w przypadku błędu
    try {
      await enableNetwork(db);
    } catch (err) {
      // Ignoruj błąd
    }
    
    return false;
  }
};

/**
 * Całkowicie resetuje stan Firestore, co pomaga przy błędach "INTERNAL ASSERTION FAILED"
 * @param db Instancja Firestore
 * @returns Promise<boolean> Czy operacja się powiodła
 */
export const resetFirestoreConnection = async (db: Firestore): Promise<void> => {
  
  try {
    // Najpierw rozłączamy się z siecią
    await disableNetwork(db);
    
    // Odczekaj chwilę
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Próbujemy wyczyścić dane IndexedDB (to może się nie udać, jeśli są otwarte połączenia)
    try {
      await clearIndexedDbPersistence(db);
    } catch (err) {
      console.warn('Nie udało się wyczyścić IndexedDB. To normalne, jeśli są aktywne połączenia:', err);
      // Nie przerywamy dalszego procesu - to jest opcjonalny krok
    }
    
    // Ponownie łączymy się z siecią
    await enableNetwork(db);
    
    return;
  } catch (error) {
    console.error('Błąd podczas resetowania połączenia Firestore:', error);
    throw error;
  }
};

/**
 * Obsługuje błędy Firestore, w tym błąd wewnętrznego stanu
 * @param error Obiekt błędu
 * @param db Instancja Firestore
 * @returns Promise<boolean> Czy błąd został obsłużony
 */
export const handleFirestoreError = async (error: any, db: Firestore): Promise<boolean> => {
  // Sprawdź, czy to błąd wewnętrznego stanu Firestore
  const isInternalAssertionFailure = 
    error && 
    typeof error.message === 'string' && 
    error.message.includes("INTERNAL ASSERTION FAILED");
  
  if (isInternalAssertionFailure) {
    console.warn("⚠️ Wykryto błąd wewnętrznego stanu Firestore - próba naprawy...");
    
    // Użyj bardziej gruntownego resetu połączenia
    await resetFirestoreConnection(db);

    return true;
  }
  
  // Obsługa innych typów błędów Firestore
  if (error && error.code) {
    switch (error.code) {
      case 'unavailable':
        console.warn("⚠️ Serwer Firestore jest niedostępny - przełączanie w tryb offline");
        try {
          await disableNetwork(db);
          return true;
        } catch (err) {
          console.error("❌ Błąd podczas przełączania w tryb offline:", err);
          return false;
        }
        
      case 'permission-denied':
        console.error("❌ Brak uprawnień do wykonania operacji w Firestore");
        return false;
        
      default:
        console.error(`❌ Błąd Firestore (${error.code}):`, error.message);
        return false;
    }
  }
  
  return false;
};

/**
 * Wyświetla przycisk resetowania na ekranie
 * @param db Instancja Firestore
 */
/**
 * Czyści dane IndexedDB dla aplikacji
 * UWAGA: To wyczyści wszystkie lokalne dane i wymaga przeładowania aplikacji
 */
export const clearAllFirestoreCache = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const databases = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
      databases
        .then(dbs => {
          const deletePromises = dbs
            .filter(db => db.name && db.name.includes('firestore'))
            .map(db => {
              return new Promise<void>((res, rej) => {
                const request = indexedDB.deleteDatabase(db.name as string);
                request.onsuccess = () => {
                  res();
                };
                request.onerror = () => {
                  console.error(`Błąd podczas usuwania bazy: ${db.name}`);
                  rej(new Error(`Nie udało się usunąć bazy ${db.name}`));
                };
              });
            });
          
          Promise.all(deletePromises)
            .then(() => {
              resolve();
            })
            .catch(err => {
              console.error('Błąd podczas czyszczenia baz IndexedDB:', err);
              reject(err);
            });
        })
        .catch(err => {
          console.error('Błąd podczas listowania baz IndexedDB:', err);
          reject(err);
        });
    } catch (err) {
      console.error('Błąd podczas czyszczenia cache Firestore:', err);
      reject(err);
    }
  });
}; 