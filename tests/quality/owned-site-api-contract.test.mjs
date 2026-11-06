import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const vite = readFileSync(new URL('../../apps/admin/vite.config.ts', import.meta.url), 'utf8');
const page = readFileSync(
  new URL('../../apps/admin/src/app/owned-site/page.tsx', import.meta.url),
  'utf8',
);

test('P3 API is explicit DEV opt-in and localhost-only', () => {
  assert.match(vite, /POCKETHOST_ENABLE_OWNED_SITE_DEV/);
  assert.match(vite, /127\.0\.0\.1:8787/);
  assert.match(vite, /runtime = enabled \?/);
  assert.match(vite, /"x-pockethost-intent"/);
  assert.match(vite, /"transfer-encoding"/);
  assert.match(vite, /serializeMutation/);
  assert.match(vite, /"owned-demo"/);
  assert.match(
    vite,
    /allowedActions = new Set\(\["create", "start", "stop", "publish\/v1", "publish\/v2", "rollback"\]\)/,
  );
  assert.match(vite, /action === "publish\/v1" \? runtime\.publish\(1\)/);
  assert.match(vite, /action === "publish\/v2" \? runtime\.publish\(2\)/);
  assert.doesNotMatch(vite, /req\.body\.command|shell:\s*true/);
});

test('P3 UI does not execute host commands and never offers external control', () => {
  assert.match(page, /Ownership: \{site.ownership\}/);
  assert.match(page, /isOwned && !running/);
  assert.match(page, /site\.canRollback/);
  assert.match(page, /Target version/);
  assert.match(page, /Publish selected version/);
  assert.match(page, /publish\/v1/);
  assert.match(page, /publish\/v2/);
  assert.doesNotMatch(page, /Switch sample version/);
  assert.match(page, /unknown &&/);
  assert.doesNotMatch(page, /child_process|exec\(|spawn\(/);
});
