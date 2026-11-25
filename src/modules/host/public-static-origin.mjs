import http from 'node:http';
import { lookupHostedSite } from './site-fleet-proxy.mjs';

const SITE_ID = /^site-[a-f0-9]{32}$/;
const RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-security-policy',
  'cross-origin-resource-policy',
  'referrer-policy',
  'x-content-type-options',
];

/** Public requests address only the current static release, never a preview. */
export function publicAssetPath(url) {
  if (typeof url !== 'string' || url.length > 350 || !url.startsWith('/')) return null;
  const raw = url.split('?')[0];
  if (raw.startsWith('//') || /%(?:2f|5c|00)/i.test(raw)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.includes('\\') || /[\x00-\x1f\x7f%]/.test(decoded)) return null;
  if (decoded === '/') return '/';
  const segments = decoded.slice(1).split('/');
  if (
    segments.length > 6 ||
    segments.some((part) => !part || part.startsWith('.')) ||
    segments[0] === '__versions' ||
    segments[0] === 'api'
  ) {
    return null;
  }
  return raw;
}

function reject(response, status) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (status === 405) response.setHeader('Allow', 'GET, HEAD');
  response.writeHead(status);
  response.end();
}

/**
 * One temporary loopback origin for one positively owned site.
 * Never starts a tunnel or listens on LAN/WAN. Re-attests the existing
 * static process on each request and forwards no visitor-supplied headers.
 */
export async function startPublicStaticOrigin({ siteId, resolveSite = lookupHostedSite }) {
  if (!SITE_ID.test(siteId)) throw new RangeError('Invalid public site identity');
  const server = http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      reject(response, 405);
      return;
    }
    const asset = publicAssetPath(request.url);
    if (asset === null) {
      reject(response, 404);
      return;
    }
    let target;
    try {
      target = resolveSite('/h2/' + siteId + asset);
    } catch {
      reject(response, 503);
      return;
    }
    if (
      !target ||
      target.path !== asset ||
      !Number.isSafeInteger(target.port) ||
      target.port < 1024 ||
      target.port > 65535
    ) {
      reject(response, 503);
      return;
    }
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: target.port,
        path: asset,
        method: request.method,
        headers: { host: '127.0.0.1:' + target.port },
        timeout: 5000,
      },
      (incoming) => {
        if (incoming.statusCode !== 200 && incoming.statusCode !== 404) {
          incoming.destroy();
          reject(response, 502);
          return;
        }
        response.setHeader('Cache-Control', 'no-store');
        for (const name of RESPONSE_HEADERS) {
          const value = incoming.headers[name];
          if (value !== undefined) response.setHeader(name, value);
        }
        response.writeHead(incoming.statusCode);
        incoming.on('error', () => response.destroy());
        incoming.pipe(response);
      },
    );
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => reject(response, 502));
    response.on('close', () => upstream.destroy());
    upstream.end();
  });
  server.maxConnections = 64;
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 2000;
  await new Promise((resolve, rejectStart) => {
    server.once('error', rejectStart);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectStart);
      resolve();
    });
  });
  return server;
}
