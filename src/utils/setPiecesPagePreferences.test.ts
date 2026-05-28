import assert from "assert";
import {
  loadSetPiecesPageSelection,
  resolveSetPiecesMatchId,
  saveSetPiecesPageSelection,
} from "./setPiecesPagePreferences";

function testResolveMatchIdPrefersSavedForSameTeam() {
  const matches = [{ matchId: "m1" }, { matchId: "m2" }];
  const id = resolveSetPiecesMatchId(matches, {
    savedSelection: { teamId: "t1", matchId: "m2" },
    teamId: "t1",
    previousMatchId: "",
  });
  assert.strictEqual(id, "m2");
}

function testResolveMatchIdIgnoresSavedWhenTeamDiffers() {
  const matches = [{ matchId: "m1" }, { matchId: "m2" }];
  const id = resolveSetPiecesMatchId(matches, {
    savedSelection: { teamId: "other", matchId: "m2" },
    teamId: "t1",
    previousMatchId: "",
  });
  assert.strictEqual(id, "m1");
}

function testResolveMatchIdKeepsPreviousWhenValid() {
  const matches = [{ matchId: "m1" }, { matchId: "m2" }];
  const id = resolveSetPiecesMatchId(matches, {
    savedSelection: null,
    teamId: "t1",
    previousMatchId: "m2",
  });
  assert.strictEqual(id, "m2");
}

function testSaveAndLoadRoundTrip() {
  const storage: Record<string, string> = {};
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    },
  });

  try {
    saveSetPiecesPageSelection({ teamId: "rakow", matchId: "match-42" });
    assert.deepStrictEqual(loadSetPiecesPageSelection(), {
      teamId: "rakow",
      matchId: "match-42",
    });
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
  }
}

testResolveMatchIdPrefersSavedForSameTeam();
testResolveMatchIdIgnoresSavedWhenTeamDiffers();
testResolveMatchIdKeepsPreviousWhenValid();
testSaveAndLoadRoundTrip();

console.log("setPiecesPagePreferences.test.ts — OK");
