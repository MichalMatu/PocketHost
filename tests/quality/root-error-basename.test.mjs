import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = (path) => readFileSync(join(root, path), 'utf8');

test('failed route recovery uses React Router links that preserve the basename', () => {
  const error = source('apps/admin/src/components/router/root-layout.tsx');
  assert.match(error, /import \{[^}]*\bLink\b[^}]*\} from "react-router-dom"/);
  assert.match(error, /<Link to="\/dashboard"[^>]*>Dashboard<\/Link>/);
  assert.doesNotMatch(error, /<a\b[^>]*href="\/dashboard"/);
});

test('normal and error recovery dashboard links agree with the configured router', () => {
  const app = source('apps/admin/src/App.tsx');
  const notFound = source('apps/admin/src/app/errors/not-found/page.tsx');
  assert.match(app, /createBrowserRouter\([\s\S]*?\{ basename \}/);
  assert.match(notFound, /<Link to="\/dashboard"/);
});
