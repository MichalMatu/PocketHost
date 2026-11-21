import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { PREFIX, valid } from './termux-worker-scripts.ts';

/** Exact protected names and canonical resolved aliases are never adoptable. */
const SYSTEM_SERVICE_NAMES = new Set([
  'sshd',
  'ssh-agent',
  'termux-agent',
  'pockethost-panel',
  'pockethost-panel-watch',
]);
export function isReserved(name: string, resolved?: string): boolean {
  return (
    SYSTEM_SERVICE_NAMES.has(name) ||
    (resolved !== undefined && SYSTEM_SERVICE_NAMES.has(path.basename(resolved)))
  );
}
/** Resolve an existing runit target within the approved service roots only. */
export function resolveRunitServiceTarget(serviceRoot: string, name: string): string {
  valid(name);
  const candidate = path.join(serviceRoot, name);
  if (!existsSync(candidate)) throw new Error('Runit service unavailable');
  const resolved = realpathSync(candidate);
  if (isReserved(name, resolved)) throw new Error('Protected service');
  const canonicalServiceRoot = realpathSync(serviceRoot);
  const allowedRoots = [canonicalServiceRoot + path.sep, path.join(PREFIX, 'var', 'sv') + path.sep];
  if (!allowedRoots.some((root) => resolved.startsWith(root)) || !statSync(resolved).isDirectory())
    throw new Error('Service points outside accepted runit root');
  return resolved;
}
