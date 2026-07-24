import assert from "assert";
import { SHOT_METHODOLOGY_SECTIONS } from "./shotMethodology";

assert.ok(SHOT_METHODOLOGY_SECTIONS.length >= 1);

for (const section of SHOT_METHODOLOGY_SECTIONS) {
  assert.ok(section.title.trim().length > 0, `brak tytułu: ${section.id}`);
  assert.ok(section.paragraphs.length > 0, `brak akapitów: ${section.id}`);
}

const allText = SHOT_METHODOLOGY_SECTIONS.flatMap((s) => s.paragraphs).join(" ");
assert.ok(allText.includes("każdy moment strzału"));
assert.ok(allText.includes("moment strzału na wideo"));

console.log("shotMethodology.test: OK");
