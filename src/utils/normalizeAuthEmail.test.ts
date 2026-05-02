import assert from "node:assert/strict";
import { normalizeAuthEmail } from "./normalizeAuthEmail";

assert.equal(normalizeAuthEmail("  Test@Example.COM  "), "test@example.com");
assert.equal(normalizeAuthEmail(""), "");

console.log("normalizeAuthEmail.test: OK");
