import { summarizeData, formatDebugLogsForCopy, ScoutingDebugLogger } from './debugLog';

let passed = 0;
let failed = 0;

const assert = (name: string, cond: boolean) => {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', name);
  }
};

assert('summarizeData array', summarizeData([{ id: '1', name: 'Ekstraklasa' }]).startsWith('array[1]'));
assert('summarizeData null', summarizeData(null) === 'null');
assert('summarizeData matches', summarizeData([{ matchId: 'a' }, { matchId: 'b' }]) === 'array[2] matches');

const log = new ScoutingDebugLogger('test');
log.logApi('seasons/dictionaries', 200, [{ id: 'x', name: '2025/2026' }]);
const finished = log.finish();
assert('logger entries', finished.entries.length === 1);
assert('format copy header', formatDebugLogsForCopy([finished]).includes('SCOUTING DEBUG LOG'));

console.log(`scouting/debugLog.test: ${failed === 0 ? 'OK' : `FAIL (${failed})`}`);
if (failed > 0) process.exit(1);
