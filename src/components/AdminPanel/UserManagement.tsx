"use client";

import React, { useState, useEffect } from "react";
import { getDB } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Team, getTeamsArray } from "@/constants/teamsLoader";
import { UserData } from "@/hooks/useAuth";
import { toast } from "react-hot-toast";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";

interface UserManagementProps {
  currentUserIsAdmin: boolean;
}

interface UserWithId extends UserData {
  id: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUserIsAdmin }) => {
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  // Pobierz wszystkich użytkowników
  const fetchUsers = async () => {
    if (!currentUserIsAdmin) return;

    setIsLoading(true);
    try {
      const db = getDB();
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      
      const usersData: UserWithId[] = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data() as UserData;
        console.log(`Użytkownik ${doc.id}:`, userData); // Debug log
        usersData.push({
          id: doc.id,
          ...userData
        });
      });

      console.log('Wszyscy użytkownicy:', usersData); // Debug log
      setUsers(usersData);
    } catch (error) {
      console.error("Błąd podczas pobierania użytkowników:", error);
      toast.error("Błąd podczas pobierania listy użytkowników");
    } finally {
      setIsLoading(false);
    }
  };

  // Pobierz wszystkie zespoły z Firebase
  const fetchTeamsData = async () => {
    if (!currentUserIsAdmin) return;

    try {
      const teamsData = await getTeamsArray();
      setTeams(teamsData);
      console.log('Pobrane zespoły:', teamsData); // Debug log
    } catch (error) {
      console.error("Błąd podczas pobierania zespołów:", error);
      toast.error("Błąd podczas pobierania listy zespołów");
    }
  };

  // Aktualizuj uprawnienia użytkownika do zespołów
  const updateUserTeams = async (userId: string, newTeams: string[]) => {
    try {
      const db = getDB();
      const userRef = doc(db, "users", userId);
      
      await updateDoc(userRef, {
        allowedTeams: newTeams
      }).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Aktualizuj lokalny stan
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, allowedTeams: newTeams }
          : user
      ));

      toast.success("Zaktualizowano uprawnienia użytkownika");
    } catch (error) {
      console.error("Błąd podczas aktualizacji uprawnień:", error);
      toast.error("Błąd podczas aktualizacji uprawnień");
    }
  };

  // Zmiana roli użytkownika
  const updateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      const db = getDB();
      const userRef = doc(db, "users", userId);
      
      await updateDoc(userRef, {
        role: newRole
      }).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Aktualizuj lokalny stan
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, role: newRole }
          : user
      ));

      toast.success(`Zmieniono rolę użytkownika na ${newRole}`);
    } catch (error) {
      console.error("Błąd podczas zmiany roli:", error);
      toast.error("Błąd podczas zmiany roli");
    }
  };

  // Usuń użytkownika
  const deleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć użytkownika ${userEmail}?`)) {
      return;
    }

    try {
      const db = getDB();
      const userRef = doc(db, "users", userId);
      
      await deleteDoc(userRef).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Usuń z lokalnego stanu
      setUsers(prev => prev.filter(user => user.id !== userId));

      toast.success("Użytkownik został usunięty");
    } catch (error) {
      console.error("Błąd podczas usuwania użytkownika:", error);
      toast.error("Błąd podczas usuwania użytkownika");
    }
  };

  // Obsługa zmiany dostępu do zespołu
  const handleTeamToggle = async (userId: string, teamId: string, currentTeams: string[]) => {
    const newTeams = currentTeams.includes(teamId)
      ? currentTeams.filter(t => t !== teamId)
      : [...currentTeams, teamId];
    
    await updateUserTeams(userId, newTeams);
  };

  useEffect(() => {
    fetchUsers();
    fetchTeamsData();
  }, [currentUserIsAdmin]);

  if (!currentUserIsAdmin) {
    return (
      <div style={{
        padding: "20px",
        backgroundColor: "#fff3cd",
        borderRadius: "8px",
        border: "1px solid #ffeaa7"
      }}>
        <p>Brak uprawnień administratora. Tylko administratorzy mogą zarządzać użytkownikami.</p>
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
      <h3>Zarządzanie użytkownikami</h3>
      
      <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
        <button
          onClick={fetchUsers}
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
          {isLoading ? "Ładowanie..." : "Odśwież listę użytkowników"}
        </button>
        <button
          onClick={fetchTeamsData}
          disabled={isLoading}
          style={{
            padding: "10px 15px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        >
          Odśwież listę zespołów
        </button>
      </div>

      <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#e3f2fd", borderRadius: "4px", fontSize: "14px" }}>
        <strong>Status:</strong> {users.length} użytkowników, {teams.length} zespołów dostępnych
      </div>

      {users.length === 0 ? (
        <p>Brak użytkowników do wyświetlenia.</p>
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
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Email</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Rola</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Dostępne zespoły</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Ostatnie logowanie</th>
                <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    {user.email || 'Brak emaila'}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value as 'user' | 'admin')}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px"
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {teams.map(team => (
                        <label key={team.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={user.allowedTeams.includes(team.id)}
                            onChange={() => handleTeamToggle(user.id, team.id, user.allowedTeams)}
                          />
                          <span style={{ fontSize: "0.9rem" }}>{team.name}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pl-PL') : 'Nigdy'}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#e74c3c",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem"
                      }}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "20px", fontSize: "0.9em", color: "#666" }}>
        <h4>Instrukcje:</h4>
        <ul style={{ paddingLeft: "20px" }}>
          <li>Zaznacz/odznacz zespoły dla każdego użytkownika, aby nadać mu odpowiednie uprawnienia</li>
          <li>Zmień rolę na "Admin" aby użytkownik mógł zarządzać innymi użytkownikami</li>
          <li>Użytkownicy bez żadnych zespołów nie będą mogli korzystać z aplikacji</li>
          <li>Usunięcie użytkownika jest nieodwracalne</li>
        </ul>
      </div>
    </div>
  );
};

export default UserManagement; 