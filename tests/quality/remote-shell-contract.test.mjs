import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRemoteShellPayload } from '../../src/modules/host/remote-shell-contract.mjs';

const code = '0123456789';
const id = 'a'.repeat(32);
test('browser can only request a paired exact command or poll opaque id', () => {
  assert.deepEqual(validateRemoteShellPayload('submit', { code, command: 'id' }),
    { code, command: 'id' });
  assert.deepEqual(validateRemoteShellPayload('poll', { code, id }), { code, id });
});
test('browser command contract fails closed on invalid payloads', () => {
  for (const [action, body] of [
    ['submit', { code: '', command: 'id' }],
    ['submit', { code, command: '' }],
    ['submit', { code, command: 'a'.repeat(241) }],
    ['submit', { code, command: 'id\0whoami' }],
    ['submit', { code, command: 'id', action: 'execute' }],
    ['submit', { code, command: 'id', token: 'extra' }],
    ['submit', { code, command: 42 }],
    ['poll', { code, id: '1' }],
    ['poll', { code, id, command: 'id' }],
    ['poll', { code, id, secret: true }],
    ['start', { code, command: 'id' }],
    ['submit', null],
  ]) {
    assert.throws(() => validateRemoteShellPayload(action, body));
  }
});
