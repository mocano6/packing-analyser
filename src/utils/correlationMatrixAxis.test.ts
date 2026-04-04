import assert from "node:assert/strict";
import { correlationAxisHeadClass, trendyKpiCorrelationAxisSide } from "./correlationMatrixAxis";

const fakeStyles = {
  headAxisOutcome: "o",
  headAxisMy: "m",
  headAxisOpp: "p",
  headAxisNeutral: "n",
};

assert.equal(correlationAxisHeadClass("outcome", fakeStyles), "o");
assert.equal(correlationAxisHeadClass("my", fakeStyles), "m");
assert.equal(correlationAxisHeadClass("opp", fakeStyles), "p");
assert.equal(correlationAxisHeadClass("neutral", fakeStyles), "n");

assert.equal(trendyKpiCorrelationAxisSide("pk_opponent"), "opp");
assert.equal(trendyKpiCorrelationAxisSide("xg_for"), "my");

console.log("correlationMatrixAxis tests: OK");
