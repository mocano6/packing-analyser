import { FirebaseError } from "firebase/app";
import { AuthCredential, GoogleAuthProvider } from "firebase/auth";

type CustomData = { email?: string };

function readAuthEmail(err: FirebaseError): string | null {
  const custom = (err as FirebaseError & { customData?: CustomData }).customData;
  const email = custom?.email;
  if (typeof email === "string" && email.trim() !== "") {
    return email.trim();
  }
  return null;
}

/**
 * Błąd po Google signInWithPopup, gdy ten e-mail ma już konto z hasłem.
 * Zwraca credential do linkWithCredential + e-mail (żeby pokazać użytkownikowi).
 */
export function readGoogleLinkDataFromAccountExistsError(
  err: unknown,
): { credential: AuthCredential; email: string } | null {
  if (!(err instanceof FirebaseError) || err.code !== "auth/account-exists-with-different-credential") {
    return null;
  }
  const credential = GoogleAuthProvider.credentialFromError(err);
  if (!credential) {
    return null;
  }
  const email = readAuthEmail(err);
  if (!email) {
    return null;
  }
  return { credential, email };
}
