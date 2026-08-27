import assert from "assert";
import {
  FULL_PITCH_AREA_M2,
  MICROCYCLE_ALERT_THRESHOLDS,
  MICROCYCLE_CONTROL_PRINCIPLES,
  MICROCYCLE_PRINCIPLES,
  MOTOR_DAY_PRESETS,
  MOTOR_SESSION_PRESETS,
  SSG_FORMATS,
  areaPerPlayer,
  findSsgFormat,
  methodologyPrincipleCatalog,
  pitchAreaPctOfFull,
  presetForOffset,
  sessionPresetForRole,
} from "./motorModel";
import {
  MOTOR_CORE_SESSION_ROLES,
  MOTOR_DOMINANT_BY_ID,
  MOTOR_SESSION_ROLE_BY_ID,
  isMotorDominantId,
  isMotorSessionRole,
  isMotorTagId,
} from "@/types/microcycleMotor";

// m²/gracz liczy się bez bramkarzy: 30×20 na 3v3 = 600 / 6 = 100
assert.equal(areaPerPlayer(30, 20, 3), 100);
assert.equal(areaPerPlayer(80, 64, 10), 256);
assert.equal(areaPerPlayer(0, 20, 3), null);
assert.equal(areaPerPlayer(30, 20, 0), null);
assert.equal(areaPerPlayer(null, 20, 3), null);

// Udział w pełnym boisku 105×68
assert.equal(FULL_PITCH_AREA_M2, 105 * 68);
assert.equal(pitchAreaPctOfFull(105, 68), 100);
assert.equal(pitchAreaPctOfFull(100, 64), 90); // 11v11 z tabeli
assert.equal(pitchAreaPctOfFull(80, 64), 72); // 10v10 ≈ ¾
assert.equal(pitchAreaPctOfFull(30, 20), 8); // 3v3
assert.equal(pitchAreaPctOfFull(0, 68), null);
assert.equal(pitchAreaPctOfFull(null, 68), null);

// Tabela referencyjna ma spójne wartości m²/gracz
for (const f of SSG_FORMATS) {
  assert.equal(
    f.areaPerPlayer,
    areaPerPlayer(f.length, f.width, f.playersPerSide),
    `Niespójne m²/gracz dla ${f.id}`
  );
}

// Gęstość rośnie razem z formatem — od 1v1 do 11v11
const areas = SSG_FORMATS.map((f) => f.areaPerPlayer);
assert.ok(areas[0] < areas[areas.length - 1]);
assert.equal(findSsgFormat("6v6")?.playersPerSide, 6);
assert.equal(findSsgFormat("99v99"), null);
assert.equal(findSsgFormat(null), null);

// Presety: pełny zakres MD-5 … MD+1, unikalne offsety, poprawne dominanty
const offsets = MOTOR_DAY_PRESETS.map((p) => p.offset).sort((a, b) => a - b);
assert.deepEqual(offsets, [-5, -4, -3, -2, -1, 0, 1]);
assert.equal(new Set(offsets).size, offsets.length);
  for (const p of MOTOR_DAY_PRESETS) {
  assert.ok(isMotorDominantId(p.dominant), `Zła dominanta dla offsetu ${p.offset}`);
  assert.ok(MOTOR_DOMINANT_BY_ID[p.dominant], `Brak definicji dominanty ${p.dominant}`);
  assert.ok(p.gymCharacter, `Brak gymCharacter dla offsetu ${p.offset}`);
  for (const b of p.blocks) {
    for (const tag of b.tags) {
      assert.ok(isMotorTagId(tag), `Nieznany tag ${tag} w presecie ${p.offset}`);
    }
    if (b.formatId) {
      assert.ok(findSsgFormat(b.formatId), `Nieznany format ${b.formatId} w presecie ${p.offset}`);
    }
  }
}

// Kształt tygodnia: MD-4 szczyt objętości, MD-5 szczyt acc/dec, MD-2 szczyt sprintu, MD-1 najlżejszy
const md5 = presetForOffset(-5);
const md4 = presetForOffset(-4);
const md3 = presetForOffset(-3);
const md2 = presetForOffset(-2);
const md1 = presetForOffset(-1);
assert.equal(md5.dominant, "tension");
assert.equal(md4.dominant, "duration");
assert.equal(md3.dominant, "off");
assert.ok(md4.targets.totalDistancePct > md5.targets.totalDistancePct);
assert.ok(md4.targets.totalDistancePct > md2.targets.totalDistancePct);
assert.ok(md4.targets.srpe > md5.targets.srpe);
assert.ok(md2.targets.sprintPct > md4.targets.sprintPct);
assert.ok(md2.targets.hsrPct > md4.targets.hsrPct);
assert.ok(md5.targets.accDecPct > md4.targets.accDecPct);
assert.ok(md1.targets.srpe < md2.targets.srpe);
assert.equal(md1.targets.minutes, 60);
assert.equal(md5.gymCharacter, "power");
assert.equal(md4.gymCharacter, "minimal");
assert.equal(presetForOffset(1).gymCharacter, "heavy");
assert.ok(presetForOffset(1).blocks[0].tags.includes("gym"));

// Offsety poza modelem traktujemy jak dzień wolny, nie zgadujemy dominanty
assert.equal(presetForOffset(-6).dominant, "off");
assert.equal(presetForOffset(4).dominant, "off");
assert.equal(presetForOffset(0).dominant, "match");

// Presety rolowe: pięć ról, spójne tagi i formaty, minuty zgodne z sumą bloków
const roles = MOTOR_SESSION_PRESETS.map((p) => p.role);
assert.deepEqual(roles, ["strength", "tension", "volume", "speed", "activation"]);
assert.equal(new Set(roles).size, roles.length);
for (const preset of MOTOR_SESSION_PRESETS) {
  assert.ok(isMotorSessionRole(preset.role), `Zła rola ${preset.role}`);
  assert.ok(isMotorDominantId(preset.dominant), `Zła dominanta w roli ${preset.role}`);
  assert.equal(
    preset.dominant,
    MOTOR_SESSION_ROLE_BY_ID[preset.role].dominant,
    `Dominanta presetu rozjeżdża się z definicją roli ${preset.role}`
  );
  assert.ok(preset.blocks.length > 0, `Rola ${preset.role} bez bloków`);
  const sum = preset.blocks.reduce((acc, b) => acc + b.minutes, 0);
  assert.equal(sum, preset.targets.minutes, `Suma minut ≠ targets.minutes w roli ${preset.role}`);
  for (const b of preset.blocks) {
    for (const tag of b.tags) {
      assert.ok(isMotorTagId(tag), `Nieznany tag ${tag} w roli ${preset.role}`);
    }
    if (b.formatId) {
      assert.ok(findSsgFormat(b.formatId), `Nieznany format ${b.formatId} w roli ${preset.role}`);
    }
  }
}

// Cztery jednostki rotacji: siłownia otwiera jednostkę, transfer przed boiskiem
for (const role of MOTOR_CORE_SESSION_ROLES) {
  const preset = sessionPresetForRole(role);
  const transferIndex = preset.blocks.findIndex((b) => b.tags.includes("transfer"));
  const pitchIndex = preset.blocks.findIndex(
    (b) => b.tags.includes("ssg") || b.tags.includes("positional")
  );
  assert.ok(transferIndex >= 0, `Rola ${role} bez bloku transferowego`);
  assert.ok(pitchIndex > transferIndex, `Boisko przed transferem w roli ${role}`);
}

const strength = sessionPresetForRole("strength");
const tension = sessionPresetForRole("tension");
const volume = sessionPresetForRole("volume");
const speed = sessionPresetForRole("speed");
const activation = sessionPresetForRole("activation");

assert.equal(strength.gymCharacter, "heavy");
assert.equal(tension.gymCharacter, "power");
assert.equal(volume.gymCharacter, "minimal");
assert.equal(speed.gymCharacter, "priming");
assert.equal(activation.gymCharacter, "none");

// Kształt tygodnia: objętość to szczyt dystansu i sRPE, prędkość szczyt sprintu, napięcie szczyt Acc/Dec
assert.ok(volume.targets.totalDistancePct > tension.targets.totalDistancePct);
assert.ok(volume.targets.totalDistancePct > speed.targets.totalDistancePct);
assert.ok(volume.targets.srpe > tension.targets.srpe);
assert.ok(volume.targets.srpe > MICROCYCLE_ALERT_THRESHOLDS.heavyDaySrpe);
assert.ok(tension.targets.srpe < MICROCYCLE_ALERT_THRESHOLDS.heavyDaySrpe);
assert.ok(speed.targets.sprintPct > volume.targets.sprintPct);
assert.ok(speed.targets.hsrPct > volume.targets.hsrPct);
assert.ok(tension.targets.accDecPct > volume.targets.accDecPct);
assert.ok(strength.targets.srpe < volume.targets.srpe);
assert.ok(activation.targets.minutes <= MICROCYCLE_ALERT_THRESHOLDS.md1MaxMinutes);

// Reguły bezpieczeństwa: Nordic tylko najdalej od meczu, ciężka siła nie w dniu objętości ani prędkości
const nordicRoles = MOTOR_SESSION_PRESETS.filter((p) =>
  p.blocks.some((b) => b.tags.includes("nordic"))
).map((p) => p.role);
assert.deepEqual(nordicRoles, ["strength"]);
const strengthMaxRoles = MOTOR_SESSION_PRESETS.filter((p) =>
  p.blocks.some((b) => b.tags.includes("strength_max"))
).map((p) => p.role);
assert.deepEqual(strengthMaxRoles, ["strength"]);
assert.ok(speed.blocks.some((b) => b.tags.includes("sprint_max")));
assert.ok(speed.blocks.some((b) => b.tags.includes("set_pieces")));
assert.ok(!volume.blocks.some((b) => b.tags.includes("sprint_max")));

// Siłownia mieści się w limicie pracy na nogi poza dniem siłowym
for (const preset of [tension, volume, speed]) {
  const gymMinutes = preset.blocks
    .filter((b) => b.tags.includes("gym"))
    .reduce((acc, b) => acc + b.minutes, 0);
  assert.ok(
    gymMinutes <= MICROCYCLE_ALERT_THRESHOLDS.gymLowerBodyMaxMinutes,
    `Za dużo siłowni w roli ${preset.role}`
  );
}

const catalog = methodologyPrincipleCatalog();
assert.equal(MICROCYCLE_PRINCIPLES.length, 10);
assert.equal(MICROCYCLE_CONTROL_PRINCIPLES.length, MICROCYCLE_PRINCIPLES.length);
assert.equal(catalog.length, 10);
assert.equal(catalog[0].id, "gym_first");
assert.equal(catalog[9].id, "gym_serves_match");
assert.equal(catalog[0].text, MICROCYCLE_PRINCIPLES[0]);

console.log("motorModel.test OK");
