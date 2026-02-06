import { Player } from "../types";
import { getPlayerFirstName, getPlayerLastName } from "./playerUtils";

export interface RegistrationDataInput {
  firstName: string;
  lastName: string;
  birthYear?: number;
}

const normalizeValue = (value: string): string => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
};

const isNameCompatible = (candidate: string, expected: string): boolean => {
  const normalizedCandidate = normalizeValue(candidate);
  const normalizedExpected = normalizeValue(expected);
  if (!normalizedCandidate || !normalizedExpected) {
    return false;
  }
  return (
    normalizedCandidate === normalizedExpected ||
    normalizedCandidate.startsWith(normalizedExpected) ||
    normalizedExpected.startsWith(normalizedCandidate)
  );
};

export const getPlayerMatchSuggestions = (
  players: Player[],
  registrationData: RegistrationDataInput
): Player[] => {
  const { firstName, lastName, birthYear } = registrationData;

  const ranked = players
    .map((player) => {
      const playerFirstName = getPlayerFirstName(player);
      const playerLastName = getPlayerLastName(player);
      const firstNameMatch = isNameCompatible(playerFirstName, firstName);
      const lastNameMatch = isNameCompatible(playerLastName, lastName);
      const birthYearMatch = birthYear ? player.birthYear === birthYear : false;

      let score = 0;
      if (firstNameMatch) score += 2;
      if (lastNameMatch) score += 2;
      if (birthYearMatch) score += 1;

      return { player, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const nameA = getPlayerLastName(a.player) || getPlayerFirstName(a.player);
      const nameB = getPlayerLastName(b.player) || getPlayerFirstName(b.player);
      return String(nameA).localeCompare(String(nameB), "pl", { sensitivity: "base" });
    });

  return ranked.map((entry) => entry.player);
};
