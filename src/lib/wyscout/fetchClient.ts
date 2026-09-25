import { getAuthClient } from "@/lib/firebase";

export async function wyscoutFetchJson<T>(path: string): Promise<T> {
  const user = getAuthClient().currentUser;
  if (!user) {
    throw new Error("Musisz być zalogowany, aby pobrać dane Wyscout.");
  }
  const token = await user.getIdToken();
  const res = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Błąd API Wyscout (${res.status}).`);
  }
  return data as T;
}
