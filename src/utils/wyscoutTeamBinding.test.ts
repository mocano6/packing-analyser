import assert from "assert";
import { parseWyscoutTeamBinding, wyscoutTeamBindingStorageKey } from "./wyscoutTeamBinding";

assert.equal(wyscoutTeamBindingStorageKey("abc"), "teamStats_wyscoutTeam_abc");
assert.equal(parseWyscoutTeamBinding(null), null);
assert.equal(parseWyscoutTeamBinding({ wyId: 0, name: "X" }), null);
assert.equal(parseWyscoutTeamBinding({ wyId: 3193, name: "  " }), null);
assert.deepEqual(parseWyscoutTeamBinding({ wyId: "3193", name: " Genoa ", officialName: "Genoa CFC" }), {
  wyId: 3193,
  name: "Genoa",
  officialName: "Genoa CFC",
});

console.log("wyscoutTeamBinding.test.ts: OK");
