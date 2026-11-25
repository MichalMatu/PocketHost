import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { FIRST_PORT, PORT_COUNT, PREFIX } from './node-runit-records.ts';

function quote(input: string): string {
  return "'" + input.replaceAll("'", "'\\''") + "'";
}
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function nodeLogRun(logFolder: string): string {
  return (
    '#!' +
    PREFIX +
    '/bin/sh\nexec ' +
    quote(PREFIX + '/bin/svlogd') +
    ' -tt ' +
    quote(logFolder) +
    '\n'
  );
}
/** A clean env blocks accidental inheritance of PocketHost admin credentials. */
export function runScript(folder: string, port: number, readinessNonce: string): string {
  if (
    !path.isAbsolute(folder) ||
    !Number.isSafeInteger(port) ||
    port < FIRST_PORT ||
    port >= FIRST_PORT + PORT_COUNT ||
    !/^[a-f0-9]{48}$/.test(readinessNonce)
  ) {
    throw new RangeError('Invalid owned Node process launch');
  }
  const project = path.basename(path.dirname(path.dirname(folder)));
  const instrument = /^node-[a-f0-9]{32}$/.test(project) &&
    folder === path.join(os.homedir(), 'PocketHost-NodeProjects', project, 'releases', path.basename(folder));
  const preload = path.join(import.meta.dirname, 'traffic-node-preload.mjs');
  const trafficEnv = instrument
    ? ' POCKETHOST_TRAFFIC_ID=' + quote(project) +
      ' POCKETHOST_TRAFFIC_ROOT=' + quote(path.join(os.homedir(), '.local', 'state', 'pockethost', 'traffic-v1'))
    : '';
  const args = instrument
    ? '\nset --\nif [ -r ' + quote(preload) + ' ]; then set -- --import ' + quote(preload) + '; fi\n'
    : '\nset --\n';
  return (
    '#!' +
    PREFIX +
    '/bin/sh\nset -eu\ncd ' +
    quote(folder) +
    args + 'exec ' +
    quote(PREFIX + '/bin/env') +
    ' -i' +
    ' PATH=' +
    quote(PREFIX + '/bin') +
    ' HOME=' +
    quote(folder) +
    ' TMPDIR=' +
    quote(PREFIX + '/tmp') +
    ' NODE_ENV=' +
    quote('production') +
    ' PORT=' +
    quote(String(port)) +
    ' POCKETHOST_READINESS_NONCE=' +
    quote(readinessNonce) + trafficEnv +
    ' ' +
    quote(PREFIX + '/bin/node') +
    ' "$@" ' +
    quote(path.join(folder, 'server.mjs')) +
    '\n'
  );
}
export function observedTicks(pid: number): string | null {
  try {
    const raw = readFileSync('/proc/' + pid + '/stat', 'utf8');
    const ticks = raw
      .slice(raw.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/)[19];
    return ticks && /^\d+$/.test(ticks) ? ticks : null;
  } catch {
    return null;
  }
}
export function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}
export function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}
/** Reserve unused fixed-pool loopback ports. */
export async function selectUnreservedNodePort(
  reserved: ReadonlySet<number>,
  free: (port: number) => Promise<boolean>,
): Promise<number> {
  for (let port = FIRST_PORT; port < FIRST_PORT + PORT_COUNT; port++) {
    if (!reserved.has(port) && (await free(port))) return port;
  }
  throw new Error('No unreserved loopback Node port');
}
/** Readiness must attest this release, not foreign HTTP 200. */
export function probeOwnedNodeReadiness(port: number, nonce: string): Promise<boolean> {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || !/^[a-f0-9]{48}$/.test(nonce))
    throw new RangeError('Unsafe Node readiness probe');
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/__pockethost/ready',
        timeout: 600,
        agent: false,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200 && response.headers['x-pockethost-ready'] === nonce);
      },
    );
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}
/** Bounded local HTTP observation. Never forwards admin headers or exposes HTML execution. */
export function readBoundedNodePreview(port: number): Promise<string> {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new RangeError('Invalid local preview port');
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/',
        agent: false,
        timeout: 1500,
        signal: AbortSignal.timeout(3000),
        headers: { accept: 'text/plain, text/html' },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error('Node preview returned non-success status'));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        response.on('data', (part: Buffer | string) => {
          const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part);
          total += bytes.length;
          if (total > 8192) {
            request.destroy(new Error('Node preview response exceeds safe budget'));
            return;
          }
          chunks.push(bytes);
        });
        response.once('end', () => {
          const clean = Buffer.concat(chunks)
            .toString('utf8')
            .split('')
            .filter((character) => {
              const code = character.charCodeAt(0);
              return (code > 31 && code !== 127) || code === 9 || code === 10;
            })
            .join('');
          resolve(clean);
        });
        response.once('error', reject);
      },
    );
    request.once('timeout', () => request.destroy(new Error('Node preview timeout')));
    request.once('error', reject);
  });
}
