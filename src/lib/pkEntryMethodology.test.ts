import assert from "assert";
import { PK_ENTRY_METHODOLOGY_SECTIONS } from "./pkEntryMethodology";

assert.ok(PK_ENTRY_METHODOLOGY_SECTIONS.length >= 1);

for (const section of PK_ENTRY_METHODOLOGY_SECTIONS) {
  assert.ok(section.title.trim().length > 0, `brak tytułu: ${section.id}`);
  assert.ok(section.paragraphs.length > 0, `brak akapitów: ${section.id}`);
}

const allText = PK_ENTRY_METHODOLOGY_SECTIONS.flatMap((s) => s.paragraphs).join(" ");
assert.ok(allText.includes("Tagujemy w momencie pierwszego kontaktu"));
assert.ok(allText.includes("dotknięcie piłki w PK"));

console.log("pkEntryMethodology.test: OK");
