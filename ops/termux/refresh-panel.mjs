#!/usr/bin/env node
/**
 * One-shot, operator-requested PocketHost DEV refresh. Never adopt a listener
 * or manage any service other than the already registered pockethost-panel.
 * All QA must complete on the Samsung before invoking this release operation.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, lstatSync, realpathSync, statSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const home = os.homedir();
const prefix = '/data/data/com.termux/files/usr';
const service = prefix + '/var/service/pockethost-panel';
const watchdog = prefix + '/var/service/pockethost-panel-watch';
const ownerFile = path.join(home, 'Projects/PocketHost-P3-Preview-20261106.json');
const gatewayFile = path.join(home, '.local/state/pockethost/lan-gateway.json');
const protectedServices = new Map([
  ['sshd', prefix + '/var/service/sshd'],
  ['cloudflared', prefix + '/var/service/cloudflared'],
  ['wreckscanner', prefix + '/var/service/wreckscanner'],
  ['mosquitto', prefix + '/var/service/mosquitto'],
  ['ilestoi-healthwatch', prefix + '/var/service/ilestoi-healthwatch'],
  ['termux-agent', path.join(home, '.local/state/local-agent/termux/runit/services/termux-agent')],
]);

function requireCondition(value, reason) {
  if (!value) throw new Error(reason);
}

function command(file, args, cwd, timeout = 15000) {
  const r = spawnSync(file, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 100000,
  });
  requireCondition(r.status === 0 && !r.error, 'Command refused: ' + path.basename(file) + ' ' + args[0]);
  return r.stdout.trim();
}

function git(root, ...args) {
  return command(prefix + '/bin/git', args, root, args[0] === 'fetch' ? 150000 : 30000);
}

function status(servicePath) {
  const text = command(prefix + '/bin/sv', ['status', servicePath], home, 8000);
  const match = /^run:\s+\S+:\s+\(pid (\d+)\)/.exec(text);
  return { running: !!match, pid: match ? Number(match[1]) : null };
}

function readRecord(file) {
  const meta = lstatSync(file);
  requireCondition(meta.isFile() && !meta.isSymbolicLink(), 'Linked or missing ownership record');
  return JSON.parse(readFileSync(file, 'utf8'));
}

function fixedServiceRecord(dir, root) {
  const meta = lstatSync(dir);
  requireCondition(meta.isDirectory() && !meta.isSymbolicLink(), 'Service not a real runit directory');
  const rootRecord = lstatSync(dir + '/owner-root');
  requireCondition(rootRecord.isFile() && !rootRecord.isSymbolicLink(), 'Linked or missing runit owner root');
  requireCondition(readFileSync(dir + '/owner-root', 'utf8').trim() === root, 'Unexpected runit service owner');
  requireCondition(!lstatSync(dir + '/run').isSymbolicLink(), 'Linked runit launcher');
}

function startTicks(pid) {
  const line = readFileSync('/proc/' + pid + '/stat', 'utf8');
  const part = line.slice(line.lastIndexOf(')') + 2).trim().split(/\s+/);
  requireCondition(/^\d+$/.test(part[19] ?? ''), 'Malformed Linux process identity');
  return part[19];
}

export function assertPanelRunitIdentity(e) {
  const { owner, gateway, root, head, pid, servicePid, ticks, cwd, argv, processUid, expectedUid } = e;
  requireCondition(owner?.managedBy === 'termux-runit/pockethost-panel', 'Not runit-owned');
  requireCondition(owner.pid === pid && gateway?.pid === pid && servicePid === pid, 'Runit PID mismatch');
  requireCondition(owner.startTicks === ticks && gateway.startTicks === ticks, 'Process start ticks changed');
  requireCondition(owner.cwd === root + '/apps/admin' && gateway.cwd === owner.cwd && cwd === owner.cwd, 'Process cwd mismatch');
  requireCondition(owner.sourceSha === head && gateway.sourceSha === head, 'Active source SHA mismatch');
  requireCondition(owner.port === 8787 && gateway.owner === 'PocketHost', 'Unknown panel owner');
  requireCondition(gateway.adminPort === 18878 && gateway.sitePort === 18879, 'Unexpected gateway ports');
  requireCondition(gateway.managedBy === owner.managedBy, 'Gateway owner manager mismatch');
  requireCondition(processUid === expectedUid, 'Unexpected process OS user');
  requireCondition(
    argv[0] === prefix + '/bin/node' &&
      argv[1] === root + '/apps/admin/node_modules/vite/bin/vite.js' &&
      argv.includes('127.0.0.1') && argv.includes('8787') && argv.includes('--strictPort'),
    'Not the exact runit Node/Vite command',
  );
  return true;
}

function inspect(root, expectedHead) {
  fixedServiceRecord(service, root);
  fixedServiceRecord(watchdog, root);
  requireCondition(status(watchdog).running, 'Panel HTTP watchdog is down');
  const managed = status(service);
  requireCondition(managed.running && Number.isSafeInteger(managed.pid), 'Owned panel service is down');
  const pid = managed.pid;
  const owner = readRecord(ownerFile);
  const gateway = readRecord(gatewayFile);
  requireCondition(gateway.bind === '192.168.0.100', 'Unapproved gateway interface');
  const rawArgv = readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').filter(Boolean);
  const cwd = realpathSync('/proc/' + pid + '/cwd');
  const evidence = {
    owner, gateway, root, head: expectedHead, pid,
    servicePid: Number(readFileSync(service + '/supervise/pid', 'utf8').trim()),
    ticks: startTicks(pid), cwd, argv: rawArgv,
    processUid: statSync('/proc/' + pid).uid, expectedUid: process.getuid(),
  };
  assertPanelRunitIdentity(evidence);
  return { pid, ticks: evidence.ticks, gatewayHost: gateway.bind };
}

function externalStates() {
  return Object.fromEntries([...protectedServices].map(([name, location]) => {
    const state = status(location);
    return [name, state.running ? 'run' : 'down'];
  }));
}

function probe(host, port, pathname) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: pathname, timeout: 4000 }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function panelReady(host) {
  const local = await probe('127.0.0.1', 8787, '/projects');
  if (local !== 200) return false;
  return (await probe(host, 18878, '/projects')) === 200;
}

async function waitForPanel(root, target, host, maxMs = 105000) {
  const deadline = Date.now() + maxMs;
  do {
    try {
      const inspected = inspect(root, target);
      if (await panelReady(host)) return inspected;
    } catch {
      // Runit may still be starting Vite or updating its exact owner record.
    }
    await sleep(1500);
  } while (Date.now() < deadline);
  throw new Error('Verified owned panel did not recover at exact target SHA');
}

async function waitForDown() {
  const deadline = Date.now() + 25000;
  do {
    const s = status(service);
    if (!s.running && (await probe('127.0.0.1', 8787, '/')) === null) return;
    await sleep(500);
  } while (Date.now() < deadline);
  throw new Error('Verified panel runit shutdown not completed');
}

async function refresh(target) {
  requireCondition(/^[a-f0-9]{40}$/.test(target ?? ''), 'Provide immutable full main SHA');
  const root = realpathSync(process.cwd());
  requireCondition(
    root.startsWith(path.join(home, 'Projects/PocketHost-')) &&
      !lstatSync(root).isSymbolicLink(),
    'Not a dedicated PocketHost checkout',
  );
  requireCondition(git(root, 'remote', 'get-url', 'origin') === 'https://github.com/MichalMatu/PocketHost.git', 'Unexpected Git remote');
  requireCondition(git(root, 'status', '--porcelain') === '', 'Live checkout is dirty');
  const oldSha = git(root, 'rev-parse', 'HEAD');
  const before = inspect(root, oldSha);
  requireCondition(await panelReady(before.gatewayHost), 'Existing panel or private LAN unavailable');
  const externalBefore = externalStates();
  requireCondition(Object.values(externalBefore).every((s) => s === 'run'), 'Unhealthy protected external service before refresh');
  git(root, 'fetch', '--quiet', '--no-tags', 'origin', 'main');
  requireCondition(git(root, 'rev-parse', 'FETCH_HEAD') === target, 'Remote main changed; pin new revision');
  requireCondition(git(root, 'status', '--porcelain') === '', 'Live worktree changed before refresh');
  git(root, 'merge-base', '--is-ancestor', oldSha, target);
  if (oldSha === target) {
    return { status: 'CURRENT', sha: oldSha, owned: before.pid };
  }

  let parked = false;
  let switched = false;
  try {
    // Explicit runit down/up avoids the stale npm/process-group assumption.
    inspect(root, oldSha);
    command(prefix + '/bin/sv', ['down', service], root, 10000);
    parked = true;
    await waitForDown();
    git(root, 'switch', '--quiet', '--detach', target);
    switched = true;
    requireCondition(git(root, 'rev-parse', 'HEAD') === target, 'Git source did not reach pinned revision');
    command(prefix + '/bin/sv', ['up', service], root, 10000);
    parked = false;
    const after = await waitForPanel(root, target, before.gatewayHost);
    const externalAfter = externalStates();
    requireCondition(JSON.stringify(externalAfter) === JSON.stringify(externalBefore), 'Protected service changed during refresh');
    return { status: 'PASS', from: oldSha, sha: target, ownedPid: after.pid, lanHttp: 200, external: 'unchanged' };
  } catch (error) {
    const originalError = String(error?.message ?? error);
    let rollback = 'NOT_REQUIRED';
    if (parked || switched) {
      try {
        command(prefix + '/bin/sv', ['down', service], root, 10000);
        await waitForDown();
        if (switched) {
          requireCondition(git(root, 'status', '--porcelain') === '', 'Refuse rollback over local changes');
          git(root, 'switch', '--quiet', '--detach', oldSha);
        }
        command(prefix + '/bin/sv', ['up', service], root, 10000);
        await waitForPanel(root, oldSha, before.gatewayHost);
        rollback = 'PASS';
      } catch (failure) {
        rollback = 'FAILED: ' + String(failure?.message ?? failure).slice(0, 120);
      }
    }
    return { status: 'HOLD', error: originalError.slice(0, 160), rollback, oldSha, target };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  refresh(process.argv[2])
    .then((out) => {
      console.log(JSON.stringify(out));
      if (out.status !== 'PASS' && out.status !== 'CURRENT') process.exitCode = 1;
    })
    .catch((err) => {
      console.log(JSON.stringify({ status: 'HOLD', error: String(err?.message ?? err).slice(0, 160) }));
      process.exitCode = 1;
    });
}
