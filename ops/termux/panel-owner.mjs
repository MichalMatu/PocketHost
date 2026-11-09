/**
 * Update only the two established PocketHost DEV owner records on a verified
 * runit cold start. Refuse an occupied/ambiguous old owner; never signal it.
 */
import { spawnSync } from 'node:child_process';
import {
  closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync,
  renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

const home = '/data/data/com.termux/files/home';
const root = process.argv[2];
const pid = Number(process.argv[3]);
const admin = root && path.join(root, 'apps/admin');
const ownerFile = path.join(home, 'Projects/PocketHost-P3-Preview-20261106.json');
const gatewayFile = path.join(home, '.local/state/pockethost/lan-gateway.json');

function requireCondition(value, reason) {
  if (!value) throw new Error('PocketHost runit owner: ' + reason);
}

function statTicks(pidValue) {
  const stat = readFileSync('/proc/' + pidValue + '/stat', 'utf8');
  return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19];
}

function readOwner(file) {
  const stat = lstatSync(file);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), 'owner record linked/missing');
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeOwner(file, object) {
  const tmp = file + '.runit-' + pid + '.tmp';
  requireCondition(!existsSync(tmp), 'stale pending owner write');
  const fd = openSync(tmp, 'wx', 0o600);
  try {
    writeFileSync(fd, JSON.stringify(object) + '\n');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(tmp, file);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

function oldOwnerIsGone(oldPid) {
  if (oldPid === pid) return true;
  try {
    process.kill(oldPid, 0);
    return false;
  } catch (error) {
    return error?.code === 'ESRCH';
  }
}

function main() {
  requireCondition(Number.isSafeInteger(pid) && pid > 1, 'invalid service PID');
  requireCondition(root?.startsWith(home + '/Projects/PocketHost-'), 'checkout path not authorized');
  requireCondition(!lstatSync(root).isSymbolicLink(), 'checkout is a link');
  requireCondition(statTicks(pid)?.length > 0, 'new service identity missing');
  const source = spawnSync('/data/data/com.termux/files/usr/bin/git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8', timeout: 10000,
  });
  requireCondition(source.status === 0 && /^[0-9a-f]{40}$/.test(source.stdout.trim()), 'source SHA missing');
  const sha = source.stdout.trim();
  const marker = readOwner(ownerFile);
  const gateway = readOwner(gatewayFile);
  requireCondition(
    marker.cwd === admin && marker.port === 8787 &&
    gateway.owner === 'PocketHost' && gateway.cwd === admin &&
    gateway.adminPort === 18878 && gateway.sitePort === 18879 &&
    marker.pid === gateway.pid && marker.startTicks === gateway.startTicks,
    'owner markers do not describe the same PocketHost DEV panel',
  );
  requireCondition(Number.isSafeInteger(marker.pid) && marker.pid > 1 &&
    oldOwnerIsGone(marker.pid), 'previous owner still running or ambiguous');
  const ticks = statTicks(pid);
  writeOwner(ownerFile, {
    ...marker, pid, startTicks: ticks, sourceSha: sha, managedBy: 'termux-runit/pockethost-panel',
  });
  writeOwner(gatewayFile, {
    ...gateway, pid, startTicks: ticks, sourceSha: sha, managedBy: 'termux-runit/pockethost-panel',
  });
  process.stdout.write(JSON.stringify({ owner: 'PocketHost', sourceSha: sha, pid, managedBy: 'runit' }) + '\n');
}

main();
