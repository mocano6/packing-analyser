import assert from "assert";
import type { TrainingMicrocycleState } from "@/types/trainingMicrocycle";
import { MOTOR_CORE_SESSION_ROLES } from "@/types/microcycleMotor";
import { createDefaultTrainingMicrocycleState } from "./trainingMicrocycle";
import { createDefaultMicrocycleMatch } from "./microcycleMatches";
import {
  applyDaySessionTemplateToState,
  applySessionTemplatesToWeek,
  assignSessionRolesToWeek,
  createSeedDaySessionTemplates,
  daysToNextMatch,
  gymMinutesFromDrafts,
  inferGymCharacter,
  migrateLegacyDaySessionTemplates,
  minutesFromDrafts,
  restDaysForWeekFill,
  restoreSeedDaySessionTemplates,
  roleForDaysToMatch,
  sessionTemplateForDay,
  sessionTemplateForRole,
  sessionTemplateFromDayBlocks,
} from "./daySessionTemplates";
import { presetBlocksForDay } from "./microcycleTrainingBlocks";

// Seed to dokładnie cztery jednostki treningowe tygodnia, opisane rolą
const seed = createSeedDaySessionTemplates();
assert.equal(seed.length, 4);
assert.deepEqual(
  seed.map((t) => t.role),
  MOTOR_CORE_SESSION_ROLES
);
assert.ok(seed.every((t) => t.seedKey && t.blocks.length > 0));
assert.ok(seed.every((t) => t.matchDayOffset === null));
assert.ok(seed.every((t) => t.targets.minutes === minutesFromDrafts(t.blocks)));
assert.equal(sessionTemplateForRole(seed, "strength")?.gymCharacter, "heavy");
assert.equal(sessionTemplateForRole(seed, "tension")?.gymCharacter, "power");
assert.equal(sessionTemplateForRole(seed, "volume")?.gymCharacter, "minimal");
assert.equal(sessionTemplateForRole(seed, "speed")?.gymCharacter, "priming");
assert.equal(sessionTemplateForRole(seed, "activation"), undefined);

const heavy = sessionTemplateForRole(seed, "strength")!;
assert.ok(gymMinutesFromDrafts(heavy.blocks) >= 40);
assert.equal(inferGymCharacter(heavy.blocks), "heavy");
assert.ok(heavy.blocks[0].tags.includes("gym"));
assert.ok(heavy.blocks.some((b) => b.tags.includes("transfer")));

// Odległość od meczu: poniedziałek przy meczu w niedzielę jest najdalej od następnego meczu
assert.equal(daysToNextMatch(0, [6]), 6);
assert.equal(daysToNextMatch(0, [5]), 5);
assert.equal(daysToNextMatch(4, [5]), 1);
assert.equal(daysToNextMatch(0, [2, 6]), 2);
assert.equal(roleForDaysToMatch(1), "activation");
assert.equal(roleForDaysToMatch(2), "speed");
assert.equal(roleForDaysToMatch(6), "strength");

// Mecz w sobotę, treningi pn–czw: siła → napięcie → objętość → prędkość
const satWeek = assignSessionRolesToWeek([5], [4, 6]);
assert.deepEqual(
  satWeek.map((a) => [a.dayIndex, a.role]),
  [
    [0, "strength"],
    [1, "tension"],
    [2, "volume"],
    [3, "speed"],
  ]
);

// Mecz w niedzielę, te same dni tygodnia: identyczna kolejność ról
const sunWeek = assignSessionRolesToWeek([6], [4, 5]);
assert.deepEqual(
  sunWeek.map((a) => [a.dayIndex, a.role]),
  [
    [0, "strength"],
    [1, "tension"],
    [2, "volume"],
    [3, "speed"],
  ]
);

// Szczyt objętości nigdy bliżej niż 3 dni od meczu
for (const week of [satWeek, sunWeek]) {
  const volumeDay = week.find((a) => a.role === "volume")!;
  assert.ok(volumeDay.daysToMatch >= 3);
  const speedDay = week.find((a) => a.role === "speed")!;
  assert.ok(speedDay.daysToMatch >= 2);
  assert.ok(speedDay.daysToMatch < volumeDay.daysToMatch);
}

// Puste restDays: i tak max 4 jednostki, pn–czw, bez aktywacji na MD-1
assert.deepEqual(restDaysForWeekFill([5], []), [4, 6]);
assert.deepEqual(restDaysForWeekFill([6], []), [4, 5]);
assert.deepEqual(restDaysForWeekFill([5], [6]), [4, 6]);
const openSat = assignSessionRolesToWeek([5], restDaysForWeekFill([5], []));
assert.deepEqual(
  openSat.map((a) => [a.dayIndex, a.role]),
  [
    [0, "strength"],
    [1, "tension"],
    [2, "volume"],
    [3, "speed"],
  ]
);
assert.equal(assignSessionRolesToWeek([6], []).length, 4);
assert.ok(!assignSessionRolesToWeek([6], []).some((a) => a.role === "activation"));

// Jedyna jednostka blisko meczu ma być prędkościowa, nie objętościowa
const singleClose = assignSessionRolesToWeek([6], [0, 1, 2, 3, 5]);
assert.deepEqual(
  singleClose.map((a) => [a.dayIndex, a.role]),
  [[4, "speed"]]
);

// Dwa mecze: tylko dni z ≥2 dniami do meczu, bez aktywacji MD-1
const twoMatches = assignSessionRolesToWeek([2, 6], restDaysForWeekFill([2, 6], []));
assert.ok(twoMatches.length <= 4);
assert.ok(!twoMatches.some((a) => a.role === "activation"));
assert.ok(twoMatches.every((a) => a.daysToMatch > 1));
assert.ok(twoMatches.find((a) => a.role === "volume")!.daysToMatch >= 3);

const state: TrainingMicrocycleState = {
  ...createDefaultTrainingMicrocycleState(),
  microcycles: [
    {
      id: "mc1",
      seasonId: "s1",
      number: 1,
      weekStartIso: "2026-08-03",
      matches: [{ ...createDefaultMicrocycleMatch(6), opponent: "Mazur" }],
      daySchedules: [],
      dayLoads: [],
      restDays: [4, 5],
    },
  ],
  activeMicrocycleId: "mc1",
  trainingBlocks: [],
};

const applied = applyDaySessionTemplateToState(state, "mc1", 0, heavy);
assert.ok((applied.trainingBlocks ?? []).every((b) => b.dayIndex === 0));
assert.ok((applied.trainingBlocks ?? []).some((b) => b.tags.includes("nordic")));
assert.equal(applied.microcycles[0].dayLoads?.find((l) => l.dayIndex === 0)?.dominant, "recovery");

const rested = {
  ...state,
  microcycles: [{ ...state.microcycles[0], restDays: [0] }],
};
const unrested = applyDaySessionTemplateToState(rested, "mc1", 0, heavy);
assert.deepEqual(unrested.microcycles[0].restDays, []);

// Rozpisanie tygodnia: cztery jednostki, dni wolne i meczowy nietknięte
const week = applySessionTemplatesToWeek(applied, "mc1", [6], seed);
assert.equal(week.applied, 4);
assert.ok(week.blockCount > 10);
assert.deepEqual(week.state.microcycles[0].restDays, [4, 5]);
const writtenDays = [
  ...new Set((week.state.trainingBlocks ?? []).map((b) => b.dayIndex)),
].sort();
assert.deepEqual(writtenDays, [0, 1, 2, 3]);
const monday = (week.state.trainingBlocks ?? []).filter((b) => b.dayIndex === 0);
assert.ok(monday.some((b) => b.tags.includes("strength_max")));
const thursday = (week.state.trainingBlocks ?? []).filter((b) => b.dayIndex === 3);
assert.ok(thursday.some((b) => b.tags.includes("sprint_max")));

// Pusta biblioteka: rozpisanie korzysta z wbudowanych presetów modelu
const fromBuiltIn = applySessionTemplatesToWeek(state, "mc1", [6], []);
assert.equal(fromBuiltIn.applied, 4);

// Ręczne przypięcie do MD ma priorytet nad rolą
const pinned = [
  ...seed,
  {
    ...seed[0],
    id: "pinned-md4",
    name: "Przypięty MD-4",
    role: null,
    matchDayOffset: -4,
    blocks: [{ name: "Tylko wideo", minutes: 20, tags: ["video" as const], formatId: null, notes: "" }],
  },
];
const pinnedWeek = applySessionTemplatesToWeek(state, "mc1", [6], pinned);
const pinnedDay = (pinnedWeek.state.trainingBlocks ?? []).filter((b) => b.dayIndex === 2);
assert.deepEqual(
  pinnedDay.map((b) => b.name),
  ["Tylko wideo"]
);

// Preset dla pojedynczego dnia idzie po roli tego dnia
assert.equal(sessionTemplateForDay(seed, 0, [6], [4, 5])?.role, "strength");
assert.equal(sessionTemplateForDay(seed, 3, [6], [4, 5])?.role, "speed");
assert.equal(sessionTemplateForDay(seed, 6, [6], [4, 5]), null);
assert.equal(sessionTemplateForDay(seed, 5, [6], [4, 5]), null);

// Puste restDays: rozpisanie samo oznacza piątek i weekend bez meczu jako wolne
const emptyRestState: TrainingMicrocycleState = {
  ...state,
  microcycles: [{ ...state.microcycles[0], restDays: [] }],
  trainingBlocks: [
    {
      id: "ghost-fri",
      microcycleId: "mc1",
      dayIndex: 4,
      order: 0,
      name: "Duch MD-1",
      minutes: 60,
      formatId: null,
      pitchLength: null,
      pitchWidth: null,
      playersPerSide: null,
      tags: ["sprint_max"],
      notes: "",
    },
  ],
};
const filledOpen = applySessionTemplatesToWeek(emptyRestState, "mc1", [6], seed);
assert.equal(filledOpen.applied, 4);
assert.deepEqual(filledOpen.state.microcycles[0].restDays, [4, 5]);
assert.ok(!(filledOpen.state.trainingBlocks ?? []).some((b) => b.dayIndex === 4));
assert.equal(
  filledOpen.state.microcycles[0].dayLoads?.find((l) => l.dayIndex === 4)?.targets?.srpe,
  0
);

// Migracja starej biblioteki per-offset na zestaw ról; własne presety zostają
const legacy = [
  { ...seed[0], id: "seed-md-minus5", role: null, matchDayOffset: -5, seedKey: "seed-md-minus5" },
  { ...seed[1], id: "own", name: "Mój preset", role: null, seedKey: undefined },
];
const migrated = migrateLegacyDaySessionTemplates(legacy);
assert.equal(migrated.length, 5);
assert.deepEqual(migrated.slice(0, 4).map((t) => t.role), MOTOR_CORE_SESSION_ROLES);
assert.equal(migrated[4].name, "Mój preset");
assert.equal(migrateLegacyDaySessionTemplates(seed).length, 4);
assert.equal(restoreSeedDaySessionTemplates(seed).length, 4);

const fromDay = sessionTemplateFromDayBlocks(presetBlocksForDay("mc1", 3, [6]), {
  name: "Z dnia",
  matchDayOffset: -3,
  dominant: "velocity",
  targets: {
    totalDistancePct: 65,
    hsrPct: 105,
    sprintPct: 110,
    accDecPct: 85,
    srpe: 500,
    minutes: 95,
  },
});
assert.equal(fromDay.gymCharacter, "priming");
assert.equal(fromDay.role, null);
assert.ok(fromDay.blocks.length > 0);
assert.equal(fromDay.targets.minutes, minutesFromDrafts(fromDay.blocks));

console.log("daySessionTemplates.test.ts: ok");
