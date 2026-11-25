import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAFFIC_FILE_LIMIT } from '../../src/modules/host/traffic-store.mjs';

const store = new URL('../../src/modules/host/traffic-store.mjs', import.meta.url).href;
const http = new URL('../../src/modules/host/traffic-http.mjs', import.meta.url).href;
const project = 'node-' + 'c'.repeat(32);
const requests = 300;

function childSource(enabled, root) {
  return `
    import http from 'node:http';
    const start = process.cpuUsage();
    const before = process.memoryUsage().rss;
    let recorder;
    if (${enabled}) {
      const { createTrafficRecorder } = await import(${JSON.stringify(store)});
      const { subscribeTrafficHttp } = await import(${JSON.stringify(http)});
      recorder = createTrafficRecorder(${JSON.stringify(root)}, ${JSON.stringify(project)});
      if (!recorder) throw new Error('collector initialization failed');
      const server = http.createServer((req, res) => res.end('payload'));
      server.listen(0, '127.0.0.1', () => {
        subscribeTrafficHttp(server.address().port, recorder.record);
        process.send({ port: server.address().port });
      });
      process.once('message', async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        if (!await recorder.close()) throw new Error('flush failed');
        const { readTraffic } = await import(${JSON.stringify(store)});
        const result = readTraffic(${JSON.stringify(root)}, ${JSON.stringify(project)});
        const cpu = process.cpuUsage(start);
        process.send({ cpuUs: cpu.user + cpu.system, rss: process.memoryUsage().rss,
          peakRssKiB: process.resourceUsage().maxRSS, beforeRss: before,
          requests: result.summary.requests, bytes: result.summary.bytes }, () => process.disconnect());
      });
    } else {
      const server = http.createServer((req, res) => res.end('payload'));
      server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
      process.once('message', async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        const cpu = process.cpuUsage(start);
        process.send({ cpuUs: cpu.user + cpu.system, rss: process.memoryUsage().rss,
          peakRssKiB: process.resourceUsage().maxRSS, beforeRss: before }, () => process.disconnect());
      });
    }
  `;
}

async function message(child) {
  const timer = AbortSignal.timeout(20000);
  const [value] = await once(child, 'message', { signal: timer });
  return value;
}

async function sample(parent, enabled, index) {
  const folder = path.join(parent, 'sample-' + index);
  mkdirSync(folder, { mode: 0o700 });
  const root = path.join(folder, 'traffic');
  const child = spawn(process.execPath, ['--input-type=module', '-e', childSource(enabled, root)], {
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const exit = once(child, 'exit');
  try {
    const ready = await message(child);
    const start = Date.now();
    for (let i = 0; i < requests; i++) {
      const response = await fetch('http://127.0.0.1:' + ready.port + '/route-' + (i % 8));
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'payload');
    }
    const elapsedMs = Date.now() - start;
    const pending = message(child);
    child.send('report');
    const measured = await pending;
    const [code] = await exit;
    assert.equal(code, 0);
    const entries = enabled ? readdirSync(root) : [];
    const diskBytes = entries.reduce((total, name) => total + statSync(path.join(root, name)).size, 0);
    const diskAllocatedBytes = entries.reduce((total, name) => total + statSync(path.join(root, name)).blocks * 512, 0);
    if (enabled) {
      assert.equal(measured.requests, requests);
      assert.equal(measured.bytes, requests * 7);
      assert.ok(diskBytes > 0 && diskBytes < TRAFFIC_FILE_LIMIT);
    }
    return { enabled, elapsedMs, ...measured, diskBytes, diskAllocatedBytes };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await exit;
    }
  }
}

test('real loopback traffic overhead stays within a bounded isolated process budget', { timeout: 90000 }, async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-traffic-bench-'));
  try {
    const samples = [];
    for (let i = 0; i < 4; i++) samples.push(await sample(root, i % 2 === 1, i));
    const mean = (enabled, key) => samples.filter(s => s.enabled === enabled).reduce((n, s) => n + s[key], 0) / 2;
    const cpuOverheadUs = mean(true, 'cpuUs') - mean(false, 'cpuUs');
    const rssOverheadBytes = mean(true, 'rss') - mean(false, 'rss');
    const peakOverheadKiB = mean(true, 'peakRssKiB') - mean(false, 'peakRssKiB');
    assert.ok(cpuOverheadUs < 1500000, 'CPU overhead exceeds isolated budget');
    assert.ok(rssOverheadBytes < 32 * 1024 * 1024, 'RSS overhead exceeds isolated budget');
    assert.ok(samples.filter(s => s.enabled).every(s => s.diskBytes < 128 * 1024));
    if (process.env.POCKETHOST_TRAFFIC_BENCH_SHA && /^[a-f0-9]{40}$/.test(process.env.POCKETHOST_TRAFFIC_BENCH_SHA)) {
      const checkout = fileURLToPath(new URL('../../', import.meta.url));
      const output = path.join(checkout, '.tmp');
      mkdirSync(output, { recursive: true });
      writeFileSync(path.join(output, 'traffic-bench-' + process.env.POCKETHOST_TRAFFIC_BENCH_SHA + '.json'),
        JSON.stringify({ sha: process.env.POCKETHOST_TRAFFIC_BENCH_SHA, platform: process.platform,
          requestsPerSample: requests, samples, cpuOverheadUs, rssOverheadBytes, peakOverheadKiB }) + '\n',
        { mode: 0o600, flag: 'wx' });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
