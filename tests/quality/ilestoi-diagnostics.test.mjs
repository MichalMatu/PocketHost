import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { IleStoiDiagnosticHost, redactServiceLog } from '../../src/modules/host/ilestoi-diagnostics.ts';

const time = '2026-11-13T17:00:00.000Z';
const stat = (pid) => pid + ' (node) S 1 ' +
  Array.from({ length: 19 }, (_, i) => i === 17 ? '42' : '0').join(' ');
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-ilestoi-'));
  const serviceRoot = path.join(root, 'service');
  const svRoot = path.join(root, 'sv');
  const logRoot = path.join(root, 'logs');
  mkdirSync(serviceRoot); mkdirSync(svRoot); mkdirSync(logRoot);
  mkdirSync(path.join(svRoot, 'wreckscanner'));
  symlinkSync(path.join(svRoot, 'wreckscanner'), path.join(serviceRoot, 'wreckscanner'));
  return { root, serviceRoot, svRoot, logRoot };
}
const proc = (file) => file.endsWith('/stat') ? stat(42) :
  'Name:\tnode\nVmRSS:\t2048 kB\n';

test('IleStoi runit status has matching PID, start ticks and bounded RSS', () => {
  const f = fixture(); const calls = [];
  try {
    const host = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot, (binary, args) => {
      calls.push([binary, args]);
      return { status: 0, stdout: 'run: ' + args[1] + ': (pid 42) 90s; run: log' };
    }, proc, () => time);
    const observed = host.inspect();
    assert.equal(observed.runit.state, 'running');
    assert.equal(observed.runit.uptimeSeconds, 90);
    assert.equal(observed.process?.pid, 42);
    assert.equal(observed.process?.startTicks, '42');
    assert.equal(observed.process?.rssMiB, 2);
    assert.equal(observed.health.state, 'unverified');
    assert.equal(observed.notice, 'external-protected-no-lifecycle-control');
    assert.equal(calls.length, 2);
    assert.ok(calls.every(([binary, args]) => binary.endsWith('/bin/sv') &&
      args[0] === 'status' && args[1] === path.join(f.serviceRoot, 'wreckscanner')));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('spoofed aliases and missing services cannot execute runit', () => {
  const f = fixture(); let calls = 0;
  try {
    rmSync(path.join(f.serviceRoot, 'wreckscanner'));
    mkdirSync(path.join(f.svRoot, 'not-wreckscanner'));
    symlinkSync(path.join(f.svRoot, 'not-wreckscanner'), path.join(f.serviceRoot, 'wreckscanner'));
    const host = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      () => { calls++; return { status: 0, stdout: '' }; });
    assert.equal(host.inspect().runit.state, 'unknown');
    assert.equal(calls, 0);
    rmSync(path.join(f.serviceRoot, 'wreckscanner'));
    assert.equal(host.inspect().runit.error, 'service-unavailable');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('runit timeout, inaccessible /proc and swapped PID remain unverified', () => {
  const f = fixture();
  try {
    const timeout = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      () => ({ status: null, error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }));
    assert.equal(timeout.inspect().runit.error, 'runit-timeout');
    const denied = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      (_file, args) => ({ status: 0, stdout: 'run: ' + args[1] + ': (pid 42) 90s;' }),
      () => { throw { code: 'EACCES' }; });
    assert.equal(denied.inspect().runit.error, 'process-permission-denied');
    let count = 0;
    const changed = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      (_file, args) => ({ status: 0, stdout: 'run: ' + args[1] + ': (pid ' +
        (++count === 1 ? 42 : 43) + ') 90s;' }), proc);
    assert.equal(changed.inspect().runit.error, 'process-identity-changed');
    const down = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      (_file, args) => ({ status: 0, stdout: 'down: ' + args[1] + ': 60s;' }));
    assert.equal(down.inspect().runit.state, 'stopped');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('logs are bounded and redacted; symlinks cannot read foreign logs', () => {
  const f = fixture();
  try {
    const folder = path.join(f.svRoot, 'wreckscanner', 'log/main');
    mkdirSync(folder, { recursive: true });
    const log = path.join(folder, 'current');
    writeFileSync(log, 'token=SUPERSECRET https://example.test/path?key=ABC\nAuthorization: Bearer BIGSECRET\n\x1b[31merror\x1b[0m\n');
    const host = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      (_file, args) => ({ status: 0, stdout: 'down: ' + args[1] + ': 60s;' }));
    const observed = host.inspect();
    assert.equal(observed.logs.state, 'ok');
    assert.ok(!JSON.stringify(observed).includes('SUPERSECRET'));
    assert.ok(!JSON.stringify(observed).includes('BIGSECRET'));
    assert.ok(!JSON.stringify(observed).includes('example.test'));
    assert.ok(observed.logs.lines.every(line => line.length <= 200));
    assert.equal(redactServiceLog('cookie=abc'), 'cookie=[redacted]');
    rmSync(log);
    symlinkSync('/etc/passwd', log);
    assert.equal(host.inspect().logs.error, 'unsafe-log-entry');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('HTTP routes are fixed, read-only and probed only for a verified runit PID', async () => {
  const f = fixture();
  const paths = [];
  try {
    const host = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      (_file, args) => ({ status: 0, stdout: 'run: ' + args[1] + ': (pid 42) 90s;' }),
      proc, () => time, async route => {
        paths.push(route);
        return { state: 'ok', statusCode: 200, error: null };
      });
    const result = await host.inspectWithHttp();
    assert.deepEqual(paths, ['/api/health/live', '/api/health/ready']);
    assert.equal(result.health.state, 'measured');
    assert.equal(result.health.live.statusCode, 200);
    assert.equal(result.health.ready.state, 'ok');
    assert.equal(result.health.attribution, 'http-route-not-process-attested');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('intermediate log symlink is refused before opening target', () => {
  const f = fixture();
  try {
    const external = path.join(f.root, 'external');
    mkdirSync(external);
    mkdirSync(path.join(external, 'main'));
    writeFileSync(path.join(external, 'main/current'), 'secret=LEAK');
    symlinkSync(external, path.join(f.svRoot, 'wreckscanner/log'));
    const host = new IleStoiDiagnosticHost(f.serviceRoot, f.svRoot, f.logRoot,
      (_file, args) => ({ status: 0, stdout: 'down: ' + args[1] + ': 60s;' }));
    const output = host.inspect();
    assert.equal(output.logs.error, 'unsafe-log-entry');
    assert.ok(!JSON.stringify(output).includes('LEAK'));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
