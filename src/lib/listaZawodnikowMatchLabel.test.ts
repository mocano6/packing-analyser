import assert from 'assert';
import { resolveTeamFieldForMatchLabel } from './listaZawodnikowMatchLabel';

const map: Record<string, string> = {
  'team-1': 'Legia Warszawa',
};

assert.strictEqual(resolveTeamFieldForMatchLabel('team-1', map, 'X'), 'Legia Warszawa');
assert.strictEqual(
  resolveTeamFieldForMatchLabel('Szombierki Bytom', map, 'X'),
  'Szombierki Bytom',
);
assert.strictEqual(
  resolveTeamFieldForMatchLabel('unknown-uuid', map, 'X'),
  'unknown-uuid',
);
assert.strictEqual(resolveTeamFieldForMatchLabel('', map, 'Zespół'), 'Zespół');
assert.strictEqual(resolveTeamFieldForMatchLabel('   ', map, 'Zespół'), 'Zespół');
assert.strictEqual(resolveTeamFieldForMatchLabel(null, map, 'Zespół'), 'Zespół');
assert.strictEqual(resolveTeamFieldForMatchLabel(1, map, 'Zespół'), 'Zespół');

console.log('listaZawodnikowMatchLabel tests: OK');
