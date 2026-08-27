import assert from "assert";
import { extractYouTubeId } from "./youtubeVideoId";

const LIVE_SHARE =
  "https://www.youtube.com/live/Rz6WeDaklfE?si=_hymLZcF4cvVeeCo";

assert.strictEqual(extractYouTubeId(LIVE_SHARE), "Rz6WeDaklfE");
assert.strictEqual(
  extractYouTubeId("https://www.youtube.com/live/Rz6WeDaklfE"),
  "Rz6WeDaklfE"
);
assert.strictEqual(
  extractYouTubeId("https://youtube.com/live/Rz6WeDaklfE"),
  "Rz6WeDaklfE"
);

assert.strictEqual(
  extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  "dQw4w9WgXcQ"
);
assert.strictEqual(
  extractYouTubeId("https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ"),
  "dQw4w9WgXcQ"
);
assert.strictEqual(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.strictEqual(
  extractYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=42"),
  "dQw4w9WgXcQ"
);
assert.strictEqual(
  extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
  "dQw4w9WgXcQ"
);
assert.strictEqual(
  extractYouTubeId("https://www.youtube.com/v/dQw4w9WgXcQ"),
  "dQw4w9WgXcQ"
);
assert.strictEqual(
  extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
  "dQw4w9WgXcQ"
);
assert.strictEqual(
  extractYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
  "dQw4w9WgXcQ"
);
assert.strictEqual(extractYouTubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.strictEqual(
  extractYouTubeId("www.youtube.com/live/Rz6WeDaklfE?si=abc"),
  "Rz6WeDaklfE"
);

assert.strictEqual(extractYouTubeId(""), null);
assert.strictEqual(extractYouTubeId("https://example.com/video"), null);
assert.strictEqual(extractYouTubeId("https://www.youtube.com/live/"), null);

console.log("youtubeVideoId.test: OK");
