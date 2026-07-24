import assert from "assert";
import {
  REGAIN_LOSE_METHODOLOGY_SECTIONS,
  REGAIN_LOSE_REACTION_WINDOW_SECONDS,
} from "./regainLoseMethodology";

assert.strictEqual(REGAIN_LOSE_REACTION_WINDOW_SECONDS, 5);
assert.ok(REGAIN_LOSE_METHODOLOGY_SECTIONS.length >= 4);

const ids = REGAIN_LOSE_METHODOLOGY_SECTIONS.map((s) => s.id);
assert.deepStrictEqual(ids, ["tagging", "regain", "lose", "reaction"]);

const allText = REGAIN_LOSE_METHODOLOGY_SECTIONS.flatMap((s) => s.paragraphs).join(" ");
assert.ok(allText.includes("pierwszy kontakt naszego zawodnika"));
assert.ok(allText.includes("pierwszy kontakt przeciwnika"));
assert.ok(allText.includes("wyszła na aut"));
assert.ok(allText.includes("5 sekund"));
assert.ok(allText.includes("Regain i Loses"));

console.log("regainLoseMethodology.test: OK");
