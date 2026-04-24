import assert from "node:assert/strict";
import {
  getOurSquadLabelForPackingModal,
  getOpponentLabelForPackingModal,
  looksLikeOpaqueTeamToken,
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

console.log("matchInfoPackingLabels tests: OK");
