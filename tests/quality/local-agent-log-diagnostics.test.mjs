import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyAgentLogLine, safeAgentLogLine, LocalAgentLogHost,
} from '../../src/modules/host/local-agent-log-diagnostics.ts';

const sample = '2026-11-13T20:45:00Z task_budget_exhausted PRIVATE_TOKEN=secret-SUPER ' +
  'task=important command=cat ~/.ssh/id_ed25519';

function fixture() {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-agent-log-'));
  const folder = path.join(home, '.local/state/local-agent/termux/runit/logs/agent');
  mkdirSync(folder, { recursive: true });
  return { home, folder, current: path.join(folder, 'current') };
}

test('classifies safe Agent event codes without copying secret log content', () => {
  const event = classifyAgentLogLine(sample);
  assert.deepEqual(event, {
    kind: 'budget', message: 'Task stopped by execution budget',
    timestamp: '2026-11-13T20:45:00.000Z',
  });
  assert.equal(classifyAgentLogLine('ACCESS_TOKEN=secret with no event'), null);
  assert.equal(classifyAgentLogLine('2026-11-13T20:45:00Z git push error PRIVATE_SECRET=abc')?.kind,
    'failed');
});

test('reads a bounded private svlogd tail and excludes arbitrary bytes', () => {
  const f = fixture();
  try {
    writeFileSync(f.current, sample + '\n' +
      '@4000000068f0000000000000 publishing a result secret=xyz\n' +
      'private data with bearer ACCESS_TOKEN=abc\n');
    const result = new LocalAgentLogHost(f.home, () => '2026-11-13T20:48:00.000Z').inspect();
    assert.equal(result.state, 'ok');
    assert.equal(result.source, 'private-runit-svlogd');
    assert.deepEqual(result.events.map(e => e.kind), ['budget', 'published']);
    assert.equal(result.unclassifiedLines, 1);
    assert.equal(result.lines.length, 3);
    assert.equal(result.lines[0].kind, 'budget');
    assert.equal(result.lines[1].kind, 'published');
    assert.equal(result.lines[2].kind, 'other');
    assert.match(result.lines[2].text, /hidden/);
    assert.ok(!JSON.stringify(result).includes('secret-'));
    assert.ok(!JSON.stringify(result).includes('ACCESS_TOKEN'));
    assert.ok(!JSON.stringify(result).includes('id_ed25519'));
    assert.equal(result.notice, 'sanitized-log-tail-no-lifecycle-authority');
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('missing and symlinked log sources fail closed, never follow foreign paths', () => {
  const f = fixture();
  try {
    assert.equal(new LocalAgentLogHost(f.home).inspect().state, 'missing');
    symlinkSync('/etc/passwd', f.current);
    assert.equal(new LocalAgentLogHost(f.home).inspect().state, 'unsafe-log');
    rmSync(f.current);
    rmSync(f.folder, { recursive: true });
    symlinkSync('/etc', f.folder);
    assert.equal(new LocalAgentLogHost(f.home).inspect().state, 'unsafe-log');
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('oversized log file cannot be streamed into browser', () => {
  const f = fixture();
  try {
    writeFileSync(f.current, 'x'.repeat(32 * 1024 * 1024 + 1));
    const result = new LocalAgentLogHost(f.home).inspect();
    assert.equal(result.state, 'unsafe-log');
    assert.deepEqual(result.events, []);
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('also supports a private service-local svlogd main/current layout', () => {
  const f = fixture();
  try {
    const serviceLog = path.join(f.home,
      '.local/state/local-agent/termux/runit/services/termux-agent/log/main');
    mkdirSync(serviceLog, { recursive: true });
    writeFileSync(path.join(serviceLog, 'current'), sample + '\n');
    const result = new LocalAgentLogHost(f.home).inspect();
    assert.equal(result.state, 'ok');
    assert.deepEqual(result.events.map(event => event.kind), ['budget']);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_TOKEN'));
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('installed Samsung svlogd path is preferred over legacy locations', () => {
  const f = fixture();
  try {
    const legacy = path.join(f.home,
      '.local/state/local-agent/termux/runit/log/termux-agent');
    mkdirSync(legacy, { recursive: true });
    writeFileSync(path.join(legacy, 'current'),
      '2026-11-13T20:45:00Z task failed legacy-only secret=abc\n');
    writeFileSync(f.current, sample + '\n');
    const result = new LocalAgentLogHost(f.home).inspect();
    assert.equal(result.state, 'ok');
    assert.deepEqual(result.events.map(event => event.kind), ['budget']);
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('svlogd -tt UTC timestamps with underscores appear as real localizable times', () => {
  const event = classifyAgentLogLine(
    '2026-11-13_21:58:57.311565 [linux-agent] exec finished exit=1; secret=hidden');
  assert.deepEqual(event, {
    kind: 'failed', message: 'Agent reported an error or failed task',
    timestamp: '2026-11-13T21:58:57.311Z',
  });
  const micro = classifyAgentLogLine(
    '2026-11-13_21:48:09.586576 [linux-agent] TASK BUDGET EXHAUSTED');
  assert.equal(micro?.kind, 'budget');
  assert.equal(micro?.timestamp, '2026-11-13T21:48:09.586Z');
  const invalid = classifyAgentLogLine(
    '2026-13-99_21:58:57.311565 [linux-agent] task failed');
  assert.equal(invalid?.timestamp, null);
  assert.equal(classifyAgentLogLine('private error token=hidden')?.timestamp, null);
});
test('installed svlogd current log renders a known timestamp without leaking payload', () => {
  const f = fixture();
  try {
    writeFileSync(f.current,
      '2026-11-13_21:58:57.311565 [linux-agent] exec finished exit=1 secret=hidden\\n');
    const observed = new LocalAgentLogHost(f.home).inspect();
    assert.equal(observed.state, 'ok');
    assert.deepEqual(observed.events.map(e => e.timestamp),
      ['2026-11-13T21:58:57.311Z']);
    assert.ok(!JSON.stringify(observed).includes('secret=hidden'));
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('older Linux Core command records are recognized as task activity', () => {
  const known = safeAgentLogLine(
    '2026-11-20_14:00:00.000000 [linux-agent] exec: command sha256=0123456789abcdef');
  assert.equal(known.kind, 'task');
  const output = safeAgentLogLine(
    '2026-11-20_14:00:01.000000 [linux-agent] output summary stage=command-1 exit=0 captured_chars=723');
  assert.equal(output.kind, 'task');
  assert.match(output.text, /captured=723 chars/);
});

test('safe tail reconstructs known command lifecycle but never prints private bytes', () => {
  const messages = [
    '2026-11-20_14:00:00.000000 [linux-agent] exec: command sha256=0123456789abcdef',
    '2026-11-20_14:00:01.000000 [linux-agent] output summary stage=command-1 exit=0 captured_chars=342',
    '2026-11-20_14:00:03.000000 [linux-agent] exec finished exit=0 elapsed=3.2s: command sha256=0123456789abcdef',
    '2026-11-20_14:00:04.000000 private output SECRET=do-not-show command=cat ~/.ssh/id_ed25519',
  ];
  const entries = messages.map(safeAgentLogLine);
  assert.equal(entries[0].text, 'exec: command sha256=0123456789abcdef');
  assert.equal(entries[1].text, 'output summary · command-1 · exit=0 · captured=342 chars');
  assert.equal(entries[2].text, 'exec finished · exit=0 · 3.2s · sha256=0123456789abcdef');
  assert.equal(entries[3].kind, 'other');
  assert.equal(entries[3].timestamp, '2026-11-20T14:00:04.000Z');
  assert.ok(!JSON.stringify(entries).includes('SECRET='));
  assert.ok(!JSON.stringify(entries).includes('id_ed25519'));
});

test('bounded tail retains placeholders for every unrecognized record', () => {
  const f = fixture();
  try {
    writeFileSync(f.current, Array.from({ length: 150 }, (_, i) =>
      '2026-11-20_14:01:00.000000 private output-' + i + ' TOKEN=hidden'
    ).join('\n') + '\n');
    const result = new LocalAgentLogHost(f.home).inspect();
    assert.equal(result.state, 'ok');
    assert.equal(result.lines.length, 120);
    assert.equal(result.unclassifiedLines, 120);
    assert.equal(result.truncated, true);
    assert.ok(result.lines.every(line => line.text.includes('hidden')));
    assert.ok(!JSON.stringify(result).includes('TOKEN=hidden'));
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('Termux task/stage/Git progress is reconstructed without raw task identifiers', () => {
  const ref = '012345abcdef';
  const source = [
    '2026-11-20_14:00:00.000000 [termux-agent] TASK START ref=' + ref,
    '2026-11-20_14:00:01.000000 [termux-agent] STAGE START ref=' + ref + ' step=1/2',
    '2026-11-20_14:00:04.000000 [termux-agent] STAGE PROGRESS ref=' + ref + ' step=1/2 progress=5/10',
    '2026-11-20_14:00:05.000000 [termux-agent] STAGE FINISHED ref=' + ref + ' step=1/2 exit=0 elapsed=4.2s',
    '2026-11-20_14:00:06.000000 [termux-agent] TASK RESULT ref=' + ref + ' status=done',
    '2026-11-20_14:00:07.000000 [termux-agent] GIT VERIFIED ref=' + ref,
    '2026-11-20_14:00:08.000000 [termux-agent] TASK RESULT ref=' + ref + ' status=done SECRET=hidden',
  ];
  const display = source.map(safeAgentLogLine);
  assert.deepEqual(display.slice(0, 6).map(r => r.kind),
    ['task', 'task', 'task', 'task', 'task', 'published']);
  assert.match(display[3].text, /exit=0.*4.2s/);
  assert.match(display[5].text, /publication verified/);
  assert.equal(display[6].text, 'Agent task activity');
  assert.ok(!JSON.stringify(display).includes('SECRET=hidden'));
  assert.ok(!JSON.stringify(display).includes('TASK RESULT ref=' + ref));
});
