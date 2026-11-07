import assert from 'node:assert/strict';
import test from 'node:test';
import { H3_TOOLS, readTermuxToolInventory } from '../../src/modules/host/termux-tool-inventory.ts';

test('H3 probes exactly four fixed commands without invoking any executable', () => {
  const calls = [];
  const inventory = readTermuxToolInventory((name) => {
    calls.push(name);
    return name === 'restic' ? 'detected' : 'not-detected';
  });
  assert.equal(inventory.version, 1);
  assert.equal(inventory.mode, 'read-only');
  assert.deepEqual(calls, H3_TOOLS.map((item) => item.executable));
  assert.deepEqual(inventory.tools.map((item) => item.id), H3_TOOLS.map((item) => item.id));
  assert.equal(inventory.tools[0].state, 'detected');
  assert.ok(!JSON.stringify(inventory).includes('/data/'));
});
test('H3 unknown tools and permission failures do not become installed or executable', () => {
  const data = readTermuxToolInventory(() => 'unavailable');
  assert.ok(data.tools.every((item) => item.state === 'unavailable'));
  assert.equal(Object.hasOwn(data, 'commands'), false);
});
