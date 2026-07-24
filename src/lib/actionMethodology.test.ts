import assert from "assert";
import { ACTION_METHODOLOGY_SECTIONS } from "./actionMethodology";

assert.ok(ACTION_METHODOLOGY_SECTIONS.length >= 3);

const ids = ACTION_METHODOLOGY_SECTIONS.map((s) => s.id);
assert.deepStrictEqual(ids, ["what", "tagging", "opponents"]);

for (const section of ACTION_METHODOLOGY_SECTIONS) {
  assert.ok(section.title.trim().length > 0, `brak tytułu: ${section.id}`);
  assert.ok(section.paragraphs.length > 0, `brak akapitów: ${section.id}`);
}

const allText = ACTION_METHODOLOGY_SECTIONS.flatMap((s) => [
  ...s.paragraphs,
  ...(s.bullets ?? []),
]).join(" ");
assert.ok(allText.includes("podania progresywne"));
assert.ok(allText.includes("minęły przeciwników"));
assert.ok(allText.includes("w poprzek"));
assert.ok(allText.includes("przyjęcia piłki"));
assert.ok(allText.includes("w drodze do bramki"));
assert.ok(!allText.includes("szerokość pola karnego"));

console.log("actionMethodology.test: OK");
