import assert from "node:assert/strict";
import { compactWiedzaMatchForStorage } from "./wiedzaMatchCompact";
import { TeamInfo } from "../types";

const heavy: TeamInfo & { id: string } = {
  id: "m1",
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
  opponentLogo: "data:image/png;base64,AAAA" + "x".repeat(5000),
  videoUrl: "https://youtube.com/watch?v=long",
  videoStorageUrl: "https://storage.example/signed?token=" + "y".repeat(2000),
  actions_regain: [
    {
      id: "r1",
      matchId: "m1",
      teamId: "t1",
      minute: 1,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      regainDefenseZone: "B4",
      senderName: "Jan",
      receiverName: "Kowal",
      videoTimestampRaw: 10,
      playersBehindBall: 5,
      totalPlayersOnField: 11,
      opponentsBehindBall: 4,
      totalOpponentsOnField: 11,
    } as any,
  ],
  shots: [
    {
      id: "s1",
      x: 50,
      y: 50,
      minute: 2,
      xG: 0.1,
      isGoal: false,
      matchId: "m1",
      timestamp: 2,
      shotType: "on_target",
      teamContext: "attack",
      teamId: "t1",
      playerName: "Secret",
    } as any,
  ],
} as TeamInfo & { id: string };

const c = compactWiedzaMatchForStorage(heavy);
assert.equal((c as any).opponentLogo, undefined);
assert.equal((c as any).videoUrl, undefined);
assert.equal((c as any).videoStorageUrl, undefined);
assert.ok(c.actions_regain?.[0]);
assert.equal((c.actions_regain![0] as any).senderName, undefined);
assert.equal((c.shots?.[0] as any).playerName, undefined);
assert.equal(c.actions_regain![0].videoTimestampRaw, 10);

const raw = JSON.stringify(c);
assert.ok(raw.length < JSON.stringify(heavy).length);

console.log("wiedzaMatchCompact tests: OK");
