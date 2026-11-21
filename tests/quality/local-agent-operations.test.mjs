import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalAgentOperationsHost } from '../../src/modules/host/local-agent-operations.ts';

function fixture(installationId = 'fa8acc66-2f97-4600-845f-b35b0ada3a78') {
  const home = mkdtempSync(path.join(os.tmpdir(), 'pockethost-agent-operations-'));
  const config = path.join(home, '.config/local-agent');
  const root = path.join(home, '.local/state/local-agent/termux');
  mkdirSync(config, { recursive: true });
  writeFileSync(path.join(config, 'termux.json'), JSON.stringify({
    host_id: 'android-termux-a8',
    installation_id: installationId,
  }));
  for (const name of ['termux-agent', 'a8-operator-sshd']) {
    const folder = path.join(root, 'runit/services', name);
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, 'run'), '#!/bin/sh\n');
  }
  return { home, root };
}

test('Agent operations refuse a foreign installation without invoking runit', async () => {
  const f = fixture('unknown-installation');
  const commands = [];
  try {
    const host = new LocalAgentOperationsHost(f.home, (...args) => {
      commands.push(args);
      return { status: 0, stdout: '' };
    });
    await assert.rejects(host.apply('agent-start'), /wrong-agent-installation/);
    assert.deepEqual(commands, []);
    assert.equal(existsSync(path.join(f.root, 'INTAKE_PAUSED')), false);
  } finally {
    rmSync(f.home, { recursive: true, force: true });
  }
});

test('Agent operations reject unverified runit observations without lifecycle calls', async () => {
  const f = fixture();
  const commands = [];
  try {
    const host = new LocalAgentOperationsHost(f.home, (args, timeout) => {
      commands.push([args, timeout]);
      return { status: 1, stdout: 'unknown service' };
    });
    await assert.rejects(host.apply('agent-stop'), /agent-state-not-confirmed/);
    assert.ok(commands.length >= 1);
    assert.ok(commands.every(([args]) => args[0] === 'status'));
    assert.equal(existsSync(path.join(f.root, 'INTAKE_PAUSED')), false);
  } finally {
    rmSync(f.home, { recursive: true, force: true });
  }
});

test('Agent pause refuses a runtime without attested pause support', async () => {
  const f = fixture();
  const commands = [];
  try {
    const folder = path.join(f.root, 'runit/services/termux-agent');
    writeFileSync(path.join(folder, 'run'), '#!/bin/sh\n' + 'a'.repeat(40) + '\n');
    const host = new LocalAgentOperationsHost(f.home, args => {
      commands.push(args);
      return { status: 0, stdout: 'run: ' + args[1] + ': (pid 123) 10s' };
    });
    await assert.rejects(host.apply('agent-pause'), /pause-requires-updated-agent/);
    assert.ok(commands.length >= 1);
    assert.ok(commands.every(args => args[0] === 'status'));
    assert.equal(existsSync(path.join(f.root, 'INTAKE_PAUSED')), false);
  } finally {
    rmSync(f.home, { recursive: true, force: true });
  }
});
