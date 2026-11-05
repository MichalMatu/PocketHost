import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = (name) => readFileSync(path.join(root, 'apps/admin/src/components', name), 'utf8');

test('admin layout does not mount third-party Pro upsells', () => {
  const layout = source('layouts/base-layout.tsx');
  assert.doesNotMatch(layout, /UpgradeToProButton|shadcnstore\.com/i);
});

test('visible shell is PocketHost branded, without upstream marketing or fake account', () => {
  for (const name of ['app-sidebar.tsx', 'site-header.tsx', 'site-footer.tsx']) {
    const code = source(name);
    assert.doesNotMatch(code, /shadcnstore|Upgrade to Pro|store@example\.com|SidebarNotification|NavUser/i, name);
  }
  assert.match(source('app-sidebar.tsx'), /PocketHost/);
  const html = readFileSync(path.join(root, 'apps/admin/index.html'), 'utf8');
  assert.match(html, /<title>PocketHost/);
  assert.doesNotMatch(html, /shadcnstore\.com|user-scalable=no/i);
});

test('MIT permission and copyright notice are preserved inside app', () => {
  const license = readFileSync(path.join(root, 'apps/admin/LICENSE.upstream.md'), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2025 ShadcnStore/);
  assert.match(license, /Permission is hereby granted/);
});
