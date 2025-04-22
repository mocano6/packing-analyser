"use client";

import React, { useState, useEffect } from "react";
import { initializeTeams, checkTeamsCollection, forceInitializeTeams } from "@/utils/initializeTeams";
import { checkFirestoreWritePermission } from "@/utils/firestorePermissionCheck";
import { TEAMS } from "@/constants/teams";

const TeamsInitializer: React.FC = () => {
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [teamsExist, setTeamsExist] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [hasWritePermission, setHasWritePermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Automatycznie sprawdź stan kolekcji przy ładowaniu komponentu
  useEffect(() => {
    handleCheckTeams();
    checkPermissions();
  }, []);

  // Sprawdza uprawnienia do zapisu w Firebase
  const checkPermissions = async () => {
    setIsLoading(true);
    setStatus("Sprawdzanie uprawnień do zapisu w Firebase...");

    try {
      const result = await checkFirestoreWritePermission();
      setHasWritePermission(result.canWrite);
      setPermissionError(result.error || null);
      
      setStatus(result.canWrite 
        ? "✅ Masz uprawnienia do zapisu w Firebase" 
        : `❌ Brak uprawnień do zapisu: ${result.error}`);
    } catch (error) {
      setStatus(`❌ Błąd podczas sprawdzania uprawnień: ${error instanceof Error ? error.message : String(error)}`);
      setHasWritePermission(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckTeams = async () => {
    setIsLoading(true);
    setStatus("Sprawdzanie kolekcji teams...");
    
    try {
      const exists = await checkTeamsCollection();
      setTeamsExist(exists);
      setLastChecked(new Date());
      setStatus(exists 
        ? "✅ Kolekcja teams istnieje w Firebase - wszystkie dokumenty znalezione" 
        : "❌ Kolekcja teams nie istnieje lub jest niekompletna");
    } catch (error) {
      setStatus(`Błąd podczas sprawdzania kolekcji: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeTeams = async () => {
    // Najpierw sprawdź uprawnienia, jeśli jeszcze nie sprawdzono
    if (hasWritePermission === null) {
      await checkPermissions();
      if (!hasWritePermission) {
        setStatus(`❌ Nie można zainicjalizować zespołów: brak uprawnień do zapisu. ${permissionError}`);
        return;
      }
    } else if (hasWritePermission === false) {
      setStatus(`❌ Nie można zainicjalizować zespołów: brak uprawnień do zapisu. ${permissionError}`);
      return;
    }

    if (!window.confirm("Czy na pewno chcesz zainicjalizować kolekcję teams? Ta operacja powinna być wykonana tylko raz.")) {
      return;
    }
    
    setIsLoading(true);
    setStatus("Inicjalizacja kolekcji teams...");
    
    try {
      const result = await initializeTeams();
      
      // Po inicjalizacji sprawdź ponownie stan kolekcji
      const exists = await checkTeamsCollection();
      setTeamsExist(exists);
      setLastChecked(new Date());
      
      setStatus(result 
        ? "✅ Pomyślnie zainicjalizowano kolekcję teams" 
        : "ℹ️ Kolekcja teams już istnieje, inicjalizacja pominięta");
    } catch (error) {
      setStatus(`❌ Błąd podczas inicjalizacji: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceInitializeTeams = async () => {
    // Najpierw sprawdź uprawnienia, jeśli jeszcze nie sprawdzono
    if (hasWritePermission === null) {
      await checkPermissions();
      if (!hasWritePermission) {
        setStatus(`❌ Nie można zainicjalizować zespołów: brak uprawnień do zapisu. ${permissionError}`);
        return;
      }
    } else if (hasWritePermission === false) {
      setStatus(`❌ Nie można zainicjalizować zespołów: brak uprawnień do zapisu. ${permissionError}`);
      return;
    }

    if (!window.confirm("⚠️ UWAGA: Czy na pewno chcesz WYMUSIĆ inicjalizację kolekcji teams? Ta operacja nadpisze istniejące dane jeśli istnieją!")) {
      return;
    }
    
    if (!window.confirm("⚠️ Upewnij się, że rozumiesz konsekwencje. Ta operacja aktualizuje wszystkie zespoły, nawet jeśli już istnieją. Kontynuować?")) {
      return;
    }
    
    setIsLoading(true);
    setStatus("Wymuszanie inicjalizacji kolekcji teams...");
    
    try {
      const result = await forceInitializeTeams();
      
      // Po inicjalizacji sprawdź ponownie stan kolekcji
      const exists = await checkTeamsCollection();
      setTeamsExist(exists);
      setLastChecked(new Date());
      
      setStatus(result 
        ? "✅ Pomyślnie wymuszono inicjalizację kolekcji teams" 
        : "❌ Wymuszona inicjalizacja nie powiodła się w pełni - sprawdź konsolę");
    } catch (error) {
      setStatus(`❌ Błąd podczas wymuszonej inicjalizacji: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      border: "1px solid #ccc",
      borderRadius: "5px",
      padding: "15px",
      margin: "15px 0",
      backgroundColor: "#f9f9f9"
    }}>
      <h3>Inicjalizacja kolekcji Teams</h3>
      <p>
        Ta funkcja służy do jednorazowego utworzenia stałej kolekcji "teams" w Firebase.
        Każdy zespół będzie miał ten sam identyfikator dla wszystkich użytkowników.
      </p>
      
      {/* Status uprawnień do zapisu */}
      {hasWritePermission !== null && (
        <div style={{
          padding: "10px",
          backgroundColor: hasWritePermission ? "#d4edda" : "#f8d7da",
          borderRadius: "4px",
          marginBottom: "15px",
          color: hasWritePermission ? "#155724" : "#721c24"
        }}>
          {hasWritePermission 
            ? "✅ Masz uprawnienia do zapisu w Firebase" 
            : `❌ Brak uprawnień do zapisu w Firebase: ${permissionError}`}
        </div>
      )}
      
      <div style={{ marginBottom: "10px" }}>
        <h4>Lista zespołów do inicjalizacji:</h4>
        <ul>
          {Object.values(TEAMS).map(team => (
            <li key={team.id}>{team.name} (ID: {team.id})</li>
          ))}
        </ul>
      </div>
      
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
        <button
          onClick={handleCheckTeams}
          disabled={isLoading}
          style={{
            padding: "8px 12px",
            backgroundColor: "#4a90e2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        >
          Sprawdź stan kolekcji
        </button>

        <button
          onClick={checkPermissions}
          disabled={isLoading}
          style={{
            padding: "8px 12px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        >
          Sprawdź uprawnienia
        </button>
        
        <button
          onClick={handleInitializeTeams}
          disabled={isLoading || hasWritePermission === false}
          style={{
            padding: "8px 12px",
            backgroundColor: "#5cb85c",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: (isLoading || hasWritePermission === false) ? "not-allowed" : "pointer",
            opacity: hasWritePermission === false ? 0.6 : 1
          }}
        >
          Inicjalizuj kolekcję teams
        </button>
        
        <button
          onClick={handleForceInitializeTeams}
          disabled={isLoading || hasWritePermission === false}
          style={{
            padding: "8px 12px",
            backgroundColor: "#e24a4a",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: (isLoading || hasWritePermission === false) ? "not-allowed" : "pointer",
            opacity: hasWritePermission === false ? 0.6 : 1
          }}
        >
          WYMUŚ inicjalizację kolekcji
        </button>
      </div>
      
      {status && (
        <div style={{ 
          padding: "10px", 
          backgroundColor: status.includes("❌") ? "#ffcccc" : 
                          status.includes("✅") ? "#ccffcc" : "#e6f7ff",
          borderRadius: "4px",
          marginTop: "10px"
        }}>
          {status}
        </div>
      )}
      
      {teamsExist === true && (
        <div style={{ 
          padding: "10px", 
          backgroundColor: "#e6f7ff", 
          borderRadius: "4px",
          marginTop: "10px"
        }}>
          ✅ Kolekcja teams jest zainicjalizowana. Aplikacja może korzystać z zespołów.
          {lastChecked && (
            <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
              Ostatnie sprawdzenie: {lastChecked.toLocaleString()}
            </div>
          )}
        </div>
      )}
      
      {teamsExist === false && (
        <div style={{ 
          padding: "10px", 
          backgroundColor: "#fff3cd", 
          borderRadius: "4px",
          marginTop: "10px"
        }}>
          ⚠️ Kolekcja teams nie istnieje lub jest niekompletna. Należy ją zainicjalizować.
          {lastChecked && (
            <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
              Ostatnie sprawdzenie: {lastChecked.toLocaleString()}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#666" }}>
        <p><strong>Instrukcje:</strong></p>
        <ol style={{ paddingLeft: "20px" }}>
          <li>Najpierw użyj przycisku "Sprawdź uprawnienia", aby zweryfikować czy masz dostęp do zapisu</li>
          <li>Następnie "Sprawdź stan kolekcji", aby zobaczyć czy zespoły już istnieją</li>
          <li>Jeśli kolekcja nie istnieje, użyj przycisku "Inicjalizuj kolekcję teams"</li>
          <li>Przycisk "WYMUŚ inicjalizację kolekcji" używaj TYLKO w przypadku problemów z inicjalizacją standardową</li>
        </ol>
        <p><strong>Uwaga:</strong> Wszystkie operacje są logowane w konsoli przeglądarki (F12 → Console)</p>
      </div>
    </div>
  );
};

export default TeamsInitializer; 