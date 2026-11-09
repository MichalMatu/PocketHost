import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectHostingServiceOwnership } from '../../src/modules/host/hosting-service-ownership.ts';

function declarations() {
  return {
    schemaVersion: 1,
    modules: [{ schemaVersion: 1, id: 'node', version: 1, capabilities: ['node'] }],
    services: [
      {
        schemaVersion: 1,
        id: 'api',
        name: 'pockethost-demo-api',
        projectId: 'demo',
        moduleId: 'node',
        state: 'planned',
      },
    ],
    projects: [
      {
        schemaVersion: 1,
        id: 'demo',
        origin: 'created-in-pockethost',
        components: [
          {
            id: 'backend',
            moduleId: 'node',
            moduleVersion: 1,
            role: 'backend',
            port: 19100,
            serviceId: 'api',
            secrets: [],
          },
        ],
      },
    ],
  };
}

function evidence() {
  const target = '/data/data/com.termux/files/usr/var/sv/pockethost-demo-api';
  const identity = {
    pid: 12345,
    startTicks: '9876543',
    executable: '/data/data/com.termux/files/usr/bin/node',
    cwd: '/data/data/com.termux/files/home/PocketHost-Owned/demo',
    argvSha256: 'a'.repeat(64),
  };
  return {
    registryRevision: 4,
    registration: { owner: 'pockethost', name: 'pockethost-demo-api', canonicalTarget: target },
    observation: {
      name: 'pockethost-demo-api',
      canonicalTarget: target,
      protected: false,
      state: 'running',
    },
    marker: {
      owner: 'pockethost',
      serviceId: 'api',
      projectId: 'demo',
      moduleId: 'node',
      name: 'pockethost-demo-api',
      canonicalTarget: target,
      instanceId: 'a3b8f70d-cf73-4394-9dce-a5ef8b843681',
      expectedProcess: identity,
    },
    observedProcess: { ...identity },
  };
}

function inspect(input = declarations(), snapshot = evidence(), revision = 4) {
  return inspectHostingServiceOwnership(input, 'api', revision, snapshot);
}

test('M1 ownership consistency requires a complete independent identity match', () => {
  assert.equal(inspect(), 'consistent');
  assert.equal(inspect(declarations(), evidence(), 3), 'unverified');
  assert.equal(inspect(declarations(), null), 'unverified');
  assert.equal(
    inspectHostingServiceOwnership(declarations(), 'missing', 4, evidence()),
    'unverified',
  );
});

test('M1 refuses foreign registration, protected runit, target drift and forged owner marker', () => {
  for (const mutate of [
    (x) => {
      x.registration.owner = 'external';
    },
    (x) => {
      x.registration.name = 'sshd';
    },
    (x) => {
      x.registration.canonicalTarget = '/tmp/../tmp/service';
    },
    (x) => {
      x.observation.name = 'sshd';
    },
    (x) => {
      x.observation.canonicalTarget = '/tmp/other';
    },
    (x) => {
      x.observation.protected = true;
    },
    (x) => {
      x.observation.state = 'unknown';
    },
    (x) => {
      x.marker.owner = 'external';
    },
    (x) => {
      x.marker.projectId = 'external';
    },
    (x) => {
      x.marker.moduleId = 'python';
    },
    (x) => {
      x.marker.name = 'pockethost-other-api';
    },
    (x) => {
      x.marker.canonicalTarget = '/tmp/other';
    },
    (x) => {
      x.marker.instanceId = 'not-an-instance';
    },
  ]) {
    const snapshot = evidence();
    mutate(snapshot);
    assert.equal(inspect(declarations(), snapshot), 'unverified');
  }
});

test('M1 refuses PID reuse, start-tick drift and incomplete/unknown process evidence', () => {
  for (const mutate of [
    (x) => {
      x.observedProcess = null;
    },
    (x) => {
      x.observedProcess.pid = 54321;
    },
    (x) => {
      x.observedProcess.startTicks = '9876544';
    },
    (x) => {
      x.observedProcess.executable = '/tmp/node';
    },
    (x) => {
      x.observedProcess.cwd = '/tmp/other';
    },
    (x) => {
      x.observedProcess.argvSha256 = 'b'.repeat(64);
    },
    (x) => {
      x.marker.expectedProcess.argvSha256 = 'invalid';
    },
    (x) => {
      x.marker.expectedProcess.pid = 0;
    },
  ]) {
    const snapshot = evidence();
    mutate(snapshot);
    assert.equal(inspect(declarations(), snapshot), 'unverified');
  }
  const unbound = declarations();
  unbound.projects[0].components[0].serviceId = null;
  assert.throws(() => inspect(unbound), /Unattached service/);
});
