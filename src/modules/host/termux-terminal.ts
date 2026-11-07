import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import os from 'node:os';

const PREFIX = '/data/data/com.termux/files/usr';
const PORT = 18798;
const BASE = '/terminal';
export interface TerminalPlan {
  executable: string;
  args: string[];
  port: number;
  url: string;
  env: Record<string, string>;
}
export function terminalLaunchPlan(): TerminalPlan {
  const home = os.homedir();
  return {
    executable: PREFIX + '/bin/ttyd',
    args: ['--interface', '127.0.0.1', '--port', String(PORT), '--writable',
      '--once', '--max-clients', '1', '--base-path', BASE, '--cwd', home,
      PREFIX + '/bin/bash', '-l'],
    port: PORT,
    url: BASE + '/',
    env: { HOME: home, PREFIX, PATH: PREFIX + '/bin', TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8', TMPDIR: PREFIX + '/tmp' },
  };
}
function portOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    let finished = false;
    const complete = (open: boolean) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => complete(true));
    socket.once('error', () => complete(false));
    socket.setTimeout(400, () => complete(false));
  });
}
/** Manually launched one-client ttyd; no daemon, PID adoption or autostart. */
export class TermuxTerminal {
  private child: ChildProcess | null = null;
  private started: Promise<{ running: boolean; url: string | null }> | null = null;
  private readonly plan = terminalLaunchPlan();

  status(): { running: boolean; url: string | null } {
    const running = !!this.child && this.child.exitCode === null && this.child.signalCode === null;
    return { running, url: running ? this.plan.url : null };
  }
  async start(): Promise<{ running: boolean; url: string | null }> {
    if (this.status().running) return this.status();
    if (this.started) return this.started;
    this.started = this.startOnce();
    try { return await this.started; }
    finally { this.started = null; }
  }
  private async startOnce(): Promise<{ running: boolean; url: string | null }> {
    if (await portOpen(this.plan.port))
      throw new Error('Terminal port already in use; refusing to adopt an unknown listener');
    const child = spawn(this.plan.executable, this.plan.args, {
      cwd: os.homedir(), env: this.plan.env, detached: false, stdio: 'ignore',
    });
    const ready = await new Promise<boolean>((resolve, reject) => {
      child.once('spawn', () => resolve(true));
      child.once('error', reject);
    }).catch(() => false);
    if (!ready) throw new Error('ttyd executable is missing or could not start');
    this.child = child;
    for (let count = 0; count < 22; count++) {
      if (child.exitCode !== null || child.signalCode !== null) break;
      if (await portOpen(this.plan.port)) return this.status();
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    // Only terminate a process we started and still hold.
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    this.child = null;
    throw new Error('ttyd failed to bind its dedicated loopback port');
  }
  stop(): { running: boolean; url: null } {
    const child = this.child;
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    this.child = null;
    return { running: false, url: null };
  }
}
