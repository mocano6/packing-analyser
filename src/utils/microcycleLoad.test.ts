import assert from "assert";
import type { TrainingMicrocycle } from "@/types/trainingMicrocycle";
import { createDefaultMicrocycleMatch } from "./microcycleMatches";
import {
  computeAcwr,
  isHeavyDay,
  moveResolvedDayLoad,
  primaryMatchDayIndex,
  resolveDayLoad,
  resolveWeekLoads,
  swapResolvedDayLoads,
  summarizeWeeklyLoad,
  weekOverWeekChangePct,
} from "./microcycleLoad";
import { presetBlocksForDay } from "./microcycleTrainingBlocks";

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

// Mecz w sobotę → role: pn siła, wt napięcie, śr objętość, cz prędkość; pt+nd wolne
const base = microcycle();
assert.equal(primaryMatchDayIndex(base), 5);
assert.equal(resolveDayLoad(base, 0).offset, -5);
assert.equal(resolveDayLoad(base, 0).dominant, "recovery");
assert.equal(resolveDayLoad(base, 1).offset, -4);
assert.equal(resolveDayLoad(base, 1).dominant, "tension");
assert.equal(resolveDayLoad(base, 2).dominant, "duration");
assert.equal(resolveDayLoad(base, 3).dominant, "velocity");
assert.equal(resolveDayLoad(base, 4).dominant, "off");
assert.equal(resolveDayLoad(base, 6).dominant, "off");

// Dzień oznaczony jako wolny ma sRPE 0 — nawet gdy model MD przewiduje obciążenie
const restedFri = microcycle({ restDays: [4, 6] });
assert.equal(resolveDayLoad(restedFri, 4).dominant, "off");
assert.equal(resolveDayLoad(restedFri, 4).targets.srpe, 0);
assert.equal(resolveDayLoad(restedFri, 4).plannedMinutes, 0);
assert.equal(resolveDayLoad(restedFri, 6).targets.srpe, 0);
assert.equal(resolveDayLoad(restedFri, 0).targets.srpe, 500);

// Dzień meczowy zawsze dostaje dominantę "match"
const matchDay = resolveDayLoad(base, 5);
assert.equal(matchDay.dominant, "match");
assert.equal(matchDay.isMatchDay, true);
assert.equal(matchDay.targets.totalDistancePct, 100);

// Nadpisanie dominanty i pojedynczego celu
const overridden = microcycle({
  dayLoads: [{ dayIndex: 1, dominant: "velocity", targets: { srpe: 400 } }],
});
const tue = resolveDayLoad(overridden, 1);
assert.equal(tue.dominant, "velocity");
assert.equal(tue.targets.srpe, 400);
assert.equal(tue.customized, true);
// Cele niepodane zostają z presetu roli (napięcie we wtorek)
assert.equal(tue.targets.totalDistancePct, 80);
assert.equal(resolveDayLoad(overridden, 0).customized, false);

// Minuty z bloków mają priorytet nad presetem
const blocks = presetBlocksForDay("mc1", 1, [5]);
assert.ok(blocks.length > 0);
const withBlocks = resolveDayLoad(base, 1, blocks);
assert.equal(
  withBlocks.plannedMinutes,
  blocks.reduce((s, b) => s + b.minutes, 0)
);
assert.equal(resolveDayLoad(base, 1, []).plannedMinutes, null);

// Podsumowanie tygodnia
const loads = resolveWeekLoads(base);
assert.equal(loads.length, 7);
const summary = summarizeWeeklyLoad(loads);
assert.equal(summary.totalSrpe, loads.reduce((s, l) => s + l.targets.srpe, 0));
assert.equal(summary.trainingSrpe, summary.totalSrpe - 850);
assert.ok(summary.monotony != null && summary.monotony > 0);
assert.ok(summary.strain != null && summary.strain > summary.totalSrpe);
// Pn–czw + mecz — pt/nd poza rotacją = 0 AU
assert.equal(summary.activeDays, 5);

// Ciężki dzień: środa (objętość) tak, piątek (wolne) nie
assert.equal(isHeavyDay(resolveDayLoad(base, 2)), true);
assert.equal(isHeavyDay(resolveDayLoad(base, 4)), false);

// ACWR: stabilne obciążenie daje 1.0
const stable = computeAcwr(2000, [2000, 2000, 2000]);
assert.equal(stable.ratio, 1);
assert.equal(stable.reliable, true);
assert.equal(stable.weeksOfHistory, 3);

// Skok obciążenia podnosi ACWR powyżej progu
const spike = computeAcwr(3600, [2000, 2000, 2000]);
assert.ok(spike.ratio != null && spike.ratio > 1.3);

// Brak historii = wynik niewiarygodny, ale nie wysypka
const noHistory = computeAcwr(2000, []);
assert.equal(noHistory.ratio, 1);
assert.equal(noHistory.reliable, false);
assert.equal(noHistory.weeksOfHistory, 0);
assert.equal(computeAcwr(0, []).ratio, null);

// Zmiana tydzień do tygodnia
assert.equal(weekOverWeekChangePct(1100, 1000), 10);
assert.equal(weekOverWeekChangePct(1000, undefined), null);
assert.equal(weekOverWeekChangePct(1000, 0), null);

// Przeniesienie obciążenia: czwartek (velocity) → środa staje się velocity (nadpisanie)
{
  const from = resolveDayLoad(base, 3);
  assert.equal(from.dominant, "velocity");
  const moved = moveResolvedDayLoad(base, 3, 2);
  const atTarget = resolveDayLoad(moved, 2);
  assert.equal(atTarget.dominant, "velocity");
  assert.equal(atTarget.targets.srpe, from.targets.srpe);
  assert.equal(atTarget.customized, true);
  assert.equal(resolveDayLoad(moved, 3).dominant, "velocity");
  assert.equal(resolveDayLoad(moved, 3).customized, false);
}

// Swap obciążenia między dniami
{
  const a = resolveDayLoad(base, 1);
  const b = resolveDayLoad(base, 2);
  const swapped = swapResolvedDayLoads(base, 1, 2);
  assert.equal(resolveDayLoad(swapped, 1).dominant, b.dominant);
  assert.equal(resolveDayLoad(swapped, 2).dominant, a.dominant);
  assert.equal(resolveDayLoad(swapped, 1).targets.srpe, b.targets.srpe);
}

console.log("microcycleLoad.test OK");
