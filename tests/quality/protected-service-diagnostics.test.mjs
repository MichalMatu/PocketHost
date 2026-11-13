import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { ProtectedServiceDiagnosticHost, classifyProtectedLog, summarizeProtectedConfig } from '../../src/modules/host/protected-service-diagnostics.ts';

const now = '2026-11-13T18:00:00.000Z';
const proc = pid => pid + ' (node) S 1 ' +
  Array.from({ length: 19 }, (_, i) => i === 17 ? '555' : '0').join(' ');
function fixture(name) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-protected-'));
  const services = path.join(root, 'service');
  const sv = path.join(root, 'sv');
  const logs = path.join(root, 'logs');
  const etc = path.join(root, 'etc');
  for (const dir of [services, sv, logs, etc]) mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(sv, name));
  symlinkSync(path.join(sv, name), path.join(services, name));
  return { root, services, sv, logs, etc, name };
}
function host(f, command = (_binary, args) => ({
  status: 0, stdout: 'run: ' + args[1] + ': (pid 98) 200s; run: log',
}), readProc = file => file.endsWith('/stat') ? proc(98) : 'Name:\tnode\nVmRSS:\t4096 kB\n') {
  return new ProtectedServiceDiagnosticHost(f.services, f.sv, f.logs, f.etc, command, readProc, () => now);
}
for (const name of ['sshd', 'mosquitto', 'ilestoi-healthwatch']) {
  test(name + ': verified fixed service, stable PID, read-only unknown health', () => {
    const f = fixture(name); const calls = [];
    try {
      const value = host(f, (binary, args) => {
        calls.push({ binary, args });
        return { status: 0, stdout: 'run: ' + args[1] + ': (pid 98) 200s; run: log' };
      }).inspect(name);
      assert.equal(value.service, name);
      assert.equal(value.runit.state, 'running');
      assert.equal(value.runit.uptimeSeconds, 200);
      assert.equal(value.process?.rssMiB, 4);
      assert.equal(value.process?.startTicks, '555');
      assert.equal(value.health.state, 'unverified');
      assert.equal(value.notice, 'external-protected-no-lifecycle-control');
      assert.equal(calls.length, 2);
      assert.ok(calls.every(call => call.binary.endsWith('/bin/sv') &&
        call.args[0] === 'status' && call.args[1] === path.join(f.services, name)));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
}
test('SSH/Mosquitto config reveals only allowlisted values, never secrets or paths', () => {
  const f = fixture('sshd');
  try {
    mkdirSync(path.join(f.etc, 'ssh'));
    writeFileSync(path.join(f.etc, 'ssh/sshd_config'),
      'Port 8022\nPasswordAuthentication no\nHostKey /private/key\nMatch User secret\n');
    const result = host(f).inspect('sshd');
    assert.deepEqual(result.config.settings, [
      { name: 'port', value: '8022' }, { name: 'password-authentication', value: 'no' },
    ]);
    assert.equal(JSON.stringify(result).includes('/private/key'), false);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
  const m = summarizeProtectedConfig('mosquitto',
    'listener 1883 0.0.0.0\nallow_anonymous false\npassword_file /secret/location\n');
  assert.deepEqual(m.settings, [
    { name: 'listener', value: '1883' }, { name: 'anonymous-access', value: 'false' },
  ]);
  assert.equal(JSON.stringify(m).includes('/secret/location'), false);
});
test('spoofed runit symlink, symlinked config and log are not followed', () => {
  const f = fixture('sshd');
  try {
    rmSync(path.join(f.services, 'sshd'));
    mkdirSync(path.join(f.sv, 'foreign-sshd'));
    symlinkSync(path.join(f.sv, 'foreign-sshd'), path.join(f.services, 'sshd'));
    mkdirSync(path.join(f.etc, 'ssh'));
    symlinkSync('/etc/passwd', path.join(f.etc, 'ssh/sshd_config'));
    const result = host(f, () => { throw Error('must not call sv'); }).inspect('sshd');
    assert.equal(result.runit.state, 'unknown');
    assert.equal(result.config.state, 'unavailable');
    assert.equal(result.config.error, 'unsafe-config');
    assert.equal(result.process, null);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
  const g = fixture('mosquitto');
  try {
    mkdirSync(path.join(g.sv, 'mosquitto/log/main'), { recursive: true });
    symlinkSync('/etc/passwd', path.join(g.sv, 'mosquitto/log/main/current'));
    assert.equal(host(g).inspect('mosquitto').logs.error, 'unsafe-log');
  } finally { rmSync(g.root, { recursive: true, force: true }); }
});
test('bounded event categories, without raw SSH/MQTT credentials, hosts or log text', () => {
  const f = fixture('mosquitto');
  try {
    const log = path.join(f.sv, 'mosquitto/log/main');
    mkdirSync(log, { recursive: true });
    writeFileSync(path.join(log, 'current'),
      '2026-11-13T18:00:00Z Client connected with password SECRET at 10.0.0.1\n' +
      '2026-11-13T18:00:01Z Error token=SECRET in https://example.org/key\n');
    const result = host(f).inspect('mosquitto');
    assert.equal(result.logs.events.length, 2);
    assert.equal(result.logs.events[0]?.kind, 'connection');
    assert.equal(result.logs.events[1]?.kind, 'failure');
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
    assert.equal(JSON.stringify(result).includes('10.0.0.1'), false);
    assert.equal(JSON.stringify(result).includes('example.org'), false);
    assert.equal(classifyProtectedLog('random unrecognized line'), null);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('changing PID/start ticks, denied proc and timeouts never claim a verified process', () => {
  const f = fixture('ilestoi-healthwatch');
  try {
    let reads = 0;
    const moving = host(f, undefined, file => file.endsWith('/stat')
      ? proc(98).replace('555', String(++reads)) : 'VmRSS:\t2048 kB\n').inspect('ilestoi-healthwatch');
    assert.equal(moving.process, null);
    assert.equal(moving.runit.error, 'process-identity-changed');
    const denied = host(f, undefined, () => {
      throw Object.assign(Error('no access'), { code: 'EACCES' });
    }).inspect('ilestoi-healthwatch');
    assert.equal(denied.runit.error, 'process-permission-denied');
    const timeout = host(f, () => ({
      error: Object.assign(Error('timeout'), { code: 'ETIMEDOUT' }),
    })).inspect('ilestoi-healthwatch');
    assert.equal(timeout.runit.error, 'runit-timeout');
    assert.equal(timeout.lastCheck.state, 'unverified');
    assert.throws(() => host(f).inspect('../sshd'), /unsupported-service/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
