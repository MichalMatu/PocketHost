import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRemoteShellPayload } from '../../src/modules/host/remote-shell-contract.mjs';

test('direct Run forwards the exact power-user command without pairing', () => {
  assert.deepEqual(validateRemoteShellPayload('run', { command: 'id' }), { command: 'id' });
  assert.deepEqual(validateRemoteShellPayload('run', { command: 'echo hello && id' }), {
    command: 'echo hello && id',
  });
});

test('shell transport rejects malformed requests but does not prohibit command categories', () => {
  for (const [action, body] of [
    ['run', null],
    ['run', {}],
    ['run', { command: '' }],
    ['run', { command: ' '.repeat(15) }],
    ['run', { command: 'x'.repeat(241) }],
    ['run', { command: 'id\0echo' }],
    ['run', { command: 42 }],
    ['run', { command: 'id', code: '1234567890' }],
    ['submit', { command: 'id' }],
    ['poll', { command: 'id' }],
  ]) {
    assert.throws(() => validateRemoteShellPayload(action, body));
  }
});
