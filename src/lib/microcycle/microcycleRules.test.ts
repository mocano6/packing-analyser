import assert from "assert";
import type { MicrocycleTrainingBlock, TrainingMicrocycle } from "@/types/trainingMicrocycle";
import { createDefaultMicrocycleMatch } from "@/utils/microcycleMatches";
import { presetBlocksForMicrocycle } from "@/utils/microcycleTrainingBlocks";
import { countBySeverity, evaluateMicrocycleRules } from "./microcycleRules";
import { summarizeWeeklyLoad, resolveWeekLoads } from "@/utils/microcycleLoad";

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
assert.ok(!cleanIds.includes("md3_heaviest"), `MD-3 zgłoszone: ${cleanIds.join(", ")}`);
assert.ok(!cleanIds.includes("md1_lightest"));
assert.ok(!cleanIds.includes("sprint_exposure"));
assert.ok(!cleanIds.includes("nordic_exposure"));
assert.ok(!cleanIds.includes("strength_exposure"));
assert.ok(!cleanIds.includes("acwr_range"));
assert.ok(!cleanIds.includes("weekly_jump"));
assert.equal(countBySeverity(clean).critical, 0);
// Model referencyjny nie może łamać własnych zasad: MD-4 i MD-3 stoją obok siebie,
// a MD-1 z presetu musi mieścić się w limicie czasu
assert.ok(
  !cleanIds.includes("no_two_heavy_in_row"),
  `Preset MD-4/MD-3 uznany za dwa ciężkie dni: ${cleanIds.join(", ")}`
);
assert.ok(
  !cleanIds.includes("md1_duration"),
  `Preset MD-1 przekracza limit czasu: ${cleanIds.join(", ")}`
);
assert.ok(!cleanIds.includes("pitch_density_mismatch"), `Boiska z presetu niezgodne: ${cleanIds.join(", ")}`);

// --- Brak bloków: reguły tagowe wyłączone, zamiast fałszywych alarmów info ---
const noBlocks = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [],
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(noBlocks).includes("no_blocks"));
assert.ok(!ruleIds(noBlocks).includes("sprint_exposure"));
assert.ok(!ruleIds(noBlocks).includes("pitch_density_mismatch"));

// --- MD-3 nie jest najcięższy ---
const md3TooLight = evaluateMicrocycleRules({
  microcycle: microcycle({
    dayLoads: [
      { dayIndex: 2, dominant: null, targets: { srpe: 300 } },
      { dayIndex: 1, dominant: null, targets: { srpe: 700 } },
    ],
  }),
  blocks: presetBlocks,
  previousWeeklySrpe: history,
});
const md3Violation = md3TooLight.find((v) => v.ruleId === "md3_heaviest");
assert.ok(md3Violation, "Brak wykrycia zbyt lekkiego MD-3");
assert.equal(md3Violation?.severity, "critical");
assert.equal(md3Violation?.dayIndex, 2);

// --- MD-1 cięższy niż inne dni treningowe ---
const md1TooHeavy = evaluateMicrocycleRules({
  microcycle: microcycle({
    dayLoads: [{ dayIndex: 4, dominant: null, targets: { srpe: 900 } }],
  }),
  blocks: presetBlocks,
  previousWeeklySrpe: history,
});
assert.ok(ruleIds(md1TooHeavy).includes("md1_lightest"));

// Czas MD-1 liczy się z bloków, nie z modelu — dodatkowy blok przekracza limit
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
      minutes: 25,
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
      { dayIndex: 1, dominant: null, targets: { srpe: 700 } },
      { dayIndex: 2, dominant: null, targets: { srpe: 750 } },
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
    dayIndex: 2,
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

// --- Sprint maksymalny na MD-4 jest ostrzeżeniem ---
const sprintOnMd4 = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [
    ...presetBlocks,
    {
      id: "sprint-md4",
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
assert.ok(ruleIds(sprintOnMd4).includes("sprint_on_md4"));

// --- Boisko niezgodne z dominantą: duże pole na dniu napięcia (MD-4) ---
const wrongPitch = evaluateMicrocycleRules({
  microcycle: base,
  blocks: [
    {
      id: "b2",
      microcycleId: "mc1",
      dayIndex: 1,
      order: 0,
      name: "Gra 10v10",
      minutes: 30,
      formatId: "10v10",
      pitchLength: 80,
      pitchWidth: 64,
      playersPerSide: 10,
      tags: ["ssg", "sprint_max", "nordic", "strength_max"],
      notes: "",
    },
  ],
  previousWeeklySrpe: history,
});
const pitchViolation = wrongPitch.find((v) => v.ruleId === "pitch_density_mismatch");
assert.ok(pitchViolation, "Brak wykrycia zbyt dużego boiska na MD-4");
assert.equal(pitchViolation?.dayIndex, 1);
assert.ok(pitchViolation?.message.includes("256 m²/gracz"));

// --- ACWR: skok obciążenia po lekkich tygodniach ---
const acwrSpike = evaluateMicrocycleRules({
  microcycle: base,
  blocks: presetBlocks,
  previousWeeklySrpe: [800, 800, 800],
});
const acwrViolation = acwrSpike.find((v) => v.ruleId === "acwr_range");
assert.ok(acwrViolation, "Brak wykrycia wysokiego ACWR");
assert.equal(acwrViolation?.severity, "critical");
assert.ok(ruleIds(acwrSpike).includes("weekly_jump"));

// --- Za mało historii: info, nie alarm ---
const shortHistory = evaluateMicrocycleRules({
  microcycle: base,
  blocks: presetBlocks,
  previousWeeklySrpe: [],
});
assert.ok(ruleIds(shortHistory).includes("acwr_history"));
assert.ok(!ruleIds(shortHistory).includes("acwr_range"));

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
      { dayIndex: 1, dominant: null, targets: { srpe: 300 } },
      { dayIndex: 2, dominant: null, targets: { srpe: 350 } },
      { dayIndex: 3, dominant: null, targets: { srpe: 250 } },
      { dayIndex: 4, dominant: null, targets: { srpe: 150 } },
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
