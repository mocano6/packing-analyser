import assert from "assert";
import {
  MOTOR_DAY_PRESETS,
  SSG_FORMATS,
  areaPerPlayer,
  findSsgFormat,
  presetForOffset,
} from "./motorModel";
import { MOTOR_DOMINANT_BY_ID, isMotorDominantId, isMotorTagId } from "@/types/microcycleMotor";

// m²/gracz liczy się bez bramkarzy: 30×20 na 3v3 = 600 / 6 = 100
assert.equal(areaPerPlayer(30, 20, 3), 100);
assert.equal(areaPerPlayer(80, 64, 10), 256);
assert.equal(areaPerPlayer(0, 20, 3), null);
assert.equal(areaPerPlayer(30, 20, 0), null);
assert.equal(areaPerPlayer(null, 20, 3), null);

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
  for (const b of p.blocks) {
    for (const tag of b.tags) {
      assert.ok(isMotorTagId(tag), `Nieznany tag ${tag} w presecie ${p.offset}`);
    }
    if (b.formatId) {
      assert.ok(findSsgFormat(b.formatId), `Nieznany format ${b.formatId} w presecie ${p.offset}`);
    }
  }
}

// Kształt tygodnia: MD-3 szczyt objętości, MD-2 szczyt intensywności, MD-1 najlżejszy
const md4 = presetForOffset(-4);
const md3 = presetForOffset(-3);
const md2 = presetForOffset(-2);
const md1 = presetForOffset(-1);
assert.ok(md3.targets.totalDistancePct > md4.targets.totalDistancePct);
assert.ok(md3.targets.totalDistancePct > md2.targets.totalDistancePct);
assert.ok(md3.targets.srpe > md2.targets.srpe);
assert.ok(md2.targets.sprintPct > md3.targets.sprintPct);
assert.ok(md2.targets.hsrPct > md3.targets.hsrPct);
assert.ok(md4.targets.accDecPct > md3.targets.accDecPct);
assert.ok(md1.targets.srpe < md2.targets.srpe);
assert.equal(md1.targets.minutes, 60);

// Offsety poza modelem traktujemy jak dzień wolny, nie zgadujemy dominanty
assert.equal(presetForOffset(-6).dominant, "off");
assert.equal(presetForOffset(4).dominant, "off");
assert.equal(presetForOffset(0).dominant, "match");

console.log("motorModel.test OK");
