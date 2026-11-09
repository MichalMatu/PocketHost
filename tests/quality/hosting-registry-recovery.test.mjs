import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fingerprintHostingRegistrySnapshot,
  planHostingRegistryRollback,
} from '../../src/modules/host/hosting-registry-recovery.ts';

function envelope(revision, port = 19100) {
  return {
    schemaVersion: 1,
    owner: 'pockethost',
    revision,
    declarations: {
      schemaVersion: 1,
      modules: [{ schemaVersion: 1, id: 'node', version: 1, capabilities: ['node'] }],
      services: [],
      projects: [
        {
          schemaVersion: 1,
          id: 'sample',
          origin: 'created-in-pockethost',
          components: [
            {
              id: 'backend',
              moduleId: 'node',
              moduleVersion: 1,
              role: 'backend',
              port,
              serviceId: null,
              secrets: [],
            },
          ],
        },
      ],
    },
  };
}

function plan(current = envelope(4, 19200), backup = envelope(2, 19100), rev = 4) {
  return planHostingRegistryRollback(
    current,
    backup,
    rev,
    fingerprintHostingRegistrySnapshot(current),
    fingerprintHostingRegistrySnapshot(backup),
  );
}

test('M1 rollback plan restores only a trusted earlier v1 declaration snapshot', () => {
  const current = envelope(4, 19200);
  const backup = envelope(2, 19100);
  const result = plan(current, backup);
  assert.equal(result.expectedRevision, 4);
  assert.equal(result.nextRevision, 5);
  assert.equal(result.restoreFromRevision, 2);
  assert.equal(result.declarations.projects[0].components[0].port, 19100);
  backup.declarations.projects[0].components[0].port = 19999;
  assert.equal(result.declarations.projects[0].components[0].port, 19100);
  assert.equal(current.declarations.projects[0].components[0].port, 19200);
  assert.match(fingerprintHostingRegistrySnapshot(envelope(2)), /^[a-f0-9]{64}$/);
});

test('M1 rollback refuses stale current state or forged backup digests', () => {
  const current = envelope(4, 19200);
  const backup = envelope(2);
  const actualCurrent = fingerprintHostingRegistrySnapshot(current);
  const actualBackup = fingerprintHostingRegistrySnapshot(backup);
  for (const args of [
    [current, backup, 3, actualCurrent, actualBackup],
    [current, backup, 4, '0'.repeat(64), actualBackup],
    [current, backup, 4, actualCurrent, 'f'.repeat(64)],
    [current, backup, 4, actualCurrent, 'invalid'],
    [current, envelope(4), 4, actualCurrent, fingerprintHostingRegistrySnapshot(envelope(4))],
    [current, envelope(5), 4, actualCurrent, fingerprintHostingRegistrySnapshot(envelope(5))],
  ]) {
    assert.throws(() => planHostingRegistryRollback(...args), /rollback/);
  }
});

test('M1 rollback rejects unknown versions, foreign owners and invalid declarations', () => {
  for (const mutate of [
    (x) => { x.schemaVersion = 2; },
    (x) => { delete x.schemaVersion; },
    (x) => { x.owner = 'external'; },
    (x) => { x.revision = Number.MAX_SAFE_INTEGER; },
    (x) => { x.declarations.projects[0].origin = 'observed'; },
    (x) => { x.declarations.projects[0].components[0].port = 80; },
    (x) => { x.declarations.projects[0].components[0].secrets = [{ kind: 'secret-ref', id: 'sec-example', value: 'plaintext' }]; },
  ]) {
    const bad = envelope(2);
    mutate(bad);
    assert.throws(() => plan(envelope(4), bad));
  }
  const unknown = envelope(4);
  unknown.legacyVersion = 0;
  assert.throws(() => fingerprintHostingRegistrySnapshot(unknown));
});
