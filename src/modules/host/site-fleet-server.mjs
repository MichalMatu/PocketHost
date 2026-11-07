import http from 'node:http';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

const MIME = Object.freeze({
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm',
});
const RELEASE = /^r-[a-f0-9]{32}$/;
const ID = /^site-[a-f0-9]{32}$/;

function checkDirectory(folder) {
  const s = lstatSync(folder);
  if (!s.isDirectory() || s.isSymbolicLink() || realpathSync(folder) !== folder)
    throw new Error('Unsafe owned static directory');
}
function getFile(root, uri) {
  if (typeof uri !== 'string' || !uri.startsWith('/') || uri.startsWith('//') ||
      /%(?:2f|5c|00)/i.test(uri)) throw new Error('Unsafe URL');
  const raw = uri.split('?')[0];
  const decoded = decodeURIComponent(raw);
  if (decoded.includes('\0') || decoded.includes('\\')) throw new Error('Unsafe URL');
  const segments = decoded === '/' ? ['index.html'] : decoded.slice(1).split('/');
  if (segments.length > 6 || segments.some(part => !part || part === '..' || part === '.' ||
      part.startsWith('.') || !/^[\p{L}\p{N}_ ()@+-][\p{L}\p{N}_. ()@+-]*$/u.test(part)))
    throw new Error('Unsafe asset request');
  let dir = root;
  for (const part of segments.slice(0, -1)) {
    dir = path.join(dir, part);
    checkDirectory(dir);
  }
  const filename = path.join(dir, segments.at(-1));
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024)
    throw new Error('Static file refused');
  const ext = segments.at(-1).split('.').at(-1).toLowerCase();
  if (!Object.hasOwn(MIME, ext)) throw new Error('Unsupported asset');
  return { bytes: readFileSync(filename), type: MIME[ext] };
}
function getRelease(site, id, port, instance) {
  checkDirectory(site);
  const markerFile = path.join(site, '.pockethost-site.json');
  const stat = lstatSync(markerFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192)
    throw new Error('Unsafe site marker');
  const marker = JSON.parse(readFileSync(markerFile, 'utf8'));
  if (marker.schema !== 1 || marker.owner !== 'pockethost-h2' ||
      marker.id !== id || marker.port !== port || marker.instance !== instance ||
      !RELEASE.test(marker.activeRelease)) throw new Error('Invalid site ownership');
  const releases = path.join(site, 'releases');
  checkDirectory(releases);
  const root = path.join(releases, marker.activeRelease);
  checkDirectory(root);
  return root;
}

/** Inert when imported; an explicitly owned child process starts the server. */
export function startSiteServer({ port, id, instance, site = process.cwd() }) {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 ||
      !ID.test(id) || !/^[0-9a-f-]{36}$/.test(instance))
    throw new Error('Invalid owned site server configuration');
  getRelease(site, id, port, instance);
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy',
      "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'none'; " +
      "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    response.setHeader('X-PocketHost-Instance', instance);
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    try {
      const { bytes, type } = getFile(getRelease(site, id, port, instance), request.url);
      response.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  server.on('error', () => { process.exitCode = 3; });
  server.listen(port, '127.0.0.1', () => console.log('PocketHost owned H2 site listening'));
  process.once('SIGTERM', () => server.close(() => process.exit(0)));
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  try {
    startSiteServer({
      port: Number(process.argv[2]),
      instance: process.argv[3],
      id: process.argv[4],
    });
  } catch {
    process.exitCode = 2;
  }
}
