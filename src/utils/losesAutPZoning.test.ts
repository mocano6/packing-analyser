import assert from "assert";

/**
 * Polityka UI Loses: przy `isAut` (Out / aut / BR) wyłączone są strefy P0–P3 oraz licznik
 * „zawodnicy minięci”; przy zapisie isP– na false oraz tally = 0.
 */
(() => {
  const losesPZoneFlagsForSave = (isAutActive: boolean, p: { p0: boolean; p1: boolean; p2: boolean; p3: boolean }) =>
    isAutActive
      ? { isP0: false, isP1: false, isP2: false, isP3: false }
      : { isP0: p.p0, isP1: p.p1, isP2: p.p2, isP3: p.p3 };

  const losesOppTallyForSave = (isAutActive: boolean, tally: number) => (isAutActive ? 0 : tally);

  assert.deepStrictEqual(
    losesPZoneFlagsForSave(true, { p0: true, p1: false, p2: true, p3: false }),
    { isP0: false, isP1: false, isP2: false, isP3: false },
  );
  assert.deepStrictEqual(
    losesPZoneFlagsForSave(false, { p0: true, p1: false, p2: false, p3: false }),
    { isP0: true, isP1: false, isP2: false, isP3: false },
  );

  assert.strictEqual(losesOppTallyForSave(true, 7), 0);
  assert.strictEqual(losesOppTallyForSave(false, 7), 7);
  console.log("losesAutPZoning.test: OK");
})();
