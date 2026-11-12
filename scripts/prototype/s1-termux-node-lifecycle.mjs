#!/usr/bin/env node
/**
 * S1 disposable process-lifecycle probe for the CURRENT Termux UID.
 *
 * NOT an isolated Android APK proof. Starts only this file as children via
 * process.execPath; uses kernel-assigned loopback ports; never scans, adopts,
 * restarts or signals external processes and never modifies host packages.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const LOOPBACK = '127.0.0.1';
const WORKER_IDS = new Set(['one', 'two', 'replacement']);

export function parseReadyLine(raw, expectedId, expectedPid) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Malformed process readiness message');
  }
  if (
    !value || typeof value !== 'object' ||
    value.id !== expectedId || !WORKER_IDS.has(value.id) ||
    !Number.isSafeInteger(value.pid) || value.pid !== expectedPid ||
    !Number.isInteger(value.port) || value.port < 1 || value.port > 65535
  ) {
    throw new Error('Untrusted process readiness message');
  }
  return { id: value.id, pid: value.pid, port: value.port };
}

async function worker(id) {
  if (!WORKER_IDS.has(id)) throw new Error('Invalid worker ID');
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ id, pid: process.pid, uid: process.getuid?.() ?? null }));
  });
  server.on('error', (error) => {
    console.error('owned-worker-bind-error:' + error.code);
    process.exitCode = 1;
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No owned loopback port');
  process.stdout.write(JSON.stringify({ id, pid: process.pid, port: address.port }) + '\n');
  const shutdown = () => server.close(() => { process.exitCode = 0; });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

function launch(id) {
  if (!WORKER_IDS.has(id)) throw new Error('Invalid worker ID');
  const child = spawn(process.execPath, [SELF, '--worker=' + id], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, POCKETHOST_S1_PROBE: '1' },
    shell: false,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-800); });
  const ready = new Promise((resolve, reject) => {
    let resolved = false;
    let buffer = '';
    const timer = setTimeout(() => fail(new Error('Owned process did not report readiness')), 7000);
    const finish = (fn, arg) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      fn(arg);
    };
    const fail = (error) => finish(reject, error);
    child.once('error', fail);
    child.once('exit', (code, signal) => {
      fail(new Error('Owned process exited before readiness: ' + String(code ?? signal) + ' ' + stderr));
    });
    child.stdout.on('data', (chunk) => {
      if (resolved) return;
      buffer += chunk.toString();
      if (buffer.length > 1024) return fail(new Error('Unexpected process readiness output'));
      const end = buffer.indexOf('\n');
      if (end < 0) return;
      try {
        finish(resolve, parseReadyLine(buffer.slice(0, end), id, child.pid));
      } catch (error) {
        fail(error);
      }
    });
  });
  return { child, ready };
}

async function requestHealth(ready) {
  const response = await fetch('http://' + LOOPBACK + ':' + ready.port + '/health', {
    signal: AbortSignal.timeout(2500),
    cache: 'no-store',
  });
  assert.equal(response.status, 200);
  const content = await response.json();
  assert.deepEqual(content, {
    id: ready.id,
    pid: ready.pid,
    uid: process.getuid?.() ?? null,
  });
}

async function stopOwned(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  let onExit;
  const exited = new Promise((resolve) => {
    onExit = resolve;
    child.once('exit', resolve);
  });
  if (!child.kill('SIGTERM')) {
    child.off('exit', onExit);
    return;
  }
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
  ]);
  if (!graceful && child.exitCode === null && child.signalCode === null) {
    // Only the ChildProcess that this test itself created, never a discovered PID.
    child.kill('SIGKILL');
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  }
}

export async function runTermuxLifecycleProbe() {
  const owned = [];
  try {
    const first = launch('one');
    owned.push(first.child);
    const second = launch('two');
    owned.push(second.child);
    const [a, b] = await Promise.all([first.ready, second.ready]);
    assert.notEqual(a.pid, b.pid, 'Separate child processes required');
    assert.notEqual(a.port, b.port, 'Independent ports required');
    await Promise.all([requestHealth(a), requestHealth(b)]);
    await stopOwned(first.child);
    await requestHealth(b); // Terminating one worker must not kill another.
    const replacement = launch('replacement');
    owned.push(replacement.child);
    const c = await replacement.ready;
    assert.notEqual(c.pid, b.pid);
    await requestHealth(c);
    return {
      status: 'PASS',
      scope: 'CURRENT_TERMUX_SAME_UID_ONLY',
      androidApkIndependent: false,
      processesStarted: 3,
      simultaneousNodeProcesses: 2,
      checks: ['distinct-processes', 'distinct-loopback-ports', 'isolated-stop', 'replacement-start'],
    };
  } finally {
    await Promise.allSettled(owned.map(stopOwned));
  }
}

if (process.argv[1] === SELF) {
  const workerArg = process.argv.slice(2).find((argument) => argument.startsWith('--worker='));
  if (workerArg) {
    if (process.env.POCKETHOST_S1_PROBE !== '1') {
      console.error('Owned worker start marker missing');
      process.exitCode = 2;
    } else {
      worker(workerArg.slice('--worker='.length)).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
    }
  } else if (process.argv.length === 2 || process.argv.slice(2).join(' ') === '--run') {
    runTermuxLifecycleProbe()
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error) => {
        console.error(JSON.stringify({ status: 'FAIL', reason: error.message.slice(0, 250) }));
        process.exitCode = 1;
      });
  } else {
    console.error('Usage: node scripts/prototype/s1-termux-node-lifecycle.mjs [--run]');
    process.exitCode = 2;
  }
}
