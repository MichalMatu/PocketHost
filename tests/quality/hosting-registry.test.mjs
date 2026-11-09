import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostingRegistries } from '../../src/modules/config/hosting-registry.ts';

function valid() {
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
            secrets: [{ kind: 'secret-ref', id: 'sec-example123' }],
          },
        ],
      },
    ],
  };
}

test('M1 declarations are read-only, versioned and never process capabilities', () => {
  const input = valid();
  const registry = createHostingRegistries(input, [8787, 18878]);
  assert.deepEqual(
    registry.modules().map((x) => x.id),
    ['node'],
  );
  assert.deepEqual(
    registry.services().map((x) => x.state),
    ['planned'],
  );
  assert.equal(registry.project('demo')?.components[0].port, 19100);
  assert.equal(registry.project('external'), null);
  input.projects[0].components[0].port = 9999;
  assert.equal(registry.project('demo')?.components[0].port, 19100);
  const copy = registry.projects();
  copy[0].components[0].port = 20000;
  assert.equal(registry.project('demo')?.components[0].port, 19100);
  assert.equal(typeof registry.project('demo')?.start, 'undefined');
});

test('M1 rejects observed foreign workloads, existing protected units and unknown services', () => {
  const foreign = valid();
  foreign.projects[0].origin = 'observed';
  assert.throws(() => createHostingRegistries(foreign), /External observations/);
  const service = valid();
  service.services[0].name = 'sshd';
  assert.throws(() => createHostingRegistries(service), /Unsafe or duplicate service/);
  const missing = valid();
  missing.projects[0].components[0].serviceId = 'unknown';
  assert.throws(() => createHostingRegistries(missing), /Unowned or reused service/);
  const unbound = valid();
  unbound.projects[0].components[0].serviceId = null;
  assert.throws(() => createHostingRegistries(unbound), /Unattached service/);
});

test('M1 rejects duplicate modules, projects, components, services, ports and reserved ports', () => {
  for (const mutate of [
    (x) => x.modules.push({ ...x.modules[0] }),
    (x) => x.projects.push({ ...x.projects[0] }),
    (x) => x.projects[0].components.push({ ...x.projects[0].components[0] }),
    (x) => x.services.push({ ...x.services[0] }),
  ]) {
    const x = valid();
    mutate(x);
    assert.throws(() => createHostingRegistries(x));
  }
  assert.throws(() => createHostingRegistries(valid(), [19100]), /port collision/);
  const x = valid();
  x.projects[0].components.push({
    ...x.projects[0].components[0],
    id: 'other',
    serviceId: null,
  });
  assert.throws(() => createHostingRegistries(x), /port collision/);
});

test('M1 rejects stale module references, malformed secrets and plaintext secret values', () => {
  const stale = valid();
  stale.projects[0].components[0].moduleVersion = 2;
  assert.throws(() => createHostingRegistries(stale), /stale/);
  const plaintext = valid();
  plaintext.projects[0].components[0].secrets = [
    {
      kind: 'secret-ref',
      id: 'sec-example123',
      value: 'password',
    },
  ];
  assert.throws(() => createHostingRegistries(plaintext), /Unknown registry field/);
  const bad = valid();
  bad.projects[0].components[0].secrets = ['actual-password'];
  assert.throws(() => createHostingRegistries(bad), /registry object/);
  const schema = valid();
  schema.schemaVersion = 2;
  assert.throws(() => createHostingRegistries(schema), /Unsupported platform schema/);
});
