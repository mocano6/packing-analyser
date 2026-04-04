import assert from "assert";
import { getXTColor, calculateXTDifference } from "./utils";

// Wysokie xT — poza najniższym bucketem skali (tam kolor może być nieustawiony jak wcześniej w CSS)
const highXt = 0.15;
const c = getXTColor(highXt);
assert.ok(typeof c === "string" && c.length > 0, "wysokie xT ma zdefiniowany kolor");

assert.strictEqual(calculateXTDifference(0.02, 0.01), -0.01);

console.log("FootballPitch utils.test: OK");
