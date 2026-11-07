import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { lookupHostedSite } from './site-fleet-proxy.mjs';

const ADMIN_PORT = 18878;
const SITE_PORT = 18879;
const INTERNAL_PORTS = { admin: 8787, site: 18787 };

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
  const octets = typeof bind === 'string' ? bind.split('.').map(Number) : [];
  const privateNetwork =
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
  if (net.isIP(bind) !== 4 || !privateNetwork) {
    throw new Error('LAN gateway requires an exact non-loopback IPv4 address');
  }
  const matches = Object.values(os.networkInterfaces())
    .flat()
    .filter(
      (iface) => iface && iface.family === 'IPv4' && !iface.internal && iface.address === bind,
    );
  if (matches.length !== 1 || !matches[0].netmask || !sameSubnet(bind, bind, matches[0].netmask)) {
    throw new Error('LAN IPv4 address is not uniquely present on this host');
  }
  return matches[0].netmask;
}

function requestAllowed(request, bind, port, mask, admin) {
  if (!sameSubnet(request.socket.remoteAddress, bind, mask)) return 403;
  const host = bind + ':' + port;
  const origin = 'http://' + host;
  if (request.headers.host !== host) return 403;
  if (request.headers.origin && request.headers.origin !== origin) return 403;
  const fetchSite = request.headers['sec-fetch-site'];
  const isTopLevelNavigation =
    (request.method === 'GET' || request.method === 'HEAD') &&
    request.headers['sec-fetch-mode'] === 'navigate' &&
    request.headers['sec-fetch-dest'] === 'document' &&
    !request.headers.origin;
  if (
    !['none', 'same-origin', undefined].includes(fetchSite) &&
    !((fetchSite === 'same-site' || fetchSite === 'cross-site') && isTopLevelNavigation)
  )
    return 403;
  if (
    typeof request.url !== 'string' ||
    !request.url.startsWith('/') ||
    request.url.startsWith('//')
  ) {
    return 403;
  }
  if (!admin && !['GET', 'HEAD'].includes(request.method)) return 405;
  return 200;
}

function rejected(response, status) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (status === 405) response.setHeader('Allow', 'GET, HEAD');
  response.writeHead(status);
  response.end();
}

function upstreamHeaders(request, internalPort) {
  const headers = { ...request.headers };
  delete headers.authorization;
  delete headers['proxy-authorization'];
  delete headers['x-forwarded-for'];
  delete headers.forwarded;
  headers.host = '127.0.0.1:' + internalPort;
  if (headers.origin) headers.origin = 'http://127.0.0.1:' + internalPort;
  return headers;
}

/**
 * Observability reads fixed host/package diagnostics that have individual
 * bounded process timeouts. Only that read-only endpoint has a longer LAN
 * upstream idle budget; other admin and demo requests keep 5 seconds.
 */
export function upstreamTimeoutMs(requestPath) {
  if (requestPath?.startsWith('/api/v1/sites')) return 30000;
  return requestPath?.split('?')[0] === '/api/v1/observability' ? 25000 : 5000;
}

export function createGateway({ bind, mask, admin, port, testUpstreamPort }) {
  const upstreamPort = testUpstreamPort ?? INTERNAL_PORTS[admin ? 'admin' : 'site'];
  const server = http.createServer((request, response) => {
    const status = requestAllowed(request, bind, port || server.address()?.port, mask, admin);
    if (status !== 200) {
      rejected(response, status);
      return;
    }
    // Site H2 views share the existing GET-only site gateway, never the admin origin.
    // Never relay to a port discovered from a request or stale ownership record.
    const h2 = !admin && request.url?.startsWith('/h2/');
    const hosted = h2 ? lookupHostedSite(request.url) : null;
    if (h2 && !hosted) {
      rejected(response, 404);
      return;
    }
    const destination = hosted?.port ?? upstreamPort;
    const headers = admin
      ? upstreamHeaders(request, upstreamPort)
      : { host: '127.0.0.1:' + destination };
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: destination,
        path: hosted?.path ?? request.url,
        method: request.method,
        headers,
        timeout: upstreamTimeoutMs(request.url),
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
      if (!response.headersSent) rejected(response, 502);
      else response.destroy();
    });
    request.pipe(upstream);
  });
  server.on('upgrade', (request, socket, head) => {
    if (
      !admin ||
      requestAllowed(request, bind, port || server.address()?.port, mask, admin) !== 200
    ) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const headers = upstreamHeaders(request, upstreamPort);
    const upstream = net.connect(upstreamPort, '127.0.0.1');
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

export async function startLanGateway(bind, { registerSignals = true } = {}) {
  const mask = ownLanInterface(bind);
  const admin = createGateway({ bind, mask, admin: true, port: ADMIN_PORT });
  const site = createGateway({ bind, mask, admin: false, port: SITE_PORT });
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
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    process.removeListener('SIGTERM', shutdown);
    process.removeListener('SIGINT', shutdown);
    await Promise.all(
      [admin, site].map(
        (listener) =>
          new Promise((resolve) => {
            listener.closeAllConnections?.();
            listener.close(() => resolve());
          }),
      ),
    );
  }
  function shutdown() {
    void close();
  }
  if (registerSignals) {
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }
  return {
    admin,
    site,
    close,
    adminUrl: 'http://' + bind + ':' + ADMIN_PORT + '/owned-site',
    siteUrl: 'http://' + bind + ':' + SITE_PORT + '/',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const bind = process.env.POCKETHOST_LAN_BIND;
  try {
    const gateway = await startLanGateway(bind);
    console.log(
      JSON.stringify({ state: 'running', admin: gateway.adminUrl, site: gateway.siteUrl }),
    );
  } catch (error) {
    console.error('LAN gateway refused startup: ' + error.message);
    process.exitCode = 1;
  }
}
