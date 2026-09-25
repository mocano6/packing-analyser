import assert from "assert";
import { createDefaultMicrocycleMatch } from "./microcycleMatches";
import {
  applyMatchProtocolToAllMicrocycles,
  clockFromKickoff,
  createDefaultMatchProtocolTemplate,
  formatDurationHhMm,
  mergeMatchProtocolIntoState,
  matchProtocolsForDay,
  MATCH_PROTOCOL_HOUR_HEIGHT_PX,
  minutesBeforeKickoffFromParts,
  minutesOfDayFromDate,
  nowLineTopPx,
  parseDurationHhMm,
  protocolDoneCounts,
  protocolEventLayouts,
  protocolHourHeightForEvents,
  protocolHourHeightForWrap,
  protocolNudgeOverlappingEvents,
  protocolItemIsPast,
  protocolOffsetIsAfter,
  protocolTimelineHours,
  protocolTimelineItems,
  protocolTimeRangeLabel,
  sanitizeMatchProtocolTemplate,
  setProtocolOffsetAfter,
  toggleProtocolSubtaskDone,
} from "./matchProtocol";
import { createDefaultTrainingMicrocycleState } from "./trainingMicrocycle";

assert.equal(parseDurationHhMm("01:30"), 90);
assert.equal(parseDurationHhMm("1:30"), 90);
assert.equal(parseDurationHhMm("00:00"), 0);
assert.equal(parseDurationHhMm("23:59"), 23 * 60 + 59);
assert.equal(parseDurationHhMm("24:00"), null);
assert.equal(parseDurationHhMm(""), null);
assert.equal(formatDurationHhMm(90), "01:30");
assert.equal(formatDurationHhMm(0), "00:00");

{
  const t = clockFromKickoff("18:00", 90);
  assert.equal(t.clock, "16:30");
  assert.equal(t.dayDelta, 0);
}

{
  const t = clockFromKickoff("10:00", 150);
  assert.equal(t.clock, "07:30");
  assert.equal(t.dayDelta, 0);
}

{
  const t = clockFromKickoff("10:00", 12 * 60);
  assert.equal(t.clock, "22:00");
  assert.equal(t.dayDelta, -1);
}

{
  const t = clockFromKickoff("18:00", 0);
  assert.equal(t.clock, "18:00");
  assert.equal(t.dayDelta, 0);
}

{
  const after = clockFromKickoff("18:00", -90);
  assert.equal(after.clock, "19:30");
  assert.equal(after.dayDelta, 0);
}

{
  const nextDay = clockFromKickoff("23:00", -120);
  assert.equal(nextDay.clock, "01:00");
  assert.equal(nextDay.dayDelta, 1);
}

{
  assert.equal(protocolOffsetIsAfter(90), false);
  assert.equal(protocolOffsetIsAfter(-45), true);
  assert.equal(protocolOffsetIsAfter(0), false);
  assert.equal(minutesBeforeKickoffFromParts(false, 90), 90);
  assert.equal(minutesBeforeKickoffFromParts(true, 45), -45);
  assert.equal(minutesBeforeKickoffFromParts(true, 0), 0);
  assert.equal(setProtocolOffsetAfter(90, true), -90);
  assert.equal(setProtocolOffsetAfter(-45, false), 45);
}

{
  const kept = sanitizeMatchProtocolTemplate({
    id: "p",
    title: "P",
    subtasks: [
      { id: "a", title: "Przed", minutesBeforeKickoff: 60 },
      { id: "b", title: "Po", minutesBeforeKickoff: -45 },
      { id: "c", title: "Po tekst", minutesBeforeKickoff: "+01:00" },
    ],
  });
  assert.equal(kept?.subtasks.find((s) => s.id === "b")?.minutesBeforeKickoff, -45);
  assert.equal(kept?.subtasks.find((s) => s.id === "c")?.minutesBeforeKickoff, -60);
}

{
  const raw = createDefaultMatchProtocolTemplate();
  const sanitized = sanitizeMatchProtocolTemplate(raw);
  assert.ok(sanitized);
  assert.equal(sanitized?.title, "Protokół meczowy");
  assert.ok((sanitized?.subtasks.length ?? 0) >= 4);
  assert.equal(
    sanitizeMatchProtocolTemplate({ id: "x", title: "P", subtasks: [] }),
    null
  );
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-31T12:00:00"));
  const mc = state.microcycles[0];
  const tpl = createDefaultMatchProtocolTemplate();
  const merged = mergeMatchProtocolIntoState(state, mc.id, mc.matches, tpl);
  assert.equal(merged.matchProtocols?.length, 1);
  assert.equal(merged.matchProtocols?.[0].dayIndex, 5);
  assert.equal(merged.matchProtocols?.[0].matchIndex, 0);
  assert.equal(
    merged.matchProtocols?.[0].subtasks.length,
    tpl.subtasks.length
  );

  const firstId = merged.matchProtocols?.[0].subtasks[0].id;
  const marked = {
    ...merged,
    matchProtocols: toggleProtocolSubtaskDone(
      merged.matchProtocols,
      merged.matchProtocols![0].id,
      firstId!
    ),
  };
  assert.equal(marked.matchProtocols?.[0].subtasks[0].done, true);

  const again = mergeMatchProtocolIntoState(marked, mc.id, mc.matches, tpl);
  assert.equal(again.matchProtocols?.[0].id, merged.matchProtocols?.[0].id);
  assert.equal(again.matchProtocols?.[0].subtasks[0].done, true, "done zostaje po merge");
  assert.equal(again.matchProtocols?.[0].subtasks[0].id, firstId);
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-31T12:00:00"));
  const mc = state.microcycles[0];
  const tpl = createDefaultMatchProtocolTemplate();
  const twoMatches = [
    { ...createDefaultMicrocycleMatch(5), opponent: "A" },
    { ...createDefaultMicrocycleMatch(2), opponent: "B" },
  ];
  const merged = mergeMatchProtocolIntoState(state, mc.id, twoMatches, tpl);
  assert.equal(merged.matchProtocols?.length, 2);
  assert.equal(matchProtocolsForDay(merged.matchProtocols, mc.id, 5).length, 1);
  assert.equal(matchProtocolsForDay(merged.matchProtocols, mc.id, 2).length, 1);

  const dropped = mergeMatchProtocolIntoState(merged, mc.id, [twoMatches[0]], tpl);
  assert.equal(dropped.matchProtocols?.length, 1);
  assert.equal(dropped.matchProtocols?.[0].matchIndex, 0);

  const cleared = mergeMatchProtocolIntoState(dropped, mc.id, [twoMatches[0]], null);
  assert.equal(cleared.matchProtocols?.length, 0);
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-31T12:00:00"));
  const tpl = createDefaultMatchProtocolTemplate();
  const all = applyMatchProtocolToAllMicrocycles(state, tpl);
  assert.equal(all.matchProtocols?.length, state.microcycles.length);
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-31T12:00:00"));
  const mc = state.microcycles[0];
  const tpl = createDefaultMatchProtocolTemplate();
  const merged = mergeMatchProtocolIntoState(state, mc.id, mc.matches, tpl);
  const p = merged.matchProtocols![0];
  const { done, total } = protocolDoneCounts(p);
  assert.equal(done, 0);
  assert.ok(total > 0);
  const items = protocolTimelineItems(p, "18:00");
  assert.equal(items.length, total);
  assert.ok(items.every((i, idx) => idx === 0 || items[idx - 1].minutesOfDay <= i.minutesOfDay || items[idx - 1].dayDelta < i.dayDelta));
  const hours = protocolTimelineHours(items, "18:00");
  assert.ok(hours.startHour <= 15);
  assert.ok(hours.endHour >= 19);
  const withNow = protocolTimelineHours(items, "18:00", 13 * 60 + 38);
  assert.equal(withNow.startHour, 13, "oś obejmuje aktualną godzinę przed pierwszym zadaniem");
  const farNow = protocolTimelineHours(items, "18:00", 22 * 60);
  assert.ok(farNow.endHour <= 20, "odległe „teraz” nie rozciąga osi na cały dzień");
  const label = protocolTimeRangeLabel(p, "18:00");
  assert.ok(label.includes("18:00"));
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-31T12:00:00"));
  const mc = state.microcycles[0];
  const tpl = createDefaultMatchProtocolTemplate();
  tpl.subtasks = [
    { id: "pre", title: "Zbiórka", notes: "", minutesBeforeKickoff: 60, coachId: null },
    { id: "kick", title: "Mecz", notes: "", minutesBeforeKickoff: 0, coachId: null },
    { id: "post", title: "Pranie", notes: "", minutesBeforeKickoff: -90, coachId: null },
  ];
  const merged = mergeMatchProtocolIntoState(state, mc.id, mc.matches, tpl);
  const items = protocolTimelineItems(merged.matchProtocols![0], "18:00");
  assert.equal(items[items.length - 1].clock, "19:30");
  assert.equal(items[items.length - 1].dayDelta, 0);
  const hours = protocolTimelineHours(
    items.filter((i) => i.dayDelta === 0),
    "18:00"
  );
  assert.ok(hours.endHour >= 20, "oś obejmuje zadania po meczu");
  const range = protocolTimeRangeLabel(merged.matchProtocols![0], "18:00");
  assert.ok(range.includes("19:30"));
  const overnight = protocolTimelineItems(
    { ...merged.matchProtocols![0], subtasks: [{ ...merged.matchProtocols![0].subtasks[2], minutesBeforeKickoff: -7 * 60 }] },
    "23:00"
  );
  assert.equal(overnight[0].dayDelta, 1);
  assert.equal(overnight[0].clock, "06:00");
  const overnightLabel = protocolTimeRangeLabel(
    { ...merged.matchProtocols![0], subtasks: overnight.map((i) => i.subtask) },
    "23:00"
  );
  assert.ok(overnightLabel.includes("d+1"));
}

{
  const iso = "2026-09-02";
  const now = new Date(2026, 8, 2, 16, 45, 0);
  assert.equal(protocolItemIsPast(iso, 0, 16 * 60 + 30, now), true, "16:30 minęło");
  assert.equal(protocolItemIsPast(iso, 0, 17 * 60, now), false, "17:00 jeszcze nie");
  assert.equal(protocolItemIsPast(iso, -1, 22 * 60, now), true, "dzień wcześniej — minęło");
  assert.equal(protocolItemIsPast("2026-09-03", 0, 10 * 60, now), false, "jutro");
}

{
  const top = nowLineTopPx("2099-01-01", 8, 20, 56, new Date("2026-09-02T12:00:00"));
  assert.equal(top, null, "inny dzień — bez linii teraz");
}

{
  const now = new Date(2026, 8, 2, 16, 30, 0); // 2 wrz 2026 16:30
  const iso = "2026-09-02";
  const top = nowLineTopPx(iso, 14, 20, MATCH_PROTOCOL_HOUR_HEIGHT_PX, now);
  assert.ok(top != null);
  assert.ok(Math.abs((top as number) - 2.5 * MATCH_PROTOCOL_HOUR_HEIGHT_PX) < 1);
  assert.ok(minutesOfDayFromDate(now) > 16 * 60);
}

{
  assert.equal(protocolHourHeightForWrap(600, 6), 100);
  assert.ok(protocolHourHeightForWrap(100, 6) >= 56);
  const layouts = protocolEventLayouts(
    [{ minutesOfDay: 16 * 60 }, { minutesOfDay: 16 * 60 + 40 }, { minutesOfDay: 18 * 60 }],
    16,
    19,
    60
  );
  assert.equal(layouts.length, 3);
  assert.ok(layouts[0].height >= 40);
  assert.ok(layouts[0].top + layouts[0].height <= layouts[1].top, "bloki nie nachodzą");
  assert.ok(layouts[1].top + layouts[1].height <= layouts[2].top, "bloki nie nachodzą");
  const sameTime = protocolEventLayouts(
    [{ minutesOfDay: 18 * 60 }, { minutesOfDay: 18 * 60 }],
    18,
    19,
    120
  );
  assert.ok(sameTime[1].top >= sameTime[0].top + sameTime[0].height, "ta sama godzina — stos");
  assert.ok(sameTime[0].height >= 40);
  const five = Array.from({ length: 5 }, () => ({ minutesOfDay: 16 * 60 }));
  const need = protocolHourHeightForEvents(five, 16, 17);
  assert.ok(need > 56, "stos 5 zadań wymaga wyższej godziny");
  const fiveLayouts = protocolEventLayouts(five, 16, 17, need);
  assert.equal(fiveLayouts.length, 5);
  for (let i = 1; i < fiveLayouts.length; i += 1) {
    assert.ok(
      fiveLayouts[i].top >= fiveLayouts[i - 1].top + fiveLayouts[i - 1].height,
      "stos nie nachodzi"
    );
  }
  const nudged = protocolNudgeOverlappingEvents([
    { top: 0, height: 40 },
    { top: 10, height: 40 },
  ]);
  assert.ok(nudged[1].top >= nudged[0].top + nudged[0].height);
}

console.log("matchProtocol tests: OK");
