import { spawn } from 'node:child_process';
import { lstatSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { startPublicStaticOrigin } from './public-static-origin.mjs';
import { lookupHostedSite } from './site-fleet-proxy.mjs';

const SITE_ID = /^site-[a-f0-9]{32}$/;
const URL = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/;
const BINARY = '/data/data/com.termux/files/usr/bin/cloudflared';

/** Only the dedicated URL row in cloudflared's startup table is accepted. */
export function quickTunnelUrl(line) {
  if (typeof line !== 'string' || line.length > 4096) return null;
  const match = /(?:^|\|\s*)(https:\/\/[a-z0-9-]+\.trycloudflare\.com)\s*\|?\s*$/.exec(
    line.trim(),
  );
  if (!match || !URL.test(match[1]) || match[1] === 'https://api.trycloudflare.com') return null;
  return match[1];
}

function launchConnector(port) {
  const info = lstatSync(BINARY);
  if (!info.isFile() || info.isSymbolicLink() || !(info.mode & 0o111))
    throw new Error('cloudflared unavailable');
  const dir = mkdtempSync('/data/data/com.termux/files/usr/tmp/pockethost-quick-');
  try {
    const config = path.join(dir, 'config.yml');
    writeFileSync(config, '{}\n', { mode: 0o600, flag: 'wx' });
    const child = spawn(
      BINARY,
      [
        'tunnel',
        '--config',
        config,
        '--no-autoupdate',
        '--url',
        'http://127.0.0.1:' + port,
        '--metrics',
        '127.0.0.1:0',
      ],
      {
        cwd: dir,
        env: {
          HOME: dir,
          PATH: '/data/data/com.termux/files/usr/bin',
          TMPDIR: '/data/data/com.termux/files/usr/tmp',
          SSL_CERT_FILE: '/data/data/com.termux/files/usr/etc/tls/cert.pem',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    // Direct child only; no PID discovery, detached workers or restart loop.
    const exit = () => {
      if (child.pid && child.exitCode === null && child.signalCode === null) child.kill();
    };
    process.once('exit', exit);
    child.once('close', () => {
      process.off('exit', exit);
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // A private temporary directory is not a reason to touch another service.
      }
    });
    return child;
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

function closeOrigin(server) {
  server.close();
  server.closeAllConnections();
}

/**
 * In-memory CF1 session. No automatic restart or adoption after panel exit.
 * URL assignment is not proof of an active Cloudflare edge or public HTTP.
 * The caller must explicitly choose an owned site; a fake child is used in QA.
 */
export class QuickTunnelSession {
  #session = null;
  #last = { siteId: null, state: 'stopped', url: null, reason: null };

  constructor({
    resolveSite = lookupHostedSite,
    openOrigin = startPublicStaticOrigin,
    launch = launchConnector,
    startupMs = 20000,
    stopMs = 5000,
  } = {}) {
    if (!Number.isSafeInteger(startupMs) || startupMs < 1 || startupMs > 25000)
      throw new RangeError('Invalid startup deadline');
    if (!Number.isSafeInteger(stopMs) || stopMs < 1 || stopMs > 10000)
      throw new RangeError('Invalid stop deadline');
    this.resolveSite = resolveSite;
    this.openOrigin = openOrigin;
    this.launch = launch;
    this.startupMs = startupMs;
    this.stopMs = stopMs;
  }

  status() {
    return { ...this.#last };
  }

  #state(session, state, reason = null, url = null) {
    if (this.#session === session) this.#last = { siteId: session.siteId, state, reason, url };
  }

  #finish(session, state, reason) {
    clearTimeout(session.timer);
    if (session.origin) closeOrigin(session.origin);
    session.origin = null;
    this.#state(session, state, reason);
    if (this.#session === session) this.#session = null;
    session.done();
  }

  #stop(session, reason) {
    if (this.#session !== session) return;
    session.stopping = true;
    session.reason = reason;
    clearTimeout(session.timer);
    if (session.origin) closeOrigin(session.origin);
    session.origin = null;
    this.#state(session, 'stopping', reason);
    const child = session.child;
    if (!child) return; // An in-flight origin creation completes before cleanup.
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      try {
        child.kill('SIGTERM');
      } catch {
        this.#state(session, 'unknown', 'stop-unconfirmed');
      }
    }
    session.timer = setTimeout(() => {
      this.#state(session, 'unknown', 'stop-unconfirmed');
      session.done();
    }, this.stopMs);
    session.timer.unref();
  }

  async start(siteId) {
    if (!SITE_ID.test(siteId)) throw new RangeError('Invalid site identity');
    if (this.#session) throw new Error('An owned Quick Tunnel session already exists');
    if (!this.resolveSite('/h2/' + siteId + '/')) throw new Error('Owned site is not running');
    const session = {
      siteId,
      origin: null,
      child: null,
      timer: undefined,
      stopping: false,
      reason: null,
      done: null,
      settled: null,
    };
    session.settled = new Promise((resolve) => {
      session.done = resolve;
    });
    this.#session = session;
    this.#state(session, 'starting');
    try {
      session.origin = await this.openOrigin({ siteId, resolveSite: this.resolveSite });
      if (session.stopping) {
        this.#finish(session, 'stopped', null);
        return this.status();
      }
      const address = session.origin.address();
      if (!address || address.address !== '127.0.0.1' || !Number.isSafeInteger(address.port))
        throw new Error('Unexpected origin address');
      const child = this.launch(address.port);
      session.child = child;
      child.once('error', () => {
        if (!session.stopping) this.#stop(session, 'connector-error');
      });
      child.once('close', () => {
        const reason = session.reason ?? 'connector-exited';
        this.#finish(session, reason === 'unpublished' ? 'stopped' : 'failed', reason);
      });
      for (const stream of [child.stdout, child.stderr]) {
        let line = '';
        let discard = false;
        stream?.on('data', (chunk) => {
          for (const part of String(chunk).split(/(\n)/)) {
            if (part === '\n') {
              const url = discard ? null : quickTunnelUrl(line);
              if (url && !session.stopping && this.#last.state === 'starting') {
                clearTimeout(session.timer);
                this.#state(session, 'url-assigned', null, url);
              }
              line = '';
              discard = false;
            } else if (!discard && line.length + part.length <= 4096) {
              line += part;
            } else {
              discard = true;
              line = '';
            }
          }
        });
      }
      session.timer = setTimeout(() => this.#stop(session, 'startup-timeout'), this.startupMs);
      session.timer.unref();
    } catch {
      this.#finish(session, 'failed', 'launch-rejected');
    }
    return this.status();
  }

  async stop(siteId) {
    const session = this.#session;
    if (!session || session.siteId !== siteId) throw new Error('No matching owned session');
    if (!session.stopping) this.#stop(session, 'unpublished');
    await session.settled;
    return this.status();
  }
}
