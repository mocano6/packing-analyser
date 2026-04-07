import assert from "assert";
import { parseAuthorizationBearer } from "./authorizationBearer";

assert.strictEqual(parseAuthorizationBearer(null), null);
assert.strictEqual(parseAuthorizationBearer(""), null);
assert.strictEqual(parseAuthorizationBearer("Basic x"), null);
assert.strictEqual(parseAuthorizationBearer("Bearer "), null);
assert.strictEqual(parseAuthorizationBearer("Bearer abc.def.ghi"), "abc.def.ghi");
assert.strictEqual(parseAuthorizationBearer("Bearer  tok  "), "tok");

console.log("authorizationBearer.test: OK");
