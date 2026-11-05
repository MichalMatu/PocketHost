import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [portArg, instanceArg] = process.argv.slice(2);
const port = Number(portArg);
if (
  !Number.isSafeInteger(port) ||
  port < 1024 ||
  port > 65535 ||
  !/^[0-9a-f-]{36}$/.test(instanceArg ?? '')
) {
  process.exit(2);
}
const root = process.cwd();
let marker;
try {
  marker = JSON.parse(await readFile(path.join(root, '.pockethost-owner.json'), 'utf8'));
} catch {
  process.exit(2);
}
if (
  marker?.schema !== 1 ||
  marker?.id !== 'pockethost-demo' ||
  marker?.instance !== instanceArg ||
  marker?.port !== port ||
  marker?.ownership !== 'pockethost'
) {
  process.exit(2);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader('X-PocketHost-Instance', instanceArg);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  if (req.url !== '/' && req.url !== '/index.html') {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const html = await readFile(path.join(root, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : html);
  } catch {
    res.writeHead(503);
    res.end();
  }
});
server.on('error', () => process.exit(3));
server.listen(port, '127.0.0.1', () => console.log('PocketHost owned demo listening'));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
