import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './check-structure.mjs';

export function validateDocs(root = repositoryRoot) {
  const errors = [];
  const manifestPath = path.join(root, 'project.structure.json');
  if (!existsSync(manifestPath)) return ['Missing project.structure.json'];
  const { modules } = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const indexPath = path.join(root, 'docs/README.md');
  if (!existsSync(indexPath)) return ['Missing docs/README.md'];
  const index = readFileSync(indexPath, 'utf8');
  const excluded = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.tmp']);
  const mdFiles = [];
  function walk(dir, base = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const rel = path.posix.join(base, entry.name);
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.isFile() && entry.name.endsWith('.md')) mdFiles.push(rel);
    }
  }
  walk(root);
  for (const rel of mdFiles) {
    const full = path.join(root, rel);
    const content = readFileSync(full, 'utf8');
    if (!/^# /m.test(content)) errors.push(`Missing top-level heading: ${rel}`);
    if (rel.startsWith('docs/') && !['docs/README.md', 'docs/AGENTS.md'].includes(rel)) {
      const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(content);
      if (!frontmatter) errors.push(`Missing YAML frontmatter: ${rel}`);
      else for (const key of ['status', 'owner', 'last_reviewed', 'purpose']) {
        if (!new RegExp(`^${key}:\\s*\\S+`, 'm').test(frontmatter[1])) errors.push(`Missing ${key}: ${rel}`);
      }
      if (!index.includes(`(${rel.slice(5)})`)) errors.push(`Document missing from docs index: ${rel}`);
    }
    const withoutFences = content.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
    for (const match of withoutFences.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim().split(/\s+"/)[0];
      if (/^(?:https?:|mailto:|#|data:)/.test(target)) continue;
      const dest = decodeURIComponent(target.split('#')[0]);
      if (!dest) continue;
      const resolved = path.resolve(path.dirname(full), dest);
      const relative = path.relative(root, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) errors.push(`Markdown link escapes repository: ${rel} -> ${target}`);
      else if (!existsSync(resolved)) errors.push(`Broken Markdown link: ${rel} -> ${target}`);
    }
  }
  const scopedAgents = [
    'docs/AGENTS.md', 'src/AGENTS.md', 'src/ui/AGENTS.md', 'src/shared/AGENTS.md',
    'scripts/AGENTS.md', 'tests/AGENTS.md', ...modules.map((m) => `src/modules/${m}/AGENTS.md`),
  ];
  for (const rel of scopedAgents) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8');
    for (const heading of ['## Scope', '## Forbidden', '## Gate']) {
      if (!content.includes(heading)) errors.push(`Missing agent section ${heading}: ${rel}`);
    }
  }
  for (const moduleName of modules) {
    if (!index.includes(`(modules/${moduleName}.md)`)) errors.push(`Missing module index: ${moduleName}`);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateDocs();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Documentation gate: PASS');
}
