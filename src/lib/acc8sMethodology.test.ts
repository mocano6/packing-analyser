import assert from "assert";
import {
  ACC8S_METHODOLOGY_SECTIONS,
  ACC8S_OUTCOME_WINDOW_SECONDS,
} from "./acc8sMethodology";

assert.strictEqual(ACC8S_OUTCOME_WINDOW_SECONDS, 8);
assert.ok(ACC8S_METHODOLOGY_SECTIONS.length >= 2);

const ids = ACC8S_METHODOLOGY_SECTIONS.map((s) => s.id);
assert.deepStrictEqual(ids, ["definition", "success"]);

for (const section of ACC8S_METHODOLOGY_SECTIONS) {
  assert.ok(section.title.trim().length > 0, `brak tytułu: ${section.id}`);
  assert.ok(section.paragraphs.length > 0, `brak akapitów: ${section.id}`);
}

const allText = ACC8S_METHODOLOGY_SECTIONS.flatMap((s) => s.paragraphs).join(" ");
assert.ok(allText.includes("pierwszego kontaktu"));
assert.ok(allText.includes("stopą"));
assert.ok(allText.includes("8 sekund"));
assert.ok(allText.includes("pole karne"));

console.log("acc8sMethodology.test: OK");
