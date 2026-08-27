import assert from 'assert';
import { parseMinute, computePlayerStat, computePlayerPlayInterval, computeMatchPlayerStats, type RawSquadPlayer } from './minutes';
import type { ScoutingTeamRef } from '@/types/scouting';

const team: ScoutingTeamRef = { id: 'T1', name: 'Team One' };
const other: ScoutingTeamRef = { id: 'T2', name: 'Team Two' };

// parseMinute
assert.strictEqual(parseMinute("71'"), 71);
assert.strictEqual(parseMinute("45+2'"), 47);
assert.strictEqual(parseMinute('90+3'), 93);
assert.strictEqual(parseMinute(undefined), null);
assert.strictEqual(parseMinute(''), null);

const base = (p: Partial<RawSquadPlayer>): RawSquadPlayer => ({
  id: 'p',
  firstname: 'Jan',
  lastname: 'Kowalski',
  number: 9,
  type: 'Starter',
  goals: [],
  cards: [],
  substitutions: [],
  ...p,
});

// Starter grający cały mecz -> 90 min
const full = computePlayerStat(base({ id: 'a' }), team);
assert.strictEqual(full.minutesPlayed, 90);
assert.strictEqual(full.isStarter, true);
assert.strictEqual(full.goals, 0);
assert.deepStrictEqual(computePlayerPlayInterval(base({ id: 'a' })), {
  isStarter: true,
  startMinute: 0,
  endMinute: 90,
  minutesPlayed: 90,
  subInMinute: null,
  subOutMinute: null,
});

// Starter zdjęty w 60' -> 60 min
const subbedOut = computePlayerStat(base({ id: 'b', substitutions: [{ type: 'Out', minute: "60'" }] }), team);
assert.strictEqual(subbedOut.minutesPlayed, 60);
assert.strictEqual(subbedOut.subOutMinute, 60);

// Rezerwowy wchodzący w 70' -> 20 min
const subbedIn = computePlayerStat(
  base({ id: 'c', type: 'Substitute', substitutions: [{ type: 'In', minute: "70'" }] }),
  team
);
assert.strictEqual(subbedIn.minutesPlayed, 20);
assert.strictEqual(subbedIn.isStarter, false);
assert.strictEqual(subbedIn.subInMinute, 70);

// Niewykorzystany rezerwowy -> 0 min
const unused = computePlayerStat(base({ id: 'd', type: 'Substitute' }), team);
assert.strictEqual(unused.minutesPlayed, 0);

// Czerwona kartka w 30' kończy udział startera -> 30 min
const red = computePlayerStat(base({ id: 'e', cards: [{ type: 'Red', minute: "30'" }] }), team);
assert.strictEqual(red.minutesPlayed, 30);
assert.strictEqual(red.redCards, 1);

// Druga żółta traktowana jak czerwona
const secondYellow = computePlayerStat(
  base({ id: 'f', cards: [{ type: 'Yellow', minute: "20'" }, { type: 'SecondYellow', minute: "75'" }] }),
  team
);
assert.strictEqual(secondYellow.minutesPlayed, 75);
assert.strictEqual(secondYellow.redCards, 1);
assert.strictEqual(secondYellow.yellowCards, 1);

// Bramki (z minutami) + gol samobójczy liczony osobno
const scorer = computePlayerStat(
  base({
    id: 'g',
    goals: [
      { type: 'Normal', minute: "30'" },
      { type: 'Penalty', minute: "80'" },
      { type: 'OwnGoal', minute: "10'" },
    ],
  }),
  team
);
assert.strictEqual(scorer.goals, 2);
assert.deepStrictEqual(scorer.goalMinutes, [30, 80]);
assert.strictEqual(scorer.ownGoals, 1);

// computeMatchPlayerStats łączy obie drużyny i przypisuje właściwy klub
const events = {
  host: { squad: [base({ id: 'h1' })] },
  guest: { squad: [base({ id: 'a1' }), base({ id: 'a2' })] },
};
const all = computeMatchPlayerStats(events, team, other);
assert.strictEqual(all.length, 3);
assert.strictEqual(all.find((x) => x.playerId === 'h1')?.teamId, 'T1');
assert.strictEqual(all.find((x) => x.playerId === 'a1')?.teamId, 'T2');

console.log('scouting/minutes.test: OK');
