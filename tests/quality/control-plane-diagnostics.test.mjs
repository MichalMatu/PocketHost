import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
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
  const agentState = path.join(home, '.local/state/local-agent/termux');
  for (const dir of [services, sv, admin, gatewayFolder,
    path.join(agentState, 'claims'), path.join(agentState, 'results'),
    path.join(agentState, 'runit/services/termux-agent')])
    mkdirSync(dir, { recursive: true });
  for (const name of ['termux-agent', 'pockethost-panel', 'pockethost-panel-watch']) {
    mkdirSync(path.join(sv, name));
    symlinkSync(path.join(sv, name), path.join(services, name));
  }
  const marker = path.join(projects, 'PocketHost-P3-Preview-20261106.json');
  const gateway = path.join(gatewayFolder, 'lan-gateway.json');
  const m = { pid: 98, startTicks: '555', cwd: admin, port: 8787, sourceSha: a };
  const g = { owner: 'PocketHost', pid: 98, startTicks: '555', cwd: admin,
    adminPort: 18878, sourceSha: a };
  writeFileSync(marker, JSON.stringify(m));
  writeFileSync(gateway, JSON.stringify(g));
  return { root, home, services, sv, admin, agentState, marker, gateway, m, g };
}
const panelArgv = f =>
  ['/data/data/com.termux/files/usr/bin/node',
    path.join(path.dirname(path.dirname(f.admin)), 'apps/admin/node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', '8787', '--strictPort'].join('\0') + '\0';
function build(f, calls = [], procCwd = f.admin, argv = panelArgv(f), agentStatus = null) {
  const run = (bin, args) => {
    calls.push([bin, args]);
    if (bin.endsWith('/bin/sv')) return {
      status: 0, stdout: agentStatus && args[1] ===
        path.join(f.agentState, 'runit/services/termux-agent')
        ? agentStatus : 'run: ' + args[1] + ': (pid 98) 120s; run: log',
    };
    if (args.includes('rev-parse')) return { status: 0, stdout: b + '\n' };
    if (args.includes('cat-file')) return { status: 0, stdout: 'commit\n' };
    if (args.includes('merge-base')) return { status: 0, stdout: '' };
    if (args.includes('diff')) return { status: 0,
      stdout: 'apps/admin/src/app/termux/page.tsx\n' +
        'src/modules/host/control-plane-diagnostics.ts\n' +
        'tests/quality/control-plane-diagnostics.test.mjs\n' };
    if (args.includes('get-url')) return {
      status: 0, stdout: 'https://github.com/MichalMatu/PocketHost.git\n',
    };
    if (args.includes('--porcelain')) return { status: 0, stdout: '' };
    throw Error('unexpected command');
  };
  return new ControlPlaneDiagnosticHost(f.services, f.sv, f.home, run,
    file => file.endsWith('/stat') ? stat(98) : argv,
    file => file.startsWith('/proc/') ? procCwd : realpathSync(file),
    () => '2026-11-13T20:00:00.000Z');
}
test('fixed read-only observations and SHA mismatch block operations', () => {
  const f = fixture(), calls = [];
  try {
    const result = build(f, calls).inspect();
    assert.equal(result.localAgent.runit.state, 'running');
    assert.equal(result.localAgent.intake, 'stop-absent');
    assert.equal(result.localAgent.claims, 0);
    assert.equal(result.localAgent.spooled, 0);
    assert.equal(result.localAgent.unspooledClaims, 0);
    assert.equal(result.localAgent.orphanSpools, 0);
    assert.equal(result.localAgent.lastResultAt, null);
    assert.equal(result.localAgent.publication, 'not-checked');
    assert.equal(result.localAgent.lastResult, 'unverified');
    assert.equal(result.pocketHost.owner.state, 'verified');
    assert.equal(result.pocketHost.owner.revision, 'mismatch');
    assert.equal(result.pocketHost.owner.markerSha, a);
    assert.equal(result.pocketHost.owner.gatewaySha, a);
    assert.equal(result.pocketHost.owner.markerAgreement, 'match');
    assert.equal(result.pocketHost.owner.checkoutSha, b);
    assert.equal(result.pocketHost.owner.revisionEvidence.state, 'ancestor');
    assert.equal(result.pocketHost.owner.revisionEvidence.changedFiles, 3);
    assert.deepEqual(result.pocketHost.owner.revisionEvidence.areas,
      { adminUI: 1, hostBackend: 1, tests: 1, docs: 0, other: 0 });
    assert.equal(result.pocketHost.restart, 'blocked');
    const runitCalls = calls.filter(([bin]) => bin.endsWith('/bin/sv'));
    assert.equal(runitCalls.length, 3);
    assert.ok(runitCalls.some(([, args]) =>
      args[1] === path.join(f.agentState, 'runit/services/termux-agent')));
    assert.ok(!runitCalls.some(([, args]) => args[1] === path.join(f.services, 'termux-agent')));
    assert.ok(calls.every(([bin, args]) => bin.endsWith('/bin/sv')
      ? args[0] === 'status' && args.length === 2
      : bin.endsWith('/bin/git') && args[0] === '-C' &&
        ['rev-parse', 'remote', 'status', 'cat-file', 'merge-base', 'diff'].includes(args[2])));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('spoofed service link and owner marker drift fail closed', () => {
  const f = fixture(), calls = [];
  try {
    const privateService = path.join(f.agentState, 'runit/services/termux-agent');
    rmSync(privateService, { recursive: true });
    mkdirSync(path.join(f.sv, 'impostor'));
    symlinkSync(path.join(f.sv, 'impostor'), privateService);
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

test('Vite JavaScript CLI process is accepted only with matching owner and start ticks', () => {
  const f = fixture();
  try {
    const good = build(f, [], f.admin, panelArgv(f)).inspect();
    assert.equal(good.pocketHost.owner.state, 'verified');
    const bad = build(f, [], f.admin,
      'node\0/data/data/com.termux/files/home/foreign/myvite.js\0').inspect();
    assert.equal(bad.pocketHost.owner.state, 'unverified');
    assert.equal(bad.pocketHost.owner.reason, 'invalid-process');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('conflicting gateway and panel SHA markers are visible and block verified ownership', () => {
  const f = fixture(), calls = [];
  try {
    writeFileSync(f.gateway, JSON.stringify({ ...f.g, sourceSha: b }));
    const result = build(f, calls).inspect();
    assert.equal(result.pocketHost.owner.state, 'unverified');
    assert.equal(result.pocketHost.owner.reason, 'invalid-source');
    assert.equal(result.pocketHost.owner.revisionEvidence.state, 'unavailable');
    assert.equal(result.pocketHost.owner.markerAgreement, 'mismatch');
    assert.equal(result.pocketHost.owner.gatewaySha, b);
    assert.equal(result.pocketHost.restart, 'blocked');
    assert.equal(calls.filter(([bin]) => bin.endsWith('/bin/git')).length, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('Local Agent STOP signal and spool counts are observed without reading private task data', () => {
  const f = fixture(), calls = [];
  try {
    writeFileSync(path.join(f.agentState, 'claims', 'task-one.json'), '{secret}');
    writeFileSync(path.join(f.agentState, 'claims', 'task-two.json'), '{other secret}');
    writeFileSync(path.join(f.agentState, 'results', 'task-one.json'), '{private data}');
    symlinkSync('missing-target', path.join(f.agentState, 'EMERGENCY_STOP'));
    const observed = build(f, calls).inspect().localAgent;
    assert.equal(observed.intake, 'stop-present');
    assert.equal(observed.claims, 2);
    assert.equal(observed.spooled, 1);
    assert.equal(observed.unspooledClaims, 1);
    assert.equal(observed.orphanSpools, 0);
    assert.equal(observed.lastResult, 'unverified');
    assert.equal(observed.publication, 'not-checked');
    assert.ok(!JSON.stringify(observed).includes('private data'));
    assert.ok(!JSON.stringify(observed).includes('secret'));
    assert.ok(!calls.some(([bin]) => bin.includes('python')));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('symlinked Local Agent state or results fail closed without following links', () => {
  const f = fixture();
  try {
    const status = path.join(f.agentState, 'results');
    rmSync(status, { recursive: true });
    symlinkSync('/etc', status);
    const observed = build(f).inspect().localAgent;
    assert.equal(observed.claims, 0);
    assert.equal(observed.spooled, null);
    assert.equal(observed.unspooledClaims, null);
    assert.equal(observed.publication, 'not-checked');
    rmSync(status);
    rmSync(f.agentState, { recursive: true });
    symlinkSync('/etc', f.agentState);
    const unknown = build(f).inspect().localAgent;
    assert.equal(unknown.intake, 'unverified');
    assert.equal(unknown.claims, null);
    assert.equal(unknown.spooled, null);
    assert.equal(unknown.unspooledClaims, null);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('missing Agent-owned runit directory stays unknown even if generic name is running', () => {
  const f = fixture(), calls = [];
  try {
    rmSync(path.join(f.agentState, 'runit'), { recursive: true });
    const observed = build(f, calls).inspect().localAgent;
    assert.equal(observed.runit.state, 'unknown');
    assert.equal(observed.runit.error, 'unavailable');
    assert.equal(observed.intake, 'stop-absent');
    assert.ok(!calls.some(([bin, args]) => bin.endsWith('/bin/sv') &&
      args[1] === path.join(f.services, 'termux-agent')));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('Agent runit marker symlink cannot redirect status to a foreign service', () => {
  const f = fixture(), calls = [];
  try {
    const privateRoot = path.join(f.agentState, 'runit');
    rmSync(privateRoot, { recursive: true });
    symlinkSync(f.sv, privateRoot);
    const observed = build(f, calls).inspect().localAgent;
    assert.equal(observed.runit.state, 'unknown');
    assert.equal(observed.runit.error, 'unsafe-service');
    assert.ok(!calls.some(([bin, args]) => bin.endsWith('/bin/sv') &&
      args[1].includes('/runit/services/termux-agent')));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('foreign Vite process, altered listening port and extra flags never verify panel identity', () => {
  const f = fixture();
  try {
    const original = panelArgv(f);
    const variants = [
      original.replace('/apps/admin/node_modules/vite/bin/vite.js',
        '/apps/admin/node_modules/other/vite.js'),
      original.replace(['--port', '8787'].join('\0'), ['--port', '9999'].join('\0')),
      original.replace(['--host', '127.0.0.1'].join('\0'),
        ['--host', '0.0.0.0'].join('\0')),
      original.replace('--strictPort', '--strictPort\0--force'),
      original.replace('/bin/node\0', '/bin/bash\0'),
    ];
    for (const argv of variants) {
      const result = build(f, [], f.admin, argv).inspect();
      assert.equal(result.pocketHost.owner.state, 'unverified');
      assert.equal(result.pocketHost.owner.reason, 'invalid-process');
      assert.equal(result.pocketHost.restart, 'blocked');
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('Agent ignores non-JSON files and rejects symlinked claim entries', () => {
  const f = fixture();
  try {
    writeFileSync(path.join(f.agentState, 'claims', 'README'), 'untrusted info');
    writeFileSync(path.join(f.agentState, 'claims', 'safe.json'), '{}');
    const baseline = build(f).inspect().localAgent;
    assert.equal(baseline.claims, 1);
    assert.equal(baseline.unspooledClaims, 1);
    symlinkSync('/etc/passwd', path.join(f.agentState, 'claims', 'unsafe.json'));
    const rejected = build(f).inspect().localAgent;
    assert.equal(rejected.claims, null);
    assert.equal(rejected.unspooledClaims, null);
    assert.equal(rejected.orphanSpools, null);
    assert.equal(rejected.publication, 'not-checked');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('latest locally correlated Agent result reports outcome without leaking payloads', () => {
  const f = fixture();
  try {
    const digest = 'd'.repeat(64);
    const writePair = (id, status, when) => {
      writeFileSync(path.join(f.agentState, 'claims', id + '.json'),
        JSON.stringify({ version: 1, id, task_digest: digest,
          status: 'execution_may_have_started' }));
      const resultFile = path.join(f.agentState, 'results', id + '.json');
      writeFileSync(resultFile,
        JSON.stringify({ version: 1, id, status, task_digest: digest,
          target_host_id: 'fixture-host', target_installation_id: 'fixture-install',
          result: { id, status, secretOutput: 'private data' } }));
      utimesSync(resultFile, new Date(when), new Date(when));
    };
    writePair('first', 'done', '2026-11-12T09:00:00Z');
    writePair('second', 'unknown', '2026-11-13T09:00:00Z');
    const observed = build(f).inspect().localAgent;
    assert.equal(observed.lastResult, 'unknown');
    assert.equal(observed.lastResultAt, '2026-11-13T09:00:00.000Z');
    assert.equal(observed.orphanSpools, 0);
    assert.equal(observed.publication, 'not-checked');
    assert.ok(!JSON.stringify(observed).includes('private data'));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('corrupt or orphaned latest Agent spool never becomes an authoritative result', () => {
  const f = fixture();
  try {
    const id = 'unclaimed';
    writeFileSync(path.join(f.agentState, 'results', id + '.json'),
      JSON.stringify({ version: 1, id, status: 'done', secret: 'do not expose' }));
    const observed = build(f).inspect().localAgent;
    assert.equal(observed.orphanSpools, 1);
    assert.equal(observed.lastResult, 'unverified');
    assert.equal(observed.lastResultAt, null);
    assert.equal(observed.publication, 'not-checked');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('mismatched digest and oversized local result fail closed', () => {
  const f = fixture();
  try {
    const id = 'mismatch';
    writeFileSync(path.join(f.agentState, 'claims', id + '.json'),
      JSON.stringify({ version: 1, id, task_digest: 'a'.repeat(64),
        status: 'execution_may_have_started' }));
    const resultFile = path.join(f.agentState, 'results', id + '.json');
    const item = { version: 1, id, status: 'done', task_digest: 'b'.repeat(64),
      target_host_id: 'fixture-host', target_installation_id: 'fixture-install',
      result: { id, status: 'done' } };
    writeFileSync(resultFile, JSON.stringify(item));
    assert.equal(build(f).inspect().localAgent.lastResult, 'unverified');
    writeFileSync(resultFile, JSON.stringify({ ...item, task_digest: 'a'.repeat(64),
      result: { id, status: 'done', largePayload: 'x'.repeat(300000) } }));
    assert.equal(build(f).inspect().localAgent.lastResult, 'unverified');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('private Agent runit accepts real sv suffix with normally down and logger status', () => {
  const f = fixture();
  try {
    const service = path.join(f.agentState, 'runit/services/termux-agent');
    const full = 'run: ' + service +
      ': (pid 31436) 392746s, normally down; run: log: (pid 31432) 392746s';
    const healthy = build(f, [], f.admin, panelArgv(f), full).inspect().localAgent.runit;
    assert.deepEqual(healthy, { state: 'running', uptimeSeconds: 392746, error: null });
    const down = build(f, [], f.admin, panelArgv(f),
      'down: ' + service + ': 18s, normally down; run: log').inspect().localAgent.runit;
    assert.deepEqual(down, { state: 'stopped', uptimeSeconds: null, error: null });
    const unknown = build(f, [], f.admin, panelArgv(f),
      'run: /tmp/foreign: (pid 1) 5s, normally down').inspect().localAgent.runit;
    assert.equal(unknown.state, 'unknown');
    assert.equal(unknown.error, 'unavailable');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
