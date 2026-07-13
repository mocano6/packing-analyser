import assert from "node:assert/strict";
import {
  getOurSquadLabelForPackingModal,
  getOpponentLabelForPackingModal,
  looksLikeOpaqueTeamToken,
  resolveMatchOpponentDisplayName,
  shortTeamDisplayLabel,
} from "./matchInfoPackingLabels";
import type { TeamInfo } from "@/types";

assert.equal(looksLikeOpaqueTeamToken("3XQSaCCRndPO4JdKoU3b"), true);
assert.equal(looksLikeOpaqueTeamToken("Polonia"), false);

const base: TeamInfo = {
  team: "x",
  opponent: "y",
  isHome: true,
  competition: "c",
  date: "d",
  time: "t",
} as TeamInfo;

assert.equal(
  getOurSquadLabelForPackingModal(
    { ...base, team: "3XQSaCCRndPO4JdKoU3b" } as TeamInfo,
    [{ id: "3XQSaCCRndPO4JdKoU3b", name: "Widzew" }],
  ),
  "Widzew",
);

assert.equal(
  getOurSquadLabelForPackingModal(
    { ...base, team: "3XQSaCCRndPO4JdKoU3b", teamName: "Zespół test" } as TeamInfo,
    [],
  ),
  "Zespół test",
);

assert.equal(
  getOurSquadLabelForPackingModal({ ...base, team: "3XQSaCCRndPO4JdKoU3b" } as TeamInfo, []),
  null,
);

assert.equal(
  getOpponentLabelForPackingModal({ ...base, opponent: "Irlandia U18" } as TeamInfo),
  "Irlandia U18",
);

assert.equal(
  getOpponentLabelForPackingModal(
    { ...base, opponent: "3XQSaCCRndPO4JdKoU3b", opponentName: "OK" } as TeamInfo,
  ),
  "OK",
);

assert.equal(
  getOpponentLabelForPackingModal(
    { ...base, opponent: "3XQSaCCRndPO4JdKoU3b" } as TeamInfo,
    [{ id: "3XQSaCCRndPO4JdKoU3b", name: "Górnik" }],
  ),
  "Górnik",
);

assert.equal(shortTeamDisplayLabel("Chrobry Głogów U19"), "U19");
assert.equal(
  resolveMatchOpponentDisplayName(
    { ...base, team: "my-team", opponent: "opp-id", opponentName: "Raków U19" } as TeamInfo,
    "my-team",
    [{ id: "opp-id", name: "Raków Częstochowa U19" }],
  ),
  "Raków Częstochowa U19",
);

console.log("matchInfoPackingLabels tests: OK");
