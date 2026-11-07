import { lstatSync, readFileSync, realpathSync } from 'node:fs';

/** Canonical, bounded managed-file admission shared across host adapters. */
export function directory(folder: string): void {
  const stat = lstatSync(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(folder) !== folder) {
    throw new Error('Managed directory is not canonical');
  }
}

export function json(file: string): Record<string, unknown> {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) {
    throw new Error('Unsafe managed runtime manifest');
  }
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error('Malformed managed runtime manifest');
  }
  return data as Record<string, unknown>;
}
