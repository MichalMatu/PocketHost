const safePrefixes = ['apps/admin/src/', 'apps/admin/tests/', 'docs/'];
const safeTopLevelFiles = new Set(['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md']);

export function isSafeUiPath(file) {
  if (typeof file !== 'string' || !file || file.includes('\0')) return false;
  if (file.startsWith('/') || file.includes('\\')) return false;
  if (file.split('/').some((part) => part === '..' || part === '.' || part === '')) return false;
  return safePrefixes.some((prefix) => file.startsWith(prefix)) || safeTopLevelFiles.has(file);
}

export function classifyUiChanges(paths) {
  const refused = paths.filter((path) => !isSafeUiPath(path));
  return { allowed: refused.length === 0, refused };
}

export function isPocketHostOrigin(origin) {
  if (typeof origin !== 'string') return false;
  return /^(?:https:\/\/(?:[^@\s/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)MichalMatu\/PocketHost(?:\.git)?\/?$/.test(
    origin.trim(),
  );
}

export function procStartTicks(stat) {
  if (typeof stat !== 'string') return null;
  const end = stat.lastIndexOf(')');
  if (end < 0 || stat[end + 1] !== ' ') return null;
  const fields = stat
    .slice(end + 2)
    .trim()
    .split(/\s+/);
  // Linux /proc/<pid>/stat field 22; offset 19 after comm.
  return /^\d+$/.test(fields[19] ?? '') ? fields[19] : null;
}
