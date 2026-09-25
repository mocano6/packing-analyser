import assert from "assert";
import {
  canSeekYoutubePlayer,
  isVideoSeekLanded,
  resolveYoutubeEmbedStart,
  youtubeEmbedStartSeconds,
} from "./youtubeSeek";

assert.strictEqual(youtubeEmbedStartSeconds(28.9), 28);
assert.strictEqual(youtubeEmbedStartSeconds(0), 0);
assert.strictEqual(youtubeEmbedStartSeconds(-3), 0);
assert.strictEqual(youtubeEmbedStartSeconds(Number.NaN), 0);

assert.strictEqual(isVideoSeekLanded(100, 100.4), true);
assert.strictEqual(isVideoSeekLanded(90, 90.9), true);
assert.strictEqual(isVideoSeekLanded(0, 1), false);
assert.strictEqual(isVideoSeekLanded(0, 90), false);
assert.strictEqual(isVideoSeekLanded(90, 0), false);
assert.strictEqual(isVideoSeekLanded(Number.NaN, 10), false);

assert.strictEqual(canSeekYoutubePlayer(-1), false);
assert.strictEqual(canSeekYoutubePlayer(undefined), false);
assert.strictEqual(canSeekYoutubePlayer(5), true);
assert.strictEqual(canSeekYoutubePlayer(1), true);
assert.strictEqual(canSeekYoutubePlayer(3), true);

assert.strictEqual(
  resolveYoutubeEmbedStart({
    playerReady: false,
    seekTargetSeconds: 90.2,
    frozenStart: undefined,
  }),
  90,
);
assert.strictEqual(
  resolveYoutubeEmbedStart({
    playerReady: false,
    seekTargetSeconds: null,
    frozenStart: 90,
  }),
  90,
);
assert.strictEqual(
  resolveYoutubeEmbedStart({
    playerReady: true,
    seekTargetSeconds: 200,
    frozenStart: 90,
  }),
  90,
);
assert.strictEqual(
  resolveYoutubeEmbedStart({
    playerReady: true,
    seekTargetSeconds: null,
    frozenStart: 90,
  }),
  90,
);

console.log("youtubeSeek.test: OK");
