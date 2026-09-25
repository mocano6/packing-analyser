import assert from "assert";
import {
  BLOCK_IMAGE_MAX_SIDE,
  imageBlobFromClipboardData,
  isBlockImageDataUrl,
  isImageMimeType,
  normalizeBlockImageUrl,
  pickClipboardImageType,
  scaledImageSize,
} from "./microcycleBlockImage";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

assert.equal(isBlockImageDataUrl(TINY_PNG), true);
assert.equal(isBlockImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), true);
assert.equal(isBlockImageDataUrl("https://example.com/a.png"), false);
assert.equal(isBlockImageDataUrl("data:text/plain;base64,QQ=="), false);
assert.equal(isBlockImageDataUrl(""), false);
assert.equal(isBlockImageDataUrl("x".repeat(40)), false);

assert.equal(normalizeBlockImageUrl(TINY_PNG), TINY_PNG);
assert.equal(normalizeBlockImageUrl("  " + TINY_PNG + "  "), TINY_PNG);
assert.equal(normalizeBlockImageUrl(""), undefined);
assert.equal(normalizeBlockImageUrl(null), undefined);
assert.equal(normalizeBlockImageUrl("javascript:alert(1)"), undefined);

assert.equal(isImageMimeType("image/png"), true);
assert.equal(isImageMimeType("image/jpeg"), true);
assert.equal(isImageMimeType("image/webp"), true);
assert.equal(isImageMimeType("text/plain"), false);
assert.equal(isImageMimeType("image/svg+xml"), false);

assert.equal(pickClipboardImageType(["text/plain", "image/png"]), "image/png");
assert.equal(pickClipboardImageType(["text/html"]), null);

assert.deepEqual(scaledImageSize(1800, 900, BLOCK_IMAGE_MAX_SIDE), { width: 900, height: 450 });
assert.deepEqual(scaledImageSize(400, 300, 900), { width: 400, height: 300 });
assert.deepEqual(scaledImageSize(0, 10, 900), { width: 1, height: 1 });
assert.deepEqual(scaledImageSize(Number.NaN, 10, 900), { width: 1, height: 1 });

const fakePng = { type: "image/png" };
const fromItems = imageBlobFromClipboardData({
  items: [
    { kind: "string", type: "text/plain", getAsFile: () => null },
    { kind: "file", type: "image/png", getAsFile: () => fakePng },
  ],
  files: [],
} as unknown as DataTransfer);
assert.equal(fromItems, fakePng);
assert.equal(imageBlobFromClipboardData(null), null);

console.log("microcycleBlockImage.test OK");
