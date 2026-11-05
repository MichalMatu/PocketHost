import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = (name) => readFileSync(path.join(root, 'apps/admin/src/components', name), 'utf8');

test('layout has no floating theme settings trigger and keeps one header control', () => {
  const layout = file('layouts/base-layout.tsx');
  const customizer = file('theme-customizer/index.tsx');
  assert.doesNotMatch(layout, /ThemeCustomizerTrigger/);
  assert.doesNotMatch(customizer, /fixed top-1\/2|ThemeCustomizerTrigger/);
  assert.equal((layout.match(/<SiteHeader/g) || []).length, 2);
  assert.match(layout, /activeTab=\{customizerTab\}/);
  assert.match(layout, /onResetAppearance=\{resetAppearance\}/);
  assert.match(file('site-header.tsx'), /<ModeToggle/);
});

test('one header menu offers light, dark, system, theme settings, layout and reset', () => {
  const menu = file('mode-toggle.tsx');
  for (const action of ['setTheme("light")', 'setTheme("dark")', 'setTheme("system")',
    'onCustomize("theme")', 'onCustomize("layout")', 'onResetAppearance']) {
    assert.ok(menu.includes(action), 'missing menu action ' + action);
  }
  assert.match(menu, /aria-label="Appearance settings"/);
  assert.match(menu, /DropdownMenuTrigger/);
});

test('system mode follows operating-system light/dark preference changes', () => {
  const provider = file('theme-provider.tsx');
  assert.match(provider, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(provider, /addEventListener\("change", applySelectedMode\)/);
  assert.match(provider, /removeEventListener\("change", applySelectedMode\)/);
});

test('responsive viewport remains untouched and pinch zoom is enabled', () => {
  const html = readFileSync(path.join(root, 'apps/admin/index.html'), 'utf8');
  assert.match(html, /width=device-width/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/i);
});
