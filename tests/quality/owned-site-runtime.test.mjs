import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOwnedSiteRuntime,
  SiteOwnershipError,
} from '../../src/modules/runtime/owned-site-runtime.ts';
import {
  OWNED_DEMO_ID,
} from '../../src/shared/owned-site.ts';
import {
  demoDocument,
  assertOwnedDemoId,
} from '../../src/modules/sites/owned-demo-spec.ts';

const absent = () => ({
  version: 1, id: OWNED_DEMO_ID, ownership: 'none', state: 'absent',
  port: 18787, url: 'http://127.0.0.1:18787/', contentVersion: null,
  previousVersion: null, canRollback: false,
});

function fixture() {
  let state = absent();
  const events = [];
  const port = {
    inspect: () => ({ ...state }),
    create: () => {
      events.push('create');
      state = { ...state, ownership: 'pockethost', state: 'stopped', contentVersion: 1 };
      return { ...state };
    },
    start: async () => {
      events.push('start');
      state = { ...state, state: 'running' };
      return { ...state };
    },
    stop: async () => {
      events.push('stop');
      state = { ...state, state: 'stopped' };
      return { ...state };
    },
    publish: () => {
      events.push('publish');
      state = { ...state, previousVersion: 1, contentVersion: 2, canRollback: true };
      return { ...state };
    },
    rollback: () => {
      events.push('rollback');
      state = { ...state, previousVersion: 2, contentVersion: 1 };
      return { ...state };
    },
    readLogs: () => ['demo started', 'demo stopped'],
  };
  return { runtime: createOwnedSiteRuntime(port), events, set: (s) => { state = s; } };
}

test('external or nonexistent services cannot be started, stopped or published', async () => {
  const { runtime, events, set } = fixture();
  await assert.rejects(runtime.start(), SiteOwnershipError);
  await assert.rejects(runtime.stop(), SiteOwnershipError);
  assert.throws(runtime.publish, SiteOwnershipError);
  assert.throws(runtime.logs, SiteOwnershipError);
  set({ ...absent(), ownership: 'external', state: 'running' });
  await assert.rejects(runtime.stop(), SiteOwnershipError);
  assert.deepEqual(events, []);
});

test('single explicit site can be created, started, published, rolled back and stopped', async () => {
  const { runtime, events } = fixture();
  assert.equal(runtime.create().state, 'stopped');
  assert.equal(runtime.create().state, 'stopped');
  assert.equal((await runtime.start()).state, 'running');
  assert.throws(runtime.rollback, RangeError);
  assert.equal(runtime.publish().contentVersion, 2);
  assert.equal(runtime.rollback().contentVersion, 1);
  assert.equal((await runtime.stop()).state, 'stopped');
  assert.deepEqual(runtime.logs(), ['demo started', 'demo stopped']);
  assert.deepEqual(events, ['create', 'start', 'publish', 'rollback', 'stop']);
});

test('fixed ID rejects discovered services; only built-in static documents are published', () => {
  assert.equal(assertOwnedDemoId(OWNED_DEMO_ID), OWNED_DEMO_ID);
  assert.throws(() => assertOwnedDemoId('ilestoi'), RangeError);
  assert.throws(() => assertOwnedDemoId('../../outside'), RangeError);
  assert.match(demoDocument(1), /First local site/);
  assert.match(demoDocument(2), /Updated local site/);
  assert.throws(() => demoDocument('<script>'), RangeError);
});
