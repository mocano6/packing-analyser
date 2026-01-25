"use client";

import React, { useState, useEffect } from "react";
import { getDB } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
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
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin' | 'coach'>('user');
  const [newUserTeams, setNewUserTeams] = useState<string[]>([]);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);
  const [showEditUserModal, setShowEditUserModal] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserEmail, setEditUserEmail] = useState<string>("");
  const [editUserRole, setEditUserRole] = useState<'user' | 'admin' | 'coach'>('user');
  const [editUserTeams, setEditUserTeams] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState<string>("");
  const [isUpdatingUser, setIsUpdatingUser] = useState<boolean>(false);

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

        usersData.push({
          id: doc.id,
          ...userData
        });
      });

      
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
  const updateUserRole = async (userId: string, newRole: 'user' | 'admin' | 'coach') => {
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
    if (!window.confirm(`Czy na pewno chcesz usunąć użytkownika ${userEmail}? To usunie również jego konto w Firebase Authentication.`)) {
      return;
    }

    try {
      const db = getDB();
      const userRef = doc(db, "users", userId);
      
      // Usuń z Firestore
      await deleteDoc(userRef).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Usuń z Firebase Authentication (przez API route)
      // userId w Firestore to uid w Firebase Auth
      try {
        const response = await fetch('/api/delete-user-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: userId })
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Jeśli błąd, ale dokument Firestore został usunięty, kontynuuj
          console.warn('Nie udało się usunąć użytkownika z Auth:', errorData);
          if (errorData.code === 'auth/user-not-found') {
            // Użytkownik już nie istnieje w Auth - to OK
            console.log('Użytkownik już nie istnieje w Authentication');
          } else {
            toast.warning("Użytkownik został usunięty z Firestore, ale wystąpił problem z usunięciem z Authentication. Możesz spróbować usunąć ręcznie w Firebase Console.");
          }
        }
      } catch (authError) {
        console.error("Błąd podczas usuwania z Authentication:", authError);
        // Kontynuuj - dokument Firestore został już usunięty
        toast.warning("Użytkownik został usunięty z Firestore, ale wystąpił problem z usunięciem z Authentication.");
      }

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

  // Obsługa zmiany zespołów dla nowego użytkownika
  const handleNewUserTeamToggle = (teamId: string) => {
    setNewUserTeams(prev => 
      prev.includes(teamId)
        ? prev.filter(t => t !== teamId)
        : [...prev, teamId]
    );
  };

  // Obsługa zmiany zespołów dla edytowanego użytkownika
  const handleEditUserTeamToggle = (teamId: string) => {
    setEditUserTeams(prev => 
      prev.includes(teamId)
        ? prev.filter(t => t !== teamId)
        : [...prev, teamId]
    );
  };

  // Otwórz modal edycji użytkownika
  const openEditUserModal = (user: UserWithId) => {
    setEditingUserId(user.id);
    setEditUserEmail(user.email);
    setEditUserRole(user.role);
    setEditUserTeams([...user.allowedTeams]);
    setNewPassword("");
    setShowEditUserModal(true);
  };

  // Aktualizuj dane użytkownika
  const updateUser = async () => {
    if (!editingUserId || !editUserEmail) {
      toast.error("Email jest wymagany");
      return;
    }

    setIsUpdatingUser(true);
    try {
      const db = getDB();
      const userRef = doc(db, "users", editingUserId);
      
      const updateData: any = {
        email: editUserEmail,
        role: editUserRole,
        allowedTeams: editUserTeams
      };

      await updateDoc(userRef, updateData).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Jeśli podano nowe hasło, wyślij email resetujący hasło
      if (newPassword && newPassword.length >= 6) {
        try {
          const auth = getAuth();
          // Pobierz użytkownika z Firebase Auth po emailu
          // Uwaga: W Firebase Auth nie ma bezpośredniej metody getByEmail w client SDK
          // Użyjemy sendPasswordResetEmail jako alternatywę
          await sendPasswordResetEmail(auth, editUserEmail);
          toast.success("Email z linkiem resetującym hasło został wysłany do użytkownika");
        } catch (error: any) {
          console.error("Błąd podczas wysyłania emaila resetującego hasło:", error);
          // Nie przerywamy aktualizacji - dane użytkownika zostały zaktualizowane
          toast.error("Nie udało się wysłać emaila resetującego hasło, ale dane użytkownika zostały zaktualizowane");
        }
      }

      // Aktualizuj lokalny stan
      setUsers(prev => prev.map(user => 
        user.id === editingUserId 
          ? { ...user, email: editUserEmail, role: editUserRole, allowedTeams: editUserTeams }
          : user
      ));

      // Zamknij modal i resetuj stan
      setShowEditUserModal(false);
      setEditingUserId(null);
      setEditUserEmail("");
      setEditUserRole('user');
      setEditUserTeams([]);
      setNewPassword("");

      toast.success("Użytkownik został zaktualizowany");
    } catch (error) {
      console.error("Błąd podczas aktualizacji użytkownika:", error);
      toast.error("Błąd podczas aktualizacji użytkownika");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // Wyślij email resetujący hasło
  const sendPasswordReset = async (userEmail: string) => {
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, userEmail);
      toast.success("Email z linkiem resetującym hasło został wysłany do użytkownika");
    } catch (error: any) {
      console.error("Błąd podczas wysyłania emaila resetującego hasło:", error);
      if (error.code === 'auth/user-not-found') {
        toast.error("Użytkownik o tym adresie email nie istnieje w Firebase Auth");
      } else {
        toast.error("Błąd podczas wysyłania emaila resetującego hasło");
      }
    }
  };

  // Dodaj nowego użytkownika
  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error("Email i hasło są wymagane");
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error("Hasło musi mieć co najmniej 6 znaków");
      return;
    }

    setIsCreatingUser(true);
    const auth = getAuth();
    const currentUser = auth.currentUser;

    try {
      if (!currentUser) {
        toast.error("Brak zalogowanego użytkownika");
        return;
      }

      // Utwórz nowe konto użytkownika (automatycznie loguje nowego użytkownika)
      const userCredential = await createUserWithEmailAndPassword(auth, newUserEmail, newUserPassword);
      const newUserId = userCredential.user.uid;

      // Utwórz dokument użytkownika w Firestore przed wylogowaniem
      const db = getDB();
      const userRef = doc(db, "users", newUserId);
      const newUserData: UserData = {
        email: newUserEmail,
        allowedTeams: newUserTeams,
        role: newUserRole,
        createdAt: new Date(),
        lastLogin: null as any
      };

      await setDoc(userRef, newUserData).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Wyloguj nowego użytkownika
      await signOut(auth);

      // Dodaj do lokalnego stanu
      setUsers(prev => [...prev, { id: newUserId, ...newUserData }]);

      // Resetuj formularz
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole('user');
      setNewUserTeams([]);
      setShowAddUserModal(false);

      toast.success("Użytkownik został utworzony pomyślnie. Proszę zalogować się ponownie jako administrator.");
      
      // Przekieruj do strony logowania po 2 sekundach
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      console.error("Błąd podczas tworzenia użytkownika:", error);

      if (error.code === 'auth/email-already-in-use') {
        toast.error("Użytkownik o tym adresie email już istnieje");
      } else if (error.code === 'auth/invalid-email') {
        toast.error("Nieprawidłowy adres email");
      } else if (error.code === 'auth/weak-password') {
        toast.error("Hasło jest zbyt słabe");
      } else {
        toast.error("Błąd podczas tworzenia użytkownika: " + (error.message || "Nieznany błąd"));
      }
    } finally {
      setIsCreatingUser(false);
    }
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
        <button
          onClick={() => setShowAddUserModal(true)}
          disabled={isLoading || isCreatingUser}
          style={{
            padding: "10px 15px",
            backgroundColor: "#17a2b8",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: (isLoading || isCreatingUser) ? "not-allowed" : "pointer"
          }}
        >
          + Dodaj użytkownika
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
                      onChange={(e) => updateUserRole(user.id, e.target.value as 'user' | 'admin' | 'coach')}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px"
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="coach">Coach</option>
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
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => openEditUserModal(user)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#17a2b8",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem"
                        }}
                      >
                        Edytuj
                      </button>
                      <button
                        onClick={() => sendPasswordReset(user.email)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#ffc107",
                          color: "#212529",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem"
                        }}
                      >
                        Reset hasła
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal dodawania użytkownika */}
      {showAddUserModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000
        }} onClick={() => !isCreatingUser && setShowAddUserModal(false)}>
          <div style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "90vh",
            overflowY: "auto"
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Dodaj nowego użytkownika</h3>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Email:
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@example.com"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isCreatingUser}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Hasło (min. 6 znaków):
              </label>
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Hasło"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isCreatingUser}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Rola:
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin' | 'coach')}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isCreatingUser}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="coach">Coach</option>
              </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Dostępne zespoły:
              </label>
              <div style={{
                maxHeight: "200px",
                overflowY: "auto",
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "10px"
              }}>
                {teams.map(team => (
                  <label key={team.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="checkbox"
                      checked={newUserTeams.includes(team.id)}
                      onChange={() => handleNewUserTeamToggle(team.id)}
                      disabled={isCreatingUser}
                    />
                    <span>{team.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUserEmail("");
                  setNewUserPassword("");
                  setNewUserRole('user');
                  setNewUserTeams([]);
                }}
                disabled={isCreatingUser}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isCreatingUser ? "not-allowed" : "pointer"
                }}
              >
                Anuluj
              </button>
              <button
                onClick={createUser}
                disabled={isCreatingUser || !newUserEmail || !newUserPassword}
                style={{
                  padding: "10px 20px",
                  backgroundColor: isCreatingUser || !newUserEmail || !newUserPassword ? "#ccc" : "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: (isCreatingUser || !newUserEmail || !newUserPassword) ? "not-allowed" : "pointer"
                }}
              >
                {isCreatingUser ? "Tworzenie..." : "Utwórz użytkownika"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edycji użytkownika */}
      {showEditUserModal && editingUserId && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000
        }} onClick={() => !isUpdatingUser && setShowEditUserModal(false)}>
          <div style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "90vh",
            overflowY: "auto"
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edytuj użytkownika</h3>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Email:
              </label>
              <input
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                placeholder="email@example.com"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isUpdatingUser}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Nowe hasło (opcjonalne, min. 6 znaków):
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Pozostaw puste, aby nie zmieniać hasła"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isUpdatingUser}
              />
              <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>
                Jeśli podasz hasło, użytkownik otrzyma email z linkiem resetującym hasło.
              </p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Rola:
              </label>
              <select
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value as 'user' | 'admin' | 'coach')}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isUpdatingUser}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="coach">Coach</option>
              </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Dostępne zespoły:
              </label>
              <div style={{
                maxHeight: "200px",
                overflowY: "auto",
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "10px"
              }}>
                {teams.map(team => (
                  <label key={team.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="checkbox"
                      checked={editUserTeams.includes(team.id)}
                      onChange={() => handleEditUserTeamToggle(team.id)}
                      disabled={isUpdatingUser}
                    />
                    <span>{team.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  setEditingUserId(null);
                  setEditUserEmail("");
                  setEditUserRole('user');
                  setEditUserTeams([]);
                  setNewPassword("");
                }}
                disabled={isUpdatingUser}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isUpdatingUser ? "not-allowed" : "pointer"
                }}
              >
                Anuluj
              </button>
              <button
                onClick={updateUser}
                disabled={isUpdatingUser || !editUserEmail}
                style={{
                  padding: "10px 20px",
                  backgroundColor: (isUpdatingUser || !editUserEmail) ? "#ccc" : "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: (isUpdatingUser || !editUserEmail) ? "not-allowed" : "pointer"
                }}
              >
                {isUpdatingUser ? "Aktualizowanie..." : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "20px", fontSize: "0.9em", color: "#666" }}>
        <h4>Instrukcje:</h4>
        <ul style={{ paddingLeft: "20px" }}>
          <li>Kliknij "Dodaj użytkownika" aby utworzyć nowe konto</li>
          <li>Kliknij "Edytuj" aby zmienić email, rolę lub zespoły użytkownika</li>
          <li>Kliknij "Reset hasła" aby wysłać użytkownikowi email z linkiem resetującym hasło</li>
          <li>W modalu edycji możesz podać nowe hasło - użytkownik otrzyma email resetujący</li>
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