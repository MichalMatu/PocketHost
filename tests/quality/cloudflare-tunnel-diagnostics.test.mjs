import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { CloudflareTunnelDiagnosticHost, classifyTunnelLog, summarizeTunnelConfig } from '../../src/modules/host/cloudflare-tunnel-diagnostics.ts';

const time = '2026-11-13T18:00:00.000Z';
const stat = pid => pid + ' (cloudflared) S 1 ' +
  Array.from({ length: 19 }, (_, i) => i === 17 ? '555' : '0').join(' ');
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-cloudflare-'));
  const service = path.join(root, 'service');
  const sv = path.join(root, 'sv');
  const logs = path.join(root, 'logs');
  const configDir = path.join(root, 'home', '.cloudflared');
  const config = path.join(configDir, 'config.yml');
  for (const dir of [service, sv, logs, configDir]) mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(sv, 'cloudflared'));
  symlinkSync(path.join(sv, 'cloudflared'), path.join(service, 'cloudflared'));
  return { root, service, sv, logs, configDir, config };
}
const proc = p => p.endsWith('/stat') ? stat(98) : 'Name:\tcloudflared\nVmRSS:\t4096 kB\n';

test('fixed Cloudflare runit lookup and verified process identity; connection state is unverified', () => {
  const f = fixture(); const commands = [];
  try {
    writeFileSync(f.config, 'tunnel: 00000000-0000-4000-8000-000000000000\ncredentials-file: /private/key.json\ningress:\n  - hostname: site.example.com\n    service: http://127.0.0.1:8001\n  - hostname: photos.example.com\n    service: https://127.0.0.1:3000\n  - service: http_status:404\n');
    const host = new CloudflareTunnelDiagnosticHost(f.service, f.sv, f.logs, f.config,
      (binary, args) => {
        commands.push([binary, args]);
        return { status: 0, stdout: 'run: ' + args[1] + ': (pid 98) 200s; run: log' };
      }, proc, () => time);
    const value = host.inspect();
    assert.equal(value.runit.state, 'running');
    assert.equal(value.runit.uptimeSeconds, 200);
    assert.equal(value.process?.rssMiB, 4);
    assert.equal(value.process?.startTicks, '555');
    assert.equal(value.connections.state, 'unverified');
    assert.deepEqual(value.config.ingress, [
      { hostname: 'site.example.com', backend: 'http' },
      { hostname: 'photos.example.com', backend: 'https' },
    ]);
    assert.equal(value.config.credentialsFileDeclared, true);
    assert.ok(!JSON.stringify(value).includes('private/key.json'));
    assert.equal(commands.length, 2);
    assert.ok(commands.every(([binary, args]) => binary.endsWith('/bin/sv') &&
      args[0] === 'status' && args[1] === path.join(f.service, 'cloudflared')));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('malformed domains and raw secret fields never cross the config boundary', () => {
  const value = summarizeTunnelConfig('tunnel: SECRET_TUNNEL_VALUE\n' +
    'credentials-file: SECRET_FILE\n' +
    'ingress:\n  - hostname: user:pass@evil.example.com\n    service: http://token@127.0.0.1:80\n' +
    '  - hostname: good.example.com\n    service: ssh://privateuser@localhost:22\n');
  assert.deepEqual(value.ingress, [{ hostname: 'good.example.com', backend: 'ssh' }]);
  assert.equal(JSON.stringify(value).includes('SECRET'), false);
  assert.equal(JSON.stringify(value).includes('privateuser'), false);
  assert.equal(JSON.stringify(value).includes('token@'), false);
});
test('spoofed runit symlink and config symlink are refused', () => {
  const f = fixture(); let commands = 0;
  try {
    rmSync(path.join(f.service, 'cloudflared'));
    mkdirSync(path.join(f.sv, 'not-cloudflared'));
    symlinkSync(path.join(f.sv, 'not-cloudflared'), path.join(f.service, 'cloudflared'));
    symlinkSync('/etc/passwd', f.config);
    const host = new CloudflareTunnelDiagnosticHost(f.service, f.sv, f.logs, f.config,
      () => { commands++; return { status: 0, stdout: '' }; });
    const value = host.inspect();
    assert.equal(value.runit.state, 'unknown');
    assert.equal(value.config.error, 'unsafe-config');
    assert.equal(commands, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('log lines are classified to event types only; no secrets, URLs or credentials', () => {
  const f = fixture();
  try {
    const log = path.join(f.sv, 'cloudflared/log/main');
    mkdirSync(log, { recursive: true });
    writeFileSync(path.join(log, 'current'),
      '2026-11-13T17:00:00Z INF Registered tunnel connection connIndex=0 token=EXPOSEME\n' +
      '2026-11-13T17:00:10Z ERR Failed to reach https://sensitive.example.com?token=EXPOSEME\n');
    const host = new CloudflareTunnelDiagnosticHost(f.service, f.sv, f.logs, f.config,
      (_bin, args) => ({ status: 0, stdout: 'down: ' + args[1] + ': 20s;' }));
    const value = host.inspect();
    assert.equal(value.connections.state, 'unverified');
    assert.equal(value.logs.state, 'ok');
    assert.equal(value.logs.events[0]?.kind, 'registered');
    assert.ok(!JSON.stringify(value).includes('EXPOSEME'));
    assert.ok(!JSON.stringify(value).includes('sensitive.example.com'));
    assert.equal(classifyTunnelLog('no event'), null);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('timeouts and unreadable log directories stay unknown without lifecycle actions', () => {
  const f = fixture();
  try {
    const host = new CloudflareTunnelDiagnosticHost(f.service, f.sv, f.logs, f.config,
      () => ({ error: Object.assign(new Error('time'), { code: 'ETIMEDOUT' }) }));
    assert.equal(host.inspect().runit.error, 'runit-timeout');
    assert.equal(host.inspect().connections.state, 'unverified');
    assert.equal(host.inspect().logs.state, 'unavailable');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('invalid hostname never assigns its backend to a previous valid route', () => {
  const config = summarizeTunnelConfig('ingress:\n  - hostname: good.example.com\n' +
    '  - hostname: invalid@secret.example.com\n    service: https://private-credential@host\n');
  assert.deepEqual(config.ingress, [{ hostname: 'good.example.com', backend: 'other' }]);
  assert.equal(JSON.stringify(config).includes('private-credential'), false);
});
