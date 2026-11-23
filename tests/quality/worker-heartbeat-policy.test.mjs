import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  chmodSync, mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync,
} from 'node:fs';
import { WorkerHeartbeatPolicy } from '../../src/modules/host/worker-heartbeat-policy.ts';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const nodeLine = '@' + 'a'.repeat(24) + ' PocketHost Node worker heartbeat\n';
const pythonLine = '@' + 'b'.repeat(24) + ' PocketHost Python worker heartbeat\n';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-heartbeat-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, policy: new WorkerHeartbeatPolicy(root) };
}

test('worker heartbeat is opt-in and validates a bound fixed template and identity', (t) => {
  const { root, policy } = fixture(t);
  assert.deepEqual(policy.observe('worker-aa', first, 'heartbeat-worker-v1', 'running', root), {
    mode: 'disabled', staleAfterSeconds: null, status: 'disabled', lastOutputAt: null,
  });
  assert.equal(policy.configure('worker-aa', first, 180), true);
  assert.equal(policy.configure('worker-aa', first, 180), false);
  assert.throws(() => policy.configure('worker-aa', second, 300), /another instance/);
  assert.throws(() => policy.observe('worker-aa', second, 'heartbeat-worker-v1', 'running', root), /identity mismatch/);
  assert.throws(() => policy.configure('../worker', first, 180), /Invalid worker/);
  assert.throws(() => policy.configure('worker-aa', first, 12), /Invalid worker/);
  assert.throws(() => policy.observe('worker-aa', first, 'unknown-template', 'running', root), /Unverified/);
  assert.equal(policy.observe('worker-aa', first, 'heartbeat-worker-v1', 'stopped', root).status, 'stale');
  assert.equal(policy.observe('worker-aa', first, 'heartbeat-worker-v1', 'unknown', root).status, 'unknown');
  assert.equal(policy.configure('worker-aa', first, null), true);
  assert.equal(policy.observe('worker-aa', first, 'heartbeat-worker-v1', 'running', root).status, 'disabled');
});

test('heartbeat reports fresh, stale, missing and indeterminate log evidence without executing workers', (t) => {
  const { root, policy } = fixture(t);
  policy.configure('worker-bb', first, 180);
  const logs = path.join(root, 'logs');
  mkdirSync(logs, { mode: 0o700 });
  const current = path.join(logs, 'current');
  assert.equal(policy.observe('worker-bb', first, 'heartbeat-worker-v1', 'running', logs).status, 'missing');
  writeFileSync(current, nodeLine, { mode: 0o600 });
  const fresh = policy.observe('worker-bb', first, 'heartbeat-worker-v1', 'running', logs);
  assert.equal(fresh.status, 'fresh');
  assert.match(fresh.lastOutputAt, /^\d{4}-/);
  assert.equal(fresh.staleAfterSeconds, 180);
  writeFileSync(current, 'a log line that is not an attested heartbeat\n');
  assert.equal(policy.observe('worker-bb', first, 'heartbeat-worker-v1', 'running', logs).status, 'missing');
  writeFileSync(current, pythonLine);
  assert.equal(policy.observe('worker-bb', first, 'python-heartbeat-v1', 'running', logs).status, 'fresh');
  assert.equal(policy.observe('worker-bb', first, 'heartbeat-worker-v1', 'running', logs).status, 'missing');
  const old = new Date(Date.now() - 10 * 60 * 1000);
  utimesSync(current, old, old);
  assert.equal(policy.observe('worker-bb', first, 'python-heartbeat-v1', 'running', logs).status, 'stale');
  chmodSync(logs, 0o733);
  assert.equal(policy.observe('worker-bb', first, 'python-heartbeat-v1', 'running', logs).status, 'unknown');
});

test('worker policy refuses insecure records, duplicates and quotas', (t) => {
  const { root, policy } = fixture(t);
  for (let index = 0; index < 4; index++)
    assert.equal(policy.configure('worker-' + index, first, 300), true);
  assert.throws(() => policy.configure('worker-5', first, 300), /quota/);
  const record = path.join(root, 'h3-worker-heartbeat.json');
  writeFileSync(record, '{"not":"an array"}\n', { mode: 0o600 });
  assert.throws(() => policy.configure('worker-0', first, null), /Invalid heartbeat policies/);
  writeFileSync(record, JSON.stringify([
    { name: 'worker-0', instanceId: first, staleAfterSeconds: 180 },
    { name: 'worker-0', instanceId: first, staleAfterSeconds: 180 },
  ]) + '\n');
  assert.throws(() => policy.observe('worker-0', first, 'heartbeat-worker-v1', 'unknown', root), /Unsafe heartbeat entry/);
  chmodSync(record, 0o644);
  assert.throws(() => policy.configure('worker-aa', first, null), /Untrusted PocketHost heartbeat file/);
});
