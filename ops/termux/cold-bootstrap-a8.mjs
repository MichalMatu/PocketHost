#!/usr/bin/env node
/**
 * One-time, A8-only PocketHost cold bootstrap. Never refreshes an existing
 * panel, adopts a port/process or changes unrelated services.
 * Run only from a clean exact-main checkout after npm ci (admin only).
 * This is an installation/operational guard, NOT a test runner.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, openSync, closeSync, writeFileSync,
  readFileSync, realpathSync, readdirSync, statSync,
} from 'node:fs';
import path from 'node:path';
import net from 'node:net';

const H = '/data/data/com.termux/files/home';
const P = '/data/data/com.termux/files/usr';
const root = H + '/Projects/PocketHost-A8-DEV';
const state = H + '/.local/state/pockethost';
const svdir = P + '/var/service';
const owner = state + '/panel-owner.json';
const gateway = state + '/lan-gateway.json';
const expected = process.argv[2];
const report = { kind: 'PocketHostA8ColdBootstrap', status: 'HOLD', stage: 'preflight',
  deployment: 'not-started', protectedServices: 'not-modified' };
const demand = (ok, why) => { if (!ok) throw Error(why); };
const exists = (p) => existsSync(p) || (() => { try { lstatSync(p); return true; } catch (e) {
  if (e?.code === 'ENOENT') return false; throw e;
} })();
function fixedDir(p) {
  const s = lstatSync(p);
  demand(s.isDirectory() && !s.isSymbolicLink() && s.uid === process.getuid(),
    'unsafe-owned-directory');
  return p;
}
function invoke(program, args, cwd = root, timeout = 15000) {
  const r = spawnSync(program, args, { cwd, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], timeout, maxBuffer: 65536 });
  demand(!r.error && r.status === 0, 'command-refused-' + path.basename(program) + '-' + args[0]);
  return r.stdout.trim();
}
function git(...args) { return invoke(P + '/bin/git', ['-C', root, ...args]); }
function service(name) {
  const d = svdir + '/' + name;
  if (!exists(d)) return 'unregistered';
  demand(!lstatSync(d).isSymbolicLink(), 'external-service-linked');
  try {
    const r = spawnSync(P + '/bin/sv', ['status', d], { encoding:'utf8', timeout:5000 });
    return r.stdout?.startsWith('run:') ? 'run' : r.stdout?.startsWith('down:') ? 'down' : 'unknown';
  } catch { return 'unknown'; }
}
function externalStates() {
  return Object.fromEntries(readdirSync(svdir).filter(n =>
    n !== 'pockethost-panel' && n !== 'pockethost-panel-watch')
    .map(n => [n, service(n)]));
}
function createOwnedState() {
  for (const dir of [H + '/.local', H + '/.local/state', state]) {
    if (!exists(dir)) mkdirSync(dir, { mode: 0o700 });
    fixedDir(dir);
    demand((statSync(dir).mode & 0o022) === 0, 'state-directory-group-writable');
  }
}
function putMarker(file, value) {
  demand(!exists(file), 'owner-marker-already-exists');
  const fd = openSync(file, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value) + '\n'); } finally { closeSync(fd); }
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen({ host:'0.0.0.0', port, exclusive:true }, () => {
      s.close((error) => error ? reject(error) : resolve());
    });
  });
}
function ticks(pid) {
  const stat = readFileSync('/proc/' + pid + '/stat','utf8');
  return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19];
}
function readMarker(file) {
  const s = lstatSync(file);
  demand(s.isFile() && !s.isSymbolicLink() && s.size < 16384, 'unsafe-owner-marker');
  return JSON.parse(readFileSync(file, 'utf8'));
}
async function main() {
  demand(process.platform === 'android' && process.env.HOME === H &&
    process.cwd() === root && realpathSync(root) === root,
    'unexpected-device-or-checkout');
  demand(/^[a-f0-9]{40}$/.test(expected ?? ''), 'exact-source-sha-required');
  demand(Number(process.versions.node.split('.')[0]) >= 22, 'node-22-required');
  demand(fixedDir(H + '/Projects') && fixedDir(root) &&
    !exists(H + '/Projects/PocketHost-P3-Preview-20261106.json'),
    'existing-legacy-owner');
  demand(git('remote','get-url','origin') === 'https://github.com/MichalMatu/PocketHost.git',
    'unexpected-git-origin');
  demand(git('rev-parse','HEAD') === expected && git('status','--porcelain') === '',
    'dirty-or-wrong-source');
  demand(exists(root + '/apps/admin/node_modules/vite/bin/vite.js'),
    'admin-npm-ci-not-complete');
  demand(fixedDir(svdir) && !exists(svdir + '/pockethost-panel') &&
    !exists(svdir + '/pockethost-panel-watch'), 'runit-service-already-exists');
  demand(!exists(owner) && !exists(gateway), 'bootstrap-markers-already-exist');
  demand(statSync(root).uid === process.getuid(), 'checkout-owner-mismatch');
  for (const port of [8787,18878,18879]) await freePort(port);
  const before = externalStates();
  const admin = root + '/apps/admin';
  createOwnedState();
  report.stage = 'cold-stage';
  const common = { cwd:admin, pid:null, startTicks:null, sourceSha:expected,
    managedBy:'termux-runit/pockethost-panel', bootstrap:'a8-cold-staged' };
  putMarker(owner, { ...common, owner:'PocketHost', port:8787 });
  putMarker(gateway, { ...common, owner:'PocketHost',
    bind:null, adminPort:18878, sitePort:18879 });
  report.deployment = 'staging';
  invoke(P + '/bin/sh', [root + '/ops/termux/install-panel-services.sh','stage'], root, 20000);
  report.stage = 'activation';
  report.deployment = 'attempted';
  invoke(P + '/bin/sh', [root + '/ops/termux/install-panel-services.sh','activate'], root, 155000);
  report.stage = 'readback';
  const m = readMarker(owner), g = readMarker(gateway);
  demand(Number.isSafeInteger(m.pid) && m.pid > 1 &&
    m.pid === g.pid && m.startTicks === g.startTicks &&
    m.startTicks === ticks(m.pid) && m.sourceSha === expected &&
    g.sourceSha === expected && m.bootstrap === undefined &&
    g.bootstrap === undefined && m.cwd === admin && g.cwd === admin,
    'live-owner-mismatch');
  demand(git('rev-parse','HEAD') === expected && git('status','--porcelain') === '',
    'deployed-source-mismatch');
  demand(realpathSync('/proc/' + m.pid + '/cwd') === admin, 'process-cwd-mismatch');
  demand(statSync('/proc/' + m.pid).uid === process.getuid(), 'process-uid-mismatch');
  const cmdline = readFileSync('/proc/' + m.pid + '/cmdline').toString().split('\0').filter(Boolean);
  const args = [P + '/bin/node', root + '/apps/admin/node_modules/vite/bin/vite.js',
    '--host','127.0.0.1','--port','8787','--strictPort'];
  demand(cmdline.length === args.length && cmdline.every((x,i) => x === args[i]),
    'process-command-mismatch');
  demand(invoke(P + '/bin/sv', ['status',svdir + '/pockethost-panel']).includes('pid ' + m.pid + ')'),
    'runit-pid-mismatch');
  invoke(P + '/bin/sv', ['check',svdir + '/pockethost-panel'], root, 12000);
  demand(JSON.stringify(externalStates()) === JSON.stringify(before),
    'protected-services-changed');
  report.status = 'PASS'; report.stage = 'complete'; report.deployment = 'applied';
  report.sourceSha = expected; report.liveSha = expected;
  report.ownerRoot = 'Projects/PocketHost-A8-DEV';
  report.pid = m.pid; report.startTicks = m.startTicks;
  report.health = 'loopback-http-200'; report.privateUrl = 'http://127.0.0.1:8787/';
  report.logDir = 'Termux var/log/sv/pockethost-panel';
  report.protectedServices = 'unchanged';
}
main().catch(e => {
  report.reason = String(e?.message ?? e).slice(0,170);
}).finally(() => {
  process.stdout.write(JSON.stringify(report) + '\n');
  if (report.status !== 'PASS') process.exitCode = 1;
});
