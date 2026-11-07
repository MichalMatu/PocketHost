import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  attestsManagedProcess,
  safeStopEvidence,
  processGroupAbsent,
  classifyManagedProcessState,
} from '../../src/modules/host/managed-process-guards.ts';

const expected = {
  pid: 12345,
  startTicks: '123456789',
  executable: '/safe/proot',
  cwd: '/managed/version',
  argvSha256: 'a'.repeat(64),
};

test('owned process requires all attested fields, not just PID', () => {
  assert.equal(attestsManagedProcess(expected, { ...expected }), true);
  for (const change of [
    { pid: 12346 },
    { startTicks: '123456790' },
    { executable: '/foreign/proot' },
    { cwd: '/foreign/workdir' },
    { argvSha256: 'b'.repeat(64) },
  ]) {
    assert.equal(attestsManagedProcess(expected, { ...expected, ...change }), false);
  }
  assert.equal(attestsManagedProcess(expected, null), false);
});

test('recycled PID and forged invalid process evidence cannot authorize a stop', () => {
  assert.equal(attestsManagedProcess({ ...expected, startTicks: '' }, { ...expected }), false);
  assert.equal(attestsManagedProcess({ ...expected, pid: 1 }, { ...expected }), false);
  assert.equal(
    attestsManagedProcess({ ...expected, argvSha256: 'not-a-digest' }, { ...expected }),
    false,
  );
});

test('graceful-stop evidence rejects surviving PRoot descendants and occupied port', () => {
  assert.equal(
    safeStopEvidence({ leaderExited: true, portReleased: true, descendantsExited: false }),
    false,
  );
  assert.equal(
    safeStopEvidence({ leaderExited: true, portReleased: false, descendantsExited: true }),
    false,
  );
  assert.equal(
    safeStopEvidence({ leaderExited: false, portReleased: true, descendantsExited: true }),
    false,
  );
  assert.equal(
    safeStopEvidence({ leaderExited: true, portReleased: true, descendantsExited: true }),
    true,
  );
});

test('PRoot process group probe fails closed for unknown and surviving descendants', () => {
  assert.equal(
    processGroupAbsent(420, () => 'absent'),
    true,
  );
  assert.equal(
    processGroupAbsent(420, () => 'present'),
    false,
  );
  assert.equal(
    processGroupAbsent(420, () => 'unknown'),
    false,
  );
  assert.equal(
    processGroupAbsent(1, () => 'absent'),
    false,
  );
  assert.equal(
    processGroupAbsent(Number.NaN, () => 'absent'),
    false,
  );
});

test('PhotoMap adapter may not delete its marker on leader-only stop evidence', () => {
  const source = readFileSync(
    new URL('../../src/modules/host/photomap-runtime-host.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /await stopOwnedProcessSafely\(/);
  assert.match(source, /observedDescendantsExited\(descendants, startTicks\)/);
  assert.match(source, /processGroupAbsent\(marker.pid/);
  assert.match(source, /signalOwnedLeader: \(\) => process\.kill\(marker\.pid, 'SIGTERM'\)/);
  assert.match(source, /PhotoMap graceful stop uncertain; marker retained/);
});

test('missing leader PID cannot clear a retained PhotoMap ownership marker', () => {
  assert.equal(classifyManagedProcessState(false, false), 'stopped');
  assert.equal(classifyManagedProcessState(true, true), 'running');
  assert.equal(classifyManagedProcessState(true, false), 'unknown');
  // An inconsistent observation must never promote an absent marker.
  assert.equal(classifyManagedProcessState(false, true), 'stopped');
  const source = readFileSync(
    new URL('../../src/modules/host/photomap-runtime-host.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /classifyManagedProcessState\(/);
  assert.doesNotMatch(source, /startTicks\(marker\.pid\) === null\s*\? 'stopped'/);
});
