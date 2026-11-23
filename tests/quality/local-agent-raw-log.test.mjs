import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, renameSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LocalAgentRawLogHost } from '../../src/modules/host/local-agent-raw-log.ts';

function fixture() {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-agent-raw-'));
  const log = path.join(home, '.local/state/local-agent/termux/runit/logs/agent');
  mkdirSync(log, { recursive: true });
  return { home, log, current: path.join(log, 'current') };
}

test('returns byte-for-byte raw lines, including commands, tokens and original svlogd timestamps', () => {
  const f = fixture();
  try {
    const content =
      '2026-11-20_15:00:00.123456 [termux-agent] TASK id=all-details\n' +
      '2026-11-20_15:00:01.123456 [CMD] TOKEN=raw-value; command=echo cześć\n';
    writeFileSync(f.current, content);
    const host = new LocalAgentRawLogHost(f.home);
    const first = host.read();
    assert.equal(first.state, 'ok');
    assert.equal(first.reset, false);
    assert.equal(first.more, false);
    assert.equal(first.bytes.toString('utf8'), content);
    const second = host.read(first.cursor);
    assert.equal(second.bytes.length, 0);
    writeFileSync(f.current, content + '2026-11-20_15:00:02.123456 [CMD] another\n');
    const third = host.read(second.cursor);
    assert.equal(third.state, 'ok');
    assert.equal(third.bytes.toString(), '2026-11-20_15:00:02.123456 [CMD] another\n');
    assert.equal(third.reset, false);
  } finally {
    rmSync(f.home, { recursive: true, force: true });
  }
});

test('tracks rotation with a new inode and preserves all original lines without classification', () => {
  const f = fixture();
  try {
    writeFileSync(f.current, 'old log\n');
    const host = new LocalAgentRawLogHost(f.home);
    const prev = host.read();
    renameSync(f.current, path.join(f.log, 'old-log'));
    writeFileSync(f.current, 'new original log\n');
    const next = host.read(prev.cursor);
    assert.equal(next.state, 'ok');
    assert.equal(next.reset, true);
    assert.equal(next.bytes.toString(), 'new original log\n');
  } finally {
    rmSync(f.home, { recursive: true, force: true });
  }
});

test('streams arbitrarily long log data in unchanged successive byte ranges', () => {
  const f = fixture();
  try {
    const content = 'A'.repeat(256 * 1024 - 1) + 'ż' + '\nXYZ\n';
    writeFileSync(f.current, content);
    const host = new LocalAgentRawLogHost(f.home);
    const first = host.read();
    assert.equal(first.more, true);
    const next = host.read(first.cursor);
    assert.equal(next.more, false);
    assert.deepEqual(Buffer.concat([first.bytes, next.bytes]), Buffer.from(content));
  } finally {
    rmSync(f.home, { recursive: true, force: true });
  }
});

test('refuses redirected private log files and never reads other host content', () => {
  const f = fixture();
  try {
    symlinkSync('/etc/passwd', f.current);
    const result = new LocalAgentRawLogHost(f.home).read();
    assert.equal(result.state, 'unavailable');
    assert.equal(result.bytes.length, 0);
  } finally {
    rmSync(f.home, { recursive: true, force: true });
  }
});
