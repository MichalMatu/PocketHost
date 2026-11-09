import assert from 'node:assert/strict';
import test from 'node:test';
import { readLegacyPhotoMapEvents } from '../../src/modules/host/photomap-legacy-events.ts';
import { formatRuntimeEvent } from '../../src/shared/runtime-diagnostics.ts';

test('legacy PhotoMap events are bounded, scoped to the fixed instance and contain no raw secrets', () => {
  const lines = [
    formatRuntimeEvent('photomap-test', 'manual-start-requested'),
    formatRuntimeEvent('foreign-example', 'manual-stop-uncertain'),
    'private token=TOP_SECRET',
    '{"unexpected":"raw secret"}',
    formatRuntimeEvent('photomap-test', 'manual-stop-completed'),
  ];
  const result = readLegacyPhotoMapEvents(() => lines);
  assert.equal(result.state, 'ok');
  assert.equal(result.events.length, 2);
  assert.deepEqual(result.events.map((event) => event.instanceId), ['photomap-test', 'photomap-test']);
  assert.deepEqual(result.events.map((event) => event.code), [
    'manual-start-requested',
    'manual-stop-completed',
  ]);
  assert.equal(JSON.stringify(result).includes('TOP_SECRET'), false);
  assert.equal(JSON.stringify(result).includes('foreign-example'), false);
});

test('missing or unsafe PhotoMap logs fail closed without a fake success state', () => {
  assert.deepEqual(readLegacyPhotoMapEvents(() => {
    throw new Error('private filename /data/data/com.termux/secret');
  }), { state: 'unavailable', events: [] });
  assert.deepEqual(readLegacyPhotoMapEvents(() => []), { state: 'ok', events: [] });
});

test('legacy PhotoMap events never become a process or package control surface', () => {
  const src = readLegacyPhotoMapEvents.toString();
  assert.doesNotMatch(src, /spawn\(|exec\(|kill\(|signal\(|start\(/);
  const events = readLegacyPhotoMapEvents(
    () => Array.from({ length: 80 }, () => formatRuntimeEvent('photomap-test', 'manual-stop-completed')),
  );
  assert.ok(events.events.length <= 20);
});
