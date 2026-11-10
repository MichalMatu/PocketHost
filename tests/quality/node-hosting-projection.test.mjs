import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nodeHostingServiceId, nodeHostingUnitName, projectNodeHostingDeclarations,
} from '../../src/shared/node-hosting-projection.ts';
import { createHostingRegistries } from '../../src/shared/hosting-registry.ts';

const a = 'node-' + 'a'.repeat(32);
const b = 'node-' + 'b'.repeat(32);

test('M2 Node project, service and module declarations have exact reusable IDs', () => {
  const declarations = projectNodeHostingDeclarations([
    { id: a, kind: 'node', port: 19300, registered: true },
    { id: b, kind: 'node', port: null, registered: false },
  ]);
  const registries = createHostingRegistries(declarations);
  assert.equal(registries.modules()[0].id, 'nodejs');
  assert.equal(registries.services().length, 1);
  assert.equal(registries.projects().length, 2);
  assert.equal(registries.services()[0].name, nodeHostingUnitName(a));
  assert.equal(registries.services()[0].id, nodeHostingServiceId(a));
  assert.ok(nodeHostingUnitName(a).length <= 64);
  assert.equal(registries.project(b).components[0].serviceId, null);
});

test('M2 projection refuses foreign identity, duplicate project, and reserved port collision', () => {
  assert.throws(() => nodeHostingUnitName('photomap-test'), /identity/);
  assert.throws(() => projectNodeHostingDeclarations([
    { id: a, kind: 'node', port: null, registered: true },
  ]), /Invalid/);
  assert.throws(() => projectNodeHostingDeclarations([
    { id: a, kind: 'node', port: 19300, registered: true },
    { id: a, kind: 'node', port: 19301, registered: true },
  ]), /duplicate/);
  assert.throws(() => createHostingRegistries(projectNodeHostingDeclarations([
    { id: a, kind: 'node', port: 19300, registered: true },
    { id: b, kind: 'node', port: 19300, registered: true },
  ])), /collision/);
});
