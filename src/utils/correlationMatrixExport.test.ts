import assert from "node:assert/strict";
import {
  buildCorrelationKpiMatrixExportPayload,
  CORRELATION_MATRIX_EXPORT_SCHEMA_VERSION,
} from "./correlationMatrixExport";

const payload = buildCorrelationKpiMatrixExportPayload({
  exportedAt: "2026-03-20T12:00:00.000Z",
  matchCount: 5,
  sortMode: "trend",
  metrics: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  matrix: [
    [1, 0.5],
    [0.5, 1],
  ],
});

assert.equal(payload.schemaVersion, CORRELATION_MATRIX_EXPORT_SCHEMA_VERSION);
assert.equal(payload.exportType, "lookball.correlationKpiMatrix");
assert.equal(payload.sample.matchCount, 5);
assert.equal(payload.metrics.length, 2);
assert.equal(payload.pearsonRMatrix[0][1], 0.5);
assert.equal(payload.correlationsByMetricId.a.b, 0.5);
assert.equal(payload.pairs.length, 3);

console.log("correlationMatrixExport tests: OK");
