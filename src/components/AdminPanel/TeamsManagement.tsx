"use client";

import React, { useState, useEffect } from "react";
import { getDB } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, setDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";
import { Team, clearTeamsCache } from "@/constants/teamsLoader";
import OpponentLogoInput from "@/components/OpponentLogoInput/OpponentLogoInput";

interface TeamsManagementProps {
  currentUserIsAdmin: boolean;
}

const TeamsManagement: React.FC<TeamsManagementProps> = ({ currentUserIsAdmin }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [newTeamName, setNewTeamName] = useState<string>("");
  const [editTeamName, setEditTeamName] = useState<string>("");
  const [editingTeamLogo, setEditingTeamLogo] = useState<string | null>(null);
  const [newTeamLogo, setNewTeamLogo] = useState<string>("");

  // Pobierz wszystkie zespoły z Firebase
  const fetchTeams = async () => {
    if (!currentUserIsAdmin) return;

    setIsLoading(true);
    try {
      const db = getDB();
      const teamsCollection = collection(db, "teams");
      const teamsSnapshot = await getDocs(teamsCollection);
      
      const teamsData: Team[] = [];
      teamsSnapshot.forEach(doc => {
        const teamData = doc.data() as Team;
        teamsData.push({
          ...teamData,
          id: doc.id
        });
      });

      // Sortuj zespoły alfabetycznie po nazwie
      teamsData.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsData);
    } catch (error) {
      console.error("Błąd podczas pobierania zespołów:", error);
      toast.error("Błąd podczas pobierania listy zespołów");
    } finally {
      setIsLoading(false);
    }
  };

  // Dodaj nowy zespół
  const addTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error("Nazwa zespołu nie może być pusta");
      return;
    }

    // Sprawdź czy zespół o takiej nazwie już istnieje
    if (teams.some(team => team.name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      toast.error("Zespół o takiej nazwie już istnieje");
      return;
    }

    try {
      const db = getDB();
      const teamsCollection = collection(db, "teams");
      
      const newTeam: Omit<Team, 'id'> = {
        name: newTeamName.trim(),
        createdAt: new Date(),
        isSystem: false
      };

      const docRef = await addDoc(teamsCollection, newTeam);
      
      // Aktualizuj dokument z właściwym ID
      await updateDoc(docRef, {
        id: docRef.id
      });

      // Dodaj do lokalnego stanu
      const newTeamWithId: Team = {
        ...newTeam,
        id: docRef.id
      };

      setTeams(prev => [...prev, newTeamWithId].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTeamName("");
      setIsAddingTeam(false);

      // Wyczyść cache zespołów aby zmiany były widoczne w głównej aplikacji
      clearTeamsCache();

      // Powiadom główną aplikację o zmianie zespołów
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('teamsChanged'));
      }

      toast.success(`Zespół "${newTeamName}" został dodany`);
    } catch (error) {
      console.error("Błąd podczas dodawania zespołu:", error);
      toast.error("Błąd podczas dodawania zespołu");
    }
  };

  // Aktualizuj nazwę zespołu
  const updateTeamName = async (teamId: string, newName: string) => {
    if (!newName.trim()) {
      toast.error("Nazwa zespołu nie może być pusta");
      return;
    }

    // Sprawdź czy zespół o takiej nazwie już istnieje (oprócz edytowanego)
    if (teams.some(team => team.id !== teamId && team.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error("Zespół o takiej nazwie już istnieje");
      return;
    }

    try {
      const db = getDB();
      const teamRef = doc(db, "teams", teamId);
      
      const updateData: any = {
        name: newName.trim()
      };

      // Dodaj logo jeśli zostało zmienione
      if (editingTeamLogo !== null) {
        updateData.logo = editingTeamLogo;
      }

      await updateDoc(teamRef, updateData).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Aktualizuj lokalny stan
      setTeams(prev => prev.map(team => 
        team.id === teamId 
          ? { 
              ...team, 
              name: newName.trim(),
              logo: editingTeamLogo !== null ? editingTeamLogo : team.logo
            }
          : team
      ).sort((a, b) => a.name.localeCompare(b.name)));

      setEditingTeam(null);
      setEditTeamName("");
      setEditingTeamLogo(null);

      // Wyczyść cache zespołów aby zmiany były widoczne w głównej aplikacji
      clearTeamsCache();

      // Powiadom główną aplikację o zmianie zespołów
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('teamsChanged'));
      }

      toast.success("Zespół został zaktualizowany");
    } catch (error) {
      console.error("Błąd podczas aktualizacji zespołu:", error);
      toast.error("Błąd podczas aktualizacji zespołu");
    }
  };

  // Usuń zespół
  const deleteTeam = async (teamId: string, teamName: string, isSystem: boolean) => {
    if (isSystem) {
      toast.error("Nie można usunąć zespołu systemowego");
      return;
    }

    if (!window.confirm(`Czy na pewno chcesz usunąć zespół "${teamName}"?\n\nUWAGA: To działanie usunie także wszystkich graczy i mecze przypisane do tego zespołu!`)) {
      return;
    }

    try {
      const db = getDB();
      const teamRef = doc(db, "teams", teamId);
      
      await deleteDoc(teamRef).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Usuń z lokalnego stanu
      setTeams(prev => prev.filter(team => team.id !== teamId));

      // Wyczyść cache zespołów aby zmiany były widoczne w głównej aplikacji
      clearTeamsCache();

      // Powiadom główną aplikację o zmianie zespołów
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('teamsChanged'));
      }

      toast.success(`Zespół "${teamName}" został usunięty`);
    } catch (error) {
      console.error("Błąd podczas usuwania zespołu:", error);
      toast.error("Błąd podczas usuwania zespołu");
    }
  };

  // Rozpocznij edycję nazwy zespołu
  const startEditingTeam = (teamId: string, currentName: string) => {
    const team = teams.find(t => t.id === teamId);
    setEditingTeam(teamId);
    setEditTeamName(currentName);
    setEditingTeamLogo(team?.logo || null);
  };

  // Anuluj edycję
  const cancelEditing = () => {
    setEditingTeam(null);
    setEditTeamName("");
    setEditingTeamLogo(null);
  };

  // Anuluj dodawanie
  const cancelAdding = () => {
    setIsAddingTeam(false);
    setNewTeamName("");
  };

  useEffect(() => {
    fetchTeams();
  }, [currentUserIsAdmin]);

  if (!currentUserIsAdmin) {
    return (
      <div style={{
        padding: "20px",
        backgroundColor: "#fff3cd",
        borderRadius: "8px",
        border: "1px solid #ffeaa7"
      }}>
        <p>Brak uprawnień administratora. Tylko administratorzy mogą zarządzać zespołami.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      border: "1px solid #ccc",
      borderRadius: "8px",
      padding: "20px",
      margin: "20px 0",
      backgroundColor: "#f9f9f9"
    }}>
      <h3>Zarządzanie zespołami</h3>
      
      <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
        <button
          onClick={fetchTeams}
          disabled={isLoading}
          style={{
            padding: "10px 15px",
            backgroundColor: "#4a90e2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        >
          {isLoading ? "Ładowanie..." : "Odśwież listę zespołów"}
        </button>

        <button
          onClick={() => setIsAddingTeam(true)}
          disabled={isAddingTeam}
          style={{
            padding: "10px 15px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isAddingTeam ? "not-allowed" : "pointer"
          }}
        >
          Dodaj nowy zespół
        </button>
      </div>

      {/* Formularz dodawania nowego zespołu */}
      {isAddingTeam && (
        <div style={{
          backgroundColor: "#e8f5e8",
          border: "2px solid #28a745",
          borderRadius: "8px",
          padding: "15px",
          marginBottom: "20px"
        }}>
          <h4>Dodaj nowy zespół</h4>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Nazwa zespołu"
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                flex: 1
              }}
              onKeyPress={(e) => e.key === 'Enter' && addTeam()}
            />
            <button
              onClick={addTeam}
              style={{
                padding: "8px 15px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Dodaj
            </button>
            <button
              onClick={cancelAdding}
              style={{
                padding: "8px 15px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <p>Brak zespołów do wyświetlenia.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            backgroundColor: "white",
            borderRadius: "8px",
            overflow: "hidden"
          }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>ID</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Logo</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Nazwa</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Typ</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Data utworzenia</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td style={{ 
                    padding: "12px", 
                    border: "1px solid #ddd",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    maxWidth: "150px",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {team.id}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    {editingTeam === team.id ? (
                      <div style={{ maxWidth: "120px" }}>
                        <OpponentLogoInput
                          value={editingTeamLogo || undefined}
                          onChange={(logoUrl) => setEditingTeamLogo(logoUrl)}
                          onRemove={() => setEditingTeamLogo(null)}
                        />
                      </div>
                    ) : (
                      team.logo ? (
                        <img 
                          src={team.logo} 
                          alt={`Logo ${team.name}`}
                          style={{
                            width: "32px",
                            height: "32px",
                            objectFit: "contain",
                            borderRadius: "4px",
                            border: "1px solid #ddd"
                          }}
                        />
                      ) : (
                        <span style={{ color: "#999", fontSize: "12px" }}>Brak logo</span>
                      )
                    )}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    {editingTeam === team.id ? (
                      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                        <input
                          type="text"
                          value={editTeamName}
                          onChange={(e) => setEditTeamName(e.target.value)}
                          style={{
                            padding: "5px 8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            flex: 1
                          }}
                          onKeyPress={(e) => e.key === 'Enter' && updateTeamName(team.id, editTeamName)}
                        />
                        <button
                          onClick={() => updateTeamName(team.id, editTeamName)}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditing}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: team.isSystem ? "bold" : "normal" }}>
                        {team.name}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      backgroundColor: team.isSystem ? "#ffeaa7" : "#dfe6e9",
                      color: team.isSystem ? "#6c5ce7" : "#2d3436"
                    }}>
                      {team.isSystem ? "Systemowy" : "Niestandardowy"}
                    </span>
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", fontSize: "14px" }}>
                    {team.createdAt ? new Date(team.createdAt).toLocaleDateString('pl-PL') : "Brak danych"}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
                      {editingTeam !== team.id && (
                        <button
                          onClick={() => startEditingTeam(team.id, team.name)}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#ffc107",
                            color: "black",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          Edytuj
                        </button>
                      )}
                      <button
                        onClick={() => deleteTeam(team.id, team.name, team.isSystem || false)}
                        disabled={team.isSystem}
                        style={{
                          padding: "5px 10px",
                          backgroundColor: team.isSystem ? "#cccccc" : "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: team.isSystem ? "not-allowed" : "pointer",
                          fontSize: "12px"
                        }}
                        title={team.isSystem ? "Nie można usunąć zespołu systemowego" : "Usuń zespół"}
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{
        marginTop: "15px",
        padding: "10px",
        backgroundColor: "#e3f2fd",
        borderRadius: "4px",
        fontSize: "14px"
      }}>
        <strong>Informacje:</strong>
        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
          <li>Zespoły systemowe nie mogą być usunięte (oznaczone jako "Systemowy")</li>
          <li>Usunięcie zespołu spowoduje również usunięcie wszystkich powiązanych graczy i meczów</li>
          <li>Nazwy zespołów muszą być unikalne</li>
        </ul>
      </div>
    </div>
  );
};

export default TeamsManagement; 