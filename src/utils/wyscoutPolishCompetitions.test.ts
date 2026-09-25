import assert from "assert";
import {
  filterTeamsByQuery,
  isPolishIiiLigaCompetition,
  isPolishIiiLigaName,
  normalizeWyscoutAreas,
  normalizeWyscoutCompetitions,
  normalizeWyscoutSeasons,
  pickDefaultPolishCompetition,
  preferredAreaCodes,
  sortPolishCompetitions,
} from "./wyscoutPolishCompetitions";

assert.equal(isPolishIiiLigaName("III Liga"), true);
assert.equal(isPolishIiiLigaName("III Liga Group 1"), true);
assert.equal(isPolishIiiLigaName("3. Liga"), true);
assert.equal(isPolishIiiLigaName("II Liga"), false);
assert.equal(isPolishIiiLigaName("Ekstraklasa"), false);
assert.equal(isPolishIiiLigaName("I Liga"), false);

assert.equal(
  isPolishIiiLigaCompetition({
    wyId: 1,
    name: "Poland 4",
    format: "Domestic league",
    category: "default",
    gender: "male",
    divisionLevel: 4,
    area: { alpha3code: "POL" },
  }),
  true,
);

const comps = sortPolishCompetitions(
  normalizeWyscoutCompetitions({
    competitions: [
      { wyId: 10, name: "Ekstraklasa", divisionLevel: 1 },
      { wyId: 20, name: "III Liga Group 2", divisionLevel: 4 },
      { wyId: 21, name: "III Liga Group 1", divisionLevel: 4 },
    ],
  }),
);
assert.equal(comps[0]?.name, "III Liga Group 1");
assert.equal(pickDefaultPolishCompetition(comps)?.wyId, 21);

const seasons = normalizeWyscoutSeasons({
  seasons: [
    { seasonId: 2, season: { wyId: 2, name: "2024/2025", startDate: "2024-07-01", active: false } },
    { season: { wyId: 3, name: "2025/2026", startDate: "2025-07-01", active: true } },
  ],
});
assert.equal(seasons[0]?.wyId, 3);

assert.equal(filterTeamsByQuery([{ wyId: 1, name: "Świt NDM" }, { wyId: 2, name: "Lech" }], "swit").length, 1);

assert.deepEqual(
  preferredAreaCodes(normalizeWyscoutAreas([{ alpha3code: "ITA", name: "Italy" }, { alpha3code: "POL" }])),
  ["POL", "ITA"],
);

console.log("wyscoutPolishCompetitions.test.ts: OK");
