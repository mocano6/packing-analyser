import assert from "assert";
import {
  buildSanitizedTrainingMicrocycleState,
  buildTrainingMicrocycleTaskDocument,
  extractDayTitleTemplatesFromMicrocycleRaw,
  migrateTrainingMicrocycleFromFirestore,
} from "./trainingMicrocycleFirestore";
import { createDefaultTrainingMicrocycleState } from "../utils/trainingMicrocycle";

const sample = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
const withAssign = {
  ...sample,
  assignments: [
    {
      id: "a1",
      microcycleId: sample.microcycles[0].id,
      dayIndex: 2,
      templateId: "tpl1",
      title: "Pressing",
      level: 1 as const,
    },
  ],
  trainingCounts: { tpl1: 1 },
};

const doc = buildTrainingMicrocycleTaskDocument(withAssign, 12345);
assert.strictEqual(typeof doc.stateJson, "string");
assert.strictEqual(doc.version, 11);

const innerDoc = JSON.parse(doc.stateJson as string);
assert.equal(innerDoc.dayTitleTemplates, undefined);

const legacyWithDayTitle = {
  seasons: sample.seasons,
  microcycles: sample.microcycles,
  assignments: [],
  dayTitleTemplates: [{ id: "dt1", generalFocus: "Dzień taktyczny", gameMoments: "Pressing, SFG" }],
  dayPlans: [
    {
      id: "dp1",
      microcycleId: sample.microcycles[0].id,
      dayIndex: 1,
      templateId: "dt1",
      generalFocus: "Dzień taktyczny",
      gameMoments: "Pressing, SFG",
    },
  ],
  trainingCounts: {},
  activeSeasonId: sample.activeSeasonId,
  activeMicrocycleId: sample.activeMicrocycleId,
};

const extracted = extractDayTitleTemplatesFromMicrocycleRaw(legacyWithDayTitle);
assert.equal(extracted.length, 1);
assert.equal(extracted[0].generalFocus, "Dzień taktyczny");

const migratedLegacy = migrateTrainingMicrocycleFromFirestore({
  stateJson: JSON.stringify(legacyWithDayTitle),
  version: 4,
});
assert.equal(migratedLegacy.dayPlans[0].generalFocus, "Dzień taktyczny");
assert.equal((migratedLegacy as { dayTitleTemplates?: unknown[] }).dayTitleTemplates, undefined);

const withSchedules = {
  ...sample,
  microcycles: [
    {
      ...sample.microcycles[0],
      daySchedules: [{ dayIndex: 2, startTime: "10:00", endTime: "12:00" }],
    },
  ],
};
const doc3 = buildTrainingMicrocycleTaskDocument(withSchedules, 1);
const migrated3 = migrateTrainingMicrocycleFromFirestore({ stateJson: doc3.stateJson, version: 5 });
assert.equal(migrated3.microcycles[0].daySchedules.length, 1);
assert.equal(migrated3.microcycles[0].daySchedules[0].startTime, "10:00");

const inner = buildSanitizedTrainingMicrocycleState({
  ...withAssign,
  assignments: [{ ...withAssign.assignments[0], dayIndex: Number.NaN as unknown as number }],
});
assert.strictEqual((inner.assignments as { dayIndex: number }[])[0].dayIndex, 0);

const withPhase = {
  ...sample,
  dayPlans: [
    {
      id: "dp-phase",
      microcycleId: sample.microcycles[0].id,
      dayIndex: 0,
      templateId: null,
      generalFocus: "Dzień obrony",
      gameMoments: "Pressing",
      phaseId: "defense" as const,
    },
  ],
};
const docPhase = buildTrainingMicrocycleTaskDocument(withPhase, 1);
const migratedPhase = migrateTrainingMicrocycleFromFirestore({
  stateJson: docPhase.stateJson,
  version: 6,
});
assert.equal(migratedPhase.dayPlans[0].phaseId, "defense");

const migratedV5NoPhase = migrateTrainingMicrocycleFromFirestore({
  stateJson: JSON.stringify({
    ...legacyWithDayTitle,
    dayPlans: [{ ...legacyWithDayTitle.dayPlans[0], phaseId: "bad" }],
  }),
  version: 5,
});
assert.equal(migratedV5NoPhase.dayPlans[0].phaseId, null);

// Bloki treningowe i nadpisania obciążenia przechodzą pełny cykl zapis → odczyt
const withMotor = {
  ...sample,
  microcycles: [
    {
      ...sample.microcycles[0],
      dayLoads: [{ dayIndex: 2, dominant: "velocity" as const, targets: { srpe: 480 } }],
    },
  ],
  trainingBlocks: [
    {
      id: "blk1",
      microcycleId: sample.microcycles[0].id,
      dayIndex: 1,
      order: 0,
      name: "SSG 3v3",
      minutes: 26,
      formatId: "3v3",
      pitchLength: 30,
      pitchWidth: 20,
      playersPerSide: 3,
      tags: ["ssg" as const, "acceleration" as const],
      notes: "gol z ≤3 podań",
    },
  ],
};
const docMotor = buildTrainingMicrocycleTaskDocument(withMotor, 1);
const migratedMotor = migrateTrainingMicrocycleFromFirestore({
  stateJson: docMotor.stateJson,
  version: 8,
});
assert.equal(migratedMotor.trainingBlocks?.length, 1);
assert.equal(migratedMotor.trainingBlocks?.[0].minutes, 26);
assert.deepEqual(migratedMotor.trainingBlocks?.[0].tags, ["ssg", "acceleration"]);
assert.equal(migratedMotor.microcycles[0].dayLoads?.[0].dominant, "velocity");
assert.equal(migratedMotor.microcycles[0].dayLoads?.[0].targets?.srpe, 480);

const withRest = {
  ...sample,
  microcycles: [{ ...sample.microcycles[0], restDays: [2, 2, 9] }],
};
const restDoc = buildTrainingMicrocycleTaskDocument(withRest, 1);
const migratedRest = migrateTrainingMicrocycleFromFirestore({
  stateJson: restDoc.stateJson,
  version: 10,
});
assert.deepEqual(migratedRest.microcycles[0].restDays, [2]);

// Terminarz ŁNP nie może ginąć przy zapisie (regresja: pola lnp* były pomijane)
const withFixtures = {
  ...sample,
  lnpTeamUrl: "https://www.laczynaspilka.pl/rozgrywki/druzyna/abc?tab=tab-mecz",
  lnpTeamId: "abc",
  lnpTeamName: "Świt II",
  lnpFixturesFetchedAt: "2026-07-29T18:00:00.000Z",
  lnpFixtures: [
    {
      matchId: "m1",
      dateTime: "2026-08-08T17:00:00",
      state: "Planowany",
      playId: "p1",
      playName: "Liga okręgowa",
      hostId: "abc",
      hostName: "Świt II",
      guestId: "xyz",
      guestName: "Mazur Radzymin",
      stadium: "Nowy Dwór",
      scoreFinal: null,
    },
  ],
};
const docFixtures = buildTrainingMicrocycleTaskDocument(withFixtures, 1);
const migratedFixtures = migrateTrainingMicrocycleFromFirestore({
  stateJson: docFixtures.stateJson,
  version: 8,
});
assert.equal(migratedFixtures.lnpTeamId, "abc");
assert.equal(migratedFixtures.lnpTeamName, "Świt II");
assert.equal(migratedFixtures.lnpFixtures?.length, 1);
assert.equal(migratedFixtures.lnpFixtures?.[0].guestName, "Mazur Radzymin");
assert.equal(migratedFixtures.lnpFixturesFetchedAt, "2026-07-29T18:00:00.000Z");

// v10: podgląd terminarza innego zespołu
const withWatch = {
  ...withFixtures,
  lnpWatchTeamUrl: "https://www.laczynaspilka.pl/rozgrywki/druzyna/watch1?tab=tab-mecz",
  lnpWatchTeamId: "watch1",
  lnpWatchTeamName: "Świt I",
  lnpWatchFixturesFetchedAt: "2026-08-01T10:00:00.000Z",
  lnpWatchFixtures: [
    {
      matchId: "w1",
      dateTime: "2026-08-09T17:00:00",
      state: "Planowany",
      playId: "p2",
      playName: "III liga",
      hostId: "watch1",
      hostName: "Świt I",
      guestId: "opp",
      guestName: "GKS",
      stadium: "",
      scoreFinal: null,
    },
  ],
};
const docWatch = buildTrainingMicrocycleTaskDocument(withWatch, 1);
assert.strictEqual(docWatch.version, 11);
const migratedWatch = migrateTrainingMicrocycleFromFirestore({
  stateJson: docWatch.stateJson,
  version: 10,
});
assert.equal(migratedWatch.lnpWatchTeamId, "watch1");
assert.equal(migratedWatch.lnpWatchTeamName, "Świt I");
assert.equal(migratedWatch.lnpWatchFixtures?.length, 1);
assert.equal(migratedWatch.lnpWatchFixturesFetchedAt, "2026-08-01T10:00:00.000Z");

// Stan bez terminarza i bez motoryki nie wysypuje migracji
const migratedBare = migrateTrainingMicrocycleFromFirestore({
  stateJson: JSON.stringify(legacyWithDayTitle),
  version: 4,
});
assert.deepEqual(migratedBare.lnpFixtures, []);
assert.equal(migratedBare.lnpTeamId, null);
assert.deepEqual(migratedBare.lnpWatchFixtures, []);
assert.equal(migratedBare.lnpWatchTeamId, null);
assert.deepEqual(migratedBare.trainingBlocks, []);
assert.deepEqual(migratedBare.proceduralTasks, []);

// v9: nawierzchnia/pogoda + zadania procesowe
const withProcedural = {
  ...sample,
  microcycles: [
    {
      ...sample.microcycles[0],
      matches: [
        {
          ...sample.microcycles[0].matches[0],
          surface: "natural" as const,
          weatherCondition: "cloudy" as const,
          weatherTempC: 16,
        },
      ],
    },
  ],
  proceduralTasks: [
    {
      id: "pt1",
      microcycleId: sample.microcycles[0].id,
      dayIndex: 4,
      templateId: "tpl-weather",
      title: "Sprawdzenie pogody na dzień meczowy",
      notes: "",
      done: false,
    },
  ],
};
const docV9 = buildTrainingMicrocycleTaskDocument(withProcedural, 1);
assert.strictEqual(docV9.version, 11);
const migratedV9 = migrateTrainingMicrocycleFromFirestore({
  stateJson: docV9.stateJson,
  version: 9,
});
assert.equal(migratedV9.microcycles[0].matches[0].surface, "natural");
assert.equal(migratedV9.microcycles[0].matches[0].weatherCondition, "cloudy");
assert.equal(migratedV9.microcycles[0].matches[0].weatherTempC, 16);
assert.equal(migratedV9.proceduralTasks?.length, 1);
assert.ok(migratedV9.proceduralTasks?.[0].title.includes("pogody"));

// Legacy bez nowych pól meczu
const migratedLegacyMatch = migrateTrainingMicrocycleFromFirestore({
  stateJson: JSON.stringify({
    ...legacyWithDayTitle,
    microcycles: [
      {
        ...sample.microcycles[0],
        matches: [
          {
            dayIndex: 5,
            kickoffTime: "18:00",
            opponent: "X",
            venue: "home",
            competition: "league",
            venueAddress: "",
          },
        ],
      },
    ],
  }),
  version: 8,
});
assert.equal(migratedLegacyMatch.microcycles[0].matches[0].surface, null);
assert.equal(migratedLegacyMatch.microcycles[0].matches[0].weatherTempC, null);
assert.equal(migratedLegacyMatch.microcycles[0].matches[0].departureTime, "");
assert.deepEqual(migratedLegacyMatch.proceduralTasks, []);

console.log("trainingMicrocycleFirestore.test.ts: OK");
