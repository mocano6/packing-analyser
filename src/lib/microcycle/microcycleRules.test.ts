import assert from "assert";
import type { MicrocycleTrainingBlock, TrainingMicrocycle } from "@/types/trainingMicrocycle";
import { createDefaultMicrocycleMatch } from "@/utils/microcycleMatches";
import { presetBlocksForMicrocycle } from "@/utils/microcycleTrainingBlocks";
import { countBySeverity, evaluateMicrocycleRules, methodologyPrincipleChecks } from "./microcycleRules";
import { summarizeWeeklyLoad, resolveWeekLoads } from "@/utils/microcycleLoad";
import {
  applySessionTemplatesToWeek,
  createSeedDaySessionTemplates,
} from "@/utils/daySessionTemplates";
import { createDefaultTrainingMicrocycleState } from "@/utils/trainingMicrocycle";
import { methodologyPrincipleCatalog } from "./motorModel";

function microcycle(overrides: Partial<TrainingMicrocycle> = {}): TrainingMicrocycle {
  return {
    id: "mc1",
    seasonId: "s1",
    number: 1,
    weekStartIso: "2026-08-03",
    matches: [{ ...createDefaultMicrocycleMatch(5), opponent: "Mazur" }],
    daySchedules: [],
    ...overrides,
  };
}

function ruleIds(violations: { ruleId: string }[]): string[] {
  return violations.map((v) => v.ruleId);
}

// --- Mikrocykl z presetów: model referencyjny nie łamie własnych zasad ---
const base = microcycle();
const presetBlocks = presetBlocksForMicrocycle(base);
const weeklySrpe = summarizeWeeklyLoad(resolveWeekLoads(base, presetBlocks)).totalSrpe;
const history = [weeklySrpe, weeklySrpe, weeklySrpe];

const clean = evaluateMicrocycleRules({
  microcycle: base,
  blocks: presetBlocks,
  previousWeeklySrpe: history,
});
const cleanIds = ruleIds(clean);
assert.ok(!cleanIds.includes("volume_heaviest"), `Objętość zgłoszona: ${cleanIds.join(", ")}`);
assert.ok(!cleanIds.includes("md1_lightest"));
assert.ok(!cleanIds.includes("sprint_exposure"));
assert.ok(!cleanIds.includes("nordic_exposure"));
assert.ok(!cleanIds.includes("strength_exposure"));
assert.ok(!cleanIds.includes("acwr_range"));
assert.ok(!cleanIds.includes("weekly_jump"));
assert.equal(countBySeverity(clean).critical, 0);
// Model referencyjny nie może łamać własnych zasad: pn–czw role nie dają dwóch ciężkich pod rząd
assert.ok(
  !cleanIds.includes("no_two_heavy_in_row"),
  `Preset ról uznany za dwa ciężkie dni: ${cleanIds.join(", ")}`
);
assert.ok(
  !cleanIds.includes("md1_duration"),
  `Preset MD-1 przekracza limit czasu: ${cleanIds.join(", ")}`
);
assert.ok(!cleanIds.includes("gym_after_pitch"), `Siłownia po boisku: ${cleanIds.join(", ")}`);
assert.ok(!cleanIds.includes("nordic_too_close"));
assert.ok(!cleanIds.includes("split_groups_missing"), `Brak rozdzielenia grup: ${cleanIds.join(", ")}`);
assert.ok(!cleanIds.includes("heavy_legs_near_match"));
assert.ok(!cleanIds.includes("gym_on_md1"));
const cleanChecks = methodologyPrincipleChecks(clean, { hasBlocks: true });
assert.equal(cleanChecks.length, 10);
assert.ok(
  cleanChecks.every((c) => c.status === "ok"),
  `Preset nie przechodzi metodyki: ${cleanChecks
    .filter((c) => c.status !== "ok")
    .map((c) => `${c.id}=${c.status}`)
    .join(", ")}`
);

// --- Tydzień z presetów rolowych (mecz w sobotę, treningi pn–czw) nie łamie zasad ---
const roleWeekState = applySessionTemplatesToWeek(
  {
    ...createDefaultTrainingMicrocycleState(),
    microcycles: [microcycle({ restDays: [4, 6], dayLoads: [] })],
    activeMicrocycleId: "mc1",
    trainingBlocks: [],
  },
  "mc1",
  [5],
  createSeedDaySessionTemplates()
);
const roleMicrocycle = roleWeekState.state.microcycles[0];
const roleBlocks = roleWeekState.state.trainingBlocks ?? [];
const roleSrpe = summarizeWeeklyLoad(resolveWeekLoads(roleMicrocycle, roleBlocks)).totalSrpe;
const roleWeek = evaluateMicrocycleRules({
  microcycle: roleMicrocycle,
  blocks: roleBlocks,
  previousWeeklySrpe: [roleSrpe, roleSrpe, roleSrpe],
});
const roleWeekIds = ruleIds(roleWeek);
assert.equal(
  countBySeverity(roleWeek).critical,
  0,
  `Zestaw czterech jednostek łamie zasadę krytyczną: ${roleWeekIds.join(", ")}`
);
for (const ruleId of [
  "volume_heaviest",
  "md1_lightest",
  "md1_duration",
  "no_two_heavy_in_row",
  "gym_after_pitch",
  "gym_transfer_missing",
  "gym_too_long",
  "nordic_too_close",
  "heavy_on_volume",
  "heavy_before_volume",
  "sprint_exposure",
  "nordic_exposure",
  "strength_exposure",
]) {
  assert.ok(
    !roleWeekIds.includes(ruleId),
    `Zestaw czterech jednostek zgłasza ${ruleId}: ${roleWeekIds.join(", ")}`
  );
}

const roleWeekOpen = applySessionTemplatesToWeek(
  {
    ...createDefaultTrainingMicrocycleState(),
    microcycles: [microcycle({ restDays: [], dayLoads: [] })],
    activeMicrocycleId: "mc1",
    trainingBlocks: [],
  },
  "mc1",
  [5],
  createSeedDaySessionTemplates()
);
assert.equal(roleWeekOpen.applied, 4);
assert.deepEqual(roleWeekOpen.state.microcycles[0].restDays, [4, 6]);

// --- Brak bloków: zasady sprintu/siły w skip, bez fałszywych alarmów ---
const noBlocks = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [],
  previousWeeklySrpe: history,
});
assert.ok(!ruleIds(noBlocks).includes("sprint_exposure"));
assert.ok(!ruleIds(noBlocks).includes("no_blocks"));
const noBlockChecks = methodologyPrincipleChecks(noBlocks, { hasBlocks: false });
assert.ok(noBlockChecks.find((c) => c.id === "sprint_week")?.status === "skip");
assert.ok(noBlockChecks.find((c) => c.id === "gym_first")?.status === "skip");
assert.ok(noBlockChecks.find((c) => c.id === "load_shape")?.status === "ok");

// --- Dzień objętości nie jest najcięższy (środa przy meczu w sobotę) ---
const volumeTooLight = evaluateMicrocycleRules({
  microcycle: microcycle({
    dayLoads: [
      { dayIndex: 2, dominant: null, targets: { srpe: 300 } },
      { dayIndex: 0, dominant: null, targets: { srpe: 700 } },
    ],
  }),
  blocks: presetBlocks,
  previousWeeklySrpe: history,
});
const volumeViolation = volumeTooLight.find((v) => v.ruleId === "volume_heaviest");
assert.ok(volumeViolation, "Brak wykrycia zbyt lekkiego dnia objętości");
assert.equal(volumeViolation?.severity, "critical");
assert.equal(volumeViolation?.principleId, "load_shape");
assert.equal(volumeViolation?.dayIndex, 2);

// --- MD-1 cięższy niż inne dni treningowe ---
const md1TooHeavy = evaluateMicrocycleRules({
  microcycle: microcycle({
    dayLoads: [{ dayIndex: 4, dominant: null, targets: { srpe: 900 } }],
  }),
  blocks: presetBlocks,
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(md1TooHeavy).includes("md1_lightest"));

// Czas MD-1 liczy się z bloków, nie z modelu — długi blok przekracza limit
const md1TooLong = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [
    ...presetBlocks,
    {
      id: "extra-md1",
      microcycleId: "mc1",
      dayIndex: 4,
      order: 9,
      name: "Dodatkowa taktyka",
      minutes: 90,
      formatId: null,
      pitchLength: null,
      pitchWidth: null,
      playersPerSide: null,
      tags: [],
      notes: "",
    },
  ],
  previousWeeklySrpe: history,
});
const md1Duration = md1TooLong.find((v) => v.ruleId === "md1_duration");
assert.ok(md1Duration, "Brak wykrycia zbyt długiego MD-1");
assert.equal(md1Duration?.severity, "warning");
assert.equal(md1Duration?.dayIndex, 4);

// Nadpisanie samego modelu (bez bloków) też podlega limitowi
const md1TargetTooLong = evaluateMicrocycleRules({
  microcycle: microcycle({
    dayLoads: [{ dayIndex: 4, dominant: null, targets: { minutes: 95 } }],
  }),
  blocks: [],
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(md1TargetTooLong).includes("md1_duration"));

// --- Dwa ciężkie dni pod rząd ---
const backToBack = evaluateMicrocycleRules({
  microcycle: microcycle({
    dayLoads: [
      { dayIndex: 0, dominant: null, targets: { srpe: 700 } },
      { dayIndex: 1, dominant: null, targets: { srpe: 750 } },
    ],
  }),
  blocks: presetBlocks,
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(backToBack).includes("no_two_heavy_in_row"));

// --- Brak sprintu, Nordica i siły w tygodniu ---
const barebones: MicrocycleTrainingBlock[] = [
  {
    id: "b1",
    microcycleId: "mc1",
    dayIndex: 1,
    order: 0,
    name: "Gra 10v10",
    minutes: 30,
    formatId: "10v10",
    pitchLength: 80,
    pitchWidth: 64,
    playersPerSide: 10,
    tags: ["ssg"],
    notes: "",
  },
];
const missing = evaluateMicrocycleRules({
  microcycle: base,
  blocks: barebones,
  previousWeeklySrpe: history,
});
const missingIds = ruleIds(missing);
assert.ok(missingIds.includes("sprint_exposure"));
assert.ok(missingIds.includes("nordic_exposure"));
assert.ok(missingIds.includes("strength_exposure"));
assert.equal(missing.find((v) => v.ruleId === "sprint_exposure")?.severity, "critical");
// Podpowiedź kieruje na MD-2 (czwartek przy meczu w sobotę)
assert.equal(missing.find((v) => v.ruleId === "sprint_exposure")?.dayIndex, 3);

// --- Sprint maksymalny na dniu napięcia (wtorek) jest ostrzeżeniem ---
const sprintOnTension = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [
    ...presetBlocks,
    {
      id: "sprint-tension",
      microcycleId: "mc1",
      dayIndex: 1,
      order: 9,
      name: "Sprinty 6× 40 m",
      minutes: 12,
      formatId: null,
      pitchLength: null,
      pitchWidth: null,
      playersPerSide: null,
      tags: ["sprint_max"],
      notes: "",
    },
  ],
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(sprintOnTension).includes("sprint_on_tension"));

// --- Nordic w MD-2 jest krytyczny ---
const nordicFriday = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [
    ...presetBlocks,
    {
      id: "nordic-md2",
      microcycleId: "mc1",
      dayIndex: 3,
      order: 9,
      name: "Nordic 3× 6",
      minutes: 8,
      formatId: null,
      pitchLength: null,
      pitchWidth: null,
      playersPerSide: null,
      tags: ["nordic"],
      notes: "",
    },
  ],
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(nordicFriday).includes("nordic_too_close"));
assert.equal(
  nordicFriday.find((v) => v.ruleId === "nordic_too_close")?.principleId,
  "nordic_timing"
);

// --- Siłownia w MD+1 bez rozdzielenia grup ---
const noSplit = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [
    ...presetBlocks.filter((b) => b.dayIndex !== 6),
    {
      id: "gym-md1plus",
      microcycleId: "mc1",
      dayIndex: 6,
      order: 0,
      name: "Siłownia ciężka",
      minutes: 50,
      formatId: null,
      pitchLength: null,
      pitchWidth: null,
      playersPerSide: null,
      tags: ["gym", "strength_max"],
      notes: "",
    },
  ],
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(noSplit).includes("split_groups_missing"));
assert.equal(
  methodologyPrincipleChecks(noSplit, { hasBlocks: true }).find((c) => c.id === "split_groups")
    ?.status,
  "warn"
);

// --- Ciężka siła w MD-2 łamie „siłownia pod mecz” ---
const heavyNearMatch = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [
    ...presetBlocks,
    {
      id: "heavy-md2",
      microcycleId: "mc1",
      dayIndex: 3,
      order: 9,
      name: "Przysiad 5×5",
      minutes: 25,
      formatId: null,
      pitchLength: null,
      pitchWidth: null,
      playersPerSide: null,
      tags: ["gym", "strength_max"],
      notes: "",
    },
  ],
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(heavyNearMatch).includes("heavy_legs_near_match"));

// --- Deload w 4. mikrocyklu ---
const noDeload = evaluateMicrocycleRules({
  microcycle: microcycle({ number: 4 }),
  blocks: presetBlocks,
  previousWeeklySrpe: [weeklySrpe, weeklySrpe, weeklySrpe],
});
assert.ok(ruleIds(noDeload).includes("deload_due"));

const withDeload = evaluateMicrocycleRules({
  microcycle: microcycle({
    number: 4,
    dayLoads: [
      { dayIndex: 0, dominant: null, targets: { srpe: 200 } },
      { dayIndex: 1, dominant: null, targets: { srpe: 300 } },
      { dayIndex: 2, dominant: null, targets: { srpe: 280 } },
      { dayIndex: 3, dominant: null, targets: { srpe: 250 } },
      { dayIndex: 4, dominant: null, targets: { srpe: 150 } },
      { dayIndex: 6, dominant: null, targets: { srpe: 120 } },
    ],
  }),
  blocks: presetBlocks,
  previousWeeklySrpe: [weeklySrpe, weeklySrpe, weeklySrpe],
});
assert.ok(!ruleIds(withDeload).includes("deload_due"));

// --- Dwa mecze w tygodniu: brak miejsca na trening rozwojowy ---
const twoMatches = evaluateMicrocycleRules({
  microcycle: microcycle({
    matches: [
      { ...createDefaultMicrocycleMatch(2), opponent: "Puchar" },
      { ...createDefaultMicrocycleMatch(5), opponent: "Mazur" },
    ],
    dayLoads: [{ dayIndex: 0, dominant: "duration", targets: { srpe: 700 } }],
  }),
  blocks: presetBlocks,
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(twoMatches).includes("two_matches_development"));
assert.equal(
  twoMatches.find((v) => v.ruleId === "two_matches_development")?.principleId,
  null
);

// --- Krytyczne zawsze na początku listy ---
const sorted = evaluateMicrocycleRules({
  microcycle: microcycle({
    dayLoads: [{ dayIndex: 2, dominant: null, targets: { srpe: 100 } }],
  }),
  blocks: barebones,
  previousWeeklySrpe: history,
});
const severities = sorted.map((v) => v.severity);
const firstWarningIdx = severities.indexOf("warning");
const lastCriticalIdx = severities.lastIndexOf("critical");
if (firstWarningIdx >= 0 && lastCriticalIdx >= 0) {
  assert.ok(lastCriticalIdx < firstWarningIdx, "Naruszenia nie są posortowane po wadze");
}

console.log("microcycleRules.test OK");
