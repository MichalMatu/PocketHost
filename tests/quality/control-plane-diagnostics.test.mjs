import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { ControlPlaneDiagnosticHost } from '../../src/modules/host/control-plane-diagnostics.ts';

const a = 'a'.repeat(40), b = 'b'.repeat(40);
const stat = pid => pid + ' (node) S 1 ' +
  Array.from({ length: 19 }, (_, i) => i === 17 ? '555' : '0').join(' ');
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ph-control-'));
  const home = path.join(root, 'home');
  const services = path.join(root, 'services');
  const sv = path.join(root, 'sv');
  const projects = path.join(home, 'Projects');
  const admin = path.join(projects, 'PocketHost-Preview/apps/admin');
  const gatewayFolder = path.join(home, '.local/state/pockethost');
  for (const dir of [services, sv, admin, gatewayFolder]) mkdirSync(dir, { recursive: true });
  for (const name of ['termux-agent', 'pockethost-panel', 'pockethost-panel-watch']) {
    mkdirSync(path.join(sv, name));
    symlinkSync(path.join(sv, name), path.join(services, name));
  }
  const marker = path.join(projects, 'PocketHost-P3-Preview-20261106.json');
  const gateway = path.join(gatewayFolder, 'lan-gateway.json');
  const m = { pid: 98, startTicks: '555', cwd: admin, port: 8787, sourceSha: a };
  const g = { owner: 'PocketHost', pid: 98, startTicks: '555', cwd: admin, adminPort: 18878 };
  writeFileSync(marker, JSON.stringify(m));
  writeFileSync(gateway, JSON.stringify(g));
  return { root, home, services, sv, admin, marker, gateway, m, g };
}
function build(f, calls = [], procCwd = f.admin) {
  const run = (bin, args) => {
    calls.push([bin, args]);
    if (bin.endsWith('/bin/sv')) return {
      status: 0, stdout: 'run: ' + args[1] + ': (pid 98) 120s; run: log',
    };
    if (args.includes('rev-parse')) return { status: 0, stdout: b + '\n' };
    if (args.includes('get-url')) return {
      status: 0, stdout: 'https://github.com/MichalMatu/PocketHost.git\n',
    };
    if (args.includes('--porcelain')) return { status: 0, stdout: '' };
    throw Error('unexpected command');
  };
  return new ControlPlaneDiagnosticHost(f.services, f.sv, f.home, run,
    file => file.endsWith('/stat') ? stat(98) : 'node\0vite\0',
    file => file.startsWith('/proc/') ? procCwd : realpathSync(file),
    () => '2026-11-13T20:00:00.000Z');
}
test('fixed read-only observations and SHA mismatch block operations', () => {
  const f = fixture(), calls = [];
  try {
    const result = build(f, calls).inspect();
    assert.equal(result.localAgent.runit.state, 'running');
    assert.equal(result.localAgent.intake, 'unverified');
    assert.equal(result.localAgent.lastResult, 'unverified');
    assert.equal(result.pocketHost.owner.state, 'verified');
    assert.equal(result.pocketHost.owner.revision, 'mismatch');
    assert.equal(result.pocketHost.owner.markerSha, a);
    assert.equal(result.pocketHost.owner.checkoutSha, b);
    assert.equal(result.pocketHost.restart, 'blocked');
    assert.equal(calls.filter(([bin]) => bin.endsWith('/bin/sv')).length, 3);
    assert.ok(calls.every(([bin, args]) => bin.endsWith('/bin/sv')
      ? args[0] === 'status' && args.length === 2
      : bin.endsWith('/bin/git') && args[0] === '-C' &&
        ['rev-parse', 'remote', 'status'].includes(args[2])));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('spoofed service link and owner marker drift fail closed', () => {
  const f = fixture(), calls = [];
  try {
    rmSync(path.join(f.services, 'termux-agent'));
    mkdirSync(path.join(f.sv, 'impostor'));
    symlinkSync(path.join(f.sv, 'impostor'), path.join(f.services, 'termux-agent'));
    writeFileSync(f.gateway, JSON.stringify({ ...f.g, pid: 77 }));
    const result = build(f, calls).inspect();
    assert.equal(result.localAgent.runit.error, 'unsafe-service');
    assert.equal(result.pocketHost.owner.state, 'unverified');
    assert.equal(result.pocketHost.owner.reason, 'invalid-owner');
    assert.equal(calls.filter(([bin]) => bin.endsWith('/bin/git')).length, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('symlink owner marker, process drift, foreign checkout are rejected', () => {
  const f = fixture();
  try {
    rmSync(f.marker);
    symlinkSync('/etc/passwd', f.marker);
    assert.equal(build(f).inspect().pocketHost.owner.state, 'unverified');
    rmSync(f.marker);
    writeFileSync(f.marker, JSON.stringify(f.m));
    assert.equal(build(f, [], '/tmp/foreign').inspect().pocketHost.owner.reason, 'invalid-process');
    writeFileSync(f.marker, JSON.stringify({ ...f.m, cwd: '/tmp/foreign/apps/admin' }));
    assert.equal(build(f).inspect().pocketHost.owner.reason, 'invalid-owner');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
