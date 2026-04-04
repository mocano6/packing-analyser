import assert from "assert";
import {
  clampProfileVideoPanelRect,
  parseStoredProfileVideoPanelLayout,
} from "./profileHeatmapVideoPanelLayout";

assert.deepStrictEqual(
  clampProfileVideoPanelRect(
    { left: -100, top: 50, width: 100, height: 100 },
    800,
    600,
  ),
  { left: 0, top: 50, width: 260, height: 180 },
);

assert.deepStrictEqual(
  clampProfileVideoPanelRect(
    { left: 10, top: 10, width: 900, height: 900 },
    800,
    600,
  ),
  { left: 8, top: 8, width: 792, height: 592 },
);

assert.strictEqual(parseStoredProfileVideoPanelLayout(null), null);
assert.strictEqual(parseStoredProfileVideoPanelLayout(""), null);
assert.strictEqual(parseStoredProfileVideoPanelLayout("not json"), null);
assert.deepStrictEqual(
  parseStoredProfileVideoPanelLayout(JSON.stringify({ left: 1, top: 2, width: 300, height: 280 })),
  { left: 1, top: 2, width: 300, height: 280 },
);
assert.strictEqual(
  parseStoredProfileVideoPanelLayout(JSON.stringify({ left: 0, top: 0, width: 10, height: 10 })),
  null,
);
