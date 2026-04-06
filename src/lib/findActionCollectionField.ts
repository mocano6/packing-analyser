import type { TeamInfo, Action } from "@/types";
import type { MatchArrayFieldKey } from "@/lib/matchArrayFieldWrite";

const ACTION_ARRAY_KEYS: MatchArrayFieldKey[] = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
];

/**
 * Zwraca pole dokumentu meczu, w którym występuje akcja o danym id (dokładnie jedna tablica).
 */
export function findActionCollectionFieldInMatchData(
  data: TeamInfo,
  actionId: string
): MatchArrayFieldKey | null {
  for (const k of ACTION_ARRAY_KEYS) {
    const arr = (data[k] as Action[] | undefined) || [];
    if (arr.some((a) => a.id === actionId)) {
      return k;
    }
  }
  return null;
}
