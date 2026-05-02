import { FirebaseError } from "firebase/app";

/**
 * Komunikaty błędów logowania/rejestracji dla UI (email + Google).
 * Firestore i walidacja formularza zwracają zwykły Error — wtedy używamy message.
 */
export function authLoginErrorMessage(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : null;

  if (!code && err instanceof Error) {
    return err.message;
  }

  if (code === "auth/user-not-found") {
    return "Nie znaleziono użytkownika o tym adresie email";
  }
  if (code === "auth/wrong-password") {
    return "Nieprawidłowe hasło";
  }
  if (code === "auth/invalid-email") {
    return "Nieprawidłowy format adresu email";
  }
  if (code === "auth/email-already-in-use") {
    return "Konto z tym adresem email już istnieje";
  }
  if (code === "auth/weak-password") {
    return "Hasło jest zbyt słabe. Użyj co najmniej 6 znaków";
  }
  if (code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
    return "Nieprawidłowy e-mail lub hasło. Konto zakładane lub używane przez Google otwierasz przyciskiem „Kontynuuj z Google” — hasło z poniższego pola zadziała dopiero po powiązaniu kont (albo gdy od początku rejestrujesz się e-mailem i hasłem).";
  }
  if (code === "auth/too-many-requests") {
    return "Zbyt wiele prób logowania. Spróbuj ponownie później";
  }
  if (code === "auth/operation-not-allowed") {
    return "Ten sposób logowania jest wyłączony w Firebase (Authentication → Sign-in method).";
  }
  if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid.-please-pass-a-valid-api-key.") {
    return "Nieprawidłowy klucz API Firebase — sprawdź .env.local (NEXT_PUBLIC_FIREBASE_*).";
  }
  if (code === "auth/app-not-authorized") {
    return "Domena nieautoryzowana — dodaj ją w Firebase → Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/configuration-not-found") {
    return "Błąd konfiguracji Auth — sprawdź zmienne NEXT_PUBLIC_FIREBASE_* i projekt w konsoli Firebase.";
  }
  if (code === "auth/user-disabled") {
    return "To konto zostało wyłączone. Skontaktuj się z administratorem.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Okno logowania zostało zamknięte. Spróbuj ponownie.";
  }
  if (code === "auth/popup-blocked") {
    return "Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna dla tej witryny.";
  }
  if (code === "auth/cancelled-popup-request") {
    return "Logowanie zostało przerwane. Spróbuj ponownie.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "Ten adres ma już konto z hasłem. Kliknij „Kontynuuj z Google”, a potem wpisz hasło w formularzu powiązania kont.";
  }
  if (code === "auth/provider-already-linked") {
    return "Google jest już powiązane z tym kontem — możesz się logować przez Google lub e-mail.";
  }
  if (code === "auth/credential-already-in-use") {
    return "Te dane logowania są już użyte przez inne konto.";
  }
  if (code === "auth/network-request-failed") {
    return "Błąd sieci. Sprawdź połączenie i spróbuj ponownie.";
  }
  if (code === "auth/requires-recent-login") {
    return "Wymagane ponowne logowanie: wyloguj się, zaloguj ponownie przez Google i spróbuj ustawić hasło jeszcze raz.";
  }
  if (typeof code === "string" && code.startsWith("auth/")) {
    return `Błąd logowania (${code}). Szczegóły w konsoli przeglądarki.`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Wystąpił błąd podczas logowania";
}
