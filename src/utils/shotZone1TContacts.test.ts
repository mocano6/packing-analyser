import assert from "node:assert/strict";
import {
  emptyZone1TContactFlags,
  hasZone1TContactTag,
  isOneContactIn1TZone,
  isShotInFinishing1TZone,
  showsZone1TContactPicker,
  toggleZone1TContact,
  zone1TContactLabel,
} from "./shotZone1TContacts";

assert.equal(isShotInFinishing1TZone({ x: 95, y: 50, teamContext: "attack" }), true);
assert.equal(isShotInFinishing1TZone({ x: 80, y: 50, teamContext: "attack" }), false);
assert.equal(isShotInFinishing1TZone({ x: 5, y: 50, teamContext: "defense" }), true);
assert.equal(isShotInFinishing1TZone({ x: 95, y: 50, teamContext: "defense" }), false);

assert.equal(showsZone1TContactPicker({ isContact1: true }, true), false);
assert.equal(showsZone1TContactPicker({ isContact2: true }, true), true);
assert.equal(showsZone1TContactPicker({ isContact3Plus: true }, true), true);
assert.equal(showsZone1TContactPicker({ isContact3Plus: true }, false), false);
assert.equal(showsZone1TContactPicker({}, true), false);

assert.equal(isOneContactIn1TZone({ isContact1: true }), true);
assert.equal(isOneContactIn1TZone({ isContact1: false }), false);
assert.equal(hasZone1TContactTag({ isContact1: true }), false);

// Prowadzenie poza strefą (3 kontakty całej akcji), w strefie tylko strzał.
assert.equal(
  isOneContactIn1TZone({
    isContact1: false,
    isZone1TContact1: true,
  }),
  true
);
assert.equal(
  isOneContactIn1TZone({
    isContact1: true,
    isZone1TContact2: true,
  }),
  false
);
assert.equal(zone1TContactLabel({ isZone1TContact1: true }), "1");
assert.equal(zone1TContactLabel({ isZone1TContact3Plus: true }), "3+");
assert.equal(zone1TContactLabel({ isContact1: true }), null);

const once = toggleZone1TContact(emptyZone1TContactFlags(), "1");
assert.deepEqual(once, {
  isZone1TContact1: true,
  isZone1TContact2: false,
  isZone1TContact3Plus: false,
});
const switched = toggleZone1TContact(once, "3plus");
assert.equal(switched.isZone1TContact1, false);
assert.equal(switched.isZone1TContact3Plus, true);
assert.deepEqual(toggleZone1TContact(switched, "3plus"), emptyZone1TContactFlags());
