import assert from "assert";
import {
  buildWyscoutAuthHeader,
  buildWyscoutUrl,
  getWyscoutConfig,
  parseWyscoutErrorMessage,
  WYSCOUT_DEFAULT_BASE_URL,
} from "./client";

const cfgEmpty = getWyscoutConfig({});
assert.equal(cfgEmpty.configured, false);
assert.equal(cfgEmpty.baseUrl, WYSCOUT_DEFAULT_BASE_URL);

const cfg = getWyscoutConfig({
  WYSCOUT_USERNAME: " user ",
  WYSCOUT_PASSWORD: " pass ",
  WYSCOUT_BASE_URL: "https://apirest.wyscout.com/v3/",
});
assert.equal(cfg.configured, true);
assert.equal(cfg.username, "user");
assert.equal(cfg.password, "pass");
assert.equal(cfg.baseUrl, "https://apirest.wyscout.com/v3");

assert.equal(
  buildWyscoutAuthHeader("Aladdin", "OpenSesame"),
  `Basic ${Buffer.from("Aladdin:OpenSesame").toString("base64")}`,
);

assert.equal(
  buildWyscoutUrl("https://apirest.wyscout.com/v3", "/search", {
    query: "Jagiellonia",
    objType: "team",
    gender: "",
  }),
  "https://apirest.wyscout.com/v3/search?query=Jagiellonia&objType=team",
);

assert.ok(parseWyscoutErrorMessage(401, "").includes("login"));
assert.ok(parseWyscoutErrorMessage(429, "").includes("12"));
assert.equal(
  parseWyscoutErrorMessage(400, JSON.stringify({ error: { code: 400, message: "Bad request" } })),
  "Wyscout 400: Bad request",
);

console.log("wyscout/client.test.ts: OK");
