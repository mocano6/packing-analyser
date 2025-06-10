import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, where, getDoc } from "firebase/firestore";
import { TEAMS } from "@/constants/teams";
import toast from "react-hot-toast";

/**
 * Inicjalizuje kolekcję zespołów w Firebase, dodając stałe identyfikatory 
 * zespołów, które są używane w całej aplikacji.
 * Funkcja sprawdza, czy kolekcja już istnieje przed dodaniem danych,
 * aby uniknąć duplikacji.
 */
export const initializeTeams = async (): Promise<boolean> => {
  try {
    console.log("Rozpoczynam inicjalizację kolekcji teams w Firebase...");
    
    // Sprawdź, czy tryb offline jest aktywny
    const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('firestore_offline_mode') === 'true';
    if (isOfflineMode) {
      console.log("📴 Aplikacja jest w trybie offline - pomijam inicjalizację zespołów w Firebase");
      return true; // Zwracamy true, aby aplikacja mogła kontynuować działanie
    }
    
    // Spróbujmy najpierw sprawdzić, czy pojedynczy dokument istnieje
    const firstTeamId = Object.values(TEAMS)[0].id;
    const teamDocRef = doc(db, "teams", firstTeamId);
    
    try {
      const teamDoc = await getDoc(teamDocRef);
      
      if (teamDoc.exists()) {
        console.log(`Dokument team o ID ${firstTeamId} już istnieje, pomijanie inicjalizacji.`);
        return false;
      }
    } catch (permissionError) {
      // Obsługa błędu uprawnień
      console.error("Brak uprawnień do odczytu z kolekcji teams:", permissionError);
      if (permissionError instanceof Error) {
        console.error("Szczegóły błędu:", permissionError);
        
        // Wykrywamy błąd uprawnień i przełączamy na tryb offline
        if (permissionError.message.includes("Missing or insufficient permissions")) {
          console.log("🔒 Wykryto brak uprawnień do kolekcji teams, przełączam na tryb offline");
          if (typeof window !== 'undefined') {
            localStorage.setItem('firestore_offline_mode', 'true');
            toast.error("Brak uprawnień do kolekcji teams. Aplikacja działa w trybie offline.");
          }
          return true; // Pozwalamy aplikacji działać dalej
        }
      }
      throw permissionError; // Przekazujemy dalej inne błędy
    }
    
    // Dodaj wszystkie zespoły z stałej TEAMS do Firebase
    const promises = Object.values(TEAMS).map(async team => {
      try {
        await setDoc(doc(db, "teams", team.id), {
          id: team.id,
          name: team.name,
          createdAt: new Date(),
          isSystem: true  // Flaga informująca, że jest to systemowy zespół
        });
        return true;
      } catch (error) {
        // Sprawdzamy, czy to błąd uprawnień
        if (error instanceof Error && error.message.includes("Missing or insufficient permissions")) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('firestore_offline_mode', 'true');
            toast.error("Brak uprawnień do zapisywania zespołów. Aplikacja działa w trybie offline.");
          }
          return false;
        }
        
        console.error(`Błąd dodawania zespołu ${team.name}:`, error);
        throw error; // Przekazujemy błąd dalej, aby przerwać całą operację
      }
    });
    
    // Czekamy na zakończenie wszystkich operacji
    const results = await Promise.all(promises);
    
    // Jeśli wymusiliśmy tryb offline, zwracamy true aby aplikacja mogła działać dalej
    if (typeof window !== 'undefined' && localStorage.getItem('firestore_offline_mode') === 'true') {
      return true;
    }
    
    // Sprawdźmy, czy zespoły zostały dodane
    const verificationResult = await checkTeamsCollection();
    if (verificationResult) {
      return true;
    } else {
      console.error("Inicjalizacja zakończona, ale weryfikacja nie powiodła się. Kolekcja może być pusta.");
      return false;
    }
  } catch (error) {
    console.error("Błąd podczas inicjalizacji kolekcji teams:", error);
    
    if (error instanceof Error) {
      console.error("Szczegóły błędu:", error);
      
      // Jeśli to błąd uprawnień, włączamy tryb offline i pozwalamy aplikacji działać dalej
      if (error.message.includes("Missing or insufficient permissions")) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('firestore_offline_mode', 'true');
          toast.error("Brak dostępu do bazy danych. Aplikacja działa w trybie offline.");
        }
        return true; // Pozwalamy aplikacji działać dalej mimo błędu
      }
    }
    
    return false;
  }
};

/**
 * Wymusza utworzenie kolekcji teams, nawet jeśli już istnieje.
 * Używać tylko w sytuacjach awaryjnych.
 */
export const forceInitializeTeams = async (): Promise<boolean> => {
  try {
    // Sprawdź, czy tryb offline jest aktywny
    const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('firestore_offline_mode') === 'true';
    if (isOfflineMode) {
      return true; // Zwracamy true, aby aplikacja mogła kontynuować działanie
    }
    
    // Dodaj wszystkie zespoły z stałej TEAMS do Firebase
    for (const team of Object.values(TEAMS)) {
      try {
        await setDoc(doc(db, "teams", team.id), {
          id: team.id,
          name: team.name,
          createdAt: new Date(),
          isSystem: true,
          updatedAt: new Date() // Dodajemy pole updatedAt dla rozróżnienia
        }, { merge: true });
      } catch (e) {
        // Sprawdzamy, czy to błąd uprawnień
        if (e instanceof Error && e.message.includes("Missing or insufficient permissions")) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('firestore_offline_mode', 'true');
            toast.error("Brak uprawnień do zapisywania zespołów. Aplikacja działa w trybie offline.");
          }
          return true; // Pozwalamy aplikacji działać dalej
        }
        
        console.error(`Błąd przy wymuszonym dodawaniu zespołu ${team.name}:`, e);
      }
    }
    
    // Sprawdź, czy operacja się powiodła
    const teamsExist = await checkTeamsCollection();
    return teamsExist;
  } catch (error) {
    console.error("Błąd podczas wymuszonej inicjalizacji kolekcji teams:", error);
    
    // Jeśli to błąd uprawnień, włączamy tryb offline i pozwalamy aplikacji działać dalej
    if (error instanceof Error && error.message.includes("Missing or insufficient permissions")) {
      console.log("🔒 Wykryto brak uprawnień, przełączam na tryb offline");
      if (typeof window !== 'undefined') {
        localStorage.setItem('firestore_offline_mode', 'true');
        toast.error("Brak dostępu do bazy danych. Aplikacja działa w trybie offline.");
      }
      return true; // Zwracamy true, aby aplikacja mogła kontynuować działanie
    }
    
    return false;
  }
};

/**
 * Sprawdza, czy kolekcja teams istnieje w Firebase.
 */
export const checkTeamsCollection = async (): Promise<boolean> => {
  try {
    // Sprawdź, czy tryb offline jest aktywny
    const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('firestore_offline_mode') === 'true';
    if (isOfflineMode) {
      return true; // Zwracamy true, aby aplikacja mogła kontynuować działanie
    }
    
    // Sprawdźmy po kolei każdy dokument, czy istnieje
    const teamIds = Object.values(TEAMS).map(team => team.id);
    let existingCount = 0;
    
    for (const teamId of teamIds) {
      try {
        const teamDocRef = doc(db, "teams", teamId);
        const teamDoc = await getDoc(teamDocRef);
        
        if (teamDoc.exists()) {
          existingCount++;
        }
      } catch (e) {
        // Sprawdzamy, czy to błąd uprawnień
        if (e instanceof Error && e.message.includes("Missing or insufficient permissions")) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('firestore_offline_mode', 'true');
            toast.error("Brak uprawnień do odczytu zespołów. Aplikacja działa w trybie offline.");
          }
          return true; // Pozwalamy aplikacji działać dalej
        }
        
        console.error(`Błąd przy sprawdzaniu zespołu ${teamId}:`, e);
        throw e; // Rzucamy błąd, aby przerwać pętlę
      }
    }
    
    const allExist = existingCount === teamIds.length;
    
    return allExist;
  } catch (error) {
    console.error("Błąd podczas sprawdzania kolekcji teams:", error);
    
    if (error instanceof Error) {
      console.error("Szczegóły błędu:", error);
      
      // Jeśli to błąd uprawnień, włączamy tryb offline i pozwalamy aplikacji działać dalej
      if (error.message.includes("Missing or insufficient permissions")) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('firestore_offline_mode', 'true');
          toast.error("Brak dostępu do bazy danych. Aplikacja działa w trybie offline.");
        }
        return true; // Pozwalamy aplikacji działać dalej mimo błędu
      }
    }
    
    return false;
  }
}; 