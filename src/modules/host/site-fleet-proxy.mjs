import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ID = /^site-[a-f0-9]{32}$/;
const RELEASE = /^r-[a-f0-9]{32}$/;
const PORT_FIRST = 19080;
const PORT_COUNT = 16;
const SCRIPT = path.resolve(import.meta.dirname, 'site-fleet-server.mjs');

function plainDirectory(folder) {
  const s = lstatSync(folder);
  return s.isDirectory() && !s.isSymbolicLink() && realpathSync(folder) === folder;
}
function ticks(pid) {
  try {
    const raw = readFileSync('/proc/' + pid + '/stat', 'utf8');
    return raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/)[19];
  } catch { return null; }
}

/**
 * No port-based adoption. The trusted-LAN GET proxy forwards a site only
 * after checking its marker and exact running /proc child identity.
 * The admin gateway retains a separate origin/port.
 */
export function lookupHostedSite(requestPath, { root } = {}) {
  if (typeof requestPath !== 'string' || requestPath.length > 400) return null;
  const match = /^\/h2\/(site-[a-f0-9]{32})(\/[^?#]*(?:\?[^#]*)?)?$/.exec(requestPath);
  if (!match || !ID.test(match[1])) return null;
  const id = match[1];
  const route = match[2] || '/';
  if (route.startsWith('//') || route.includes('\\') || /%(?:2f|5c|00)/i.test(route))
    return null;
  const home = root ?? path.join(os.homedir(), 'Projects', 'PocketHost-UserSites');
  const folder = path.join(home, id);
  try {
    if (!existsSync(home) || !plainDirectory(home) || !plainDirectory(folder))
      return null;
    const ownerFile = path.join(folder, '.pockethost-site.json');
    const stat = lstatSync(ownerFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) return null;
    const marker = JSON.parse(readFileSync(ownerFile, 'utf8'));
    if (marker.schema !== 1 || marker.owner !== 'pockethost-h2' ||
        marker.id !== id || !RELEASE.test(marker.activeRelease) ||
        !Number.isSafeInteger(marker.port) ||
        marker.port < PORT_FIRST || marker.port >= PORT_FIRST + PORT_COUNT ||
        !marker.process || !Number.isSafeInteger(marker.process.pid) ||
        marker.process.pid < 2 || !/^\d+$/.test(marker.process.ticks) ||
        !/^[0-9a-f-]{36}$/.test(marker.instance) ||
        ticks(marker.process.pid) !== marker.process.ticks ||
        !plainDirectory(path.join(folder, 'releases')) ||
        !plainDirectory(path.join(folder, 'releases', marker.activeRelease)))
      return null;
    const argv = readFileSync('/proc/' + marker.process.pid + '/cmdline', 'utf8').split('\0');
    if (readlinkSync('/proc/' + marker.process.pid + '/cwd') !== folder ||
        !argv.includes(SCRIPT) || !argv.includes(marker.id) ||
        !argv.includes(String(marker.port)) || !argv.includes(marker.instance)) return null;
    return { port: marker.port, path: route };
  } catch { return null; }
}
