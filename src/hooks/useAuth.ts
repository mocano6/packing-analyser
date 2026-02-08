import { useState, useEffect } from "react";
import { getDB } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import { AuthService, AuthState } from "@/utils/authService";
import { toast } from "react-hot-toast";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";

const USER_DATA_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min — pomijamy getDoc gdy świeży
const LAST_LOGIN_WRITE_INTERVAL_MS = 5 * 60 * 1000; // zapis lastLogin co najwyżej co 5 min

const userDataCache = new Map<string, { data: UserData; timestamp: number }>();
const lastLoginWriteAt = new Map<string, number>();

export type UserRole = 'user' | 'admin' | 'coach' | 'player';
export type UserStatus = 'pending' | 'approved';

export interface RegistrationData {
  firstName: string;
  lastName: string;
  birthYear?: number;
}

// Typ dla użytkownika z uprawnieniami do zespołów
export interface UserData {
  email: string;
  allowedTeams: string[];
  role: UserRole;
  status?: UserStatus;
  linkedPlayerId?: string | null;
  registrationData?: RegistrationData;
  createdAt: Date;
  lastLogin: Date | null;
}

interface UseAuthReturnType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  userTeams: string[];
  isAdmin: boolean;
  userRole: UserRole | null;
  userStatus: UserStatus | null;
  linkedPlayerId: string | null;
  isPlayer: boolean;
  logout: () => void;
  refreshUserData: () => Promise<void>;
}

export function useAuth(): UseAuthReturnType {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isAnonymous: false,
    error: null
  });
  const [userTeams, setUserTeams] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [linkedPlayerId, setLinkedPlayerId] = useState<string | null>(null);
  const [isUserDataLoading, setIsUserDataLoading] = useState<boolean>(false);

  const authService = AuthService.getInstance();

  // Pobiera dane użytkownika z Firestore na podstawie UID (z cache 2 min, lastLogin zapis co 5 min)
  const fetchUserData = async (uid: string, userEmail?: string, isUserAuthenticated: boolean = true, isMounted: () => boolean = () => true): Promise<UserData | null> => {
    if (!isUserAuthenticated) return null;

    const now = Date.now();
    const cached = userDataCache.get(uid);
    if (cached && now - cached.timestamp < USER_DATA_CACHE_TTL_MS) {
      const lastWrite = lastLoginWriteAt.get(uid) ?? 0;
      if (now - lastWrite >= LAST_LOGIN_WRITE_INTERVAL_MS) {
        lastLoginWriteAt.set(uid, now);
        const db = getDB();
        const userRef = doc(db, "users", uid);
        setDoc(userRef, { lastLogin: new Date() }, { merge: true }).catch(err => {
          handleFirestoreError(err, db);
          console.error("Błąd zapisu lastLogin:", err);
        });
      }
      return { ...cached.data, lastLogin: cached.data.lastLogin ?? new Date() };
    }

    try {
      const db = getDB();
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });

      if (!userDoc.exists()) {
        const newUserData: UserData = {
          email: userEmail || '',
          allowedTeams: [],
          role: 'user',
          createdAt: new Date(),
          lastLogin: new Date()
        };
        await setDoc(userRef, newUserData).catch(error => {
          handleFirestoreError(error, db);
          throw error;
        });
        userDataCache.set(uid, { data: newUserData, timestamp: now });
        lastLoginWriteAt.set(uid, now);
        return newUserData;
      }

      const userData = userDoc.data() as UserData;
      const needsEmailUpdate = !userData.email && userEmail;
      const updateData: any = { lastLogin: new Date() };
      if (needsEmailUpdate) updateData.email = userEmail;

      await setDoc(userRef, updateData, { merge: true }).catch(error => {
        handleFirestoreError(error, db);
        console.error('Błąd aktualizacji danych użytkownika:', error);
      });

      const result: UserData = {
        ...userData,
        email: userData.email || userEmail || '',
        lastLogin: new Date()
      };
      userDataCache.set(uid, { data: result, timestamp: now });
      lastLoginWriteAt.set(uid, now);
      return result;
    } catch (error) {
      console.error("Błąd podczas pobierania danych użytkownika:", error);
      if (isUserAuthenticated && isMounted()) {
        toast.error("Błąd podczas pobierania uprawnień użytkownika");
      }
      return null;
    }
  };

  // Odświeża dane użytkownika (pomija cache)
  const refreshUserData = async (): Promise<void> => {
    if (!authState.user?.uid || !authState.isAuthenticated) return;
    userDataCache.delete(authState.user.uid);
    lastLoginWriteAt.delete(authState.user.uid);

    setIsUserDataLoading(true);
    const userData = await fetchUserData(authState.user.uid, authState.user.email || undefined, authState.isAuthenticated, () => true);
    if (userData) {
      setUserTeams(userData.allowedTeams);
      setIsAdmin(userData.role === 'admin');
      setUserRole(userData.role);
      setUserStatus(userData.status ?? null);
      setLinkedPlayerId(userData.linkedPlayerId ?? null);
    }
    setIsUserDataLoading(false);
  };

  // Nasłuchuj na zmiany stanu uwierzytelniania
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = authService.subscribe(async (newAuthState) => {
      if (!isMounted) return;
      
      setAuthState(newAuthState);

      if (newAuthState.isAuthenticated && newAuthState.user && !newAuthState.isAnonymous) {
        // Pobierz dane użytkownika z Firestore
        if (isMounted) {
          setIsUserDataLoading(true);
          const userData = await fetchUserData(newAuthState.user.uid, newAuthState.user.email || undefined, newAuthState.isAuthenticated, () => isMounted);
          if (userData && isMounted) {
            setUserTeams(userData.allowedTeams);
            setIsAdmin(userData.role === 'admin');
            setUserRole(userData.role);
            setUserStatus(userData.status ?? null);
            setLinkedPlayerId(userData.linkedPlayerId ?? null);
          }
          if (isMounted) {
            setIsUserDataLoading(false);
          }
        }
      } else {
        // Wyczyść dane użytkownika przy wylogowaniu
        if (isMounted) {
          setUserTeams([]);
          setIsAdmin(false);
          setUserRole(null);
          setUserStatus(null);
          setLinkedPlayerId(null);
          setIsUserDataLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Funkcja wylogowania
  const logout = async () => {
    try {
      const uid = authState.user?.uid;
      if (uid) {
        userDataCache.delete(uid);
        lastLoginWriteAt.delete(uid);
      }
      // Wyczyść dane użytkownika od razu
      setUserTeams([]);
      setIsAdmin(false);
      setUserRole(null);
      setUserStatus(null);
      setLinkedPlayerId(null);
      setIsUserDataLoading(false);
      
      await authService.signOut();
    } catch (error) {
      console.error("Błąd podczas wylogowania:", error);
      toast.error("Błąd podczas wylogowania");
    }
  };

  // Kombinuj stan ładowania uwierzytelniania i danych użytkownika
  const isLoading = authState.isLoading || (authState.isAuthenticated && !authState.isAnonymous && isUserDataLoading);

  return {
    isAuthenticated: authState.isAuthenticated && !authState.isAnonymous,
    isLoading,
    user: authState.user,
    userTeams,
    isAdmin,
    userRole,
    userStatus,
    linkedPlayerId,
    isPlayer: userRole === 'player',
    logout,
    refreshUserData
  };
} 