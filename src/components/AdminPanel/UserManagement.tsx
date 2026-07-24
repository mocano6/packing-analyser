"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { getDB } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, setDoc } from "@/lib/firestoreWithMetrics";
import {
  authUserHasPasswordProvider,
  formatAuthProviderLabels,
  mergeFirestoreUsersWithAuthUsers,
  type AdminAuthUserSummary,
  type UserWithAuthMeta,
} from "@/lib/adminAuthUserList";
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { Team, getTeamsArray } from "@/constants/teamsLoader";
import { UserData } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/userRoles";
import {
  USER_ROLE_OPTIONS,
  STAFF_ROLE_OPTIONS,
  buildRoleChangePatch,
  normalizeUserRole,
} from "@/lib/userRoles";
import { Player } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import { getPlayerMatchSuggestions } from "@/utils/playerMatching";
import { toast } from "react-hot-toast";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";
import { normalizeAllowedTeams } from "@/utils/userAllowedTeams";
import { formatLastLoginPl } from "@/utils/firestoreTimestamps";

interface UserManagementProps {
  currentUserIsAdmin: boolean;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUserIsAdmin }) => {
  const [users, setUsers] = useState<UserWithAuthMeta[]>([]);
  const [authOnlyCount, setAuthOnlyCount] = useState<number>(0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState<boolean>(false);
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [newUserTeams, setNewUserTeams] = useState<string[]>([]);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);
  const [showEditUserModal, setShowEditUserModal] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserEmail, setEditUserEmail] = useState<string>("");
  const [editUserRole, setEditUserRole] = useState<UserRole>('user');
  const [editUserTeams, setEditUserTeams] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState<string>("");
  const [isUpdatingUser, setIsUpdatingUser] = useState<boolean>(false);
  const [selectedPlayerByUser, setSelectedPlayerByUser] = useState<Record<string, string>>({});
  const [playerSearchByUser, setPlayerSearchByUser] = useState<Record<string, string>>({});
  const [pendingStaffRoleByUser, setPendingStaffRoleByUser] = useState<Record<string, UserRole>>({});
  const [convertingRoleUserId, setConvertingRoleUserId] = useState<string | null>(null);
  const [openTeamsDropdownUserId, setOpenTeamsDropdownUserId] = useState<string | null>(null);
  const [dropdownAnchorRect, setDropdownAnchorRect] = useState<DOMRect | null>(null);
  const [sortByRole, setSortByRole] = useState<'asc' | 'desc' | null>(null);
  const teamsDropdownRef = useRef<HTMLDivElement>(null);
  const teamsDropdownButtonRef = useRef<HTMLButtonElement | null>(null);

  // Posortowana lista użytkowników (według roli)
  const sortedUsers = useMemo(() => {
    if (sortByRole === null) return users;
    const order = sortByRole === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => order * (a.role.localeCompare(b.role)));
  }, [users, sortByRole]);

  // Zamknij dropdown zespołów po kliknięciu poza nim
  useEffect(() => {
    if (openTeamsDropdownUserId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inPortal = teamsDropdownRef.current?.contains(target);
      const inButton = teamsDropdownButtonRef.current?.contains(target);
      if (!inPortal && !inButton) {
        setOpenTeamsDropdownUserId(null);
        setDropdownAnchorRect(null);
        teamsDropdownButtonRef.current = null;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openTeamsDropdownUserId]);

  // Aktualizuj pozycję dropdownu przy scrollu i resize
  useEffect(() => {
    if (openTeamsDropdownUserId === null || !teamsDropdownButtonRef.current) return;
    const updateRect = () => {
      if (teamsDropdownButtonRef.current) {
        setDropdownAnchorRect(teamsDropdownButtonRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [openTeamsDropdownUserId]);

  const saveUserProfile = async (userId: string, patch: Partial<UserData>) => {
    const db = getDB();
    const userRef = doc(db, "users", userId);
    const current = users.find((user) => user.id === userId);

    if (current?.hasFirestoreProfile === false) {
      const newUserData: UserData = {
        email: current.email,
        allowedTeams: normalizeAllowedTeams(current.allowedTeams),
        role: current.role,
        createdAt: current.createdAt ?? new Date(),
        lastLogin: current.lastLogin ?? null,
        ...(current.status ? { status: current.status } : {}),
        ...(current.linkedPlayerId !== undefined ? { linkedPlayerId: current.linkedPlayerId } : {}),
        ...(current.registrationData ? { registrationData: current.registrationData } : {}),
        ...patch,
      };
      await setDoc(userRef, newUserData).catch(async (error) => {
        await handleFirestoreError(error, db);
        throw error;
      });
      return newUserData;
    }

    await updateDoc(userRef, patch).catch(async (error) => {
      await handleFirestoreError(error, db);
      throw error;
    });
    return patch;
  };

  // Pobierz użytkowników z Firestore i połącz z kontami Firebase Authentication (np. Google)
  const fetchUsers = async () => {
    if (!currentUserIsAdmin) return;

    setIsLoading(true);
    try {
      const db = getDB();
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);

      const firestoreUsers: Array<UserData & { id: string }> = [];
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data() as UserData;
        firestoreUsers.push({
          id: userDoc.id,
          ...userData,
          allowedTeams: normalizeAllowedTeams(userData.allowedTeams),
          role: normalizeUserRole(userData.role),
        });
      });

      let authUsers: AdminAuthUserSummary[] = [];
      const auth = getAuth();
      const current = auth.currentUser;
      if (current) {
        try {
          const idToken = await current.getIdToken();
          const response = await fetch("/api/admin-list-auth-users", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (response.ok) {
            const payload = (await response.json()) as { users?: AdminAuthUserSummary[] };
            authUsers = payload.users ?? [];
          } else {
            let payload: { error?: string; hint?: string } = {};
            try {
              payload = await response.json();
            } catch {
              /* body nie-JSON */
            }
            console.error("admin-list-auth-users:", response.status, payload);
            toast.error(
              payload.hint
                ? `${payload.error || "Nie udało się pobrać kont Auth"}\n\n${payload.hint}`
                : payload.error || "Nie udało się pobrać kont z Firebase Authentication — widoczni są tylko użytkownicy z Firestore.",
              { duration: 12_000 },
            );
          }
        } catch (error) {
          console.error("Błąd pobierania użytkowników Auth:", error);
          toast.error("Nie udało się pobrać kont Google — widoczni są tylko użytkownicy z Firestore.");
        }
      }

      const mergedUsers = mergeFirestoreUsersWithAuthUsers(firestoreUsers, authUsers);
      setUsers(mergedUsers);
      setAuthOnlyCount(mergedUsers.filter((user) => !user.hasFirestoreProfile).length);
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
      const teamsData = await getTeamsArray({ includeInactive: true });
      setTeams(teamsData);
      
    } catch (error) {
      console.error("Błąd podczas pobierania zespołów:", error);
      toast.error("Błąd podczas pobierania listy zespołów");
    }
  };

  const fetchPlayersData = async () => {
    if (!currentUserIsAdmin) return;

    setIsLoadingPlayers(true);
    try {
      const db = getDB();
      const playersCollection = collection(db, "players");
      const playersSnapshot = await getDocs(playersCollection);
      const playersData: Player[] = [];

      playersSnapshot.forEach(playerDoc => {
        playersData.push({ id: playerDoc.id, ...(playerDoc.data() as Omit<Player, "id">) });
      });

      setPlayers(playersData);
    } catch (error) {
      console.error("Błąd podczas pobierania zawodników:", error);
      toast.error("Błąd podczas pobierania listy zawodników");
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  // Aktualizuj uprawnienia użytkownika do zespołów
  const updateUserTeams = async (userId: string, newTeams: string[]) => {
    try {
      await saveUserProfile(userId, { allowedTeams: newTeams });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, allowedTeams: newTeams, hasFirestoreProfile: true }
            : user,
        ),
      );

      toast.success("Zaktualizowano uprawnienia użytkownika");
    } catch (error: unknown) {
      console.error("Błąd podczas aktualizacji uprawnień:", error);
      const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : "";
      const message =
        code === "permission-denied"
          ? "Brak uprawnień Firebase (permission-denied). Sprawdź, czy konto ma rolę admin w dokumentie users, i wdróż zaktualizowane firestore.rules."
          : "Błąd podczas aktualizacji uprawnień";
      toast.error(message);
    }
  };

  // Zmiana roli użytkownika (wyjście z zawodnika czyści status pending)
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const patch = buildRoleChangePatch(newRole);
      await saveUserProfile(userId, patch);

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                ...patch,
                hasFirestoreProfile: true,
              }
            : user,
        ),
      );

      const roleLabel = USER_ROLE_OPTIONS.find((option) => option.value === newRole)?.label ?? newRole;
      toast.success(`Zmieniono rolę użytkownika na ${roleLabel}`);
    } catch (error) {
      console.error("Błąd podczas zmiany roli:", error);
      toast.error("Błąd podczas zmiany roli");
    }
  };

  /** Oczekujące konto zawodnika → analityk / operator / trener / admin (bez przypisywania gracza). */
  const handleConvertPendingToStaffRole = async (user: UserWithAuthMeta, newRole: UserRole) => {
    if (newRole === "player") {
      toast.error("Wybierz rolę inną niż zawodnik");
      return;
    }

    setConvertingRoleUserId(user.id);
    try {
      const patch = buildRoleChangePatch(newRole);
      await saveUserProfile(user.id, patch);

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                ...patch,
                hasFirestoreProfile: true,
              }
            : item,
        ),
      );

      setPendingStaffRoleByUser((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      setSelectedPlayerByUser((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });

      const roleLabel = USER_ROLE_OPTIONS.find((option) => option.value === newRole)?.label ?? newRole;
      toast.success(`Konto ustawione jako ${roleLabel} (bez przypisania zawodnika)`);
    } catch (error) {
      console.error("Błąd podczas zmiany roli oczekującego konta:", error);
      toast.error("Błąd podczas zmiany roli konta");
    } finally {
      setConvertingRoleUserId(null);
    }
  };

  // Usuń użytkownika (Auth + Firestore przez Admin SDK — bez deleteDoc z klienta, omija permission-denied)
  const deleteUser = async (userId: string, userEmail: string, confirmMessage?: string) => {
    const defaultMsg = `Czy na pewno chcesz usunąć użytkownika ${userEmail}? To usunie konto w Firebase Authentication oraz dokument w Firestore.`;
    if (!window.confirm(confirmMessage ?? defaultMsg)) {
      return;
    }

    try {
      const auth = getAuth();
      const current = auth.currentUser;
      if (!current) {
        toast.error("Brak aktywnej sesji — zaloguj się ponownie.");
        return;
      }
      if (current.uid === userId) {
        toast.error("Nie możesz usunąć własnego konta z tego panelu.");
        return;
      }

      let idToken: string;
      try {
        idToken = await current.getIdToken();
      } catch (e) {
        console.error("getIdToken:", e);
        toast.error("Nie udało się pobrać tokenu sesji.");
        return;
      }

      const response = await fetch("/api/delete-user-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: userId }),
      });

      let payload: { error?: string; message?: string; hint?: string } = {};
      try {
        payload = await response.json();
      } catch {
        /* body nie-JSON */
      }

      if (!response.ok) {
        console.error("delete-user-auth:", response.status, payload);
        const main = payload.error || `Błąd usuwania (${response.status})`;
        toast.error(payload.hint ? `${main}\n\n${payload.hint}` : main, { duration: 20_000 });
        return;
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));
      toast.success(payload.message || "Użytkownik został usunięty");
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
  const openEditUserModal = (user: UserWithAuthMeta) => {
    setEditingUserId(user.id);
    setEditUserEmail(user.email);
    setEditUserRole(user.role);
    setEditUserTeams([...normalizeAllowedTeams(user.allowedTeams)]);
    setNewPassword("");
    setShowEditUserModal(true);
  };

  // Aktualizuj dane użytkownika
  const updateUser = async () => {
    if (!editingUserId || !editUserEmail) {
      toast.error("Email jest wymagany");
      return;
    }

    const trimmedPassword = newPassword.trim();
    if (trimmedPassword.length > 0 && trimmedPassword.length < 6) {
      toast.error("Hasło musi mieć co najmniej 6 znaków albo pozostaw pole puste");
      return;
    }

    setIsUpdatingUser(true);
    try {
      const rolePatch = buildRoleChangePatch(editUserRole);
      const updateData: Partial<UserData> = {
        email: editUserEmail,
        ...rolePatch,
        allowedTeams: editUserTeams,
      };

      await saveUserProfile(editingUserId, updateData);

      let passwordFailed = false;
      if (trimmedPassword.length >= 6) {
        const auth = getAuth();
        const current = auth.currentUser;
        if (!current) {
          toast.error("Brak aktywnej sesji — zaloguj się ponownie.");
          passwordFailed = true;
        } else {
          let idToken: string;
          try {
            idToken = await current.getIdToken();
          } catch (e) {
            console.error("getIdToken:", e);
            toast.error("Nie udało się pobrać tokenu sesji.");
            passwordFailed = true;
          }
          if (!passwordFailed) {
            const response = await fetch("/api/admin-set-user-password", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken!}`,
              },
              body: JSON.stringify({ uid: editingUserId, newPassword: trimmedPassword }),
            });
            let payload: { error?: string; hint?: string; message?: string } = {};
            try {
              payload = await response.json();
            } catch {
              /* body nie-JSON */
            }
            if (!response.ok) {
              console.error("admin-set-user-password:", response.status, payload);
              const main = payload.error || `Błąd ustawiania hasła (${response.status})`;
              toast.error(
                payload.hint ? `${main}\n\n${payload.hint}` : `${main}\n\nProfil w Firestore został zapisany — możesz spróbować ponownie lub użyć „Reset hasła”.`,
                { duration: 12_000 }
              );
              passwordFailed = true;
            }
          }
        }
      }

      // Aktualizuj lokalny stan (Firestore już zapisany)
      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUserId
            ? {
                ...user,
                email: editUserEmail,
                ...rolePatch,
                allowedTeams: editUserTeams,
                hasFirestoreProfile: true,
              }
            : user,
        ),
      );

      if (passwordFailed) {
        return;
      }

      // Zamknij modal i resetuj stan
      setShowEditUserModal(false);
      setEditingUserId(null);
      setEditUserEmail("");
      setEditUserRole('user');
      setEditUserTeams([]);
      setNewPassword("");

      toast.success(
        trimmedPassword.length >= 6
          ? "Użytkownik został zaktualizowany. Nowe hasło działa przy logowaniu."
          : "Użytkownik został zaktualizowany"
      );
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

  const pendingUsers = useMemo(() => {
    return users.filter(user => user.role === 'player' && user.status === 'pending');
  }, [users]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) =>
      getPlayerFullName(a).localeCompare(getPlayerFullName(b), "pl", { sensitivity: "base" })
    );
  }, [players]);

  const filterPlayersBySearch = (list: Player[], query: string): Player[] => {
    const q = (query || "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (!q) return list;
    return list.filter((p) => {
      const name = (getPlayerFullName(p) + " " + (p.birthYear ?? "")).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      return name.includes(q);
    });
  };

  const resolvePlayerTeams = (player: Player): string[] => {
    if (!player?.teams) {
      return [];
    }
    if (Array.isArray(player.teams)) {
      return player.teams.filter(Boolean);
    }
    return [player.teams].filter(Boolean);
  };

  const handleApprovePlayerAccount = async (user: UserWithAuthMeta, playerId: string) => {
    const selectedPlayer = players.find(player => player.id === playerId);
    if (!selectedPlayer) {
      toast.error("Nie znaleziono wybranego zawodnika");
      return;
    }

    const existingLink = users.find(existingUser =>
      existingUser.id !== user.id &&
      existingUser.role === 'player' &&
      existingUser.linkedPlayerId === playerId
    );

    if (existingLink) {
      toast.error("Ten zawodnik jest już przypisany do innego konta");
      return;
    }

    try {
      const allowedTeams = resolvePlayerTeams(selectedPlayer);

      await saveUserProfile(user.id, {
        role: "player",
        status: "approved",
        linkedPlayerId: playerId,
        allowedTeams,
      });

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                role: "player",
                status: "approved",
                linkedPlayerId: playerId,
                allowedTeams,
                hasFirestoreProfile: true,
              }
            : item,
        ),
      );

      setSelectedPlayerByUser(prev => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });

      toast.success("Konto zawodnika zostało zatwierdzone");
    } catch (error) {
      console.error("Błąd podczas zatwierdzania konta zawodnika:", error);
      toast.error("Błąd podczas zatwierdzania konta zawodnika");
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
        lastLogin: null as any,
        ...(newUserRole === 'player'
          ? { status: 'pending', linkedPlayerId: null }
          : {})
      };

      await setDoc(userRef, newUserData).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      // Wyloguj nowego użytkownika
      await signOut(auth);

      // Dodaj do lokalnego stanu
      setUsers((prev) => [
        ...prev,
        {
          id: newUserId,
          ...newUserData,
          hasFirestoreProfile: true,
          authProviders: ["password"],
        },
      ]);

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
    fetchPlayersData();
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
    <div>
      <div style={{ marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => {
            void fetchUsers();
            void fetchTeamsData();
            void fetchPlayersData();
          }}
          disabled={isLoading}
          style={{
            padding: "8px 12px",
            backgroundColor: "#4a90e2",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
          }}
        >
          {isLoading ? "Ładowanie..." : "Odśwież"}
        </button>
        <button
          type="button"
          onClick={() => setShowAddUserModal(true)}
          disabled={isLoading || isCreatingUser}
          style={{
            padding: "8px 12px",
            backgroundColor: "#17a2b8",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: (isLoading || isCreatingUser) ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
          }}
        >
          + Dodaj użytkownika
        </button>
        <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
          {users.length} użytkowników
          {authOnlyCount > 0 ? ` · ${authOnlyCount} tylko Auth` : ""}
          {teams.length > 0 ? ` · ${teams.length} zespołów` : ""}
        </span>
      </div>

      {pendingUsers.length > 0 && (
        <div style={{ marginBottom: "16px", padding: "16px", backgroundColor: "#fefce8", borderRadius: "10px", border: "1px solid #facc15" }}>
          <h4 style={{ marginTop: 0, marginBottom: "4px", fontSize: "1rem", color: "#854d0e" }}>
            Oczekujące konta ({pendingUsers.length})
          </h4>
          <p style={{ marginTop: 0, marginBottom: "14px", fontSize: "0.8125rem", color: "#78716c" }}>
            Przypisz profil zawodnika albo zmień rolę na analityka / operatora (np. konto Google, które nie powinno być zawodnikiem).
          </p>
          {isLoadingPlayers && (
            <p style={{ marginTop: "6px", color: "#6c757d", fontSize: "0.8125rem" }}>Ładowanie listy zawodników...</p>
          )}
          {pendingUsers.map(user => {
            const registration = user.registrationData;
            const suggestions = registration ? getPlayerMatchSuggestions(sortedPlayers, registration) : [];
            const selectedPlayerId = selectedPlayerByUser[user.id] || "";
            const searchQuery = (playerSearchByUser[user.id] || "").trim();
            const filteredForSelect = filterPlayersBySearch(sortedPlayers, searchQuery);
            const staffRole = pendingStaffRoleByUser[user.id] ?? "user";
            const isConverting = convertingRoleUserId === user.id;

            return (
              <div
                key={user.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: "10px",
                  padding: "14px",
                  border: "1px solid #fde047",
                  marginBottom: "12px",
                }}
              >
                <div style={{ marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid #fef3c7" }}>
                  <strong style={{ fontSize: "0.95rem" }}>{user.email}</strong>
                  {registration ? (
                    <div style={{ fontSize: "0.85rem", color: "#57534e", marginTop: "4px" }}>
                      <span style={{ fontWeight: 600 }}>Dane rejestracyjne:</span> {registration.firstName} {registration.lastName}
                      {registration.birthYear ? `, ur. ${registration.birthYear}` : ""}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: "#78716c" }}>Brak danych rejestracyjnych</div>
                  )}
                </div>

                <div
                  style={{
                    marginBottom: "14px",
                    padding: "12px",
                    backgroundColor: "#f0f9ff",
                    borderRadius: "8px",
                    border: "1px solid #bae6fd",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "8px", fontSize: "0.875rem", color: "#0c4a6e" }}>
                    Zmień rolę konta (bez przypisania zawodnika)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
                      <span style={{ fontWeight: 500 }}>Rola:</span>
                      <select
                        value={staffRole}
                        onChange={(e) =>
                          setPendingStaffRoleByUser((prev) => ({
                            ...prev,
                            [user.id]: e.target.value as UserRole,
                          }))
                        }
                        disabled={isConverting}
                        aria-label={`Nowa rola dla ${user.email}`}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #7dd3fc",
                          fontSize: "0.85rem",
                          backgroundColor: "white",
                        }}
                      >
                        {STAFF_ROLE_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleConvertPendingToStaffRole(user, staffRole)}
                      disabled={isConverting}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: isConverting ? "#d1d5db" : "#0369a1",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: isConverting ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      {isConverting ? "Zapisywanie..." : "Ustaw rolę"}
                    </button>
                  </div>
                </div>

                {suggestions.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontWeight: 600, marginBottom: "6px", fontSize: "0.85rem", color: "#374151" }}>
                      Sugestie dopasowania zawodnika:
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {suggestions.map(player => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => setSelectedPlayerByUser(prev => ({ ...prev, [user.id]: player.id }))}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: selectedPlayerId === player.id ? "2px solid #16a34a" : "1px solid #e5e7eb",
                            backgroundColor: selectedPlayerId === player.id ? "#dcfce7" : "#f9fafb",
                            cursor: "pointer",
                            fontSize: "0.8125rem",
                            fontWeight: selectedPlayerId === player.id ? 600 : 400
                          }}
                        >
                          {getPlayerFullName(player)}{player.birthYear ? ` (${player.birthYear})` : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "6px", fontSize: "0.85rem" }}>
                    Albo przypisz zawodnika
                  </label>
                  <input
                    type="text"
                    placeholder="Imię, nazwisko lub rok urodzenia..."
                    value={playerSearchByUser[user.id] || ""}
                    onChange={(e) => setPlayerSearchByUser(prev => ({ ...prev, [user.id]: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "0.85rem",
                      marginBottom: "8px",
                      boxSizing: "border-box"
                    }}
                  />
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerByUser(prev => ({ ...prev, [user.id]: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "0.85rem",
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="">{filteredForSelect.length === 0 && searchQuery ? "Brak wyników" : "Wybierz z listy..."}</option>
                    {filteredForSelect.map(player => (
                      <option key={player.id} value={player.id}>
                        {getPlayerFullName(player)}{player.birthYear ? ` (${player.birthYear})` : ""}{player.position ? ` · ${player.position}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => handleApprovePlayerAccount(user, selectedPlayerId)}
                    disabled={!selectedPlayerId || isLoadingPlayers || isConverting}
                    style={{
                      padding: "8px 14px",
                      backgroundColor: (!selectedPlayerId || isLoadingPlayers || isConverting) ? "#d1d5db" : "#16a34a",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: (!selectedPlayerId || isLoadingPlayers || isConverting) ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    Przypisz i zatwierdź
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      deleteUser(
                        user.id,
                        user.email,
                        `Odrzucić rejestrację i trwale usunąć konto ${user.email}? Operacja jest nieodwracalna (Firestore + Authentication).`
                      )
                    }
                    disabled={isLoadingPlayers || isConverting}
                    style={{
                      padding: "8px 14px",
                      backgroundColor: (isLoadingPlayers || isConverting) ? "#d1d5db" : "#b91c1c",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: (isLoadingPlayers || isConverting) ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                    title="Odrzuca rejestrację i usuwa konto z Firestore oraz Firebase Authentication"
                  >
                    Odrzuć i usuń
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {users.length === 0 ? (
        <p>Brak użytkowników do wyświetlenia.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            backgroundColor: "white",
            borderRadius: "8px",
            overflow: "hidden",
            tableLayout: "fixed"
          }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "left", fontSize: "0.8rem", width: "220px" }}>Email / logowanie</th>
                <th style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "left", fontSize: "0.8rem", width: "96px" }}>
                  <button
                    type="button"
                    onClick={() => setSortByRole(prev => prev === null ? 'asc' : prev === 'asc' ? 'desc' : null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: 0,
                      border: "none",
                      background: "none",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      color: "inherit",
                      fontWeight: "inherit"
                    }}
                    title={sortByRole === null ? "Sortuj według roli" : sortByRole === 'asc' ? "Sortuj malejąco (kliknij aby wyłączyć)" : "Wyłącz sortowanie"}
                    aria-sort={sortByRole === null ? undefined : sortByRole === 'asc' ? 'ascending' : 'descending'}
                  >
                    Rola
                    {sortByRole === 'asc' && " ↑"}
                    {sortByRole === 'desc' && " ↓"}
                  </button>
                </th>
                <th style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "left", fontSize: "0.8rem", width: "180px" }}>Dostępne zespoły</th>
                <th style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "left", fontSize: "0.8rem", width: "120px" }}>Ostatnie logowanie</th>
                <th style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "left", fontSize: "0.8rem", width: "240px" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map(user => {
                const canResetPassword =
                  authUserHasPasswordProvider(user.authProviders) ||
                  (user.hasFirestoreProfile && user.authProviders.length === 0);

                return (
                <tr key={user.id}>
                  <td style={{ padding: "6px 8px", border: "1px solid #ddd", fontSize: "0.85rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                      <span
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={user.email || ""}
                      >
                        {user.email || "Brak emaila"}
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {user.authProviders.length > 0 && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: "999px",
                              backgroundColor: "#e8f5e9",
                              color: "#2e7d32",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                            title={`Dostawcy logowania: ${formatAuthProviderLabels(user.authProviders)}`}
                          >
                            {formatAuthProviderLabels(user.authProviders)}
                          </span>
                        )}
                        {!user.hasFirestoreProfile && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: "999px",
                              backgroundColor: "#fff3cd",
                              color: "#856404",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                            title="Konto istnieje w Firebase Authentication, ale nie ma jeszcze dokumentu users/{uid} w Firestore. Pierwsza edycja utworzy profil."
                          >
                            Brak profilu Firestore
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                      style={{
                        padding: "4px 6px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        width: "100%"
                      }}
                    >
                      {USER_ROLE_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #ddd", verticalAlign: "middle", position: "relative" }}>
                    <div style={{ position: "relative" }}>
                      <button
                        ref={(el) => {
                          if (openTeamsDropdownUserId === user.id) teamsDropdownButtonRef.current = el;
                        }}
                        type="button"
                        onClick={(e) => {
                          const btn = e.currentTarget;
                          if (openTeamsDropdownUserId === user.id) {
                            setOpenTeamsDropdownUserId(null);
                            setDropdownAnchorRect(null);
                            teamsDropdownButtonRef.current = null;
                          } else {
                            teamsDropdownButtonRef.current = btn;
                            setDropdownAnchorRect(btn.getBoundingClientRect());
                            setOpenTeamsDropdownUserId(user.id);
                          }
                        }}
                        aria-expanded={openTeamsDropdownUserId === user.id}
                        aria-haspopup="listbox"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          textAlign: "left",
                          backgroundColor: "white",
                          cursor: "pointer",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {user.allowedTeams.length === 0
                          ? "Wybierz zespoły"
                          : user.allowedTeams.length <= 2
                            ? teams.filter(t => user.allowedTeams.includes(t.id)).map(t => t.name).join(", ")
                            : `${user.allowedTeams.length} zespołów`}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                    {formatLastLoginPl(user.lastLogin)}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => openEditUserModal(user)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#17a2b8",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.75rem"
                        }}
                      >
                        Edytuj
                      </button>
                      <button
                        onClick={() => sendPasswordReset(user.email)}
                        disabled={!canResetPassword}
                        title={
                          canResetPassword
                            ? "Wyślij email resetujący hasło"
                            : "Konto loguje się przez Google — brak hasła do resetu"
                        }
                        style={{
                          padding: "4px 8px",
                          backgroundColor: canResetPassword ? "#ffc107" : "#e9ecef",
                          color: canResetPassword ? "#212529" : "#6c757d",
                          border: "none",
                          borderRadius: "4px",
                          cursor: canResetPassword ? "pointer" : "not-allowed",
                          fontSize: "0.75rem"
                        }}
                      >
                        Reset hasła
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#e74c3c",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.75rem"
                        }}
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Portal: lista zespołów (poza overflow, żeby nie była przycinana) */}
      {typeof document !== "undefined" &&
        openTeamsDropdownUserId &&
        dropdownAnchorRect &&
        (() => {
          const openUser = users.find((u) => u.id === openTeamsDropdownUserId);
          if (!openUser) return null;
          return createPortal(
            <div
              ref={teamsDropdownRef}
              role="listbox"
              aria-multiselectable
              aria-label="Dostępne zespoły"
              style={{
                position: "fixed",
                top: dropdownAnchorRect.bottom + 2,
                left: dropdownAnchorRect.left,
                width: dropdownAnchorRect.width,
                maxHeight: "200px",
                overflowY: "auto",
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "4px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 10050,
                padding: "4px"
              }}
            >
              {teams.map((team) => (
                <label
                  key={team.id}
                  role="option"
                  aria-selected={openUser.allowedTeams.includes(team.id)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 6px", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  <input
                    type="checkbox"
                    checked={openUser.allowedTeams.includes(team.id)}
                    onChange={() => handleTeamToggle(openUser.id, team.id, openUser.allowedTeams)}
                  />
                  <span>{team.name}</span>
                </label>
              ))}
            </div>,
            document.body
          );
        })()}

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
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isCreatingUser}
              >
                {USER_ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
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
                Hasło ustawia serwer (Firebase Admin SDK — jak przy usuwaniu konta). Przy błędzie konfiguracji użyj „Reset hasła”.
              </p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Rola:
              </label>
              <select
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
                disabled={isUpdatingUser}
              >
                {USER_ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
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

    </div>
  );
};

export default UserManagement; 