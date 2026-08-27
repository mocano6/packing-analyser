import assert from "assert";
import type { MicrocycleTrainingBlock } from "@/types/trainingMicrocycle";
import {
  applyFormatToBlock,
  blockAreaPerPlayer,
  blocksForDay,
  blocksForMicrocycle,
  createEmptyBlock,
  moveBlockToDay,
  normalizeDayLoads,
  normalizeTrainingBlocks,
  presetBlocksForDay,
  presetBlocksForMicrocycle,
  removeBlocksForMicrocycle,
  safeBlockMinutes,
  setDayLoadOverride,
} from "./microcycleTrainingBlocks";
import { createDefaultTrainingMicrocycleState } from "./trainingMicrocycle";

// Bloki z presetu: poniedziałek (siła) przy meczu w sobotę
const mdStrength = presetBlocksForDay("mc1", 0, [5]);
assert.ok(mdStrength.length > 0);
assert.ok(mdStrength.some((b) => b.tags.includes("gym")));
assert.ok(mdStrength.some((b) => b.tags.includes("strength_max")));
assert.ok(mdStrength.some((b) => b.tags.includes("nordic")));
assert.ok(mdStrength.every((b) => b.dayIndex === 0 && b.microcycleId === "mc1"));
assert.deepEqual(
  mdStrength.map((b) => b.order),
  mdStrength.map((_, i) => i)
);

const ssgBlock = mdStrength.find((b) => b.formatId === "4v4");
assert.ok(ssgBlock);
assert.equal(ssgBlock?.pitchLength, 40);
assert.equal(ssgBlock?.pitchWidth, 30);
assert.equal(blockAreaPerPlayer(ssgBlock as MicrocycleTrainingBlock), 150);

// Niedziela (poza rotacją) — brak bloków; ciężka siła jest w poniedziałek
assert.equal(presetBlocksForDay("mc1", 6, [5]).length, 0);

// Wtorek — napięcie/moc, bez ciężkiej siły i bez Nordica
const mdTension = presetBlocksForDay("mc1", 1, [5]);
assert.ok(mdTension.some((b) => b.tags.includes("power")));
assert.ok(mdTension.some((b) => b.tags.includes("gym")));
assert.ok(!mdTension.some((b) => b.tags.includes("strength_max")));
assert.ok(!mdTension.some((b) => b.tags.includes("nordic")));

// Środa — objętość (nie wolne)
const mdVolume = presetBlocksForDay("mc1", 2, [5]);
assert.ok(mdVolume.length > 0);
assert.ok(mdVolume.some((b) => b.formatId === "11v11"));
assert.ok(!mdVolume.some((b) => b.tags.includes("strength_max")));

// Piątek (MD-1, wolne w modelu 4 jednostek) nie dostaje bloków
assert.equal(presetBlocksForDay("mc1", 4, [5]).length, 0);

// Cały tydzień: bloki tylko w pn–czw
const week = presetBlocksForMicrocycle({
  id: "mc1",
  seasonId: "s1",
  number: 1,
  weekStartIso: "2026-08-03",
  matches: [{ dayIndex: 5, kickoffTime: "17:00", opponent: "Mazur", venue: "home", departureTime: "", competition: "league", venueAddress: "", surface: null, weatherCondition: null, weatherTempC: null }],
  daySchedules: [],
});
assert.ok(week.length > 20);
assert.equal(week.filter((b) => b.dayIndex === 4).length, 0);
assert.ok(week.filter((b) => b.dayIndex === 0).length > 0);
assert.equal(blocksForDay(week, 1).length, presetBlocksForDay("mc1", 1, [5]).length);

// Wybór formatu podstawia wymiary, wyczyszczenie je zostawia bez formatu
const empty = createEmptyBlock("mc1", 3, 0);
assert.equal(empty.formatId, null);
assert.equal(blockAreaPerPlayer(empty), null);
const with7v7 = applyFormatToBlock(empty, "7v7");
assert.equal(with7v7.pitchLength, 60);
assert.equal(with7v7.pitchWidth, 45);
assert.equal(with7v7.playersPerSide, 7);
assert.equal(blockAreaPerPlayer(with7v7), 193);
assert.equal(applyFormatToBlock(with7v7, "nieistniejacy").formatId, null);

// Ręczne wymiary liczą m²/gracz niezależnie od formatu
assert.equal(blockAreaPerPlayer({ ...with7v7, pitchLength: 50, pitchWidth: 40 }), 143);

// Minuty: obcinanie śmieci i limit
assert.equal(safeBlockMinutes(15), 15);
assert.equal(safeBlockMinutes("20"), 20);
assert.equal(safeBlockMinutes(-5), 0);
assert.equal(safeBlockMinutes("abc"), 0);
assert.equal(safeBlockMinutes(9999), 240);

// Normalizacja z Firestore: odrzuca wpisy bez mikrocyklu i nieznane tagi
const normalized = normalizeTrainingBlocks([
  {
    id: "b1",
    microcycleId: "mc1",
    dayIndex: 9,
    order: 1,
    name: "Blok",
    minutes: 20,
    formatId: "6v6",
    pitchLength: 55,
    pitchWidth: 40,
    playersPerSide: 6,
    tags: ["ssg", "nieznany", "nordic", "ssg"],
    notes: "x",
  },
  { id: "b2", dayIndex: 1 },
  null,
  "nonsens",
]);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].dayIndex, 0); // 9 poza zakresem → 0
assert.deepEqual(normalized[0].tags, ["ssg", "nordic"]);
assert.equal(normalized[0].formatId, "6v6");
assert.equal(normalizeTrainingBlocks("nie tablica").length, 0);

// Filtrowanie po mikrocyklu i sortowanie
const mixed = [...presetBlocksForDay("mc2", 1, [5]), ...mdStrength];
const onlyMc1 = blocksForMicrocycle(mixed, "mc1");
assert.ok(onlyMc1.every((b) => b.microcycleId === "mc1"));
assert.equal(blocksForMicrocycle(mixed, null).length, 0);

// Nadpisania obciążenia dnia: dopisywanie, scalanie, usuwanie pustego wpisu
let dayLoads = setDayLoadOverride([], 2, { dominant: "velocity" });
assert.equal(dayLoads.length, 1);
dayLoads = setDayLoadOverride(dayLoads, 2, { targets: { srpe: 500 } });
assert.equal(dayLoads[0].dominant, "velocity");
assert.equal(dayLoads[0].targets?.srpe, 500);
dayLoads = setDayLoadOverride(dayLoads, 2, { targets: { minutes: 90 } });
assert.equal(dayLoads[0].targets?.srpe, 500);
assert.equal(dayLoads[0].targets?.minutes, 90);
dayLoads = setDayLoadOverride(dayLoads, 2, { dominant: null, targets: null as never });
assert.equal(dayLoads.length, 0);

// Normalizacja nadpisań: puste wpisy wypadają, ujemne wartości ignorowane
const loadsFromFirestore = normalizeDayLoads([
  { dayIndex: 1, dominant: "tension", targets: { srpe: 600, hsrPct: -20 } },
  { dayIndex: 2 },
  { dayIndex: 3, targets: {} },
]);
assert.equal(loadsFromFirestore.length, 1);
assert.equal(loadsFromFirestore[0].targets?.srpe, 600);
assert.equal(loadsFromFirestore[0].targets?.hsrPct, undefined);

// Usuwanie mikrocyklu czyści jego bloki
const state = {
  ...createDefaultTrainingMicrocycleState(),
  trainingBlocks: [...mdStrength, ...presetBlocksForDay("mc2", 0, [5])],
};
const cleaned = removeBlocksForMicrocycle(state, "mc1");
assert.ok(cleaned.trainingBlocks?.every((b) => b.microcycleId === "mc2"));
assert.equal(removeBlocksForMicrocycle({ ...state, trainingBlocks: [] }, "mc1").trainingBlocks?.length, 0);

// Przenoszenie bloku między dniami — na koniec listy dnia docelowego
const a = createEmptyBlock("mc1", 1, 0);
const b = createEmptyBlock("mc1", 1, 1);
const c = createEmptyBlock("mc1", 3, 0);
const moved = moveBlockToDay([a, b, c], a.id, 3);
assert.equal(moved.find((x) => x.id === a.id)?.dayIndex, 3);
assert.equal(moved.find((x) => x.id === a.id)?.order, 1);
assert.equal(moved.find((x) => x.id === b.id)?.dayIndex, 1);
assert.deepEqual(moveBlockToDay([a, b], a.id, 1), [a, b]); // ten sam dzień
assert.deepEqual(moveBlockToDay([a, b], "brak", 2), [a, b]); // nieznany id

console.log("microcycleTrainingBlocks.test OK");
