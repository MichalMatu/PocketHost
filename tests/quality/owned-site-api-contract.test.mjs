import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const vite = readFileSync(new URL('../../apps/admin/vite.config.ts', import.meta.url), 'utf8');
const demo = readFileSync(
  new URL('../../apps/admin/plugins/owned-demo-api.ts', import.meta.url),
  'utf8',
);
const page = readFileSync(
  new URL('../../apps/admin/src/app/owned-site/page.tsx', import.meta.url),
  'utf8',
);

test('P3 API is explicit DEV opt-in and localhost-only', () => {
  assert.match(vite, /ownedDemoApi\(\)/);
  assert.match(demo, /POCKETHOST_ENABLE_OWNED_SITE_DEV/);
  assert.match(demo, /127\.0\.0\.1:8787/);
  assert.match(demo, /adapter = enabled \? new OwnedDemoHost/);
  assert.match(demo, /runtime = adapter \? createOwnedSiteRuntime/);
  assert.match(demo, /"x-pockethost-intent"/);
  assert.match(demo, /"transfer-encoding"/);
  assert.match(demo, /serializeMutation/);
  assert.match(demo, /"owned-demo"/);
  assert.match(
    demo,
    /allowedActions = new Set\(\["create", "start", "stop", "restart", "publish\/v1", "publish\/v2", "rollback"\]\)/,
  );
  assert.match(demo, /action === "publish\/v1" \? runtime\.publish\(1\)/);
  assert.match(demo, /action === "publish\/v2" \? runtime\.publish\(2\)/);
  assert.doesNotMatch(demo, /req\.body\.command|shell:\s*true/);
});

test('P3 UI does not execute host commands and never offers external control', () => {
  assert.match(page, /PocketHost-owned/);
  assert.match(page, /readProject\(/);
  assert.match(page, /readHealth\(/);
  assert.match(page, /owned && !running/);
  assert.match(page, /site\.canRollback/);
  assert.match(page, /Target release/);
  assert.match(page, /Publish/);
  assert.match(page, /window\.confirm\(/);
  assert.match(page, /restart/);
  assert.match(page, /publish\/v1/);
  assert.match(page, /publish\/v2/);
  assert.doesNotMatch(page, /Switch sample version/);
  assert.match(page, /unknown &&/);
  assert.doesNotMatch(page, /child_process|exec\(|spawn\(/);
});
