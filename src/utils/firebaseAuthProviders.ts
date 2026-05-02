import type { User } from "firebase/auth";

/** Czy konto ma dostawcę Email/hasło (providerId === "password"). */
export function userHasEmailPasswordProvider(user: User | null | undefined): boolean {
  if (!user?.providerData?.length) {
    return false;
  }
  return user.providerData.some((p) => p.providerId === "password");
}
