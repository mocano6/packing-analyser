/**
 * Wynik fetchSignInMethodsForEmail (Firebase), np. ['password'], ['google.com'].
 * Jeśli wyłącznie Google — logowanie e-mail/hasło nie jest skonfigurowane.
 */
export function passwordLoginBlockedByGoogleOnlyProvider(methods: string[]): string | null {
  const hasGoogle = methods.includes("google.com");
  const hasPassword = methods.includes("password");
  if (hasGoogle && !hasPassword) {
    return "To konto powstało przez Google i nie ma hasła do logowania e-mail. Użyj przycisku „Kontynuuj z Google”.";
  }
  return null;
}
