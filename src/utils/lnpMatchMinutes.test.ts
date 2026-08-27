import assert from "node:assert/strict";
import type { Player, PlayerMinutes } from "../types";
import { parseLaczyMatchIdFromUrl, buildLaczyMatchPageUrl } from "./laczyTeamUrl";
import {
  applyLnpMinutesToRoster,
  extractLnpMatchMinutes,
  pickLnpMatchSquadSide,
  squadForSide,
} from "./lnpMatchMinutes";

const MATCH_URL =
  "https://www.laczynaspilka.pl/rozgrywki/mecz/2b77df3e-73c4-4961-bcd7-72b0e6174a1f?si=abc";

assert.equal(parseLaczyMatchIdFromUrl(MATCH_URL), "2b77df3e-73c4-4961-bcd7-72b0e6174a1f");
assert.equal(
  parseLaczyMatchIdFromUrl("2b77df3e-73c4-4961-bcd7-72b0e6174a1f"),
  "2b77df3e-73c4-4961-bcd7-72b0e6174a1f"
);
assert.equal(
  parseLaczyMatchIdFromUrl(
    "https://www.laczynaspilka.pl/rozgrywki/druzyna/4b125148-f622-4b9c-88f9-4a83fd8b7b3b"
  ),
  null
);
assert.equal(parseLaczyMatchIdFromUrl(""), null);
assert.ok(
  buildLaczyMatchPageUrl("2b77df3e-73c4-4961-bcd7-72b0e6174a1f").includes(
    "/mecz/2b77df3e-73c4-4961-bcd7-72b0e6174a1f"
  )
);

const events = {
  host: {
    name: "Zagłębie II Lubin",
    squad: [
      {
        id: "h1",
        firstname: "Jan",
        lastname: "Kowalski",
        number: 9,
        type: "Starter",
        substitutions: [{ type: "Out", minute: "70'" }],
      },
      {
        id: "h2",
        firstName: "Adam",
        lastName: "Nowak",
        number: 7,
        type: "Substitute",
        substitutions: [{ type: "In", minute: "70'" }],
      },
      { id: "h3", firstname: "Piotr", lastname: "Lis", number: 1, type: "Substitute" },
    ],
  },
  guest: {
    team: { name: "Widzew II Łódź" },
    squad: [
      {
        id: "g1",
        firstname: "Marek",
        lastname: "Bąk",
        number: 4,
        type: "Starter",
        cards: [{ type: "Red", minute: "30'" }],
      },
    ],
  },
};

const payload = extractLnpMatchMinutes(events, null, "2b77df3e-73c4-4961-bcd7-72b0e6174a1f");
assert.equal(payload.hostName, "Zagłębie II Lubin");
assert.equal(payload.guestName, "Widzew II Łódź");
assert.equal(payload.hostPlayers.length, 3);
assert.deepEqual(
  payload.hostPlayers.find((p) => p.lastName === "Kowalski"),
  {
    lnpId: "h1",
    firstName: "Jan",
    lastName: "Kowalski",
    number: 9,
    isStarter: true,
    startMinute: 0,
    endMinute: 70,
    minutesPlayed: 70,
  }
);
assert.equal(payload.hostPlayers.find((p) => p.lastName === "Nowak")?.startMinute, 70);
assert.equal(payload.hostPlayers.find((p) => p.lastName === "Nowak")?.endMinute, 90);
assert.equal(payload.hostPlayers.find((p) => p.lastName === "Lis")?.minutesPlayed, 0);
assert.equal(payload.guestPlayers[0].endMinute, 30);

const ourPlayers: Player[] = [
  {
    id: "local-jan",
    firstName: "Jan",
    lastName: "Kowalski",
    number: 9,
    position: "ST",
    teams: ["t1"],
  },
  {
    id: "local-adam",
    firstName: "Adam",
    lastName: "Nowak",
    number: 7,
    position: "AM",
    teams: ["t1"],
  },
];

assert.equal(
  pickLnpMatchSquadSide(payload, ourPlayers, { opponent: "Widzew II Łódź" }),
  "host"
);
assert.equal(
  pickLnpMatchSquadSide(payload, ourPlayers, { isHome: false, opponent: "Zagłębie II Lubin" }),
  "guest"
);
assert.equal(pickLnpMatchSquadSide(payload, ourPlayers), "host");

const roster: PlayerMinutes[] = [
  { playerId: "local-jan", startMinute: 0, endMinute: 0, position: "ST", status: "dostepny" },
  { playerId: "local-adam", startMinute: 0, endMinute: 0, position: "AM", status: "brak_powolania" },
  { playerId: "local-other", startMinute: 0, endMinute: 0, position: "CB", status: "dostepny" },
];

const applied = applyLnpMinutesToRoster(roster, ourPlayers, squadForSide(payload, "host"));
assert.equal(applied.matched, 2);
assert.deepEqual(applied.unmatchedLnpNames, ["Piotr Lis"]);
assert.equal(applied.next.find((p) => p.playerId === "local-jan")?.endMinute, 70);
assert.equal(applied.next.find((p) => p.playerId === "local-adam")?.startMinute, 70);
assert.equal(applied.next.find((p) => p.playerId === "local-adam")?.status, "dostepny");
assert.equal(applied.next.find((p) => p.playerId === "local-other")?.endMinute, 0);

const nested = extractLnpMatchMinutes(
  { data: { host: { squad: [{ player: { firstName: "Ewa", lastName: "Lis", type: "Starter" } }] }, guest: { squad: [] } } },
  { host: { name: "A" }, guest: { name: "B" } },
  "m1"
);
assert.equal(nested.hostPlayers[0].firstName, "Ewa");
assert.equal(nested.hostPlayers[0].endMinute, 90);

console.log("lnpMatchMinutes.test.ts: OK");
