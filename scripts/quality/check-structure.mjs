import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function validateStructure(root = repositoryRoot) {
  const errors = [];
  const manifestPath = path.join(root, 'project.structure.json');
  if (!existsSync(manifestPath)) return ['Missing project.structure.json'];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return [`Invalid project.structure.json: ${error.message}`];
  }
  const { modules, rootDirectories, requiredFiles, documentationDirectories } = manifest;
  if (![modules, rootDirectories, requiredFiles, documentationDirectories].every(Array.isArray)) {
    return ['Incomplete structure manifest'];
  }
  if (new Set(modules).size !== modules.length || modules.some((m) => !/^[a-z][a-z0-9-]*$/.test(m))) {
    errors.push('Module names must be unique lowercase kebab-case');
  }
  const required = [...requiredFiles, ...modules.flatMap((m) => [`src/modules/${m}/AGENTS.md`, `docs/modules/${m}.md`])];
  for (const rel of required) {
    if (!existsSync(path.join(root, rel))) errors.push(`Missing required file: ${rel}`);
  }
  const approvedRootFiles = new Set([...requiredFiles.filter((p) => !p.includes('/')), 'package-lock.json']);
  const approvedRootDirs = new Set(rootDirectories);
  const excludedDirs = new Set(manifest.excludedDirectories || []);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (excludedDirs.has(entry.name)) continue;
    if (entry.isDirectory() && !approvedRootDirs.has(entry.name)) errors.push(`Unexpected root directory: ${entry.name}`);
    else if (entry.isFile() && !approvedRootFiles.has(entry.name)) errors.push(`Unexpected root file: ${entry.name}`);
  }
  const moduleRoot = path.join(root, 'src/modules');
  if (existsSync(moduleRoot)) {
    for (const entry of readdirSync(moduleRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !modules.includes(entry.name)) errors.push(`Unexpected module: ${entry.name}`);
    }
  }
  const docsRoots = new Set(documentationDirectories);
  function walk(dir, base) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (excludedDirs.has(entry.name)) continue;
      const rel = path.posix.join(base, entry.name);
      if (entry.isSymbolicLink()) { errors.push(`Symlink not allowed: ${rel}`); continue; }
      if (entry.isDirectory()) {
        if (rel.startsWith('docs/') && !docsRoots.has(rel)) errors.push(`Unexpected documentation directory: ${rel}`);
        if (rel.startsWith('src/') && !['src/ui', 'src/shared', 'src/modules'].includes(rel) &&
          !/^src\/modules\/[a-z][a-z0-9-]*$/.test(rel)) errors.push(`Unexpected source directory: ${rel}`);
        walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile()) {
        if (rel.startsWith('src/') && !/\.(ts|tsx)$/.test(rel) && !rel.endsWith('/AGENTS.md')) errors.push(`Unsupported source artifact: ${rel}`);
        if (/^src\/.+\.(ts|tsx)$/.test(rel) && !/^src\/(ui|shared)\/.+\.(ts|tsx)$/.test(rel) &&
          !new RegExp(`^src/modules/(${modules.join('|')})/[^/]+\\.(ts|tsx)import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function validateStructure(root = repositoryRoot) {
  const errors = [];
  const manifestPath = path.join(root, 'project.structure.json');
  if (!existsSync(manifestPath)) return ['Missing project.structure.json'];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return [`Invalid project.structure.json: ${error.message}`];
  }
  const { modules, rootDirectories, requiredFiles, documentationDirectories } = manifest;
  if (![modules, rootDirectories, requiredFiles, documentationDirectories].every(Array.isArray)) {
    return ['Incomplete structure manifest'];
  }
  if (new Set(modules).size !== modules.length || modules.some((m) => !/^[a-z][a-z0-9-]*$/.test(m))) {
    errors.push('Module names must be unique lowercase kebab-case');
  }
  const required = [...requiredFiles, ...modules.flatMap((m) => [`src/modules/${m}/AGENTS.md`, `docs/modules/${m}.md`])];
  for (const rel of required) {
    if (!existsSync(path.join(root, rel))) errors.push(`Missing required file: ${rel}`);
  }
  const approvedRootFiles = new Set([...requiredFiles.filter((p) => !p.includes('/')), 'package-lock.json']);
  const approvedRootDirs = new Set(rootDirectories);
  const excludedDirs = new Set(manifest.excludedDirectories || []);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (excludedDirs.has(entry.name)) continue;
    if (entry.isDirectory() && !approvedRootDirs.has(entry.name)) errors.push(`Unexpected root directory: ${entry.name}`);
    else if (entry.isFile() && !approvedRootFiles.has(entry.name)) errors.push(`Unexpected root file: ${entry.name}`);
  }
  const moduleRoot = path.join(root, 'src/modules');
  if (existsSync(moduleRoot)) {
    for (const entry of readdirSync(moduleRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !modules.includes(entry.name)) errors.push(`Unexpected module: ${entry.name}`);
    }
  }
  const docsRoots = new Set(documentationDirectories);
  function walk(dir, base) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (excludedDirs.has(entry.name)) continue;
      const rel = path.posix.join(base, entry.name);
      if (entry.isSymbolicLink()) { errors.push(`Symlink not allowed: ${rel}`); continue; }
      if (entry.isDirectory()) {
        if (rel.startsWith('docs/') && !docsRoots.has(rel)) errors.push(`Unexpected documentation directory: ${rel}`);
        if (rel.startsWith('src/') && !['src/ui', 'src/shared', 'src/modules'].includes(rel) &&
          !/^src\/modules\/[a-z][a-z0-9-]*$/.test(rel)) errors.push(`Unexpected source directory: ${rel}`);
        walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile()) {
        ).test(rel)) errors.push(`Unexpected source location: ${rel}`);
        if (rel.startsWith('docs/') && !rel.endsWith('.md')) errors.push(`Unexpected documentation artifact: ${rel}`);
        if (rel.startsWith('scripts/') && !rel.endsWith('.mjs') && rel !== 'scripts/AGENTS.md') errors.push(`Unexpected script artifact: ${rel}`);
        if (rel.startsWith('tests/') && !/\.test\.mjs$/.test(rel) && rel !== 'tests/AGENTS.md') errors.push(`Unexpected test artifact: ${rel}`);
        if (rel.startsWith('docs/adr/') && !/^docs\/adr\/\d{4}-[a-z0-9-]+\.md$/.test(rel)) errors.push(`Invalid ADR filename: ${rel}`);
        if (rel.startsWith('docs/checkpoints/') && !/^docs\/checkpoints\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(rel)) errors.push(`Invalid checkpoint filename: ${rel}`);
        if (rel.startsWith('docs/modules/') && !modules.includes(path.basename(rel, '.md'))) errors.push(`Unexpected module specification: ${rel}`);
      } else errors.push(`Unexpected filesystem entry: ${rel}`);
    }
  }
  for (const d of rootDirectories) walk(path.join(root, d), d);
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateStructure();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Structure gate: PASS');
}
