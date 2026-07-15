import assert from "assert";
import {
  mergeTrainingDayTitleTemplates,
  migrateTrainingDayTitleTemplatesFromFirestore,
} from "./trainingDayTitleTemplatesFirestore";

const fromMicrocycle = migrateTrainingDayTitleTemplatesFromFirestore({
  stateJson: JSON.stringify({
    dayTitleTemplates: [
      { id: "dt1", generalFocus: "Dzień taktyczny", gameMoments: "Pressing" },
    ],
  }),
  version: 4,
});
assert.equal(fromMicrocycle.templates.length, 1);

const fromDoc = migrateTrainingDayTitleTemplatesFromFirestore({
  stateJson: JSON.stringify({
    templates: [{ id: "dt2", generalFocus: "Siła", gameMoments: "" }],
  }),
  version: 1,
});
assert.equal(fromDoc.templates[0].generalFocus, "Siła");

const merged = mergeTrainingDayTitleTemplates(
  [{ id: "a", generalFocus: "A", gameMoments: "" }],
  [
    { id: "b", generalFocus: "B", gameMoments: "" },
    { id: "a", generalFocus: "Ignored", gameMoments: "" },
  ]
);
assert.equal(merged.length, 2);

console.log("trainingDayTitleTemplatesFirestore.test.ts: OK");
