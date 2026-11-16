import { lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { request } from 'node:http';
import path from 'node:path';

export type WorkerHttpReadiness = {
  name: string;
  status: 'ready' | 'not-ready' | 'unverified';
  httpStatus: number | null;
  reason:
    | 'http-2xx'
    | 'http-other'
    | 'process-unverified'
    | 'socket-owner-unverified'
    | 'transport-unverified'
    | 'worker-changed';
  checkedAt: string;
};

export const validHttpPort = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 1024 && value <= 65535;

/** Paths only, never arbitrary URLs, query strings, fragments or credentials. */
export const validHttpPath = (value: string): boolean =>
  typeof value === 'string' &&
  /^\/(?:[a-zA-Z0-9._~-]|\/){0,96}$/.test(value) &&
  !value.startsWith('//') &&
  !value.includes('/../') &&
  !value.endsWith('/..');

const unreadable = (name: string, reason: WorkerHttpReadiness['reason']): WorkerHttpReadiness => ({
  name,
  status: 'unverified',
  httpStatus: null,
  reason,
  checkedAt: new Date().toISOString(),
});

/**
 * Demonstrate that the named same-UID process, and not another local service,
 * owns a LISTEN socket bound exclusively to 127.0.0.1:port.
 * No connection is opened when procfs proof is unavailable. The ownership check
 * is repeated after the GET to detect process/port reassignment during the probe.
 */
function ownedLoopbackListener(pid: number, port: number): boolean {
  if (
    !Number.isSafeInteger(pid) ||
    pid < 2 ||
    !validHttpPort(port) ||
    typeof process.getuid?.() !== 'number'
  )
    return false;
  try {
    const proc = path.join('/proc', String(pid));
    const stat = lstatSync(proc);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.())
      return false;
    const portHex = port.toString(16).toUpperCase().padStart(4, '0');
    const raw = readFileSync('/proc/net/tcp', 'utf8');
    if (raw.length > 1024 * 1024) return false;
    const sockets = new Set<string>();
    for (const line of raw.split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/);
      // sl local_address rem_address st tx_queue tr retrnsmt uid timeout inode
      if (
        fields.length < 10 ||
        fields[1] !== '0100007F:' + portHex ||
        fields[3] !== '0A' ||
        Number(fields[7]) !== process.getuid?.()
      )
        continue;
      const inode = fields[9];
      if (inode && /^[0-9]{1,20}$/.test(inode) && inode !== '0') sockets.add(inode);
    }
    if (sockets.size !== 1) return false;
    const [socket] = [...sockets];
    if (!socket) return false;
    const fdRoot = path.join(proc, 'fd');
    const fds = readdirSync(fdRoot);
    if (fds.length > 256) return false;
    return fds.some((fd) => {
      if (!/^[0-9]{1,8}$/.test(fd)) return false;
      try {
        return readlinkSync(path.join(fdRoot, fd)) === 'socket:[' + socket + ']';
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function oneHttpGet(port: number, urlPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    let finished = false;
    const settle = (status: number | null) => {
      if (finished) return;
      finished = true;
      resolve(status);
    };
    const req = request(
      {
        protocol: 'http:',
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'GET',
        agent: false,
        timeout: 800,
        maxHeaderSize: 2048,
        headers: { Accept: 'application/json', Connection: 'close' },
      },
      (response) => {
        const status = response.statusCode ?? null;
        settle(status !== null && status >= 100 && status <= 599 ? status : null);
        response.destroy(); // never download or inspect application response bodies
      },
    );
    req.on('timeout', () => {
      req.destroy();
      settle(null);
    });
    req.on('error', () => settle(null));
    req.end();
  });
}

export async function probeOwnedWorkerHttp(
  name: string,
  pid: number,
  port: number,
  urlPath: string,
): Promise<WorkerHttpReadiness> {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(name) || !validHttpPort(port) || !validHttpPath(urlPath))
    throw new RangeError('Invalid owned worker HTTP readiness request');
  if (!ownedLoopbackListener(pid, port)) return unreadable(name, 'socket-owner-unverified');
  const responseStatus = await oneHttpGet(port, urlPath);
  if (!ownedLoopbackListener(pid, port)) return unreadable(name, 'socket-owner-unverified');
  if (responseStatus === null) return unreadable(name, 'transport-unverified');
  return {
    name,
    status: responseStatus >= 200 && responseStatus <= 299 ? 'ready' : 'not-ready',
    httpStatus: responseStatus,
    reason: responseStatus >= 200 && responseStatus <= 299 ? 'http-2xx' : 'http-other',
    checkedAt: new Date().toISOString(),
  };
}
