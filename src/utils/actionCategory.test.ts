import assert from "node:assert/strict";
import { getActionCategory } from "./actionCategory";
import type { Action } from "@/types";

{
  const a = {
    id: "1",
    minute: 1,
    actionType: "pass" as const,
    senderId: "s",
    packingPoints: 1,
    fromZone: "a1",
    toZone: "b2",
  } as Action;
  assert.equal(getActionCategory(a), "packing");
}

{
  const a = {
    id: "2",
    minute: 1,
    actionType: "pass" as const,
    senderId: "s",
    regainDefenseZone: "G7",
  } as Action;
  assert.equal(getActionCategory(a), "regain");
}

{
  const a = {
    id: "3",
    minute: 1,
    actionType: "pass" as const,
    senderId: "s",
    losesDefenseZone: "C5",
  } as Action;
  assert.equal(getActionCategory(a), "loses");
}

{
  const a = {
    id: "4",
    minute: 1,
    actionType: "pass" as const,
    senderId: "s",
    isReaction5s: false,
    regainDefenseZone: "G7",
  } as Action;
  assert.equal(getActionCategory(a), "loses");
}
