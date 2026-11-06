import { timingSafeEqual } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ADMIN_PORT = 18878;
const SITE_PORT = 18879;
const INTERNAL_PORTS = { admin: 8787, site: 18787 };
const LOGIN = 'pocket';
const PASSWORD_FILE = path.join(os.homedir(), '.local/state/pockethost/lan-password');

function numberOf(ip) {
  const bytes = ip.split('.').map(Number);
  if (bytes.length !== 4 || bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error('Invalid IPv4 address');
  }
  return (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0;
}

export function sameSubnet(remote, local, mask) {
  const address = remote?.startsWith('::ffff:') ? remote.slice(7) : remote;
  if (net.isIP(address) !== 4) return false;
  return (numberOf(address) & numberOf(mask)) === (numberOf(local) & numberOf(mask));
}

export function ownLanInterface(bind) {
  if (net.isIP(bind) !== 4 || bind.startsWith('127.') || bind.startsWith('169.254.')) {
    throw new Error('LAN gateway requires an exact non-loopback IPv4 address');
  }
  const matches = Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal && iface.address === bind);
  if (matches.length !== 1 || !matches[0].netmask || !sameSubnet(bind, bind, matches[0].netmask)) {
    throw new Error('LAN IPv4 address is not uniquely present on this host');
  }
  return matches[0].netmask;
}

export function safePassword(filename = PASSWORD_FILE) {
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new Error('LAN password must be a regular owner-only file');
  }
  const value = readFileSync(filename, 'utf8').trim();
  if (value.length < 24 || value.length > 128 || /[\r\n:]/.test(value)) {
    throw new Error('Invalid LAN password length or characters');
  }
  return value;
}

export function passwordMatches(header, password) {
  if (typeof header !== 'string' || !header.startsWith('Basic ') || header.length > 256) return false;
  let raw;
  try {
    raw = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const expected = Buffer.from(LOGIN + ':' + password);
  const received = Buffer.from(raw);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function requestAllowed(request, bind, port, mask, admin, password) {
  if (!sameSubnet(request.socket.remoteAddress, bind, mask)) return 403;
  const host = bind + ':' + port;
  const origin = 'http://' + host;
  if (request.headers.host !== host) return 403;
  if (request.headers.origin && request.headers.origin !== origin) return 403;
  if (!['none', 'same-origin', undefined].includes(request.headers['sec-fetch-site'])) return 403;
  if (typeof request.url !== 'string' || !request.url.startsWith('/') || request.url.startsWith('//')) {
    return 403;
  }
  if (admin) {
    if (!passwordMatches(request.headers.authorization, password)) return 401;
  } else if (!['GET', 'HEAD'].includes(request.method)) {
    return 405;
  }
  return 200;
}

function rejected(response, status, admin) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (status === 401 && admin) {
    response.setHeader('WWW-Authenticate', 'Basic realm="PocketHost LAN", charset="UTF-8"');
  }
  if (status === 405) response.setHeader('Allow', 'GET, HEAD');
  response.writeHead(status);
  response.end();
}

function upstreamHeaders(request) {
  const headers = { ...request.headers };
  delete headers.authorization;
  delete headers['proxy-authorization'];
  delete headers['x-forwarded-for'];
  delete headers.forwarded;
  headers.host = '127.0.0.1:8787';
  if (headers.origin) headers.origin = 'http://127.0.0.1:8787';
  return headers;
}

export function createGateway({ bind, mask, admin, password, port }) {
  const upstreamPort = INTERNAL_PORTS[admin ? 'admin' : 'site'];
  const server = http.createServer((request, response) => {
    const status = requestAllowed(request, bind, port, mask, admin, password);
    if (status !== 200) {
      rejected(response, status, admin);
      return;
    }
    const headers = admin ? upstreamHeaders(request) : { host: '127.0.0.1:18787' };
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: upstreamPort,
        path: request.url,
        method: request.method,
        headers,
        timeout: 5000,
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, {
          ...upstreamResponse.headers,
          'cache-control': 'no-store',
        });
        upstreamResponse.pipe(response);
      },
    );
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!response.headersSent) rejected(response, 502, admin);
      else response.destroy();
    });
    request.pipe(upstream);
  });
  server.on('upgrade', (request, socket, head) => {
    if (!admin || requestAllowed(request, bind, port, mask, admin, password) !== 200) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const headers = upstreamHeaders(request);
    const upstream = net.connect(8787, '127.0.0.1');
    upstream.once('connect', () => {
      const lines = ['GET ' + request.url + ' HTTP/1.1'];
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') lines.push(key + ': ' + value);
        else if (Array.isArray(value)) for (const v of value) lines.push(key + ': ' + v);
      }
      upstream.write(lines.join('\r\n') + '\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.once('error', () => socket.destroy());
    socket.once('error', () => upstream.destroy());
  });
  server.on('clientError', (_err, socket) => socket.destroy());
  return server;
}

export async function startLanGateway(bind, password) {
  const mask = ownLanInterface(bind);
  const admin = createGateway({ bind, mask, admin: true, password, port: ADMIN_PORT });
  const site = createGateway({ bind, mask, admin: false, password, port: SITE_PORT });
  async function listen(server, port) {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, bind, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  }
  await listen(admin, ADMIN_PORT);
  try {
    await listen(site, SITE_PORT);
  } catch (error) {
    await new Promise((resolve) => admin.close(resolve));
    throw error;
  }
  const shutdown = () => {
    admin.close();
    site.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return { admin, site, adminUrl: 'http://' + bind + ':' + ADMIN_PORT + '/owned-site',
    siteUrl: 'http://' + bind + ':' + SITE_PORT + '/' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const bind = process.env.POCKETHOST_LAN_BIND;
  try {
    const password = safePassword();
    const gateway = await startLanGateway(bind, password);
    console.log(JSON.stringify({ state: 'running', admin: gateway.adminUrl, site: gateway.siteUrl }));
  } catch (error) {
    console.error('LAN gateway refused startup: ' + error.message);
    process.exitCode = 1;
  }
}
