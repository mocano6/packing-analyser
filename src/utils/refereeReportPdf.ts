import { computePlayerPlayInterval, type RawSquadPlayer } from "@/lib/scouting/minutes";
import type { LnpCachedMatchMinutes, LnpCachedMatchPlayer } from "@/types/lnpPlayerLoad";
import {
  findItemContaining,
  itemText,
  itemsOnPage,
  mergeAdjacentPdfItems,
  sortItemsTopLeft,
  type PdfTextItem,
} from "./pdfTextItems";

export const REFEREE_REPORT_MATCH_ID_PREFIX = "pdf:" as const;
export const REGULAR_MATCH_END_MINUTE = 90;
export const EXTRA_TIME_END_MINUTE = 120;

export interface RefereeReportPlayer {
  number: number;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  isStarter: boolean;
  isKeeper: boolean;
  subMinute: number | null;
  subPartnerNumber: number | null;
  redMinute: number | null;
  minutesPlayed: number;
}

export interface RefereeReportTeam {
  name: string;
  players: RefereeReportPlayer[];
}

export interface RefereeReportMatch {
  competition: string;
  hostName: string;
  guestName: string;
  date: string;
  kickoffTime: string;
  dateTime: string;
  scoreFinal: string | null;
  winnerName: string | null;
  addedTimeFirst: number;
  addedTimeSecond: number;
  extraTimePlayed: boolean;
  matchEndMinute: number;
  host: RefereeReportTeam;
  guest: RefereeReportTeam;
}

export type RefereeReportSide = "host" | "guest";

const TEAM_SPLIT_RE = /\s+[-–—]\s+/;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const TIME_RE = /(\d{1,2}:\d{2})/;
const SCORE_RE = /^(\d+)\s*[:：]\s*(\d+)$/;
const BIRTH_RE = /ur\.\s*(\d{4}-\d{2}-\d{2})/i;
const SHIRT_RE = /^\d{1,2}$/;
const SUB_RE =
  /(\d+)\s*'\s*(?:\+\s*(\d+))?\s*(?:\((?:W|w)\s*przerwie\))?\s*-\s*nr\.?\s*(\d{1,2})?/i;
const BARE_MINUTE_RE = /^\d+\s*'\s*(?:\+\s*\d+)?$/;
const HALF_TIME_RE = /\(\s*(?:W|w)\s*przerwie\s*\)/;
const ADDED_FIRST_RE = /^1\s*połowa:\s*(\d+)/i;
const ADDED_SECOND_RE = /^2\s*połowa:\s*(\d+)/i;
const EXTRA_FIRST_RE = /^1\s*połowa dogrywki:\s*(\d+)/i;
const EXTRA_SECOND_RE = /^2\s*połowa dogrywki:\s*(\d+)/i;

function normalizeName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function namesOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const skip = new Set(["ks", "mks", "lks", "rks", "ukp", "akf", "ii", "iii"]);
  const tokens = (s: string) => s.split(/\s+/).filter((t) => t.length > 2 && !skip.has(t));
  const setA = new Set(tokens(na));
  const listB = tokens(nb);
  if (setA.size === 0 || listB.length === 0) return false;
  const hits = listB.filter((t) => setA.has(t)).length;
  return hits >= 2 && hits / Math.max(listB.length, tokens(na).length) >= 0.5;
}

export function isRefereeReportPdfMatchId(matchId: string): boolean {
  return matchId.startsWith(REFEREE_REPORT_MATCH_ID_PREFIX);
}

export function slugTeamName(value: string): string {
  const slug = normalizeName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "druzyna";
}

export function buildRefereeReportMatchId(date: string, hostName: string, guestName: string): string {
  return `${REFEREE_REPORT_MATCH_ID_PREFIX}${date}:${slugTeamName(hostName)}-vs-${slugTeamName(guestName)}`;
}

function pageWidthOf(items: PdfTextItem[]): number {
  return items.find((i) => i.pageWidth > 0)?.pageWidth || 595;
}

function parseScoreToken(raw: string): string | null {
  const m = itemText({ str: raw } as PdfTextItem).match(SCORE_RE) || raw.trim().match(SCORE_RE);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

function parsePlayerName(raw: string): {
  firstName: string;
  lastName: string;
  isKeeper: boolean;
  isCaptain: boolean;
} {
  const isKeeper = /\(\s*Br\.?\s*\)/i.test(raw);
  const isCaptain = /\(\s*Kpt\.?\s*\)/i.test(raw);
  const cleaned = raw
    .replace(/\(\s*Br\.?\s*\)/gi, " ")
    .replace(/\(\s*Kpt\.?\s*\)/gi, " ")
    .replace(/\(\s*M\s*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "", isKeeper, isCaptain };
  if (parts.length === 1) return { firstName: "", lastName: parts[0], isKeeper, isCaptain };
  return { firstName: parts[0], lastName: parts.slice(1).join(" "), isKeeper, isCaptain };
}

function parseSubFromText(text: string): { minute: number; partner: number | null } | null {
  if (!SUB_RE.test(text) && !HALF_TIME_RE.test(text)) return null;
  const m = text.match(SUB_RE);
  if (m) {
    const minute = Number(m[1]) + (m[2] ? Number(m[2]) : 0);
    const partner = m[3] ? Number(m[3]) : null;
    if (!Number.isFinite(minute)) return null;
    return { minute, partner: partner != null && Number.isFinite(partner) ? partner : null };
  }
  if (HALF_TIME_RE.test(text)) return { minute: 46, partner: null };
  return null;
}

function readNearbyNumber(text: string, all: PdfTextItem[], band: PdfTextItem[], colMinX: number): number | null {
  const fromText = text.match(/nr\.?\s*(\d{1,2})/i);
  if (fromText) return Number(fromText[1]);
  const leftover = band.find(
    (i) => SHIRT_RE.test(itemText(i)) && i.x > colMinX + 120 && Number(itemText(i)) >= 1
  );
  if (leftover) return Number(itemText(leftover));
  const wrapped = all.find(
    (i) =>
      SHIRT_RE.test(itemText(i)) &&
      i.x > colMinX + 120 &&
      i.y >= (band[0]?.y ?? 0) - 2 &&
      i.y <= (band[band.length - 1]?.y ?? 0) + 18
  );
  if (wrapped) return Number(itemText(wrapped));
  return null;
}

function parseHeader(items: PdfTextItem[]): {
  competition: string;
  hostName: string;
  guestName: string;
  date: string;
  kickoffTime: string;
  scoreFinal: string | null;
  winnerName: string | null;
  addedTimeFirst: number;
  addedTimeSecond: number;
  extraTimePlayed: boolean;
} {
  const page1 = sortItemsTopLeft(itemsOnPage(items, 1));
  const competitionItem =
    page1.find((i) => /puchar|liga|klasa|mistrzost/i.test(itemText(i))) ||
    page1.find((i, idx) => {
      const prev = page1[idx - 1];
      return prev ? /sprawozdanie/i.test(itemText(prev)) : false;
    });
  const competition = competitionItem ? itemText(competitionItem) : "Puchar";

  const teamsAnchor = page1.find((i) => /zawody pomiędzy|zespołami/i.test(itemText(i)));
  const teamsItem = page1.find((i) => {
    const t = itemText(i);
    if (!TEAM_SPLIT_RE.test(t) || t.length < 8) return false;
    if (/puchar polski|mazowiecki zpn\s*-/i.test(t)) return false;
    if (teamsAnchor && Math.abs(i.y - teamsAnchor.y) > 28) return false;
    return true;
  });
  const teamsText = teamsItem ? itemText(teamsItem) : "";
  const teamParts = teamsText.split(TEAM_SPLIT_RE).map((s) => s.trim()).filter(Boolean);
  const hostName = teamParts[0] || "";
  const guestName = teamParts[1] || "";

  const dateItem = page1.find((i) => /data zawodów/i.test(itemText(i))) || page1.find((i) => DATE_RE.test(itemText(i)));
  const dateText = dateItem ? itemText(dateItem) : "";
  const date = dateText.match(DATE_RE)?.[1] || "";
  const timeItem = page1.find((i) => /godz/i.test(itemText(i)) && TIME_RE.test(itemText(i))) || dateItem;
  const kickoffTime =
    (timeItem ? itemText(timeItem) : "").match(TIME_RE)?.[1] ||
    dateText.match(TIME_RE)?.[1] ||
    "00:00";

  const rezultat = page1.find((i) => /^rezultat:?$/i.test(itemText(i)));
  let scoreFinal: string | null = null;
  let winnerName: string | null = null;
  if (rezultat) {
    const sameLine = page1.filter((i) => Math.abs(i.y - rezultat.y) < 8);
    for (const i of sameLine) {
      const score = parseScoreToken(itemText(i));
      if (score) scoreFinal = score;
      const dla = itemText(i).match(/^dla\s+(.+)/i);
      if (dla) winnerName = dla[1].trim();
    }
  }

  const addedTimeFirst =
    Number(page1.find((i) => ADDED_FIRST_RE.test(itemText(i)))?.str.match(ADDED_FIRST_RE)?.[1] ?? 0) || 0;
  const addedTimeSecond =
    Number(page1.find((i) => ADDED_SECOND_RE.test(itemText(i)))?.str.match(ADDED_SECOND_RE)?.[1] ?? 0) || 0;
  const extraFirst = page1.find((i) => EXTRA_FIRST_RE.test(itemText(i)));
  const extraSecond = page1.find((i) => EXTRA_SECOND_RE.test(itemText(i)));
  const extraTimePlayed = Boolean(
    (extraFirst && EXTRA_FIRST_RE.test(itemText(extraFirst))) ||
      (extraSecond && EXTRA_SECOND_RE.test(itemText(extraSecond)))
  );

  return {
    competition,
    hostName,
    guestName,
    date,
    kickoffTime,
    scoreFinal,
    winnerName,
    addedTimeFirst,
    addedTimeSecond,
    extraTimePlayed,
  };
}

function parseRedCards(items: PdfTextItem[]): Array<{ number: number; team: string; minute: number }> {
  const page2 = sortItemsTopLeft(itemsOnPage(items, 2).concat(itemsOnPage(items, 1)));
  const start = page2.find((i) => /wykluczenia/i.test(itemText(i)) && !/funkcyj/i.test(itemText(i)));
  if (!start) return [];
  const end =
    page2.find((i) => i.y > start.y && /arkusz dodatkowy|napomnienia osób|osoby funkcyjne/i.test(itemText(i))) ||
    start;
  const band = page2.filter((i) => i.y > start.y + 20 && i.y < end.y - 2);
  const numbers = band.filter((i) => SHIRT_RE.test(itemText(i)) && i.width <= 16);
  const out: Array<{ number: number; team: string; minute: number }> = [];
  for (const num of numbers) {
    const row = band.filter((i) => Math.abs(i.y - num.y) < 10);
    const minuteItem = row.find((i) => BARE_MINUTE_RE.test(itemText(i)) || /^\d+'\s*$/.test(itemText(i)));
    const teamItem = row.find(
      (i) => itemText(i).length > 3 && !SHIRT_RE.test(itemText(i)) && !BARE_MINUTE_RE.test(itemText(i))
    );
    const minute = minuteItem ? Number(itemText(minuteItem).match(/\d+/)?.[0] ?? NaN) : NaN;
    if (!Number.isFinite(minute)) continue;
    out.push({
      number: Number(itemText(num)),
      team: teamItem ? itemText(teamItem) : "",
      minute,
    });
  }
  return out;
}

function squadPageNumber(items: PdfTextItem[]): number {
  const marked = items.find((i) => /skład rezerwowy/i.test(itemText(i)));
  if (marked) return marked.page;
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  return pages[pages.length - 1] || 3;
}

function parseColumnPlayers(
  column: PdfTextItem[],
  pageItems: PdfTextItem[],
  teamName: string,
  redCards: Array<{ number: number; team: string; minute: number }>
): RefereeReportPlayer[] {
  const sorted = sortItemsTopLeft(column);
  const benchMarker = findItemContaining(pageItems, /skład rezerwowy/i);
  const stopMarker =
    findItemContaining(pageItems, /osoby funkcyjne/i) || findItemContaining(pageItems, /^legenda:?$/i);
  const benchY = benchMarker?.y ?? Number.POSITIVE_INFINITY;
  const stopY = stopMarker?.y ?? Number.POSITIVE_INFINITY;
  const headerY = sorted[0]?.y ?? 0;
  const body = sorted.filter((i) => i.y > headerY + 10 && i.y < stopY - 2);
  if (body.length === 0) return [];

  const colMinX = Math.min(...body.map((i) => i.x));
  const numbers = body.filter(
    (i) => SHIRT_RE.test(itemText(i)) && i.width <= 16 && i.x < colMinX + 42
  );
  const players: RefereeReportPlayer[] = [];

  for (let idx = 0; idx < numbers.length; idx += 1) {
    const numItem = numbers[idx];
    const nextY = numbers[idx + 1]?.y ?? stopY;
    const y0 = numItem.y - 18;
    const y1 = Math.min(numItem.y + 24, nextY - 2);
    const band = body.filter((i) => i.y >= y0 && i.y < y1);
    const number = Number(itemText(numItem));
    const nameItem = band
      .filter((i) => {
        const t = itemText(i);
        if (!t || t === String(number)) return false;
        if (BIRTH_RE.test(t)) return false;
        if (SUB_RE.test(t) || HALF_TIME_RE.test(t)) return false;
        if (BARE_MINUTE_RE.test(t)) return false;
        if (SHIRT_RE.test(t)) return false;
        if (/^nr\.?$/i.test(t)) return false;
        if (/skład rezerwowy|osoby funkcyjne|^legenda:?$/i.test(t)) return false;
        return /[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/.test(t);
      })
      .sort((a, b) => a.x - b.x)[0];
    if (!nameItem) continue;

    const parsed = parsePlayerName(itemText(nameItem));
    const birthItem = band.find((i) => BIRTH_RE.test(itemText(i)));
    const birthDate = birthItem ? itemText(birthItem).match(BIRTH_RE)?.[1] ?? null : null;
    const subItem = band.find((i) => parseSubFromText(itemText(i)) != null);
    const subParsed = subItem ? parseSubFromText(itemText(subItem)) : null;
    const partner =
      subParsed?.partner ??
      (subItem ? readNearbyNumber(itemText(subItem), body, band, colMinX) : null);
    const isStarter = numItem.y < benchY;
    const red = redCards.find(
      (r) => r.number === number && (!r.team || namesOverlap(r.team, teamName))
    );

    const raw: RawSquadPlayer = {
      id: `${number}`,
      firstname: parsed.firstName,
      lastname: parsed.lastName,
      number,
      isKeeper: parsed.isKeeper,
      type: isStarter ? "Starter" : "Substitute",
      substitutions:
        subParsed != null
          ? [
              {
                type: isStarter ? "out" : "in",
                minute: `${subParsed.minute}'`,
              },
            ]
          : [],
      cards: red ? [{ type: "red", minute: `${red.minute}'` }] : [],
    };
    const interval = computePlayerPlayInterval(raw);

    players.push({
      number,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      birthDate,
      isStarter,
      isKeeper: parsed.isKeeper,
      subMinute: subParsed?.minute ?? null,
      subPartnerNumber: partner,
      redMinute: red?.minute ?? null,
      minutesPlayed: interval.minutesPlayed,
    });
  }

  return players;
}

function columnName(column: PdfTextItem[], fallback: string): string {
  const sorted = sortItemsTopLeft(column);
  const header = sorted.find((i) => {
    const t = itemText(i);
    if (t.length < 4) return false;
    if (SHIRT_RE.test(t)) return false;
    if (/^\d+$/.test(t)) return false;
    return /[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/.test(t);
  });
  return header ? itemText(header) : fallback;
}

export function parseRefereeReport(items: PdfTextItem[]): RefereeReportMatch {
  const merged = mergeAdjacentPdfItems(items);
  if (merged.length === 0) {
    throw new Error("PDF nie zawiera tekstu.");
  }
  const header = parseHeader(merged);
  if (!header.hostName || !header.guestName) {
    throw new Error("Nie znaleziono nazw drużyn w sprawozdaniu.");
  }
  if (!header.date) {
    throw new Error("Nie znaleziono daty zawodów w sprawozdaniu.");
  }

  const redCards = parseRedCards(merged);
  const squadPage = squadPageNumber(merged);
  const pageItems = itemsOnPage(merged, squadPage);
  const mid = pageWidthOf(pageItems) / 2;
  const left = pageItems.filter((i) => i.x + i.width / 2 < mid);
  const right = pageItems.filter((i) => i.x + i.width / 2 >= mid);
  const leftName = columnName(left, header.hostName);
  const rightName = columnName(right, header.guestName);

  const leftIsHost =
    namesOverlap(leftName, header.hostName) ||
    namesOverlap(rightName, header.guestName) ||
    (!namesOverlap(leftName, header.guestName) && !namesOverlap(rightName, header.hostName));

  const hostCol = leftIsHost ? left : right;
  const guestCol = leftIsHost ? right : left;
  const hostLabel = leftIsHost ? leftName : rightName;
  const guestLabel = leftIsHost ? rightName : leftName;

  const extraTimePlayed = header.extraTimePlayed;
  const matchEndMinute = extraTimePlayed ? EXTRA_TIME_END_MINUTE : REGULAR_MATCH_END_MINUTE;
  const hh = header.kickoffTime.padStart(5, "0");
  const dateTime = `${header.date}T${hh.length === 5 ? hh : "00:00"}:00`;

  return {
    competition: header.competition,
    hostName: header.hostName,
    guestName: header.guestName,
    date: header.date,
    kickoffTime: header.kickoffTime,
    dateTime,
    scoreFinal: header.scoreFinal,
    winnerName: header.winnerName,
    addedTimeFirst: header.addedTimeFirst,
    addedTimeSecond: header.addedTimeSecond,
    extraTimePlayed,
    matchEndMinute,
    host: {
      name: hostLabel || header.hostName,
      players: parseColumnPlayers(hostCol, pageItems, header.hostName, redCards),
    },
    guest: {
      name: guestLabel || header.guestName,
      players: parseColumnPlayers(guestCol, pageItems, header.guestName, redCards),
    },
  };
}

export function pickRefereeReportSide(
  report: Pick<RefereeReportMatch, "hostName" | "guestName" | "host" | "guest">,
  ourTeamNames: string[]
): RefereeReportSide {
  const names = ourTeamNames.map((n) => n.trim()).filter(Boolean);
  const hostHits = names.filter(
    (n) => namesOverlap(n, report.hostName) || namesOverlap(n, report.host.name)
  ).length;
  const guestHits = names.filter(
    (n) => namesOverlap(n, report.guestName) || namesOverlap(n, report.guest.name)
  ).length;
  if (guestHits > hostHits) return "guest";
  if (hostHits > guestHits) return "host";
  return "host";
}

function toCachedPlayer(p: RefereeReportPlayer): LnpCachedMatchPlayer {
  return {
    lnpId: "",
    firstName: p.firstName,
    lastName: p.lastName,
    number: p.number,
    minutesPlayed: p.minutesPlayed,
  };
}

export function refereeReportToCachedMatch(
  report: RefereeReportMatch,
  side: RefereeReportSide,
  fetchedAt: string
): LnpCachedMatchMinutes {
  const ours = side === "host" ? report.host : report.guest;
  const opponent = side === "host" ? report.guestName : report.hostName;
  return {
    matchId: buildRefereeReportMatchId(report.date, report.hostName, report.guestName),
    dateTime: report.dateTime,
    opponent,
    isHome: side === "host",
    playName: report.competition || "Puchar",
    scoreFinal: report.scoreFinal,
    fetchedAt,
    hasSquad: ours.players.length > 0,
    players: ours.players.filter((p) => p.minutesPlayed > 0).map(toCachedPlayer),
  };
}

export function attachKnownLnpIds(
  players: LnpCachedMatchPlayer[],
  known: LnpCachedMatchPlayer[]
): LnpCachedMatchPlayer[] {
  return players.map((p) => {
    if (p.lnpId) return p;
    const byName = known.find(
      (k) =>
        Boolean(k.lnpId) &&
        normalizeName(k.firstName) === normalizeName(p.firstName) &&
        normalizeName(k.lastName) === normalizeName(p.lastName)
    );
    if (byName) return { ...p, lnpId: byName.lnpId };
    return p;
  });
}
