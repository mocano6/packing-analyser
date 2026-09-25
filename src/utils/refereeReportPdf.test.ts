import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PdfTextItem } from "./pdfTextItems";
import { mergeAdjacentPdfItems } from "./pdfTextItems";
import {
  attachKnownLnpIds,
  buildRefereeReportMatchId,
  parseRefereeReport,
  pickRefereeReportSide,
  refereeReportToCachedMatch,
} from "./refereeReportPdf";

const fixturePath = join(__dirname, "fixtures", "refereeReportSample.items.json");
const items = JSON.parse(readFileSync(fixturePath, "utf8")) as PdfTextItem[];

const report = parseRefereeReport(items);

assert.equal(report.hostName, "KS Orły Klembów");
assert.equal(report.guestName, "Świt II Nowy Dwór Mazowiecki");
assert.equal(report.date, "2026-09-02");
assert.equal(report.kickoffTime, "18:00");
assert.equal(report.dateTime, "2026-09-02T18:00:00");
assert.equal(report.scoreFinal, "1:3");
assert.match(report.competition, /Puchar Polski/i);
assert.equal(report.extraTimePlayed, false);
assert.equal(report.matchEndMinute, 90);
assert.equal(report.addedTimeSecond, 1);

assert.equal(report.host.players.length, 15);
assert.equal(report.guest.players.length, 15);

const byNum = (side: "host" | "guest", n: number) => {
  const p = report[side].players.find((x) => x.number === n);
  assert.ok(p, `brak nr ${n} po stronie ${side}`);
  return p;
};

assert.equal(byNum("guest", 1).lastName, "WIAK");
assert.equal(byNum("guest", 1).isStarter, true);
assert.equal(byNum("guest", 1).minutesPlayed, 90);

assert.equal(byNum("guest", 2).lastName, "DUCZMAN");
assert.equal(byNum("guest", 2).minutesPlayed, 90);
assert.equal(byNum("guest", 2).subMinute, null);

assert.equal(byNum("guest", 6).lastName, "MIERZEJEWSKI");
assert.equal(byNum("guest", 6).subMinute, 55);
assert.equal(byNum("guest", 6).subPartnerNumber, 17);
assert.equal(byNum("guest", 6).minutesPlayed, 55);

assert.equal(byNum("guest", 10).lastName, "ZYSKA");
assert.equal(byNum("guest", 10).minutesPlayed, 63);

assert.equal(byNum("guest", 18).lastName, "Kucharczyk");
assert.equal(byNum("guest", 18).minutesPlayed, 90);

assert.equal(byNum("guest", 20).lastName, "Kunisz");
assert.equal(byNum("guest", 20).isStarter, true);
assert.equal(byNum("guest", 20).subMinute, 46);
assert.equal(byNum("guest", 20).subPartnerNumber, 77);
assert.equal(byNum("guest", 20).minutesPlayed, 46);

assert.equal(byNum("guest", 12).lastName, "CZAJKA");
assert.equal(byNum("guest", 12).isStarter, false);
assert.equal(byNum("guest", 12).minutesPlayed, 0);

assert.equal(byNum("guest", 13).lastName, "Utko");
assert.equal(byNum("guest", 13).isStarter, false);
assert.equal(byNum("guest", 13).subMinute, 63);
assert.equal(byNum("guest", 13).minutesPlayed, 27);

assert.equal(byNum("guest", 17).lastName, "FRYC");
assert.equal(byNum("guest", 17).minutesPlayed, 35);

assert.equal(byNum("guest", 77).lastName, "Dwojak");
assert.equal(byNum("guest", 77).subMinute, 46);
assert.equal(byNum("guest", 77).subPartnerNumber, 20);
assert.equal(byNum("guest", 77).minutesPlayed, 44);

assert.equal(byNum("host", 4).lastName, "Czerski");
assert.equal(byNum("host", 4).minutesPlayed, 78);
assert.equal(byNum("host", 4).subPartnerNumber, 35);

assert.equal(byNum("host", 15).minutesPlayed, 60);
assert.equal(byNum("host", 22).minutesPlayed, 46);
assert.equal(byNum("host", 84).lastName, "Przybysz");
assert.equal(byNum("host", 84).minutesPlayed, 46);
assert.equal(byNum("host", 84).subPartnerNumber, 7);

assert.equal(byNum("host", 7).lastName, "Rakowski");
assert.equal(byNum("host", 7).isStarter, false);
assert.equal(byNum("host", 7).minutesPlayed, 44);

assert.equal(byNum("host", 10).lastName, "BULA");
assert.equal(byNum("host", 10).minutesPlayed, 30);

assert.equal(byNum("host", 21).minutesPlayed, 44);
assert.equal(byNum("host", 35).lastName, "Sandomirski");
assert.equal(byNum("host", 35).minutesPlayed, 12);

assert.equal(pickRefereeReportSide(report, ["Świt Nowy Dwór Mazowiecki"]), "guest");
assert.equal(pickRefereeReportSide(report, ["KS Orły Klembów"]), "host");
assert.equal(pickRefereeReportSide(report, ["Inny Klub"]), "host");

const cached = refereeReportToCachedMatch(report, "guest", "2026-09-07T08:00:00.000Z");
assert.equal(
  cached.matchId,
  buildRefereeReportMatchId("2026-09-02", "KS Orły Klembów", "Świt II Nowy Dwór Mazowiecki")
);
assert.equal(cached.isHome, false);
assert.equal(cached.opponent, "KS Orły Klembów");
assert.equal(cached.scoreFinal, "1:3");
assert.equal(cached.hasSquad, true);
assert.equal(cached.players.some((p) => p.lastName === "CZAJKA"), false);
assert.equal(cached.players.find((p) => p.lastName === "DUCZMAN")?.minutesPlayed, 90);
assert.equal(cached.players.find((p) => p.lastName === "Dwojak")?.minutesPlayed, 44);

const withIds = attachKnownLnpIds(cached.players, [
  { lnpId: "lnp-2", firstName: "Dawid", lastName: "Duczman", number: 2, minutesPlayed: 90 },
]);
assert.equal(withIds.find((p) => p.lastName === "DUCZMAN")?.lnpId, "lnp-2");

const aliasId = attachKnownLnpIds(
  [{ lnpId: "", firstName: "MIKOŁAJ", lastName: "STEIGMANN", number: 9, minutesPlayed: 90 }],
  [{ lnpId: "p-pecz", firstName: "Mikołaj", lastName: "Pęczkowski", number: 9, minutesPlayed: 90 }]
);
assert.equal(aliasId[0].lnpId, "", "inne nazwisko — bez automatycznego scalenia");
assert.equal(aliasId[0].lastName, "STEIGMANN");

const splitName = mergeAdjacentPdfItems([
  { str: "DAWID", x: 56, y: 90, width: 30, height: 9, page: 3, pageWidth: 595, pageHeight: 842 },
  { str: "DUCZMAN", x: 88, y: 90, width: 45, height: 9, page: 3, pageWidth: 595, pageHeight: 842 },
  { str: "(Kpt.)", x: 136, y: 90, width: 28, height: 9, page: 3, pageWidth: 595, pageHeight: 842 },
  { str: "78'-", x: 225, y: 90, width: 13, height: 9, page: 3, pageWidth: 595, pageHeight: 842 },
  { str: "nr.", x: 240, y: 90, width: 9, height: 9, page: 3, pageWidth: 595, pageHeight: 842 },
  { str: "35", x: 252, y: 90, width: 9, height: 9, page: 3, pageWidth: 595, pageHeight: 842 },
]);
assert.equal(splitName[0].str, "DAWID DUCZMAN (Kpt.)");
assert.equal(splitName[1].str, "78'- nr. 35");

console.log("refereeReportPdf.test.ts: OK");
