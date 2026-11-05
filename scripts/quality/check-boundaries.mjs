import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './check-structure.mjs';

const hostOnlyImports = new Set([
  'child_process', 'node:child_process', 'fs', 'node:fs',
  'fs/promises', 'node:fs/promises', 'os', 'node:os',
]);

export function validateBoundaries(root = repositoryRoot) {
  const errors = [];
  const srcRoot = path.join(root, 'src');
  if (!existsSync(srcRoot)) return ['Missing src directory'];

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) { errors.push(`Symlink in source tree: ${entry.name}`); continue; }
      const abs = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;

      const source = path.relative(srcRoot, abs).replaceAll(path.sep, '/');
      const content = readFileSync(abs, 'utf8');
      // Conservative static scan; full syntax-aware lint is added after tooling install.
      const specifierPattern = /\b(?:import|export)\s+(?:[^;'"`]*?\s+from\s+)?['"`]([^'"`]+)['"`]|\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g;
      for (const match of content.matchAll(specifierPattern)) {
        const specifier = match[1] || match[2];
        if (hostOnlyImports.has(specifier) && !source.startsWith('modules/host/')) {
          errors.push(`Host-only import in ${source}: ${specifier}`);
        }
        if (!specifier.startsWith('.')) continue;
        const target = path.relative(srcRoot, path.resolve(path.dirname(abs), specifier)).replaceAll(path.sep, '/');
        if (target.startsWith('..')) errors.push(`Import escapes src in ${source}: ${specifier}`);
        const sourceModule = /^modules\/([^/]+)\//.exec(source)?.[1];
        const targetModule = /^modules\/([^/]+)\//.exec(target)?.[1];
        if (targetModule && targetModule !== sourceModule) {
          errors.push(`Cross-module import in ${source}: ${specifier}`);
        }
        if (source.startsWith('shared/') && !target.startsWith('shared/')) {
          errors.push(`Shared layer must be pure in ${source}: ${specifier}`);
        }
      }
    }
  }
  walk(srcRoot);
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateBoundaries();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Module boundary gate: PASS');
}
