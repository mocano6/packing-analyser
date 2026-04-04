import assert from "assert";
import type { Action } from "@/types";
import { getActionVideoSeekSeconds, getVideoTimestampSeconds } from "./actionVideoSeekSeconds";

const base = {} as Action;

assert.strictEqual(getVideoTimestampSeconds({ videoTimestamp: 42.5 }), 42.5);
assert.strictEqual(getVideoTimestampSeconds({ videoTimestampRaw: 120 }), 120);
assert.strictEqual(getVideoTimestampSeconds({ videoTimestamp: 2_000_000 }), 2000);
assert.strictEqual(getVideoTimestampSeconds({}), null);

assert.strictEqual(getActionVideoSeekSeconds({ ...base, videoTimestamp: 42.5 } as Action), 42.5);
assert.strictEqual(getActionVideoSeekSeconds({ ...base } as Action), null);

console.log("actionVideoSeekSeconds.test: OK");
