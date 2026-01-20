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
    
    
    // Możemy wyświetlić użytkownikowi powiadomienie o konieczności odświeżenia
    if (typeof window !== 'undefined' && window.confirm(
      "Wykryto poważny problem z połączeniem do bazy danych, który został naprawiony. " +
      "Strona musi zostać odświeżona, aby zmiany zostały zastosowane. Odświeżyć teraz?"
    )) {
      window.location.reload();
    }
    
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
export const showResetButton = (db: Firestore) => {
  if (typeof document === 'undefined') return;
  
  // Sprawdź, czy przycisk już istnieje
  if (document.getElementById('firestore-reset-button')) return;
  
  // Stwórz przycisk resetowania
  const button = document.createElement('button');
  button.id = 'firestore-reset-button';
  button.innerText = 'Resetuj połączenie Firestore';
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.zIndex = '9999';
  button.style.backgroundColor = '#ff5252';
  button.style.color = 'white';
  button.style.padding = '10px 15px';
  button.style.border = 'none';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
  
  // Dodaj obsługę kliknięcia
  button.onclick = async () => {
    button.disabled = true;
    button.innerText = 'Resetowanie...';
    
    await resetFirestoreConnection(db);
    
    button.innerText = 'Reset zakończony, odśwież stronę';
    button.style.backgroundColor = '#4caf50';
    
    // Po kliknięciu odświeżamy stronę
    button.onclick = () => window.location.reload();
  };
  
  // Dodaj przycisk do dokumentu
  document.body.appendChild(button);
};

/**
 * Rejestruje globalnych obserwatorów do automatycznej obsługi błędów Firestore
 * @param db Instancja Firestore
 */
export const registerFirestoreErrorHandlers = (db: Firestore): void => {
  if (typeof window === 'undefined') return;
  
  // Obserwator zdarzeń błędów
  window.addEventListener('error', (event) => {
    if (event.error && 
        typeof event.error.message === 'string' &&
        event.error.message.includes("INTERNAL ASSERTION FAILED") && 
        event.error.stack && 
        event.error.stack.includes("firestore")) {
      
      console.warn("🚨 Przechwycono błąd wewnętrznego stanu Firestore");
      handleFirestoreError(event.error, db).then(handled => {
        if (handled) {
        } else {
          console.error("❌ Nie udało się obsłużyć błędu");
          showResetButton(db);
        }
      });
    }
  });
  
  // Dodajemy przycisk do UI, który można użyć w razie problemów z bazą danych
  const addResetButtonToUI = () => {
    if (typeof document === 'undefined') return;
    
    // Stwórz mały przycisk w rogu ekranu
    const container = document.createElement('div');
    container.id = 'firestore-reset-container';
    container.style.position = 'fixed';
    container.style.bottom = '10px';
    container.style.right = '10px';
    container.style.zIndex = '9999';
    
    const button = document.createElement('button');
    button.id = 'firestore-mini-reset-button';
    button.innerText = '🔄 DB';
    button.title = 'Napotkano problemy z bazą danych? Kliknij, aby zresetować połączenie';
    button.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    button.style.color = 'white';
    button.style.padding = '5px 10px';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '12px';
    button.style.opacity = '0.7';
    
    button.onmouseover = () => {
      button.style.opacity = '1';
    };
    
    button.onmouseout = () => {
      button.style.opacity = '0.7';
    };
    
    button.onclick = async () => {
      if (window.confirm('Czy na pewno chcesz zresetować połączenie z bazą danych? To może pomóc w razie problemów z synchronizacją.')) {
        button.disabled = true;
        button.innerText = '🔄 Resetowanie...';
        
        await resetFirestoreConnection(db);
        
        button.innerText = '✅ Gotowe';
        
        setTimeout(() => {
          if (window.confirm('Reset zakończony pomyślnie. Zalecane jest odświeżenie strony. Odświeżyć teraz?')) {
            window.location.reload();
          } else {
            button.innerText = '🔄 DB';
            button.disabled = false;
          }
        }, 1000);
      }
    };
    
    container.appendChild(button);
    document.body.appendChild(container);
  };
  
  // Dodaj przycisk po załadowaniu strony
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(addResetButtonToUI, 2000);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(addResetButtonToUI, 2000);
    });
  }
  
  // Obserwator stanu sieci
  window.addEventListener('online', () => {
    enableNetwork(db).catch(err => {
      console.error("❌ Błąd podczas włączania sieci dla Firestore:", err);
      handleFirestoreError(err, db);
    });
  });
  
  window.addEventListener('offline', () => {
    disableNetwork(db).catch(err => {
      console.error("❌ Błąd podczas wyłączania sieci dla Firestore:", err);
    });
  });
};

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