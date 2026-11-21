import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { createConnection } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const PREFIX = '/data/data/com.termux/files/usr';
const HOST_ID = 'android-termux-a8';
const INSTALL_ID = 'fa8acc66-2f97-4600-845f-b35b0ada3a78';
const PAUSE_RUNTIME = '7415454b1fb2af7d3babe1c283c9e38848291d2b';
type Service = 'termux-agent' | 'a8-operator-sshd';
type Run = (
  args: string[],
  timeout: number,
) => { status: number | null; stdout: string; error?: Error };
export type AgentAction =
  | 'agent-start'
  | 'agent-stop'
  | 'agent-pause'
  | 'agent-resume'
  | 'ssh-start'
  | 'ssh-stop'
  | 'ssh-restart';
type ProcessStatus = {
  state: 'running' | 'stopped' | 'unavailable';
  pid: number | null;
  uptimeSeconds: number | null;
};
export type AgentOperationsSnapshot = {
  version: 1;
  observedAt: string;
  agent: ProcessStatus & { sourceSha: string | null; supportsPause: boolean };
  ssh: ProcessStatus & {
    listen: 'open' | 'closed' | 'unverified';
    address: '192.168.0.16';
    port: 8022;
  };
  intake: 'active' | 'paused' | 'emergency-stop' | 'unverified';
  current: { id: string; since: string | null }[];
  recent: { id: string; status: 'done' | 'failed' | 'unknown'; at: string }[];
  claims: number | null;
  results: number | null;
  remoteQueue: 'not-checked';
};
const empty = (): ProcessStatus => ({ state: 'unavailable', pid: null, uptimeSeconds: null });
const id = /^[A-Za-z0-9._-]{1,200}\.json$/;
function portCheck(): Promise<'open' | 'closed' | 'unverified'> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '192.168.0.16', port: 8022 });
    let done = false;
    const complete = (status: 'open' | 'closed' | 'unverified') => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(status);
    };
    socket.once('connect', () => complete('open'));
    socket.once('error', () => complete('closed'));
    socket.setTimeout(650, () => complete('unverified'));
  });
}
export class LocalAgentOperationsHost {
  private readonly root: string;
  private readonly run: Run;
  constructor(
    private readonly home = os.homedir(),
    run?: Run,
  ) {
    this.root = path.join(home, '.local/state/local-agent/termux');
    this.run =
      run ??
      ((args, timeout) => {
        const r = spawnSync(PREFIX + '/bin/sv', args, {
          encoding: 'utf8',
          shell: false,
          timeout,
          maxBuffer: 4096,
        });
        return { status: r.status, stdout: r.stdout ?? '', ...(r.error ? { error: r.error } : {}) };
      });
  }
  private service(name: Service): string {
    return path.join(this.root, 'runit/services', name);
  }
  private assertIdentity(): void {
    const c = JSON.parse(
      readFileSync(path.join(this.home, '.config/local-agent/termux.json'), 'utf8'),
    ) as Record<string, unknown>;
    if (c.host_id !== HOST_ID || c.installation_id !== INSTALL_ID)
      throw Error('wrong-agent-installation');
    for (const name of ['termux-agent', 'a8-operator-sshd'] as const) {
      const folder = this.service(name);
      const stat = lstatSync(folder),
        run = lstatSync(path.join(folder, 'run'));
      if (!stat.isDirectory() || stat.isSymbolicLink() || !run.isFile() || run.isSymbolicLink())
        throw Error('runit-service-unavailable');
    }
  }
  private status(name: Service): ProcessStatus {
    try {
      const folder = this.service(name);
      const r = this.run(['status', folder], 2200);
      if (r.error || r.status !== 0) return empty();
      const prefix = 'run: ' + folder + ': ';
      if (r.stdout.startsWith(prefix)) {
        const match = /^\(pid ([1-9]\d*)\) (\d+)s/.exec(r.stdout.slice(prefix.length));
        if (match)
          return { state: 'running', pid: Number(match[1]), uptimeSeconds: Number(match[2]) };
      }
      if (r.stdout.startsWith('down: ' + folder + ': '))
        return { state: 'stopped', pid: null, uptimeSeconds: null };
    } catch {
      /* No guessed service state. */
    }
    return empty();
  }
  private marker(): AgentOperationsSnapshot['intake'] {
    try {
      lstatSync(path.join(this.root, 'EMERGENCY_STOP'));
      return 'emergency-stop';
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return 'unverified';
    }
    try {
      lstatSync(path.join(this.root, 'INTAKE_PAUSED'));
      return 'paused';
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'active' : 'unverified';
    }
  }
  private source(): string | null {
    try {
      const text = readFileSync(path.join(this.service('termux-agent'), 'run'), 'utf8');
      const shas = [...new Set([...text.matchAll(/[a-f0-9]{40}/g)].map((m) => m[0]))];
      return shas.length === 1 ? (shas[0] ?? null) : null;
    } catch {
      return null;
    }
  }
  private pauseCapable(s: ProcessStatus, source: string | null): boolean {
    if (source !== PAUSE_RUNTIME || !s.pid) return false;
    try {
      return readFileSync('/proc/' + s.pid + '/environ').includes(Buffer.from(PAUSE_RUNTIME));
    } catch {
      return false;
    }
  }
  private tasks(): Pick<AgentOperationsSnapshot, 'current' | 'recent' | 'claims' | 'results'> {
    const fallback = { current: [], recent: [], claims: null, results: null };
    try {
      const entries = (kind: 'claims' | 'results') =>
        readdirSync(path.join(this.root, kind), { withFileTypes: true })
          .filter((x) => x.isFile() && id.test(x.name))
          .map((x) => ({
            name: x.name,
            stat: statSync(path.join(this.root, kind, x.name)),
          }));
      const claims = entries('claims'),
        results = entries('results');
      const done = new Set(results.map((x) => x.name));
      const current = claims
        .filter((x) => !done.has(x.name))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
        .slice(0, 12)
        .map((x) => ({ id: x.name.slice(0, -5), since: new Date(x.stat.mtimeMs).toISOString() }));
      const recent = results
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
        .slice(0, 24)
        .flatMap((x) => {
          try {
            if (x.stat.size > 4 * 1024 * 1024) return [];
            const parsed = JSON.parse(
              readFileSync(path.join(this.root, 'results', x.name), 'utf8'),
            ) as Record<string, unknown>;
            if (
              parsed.id !== x.name.slice(0, -5) ||
              !['done', 'failed', 'unknown'].includes(String(parsed.status))
            )
              return [];
            return [
              {
                id: x.name.slice(0, -5),
                status: parsed.status as 'done' | 'failed' | 'unknown',
                at: new Date(x.stat.mtimeMs).toISOString(),
              },
            ];
          } catch {
            return [];
          }
        });
      return { current, recent, claims: claims.length, results: results.length };
    } catch {
      return fallback;
    }
  }
  async inspect(): Promise<AgentOperationsSnapshot> {
    try {
      this.assertIdentity();
    } catch {
      return {
        version: 1,
        observedAt: new Date().toISOString(),
        agent: { ...empty(), sourceSha: null, supportsPause: false },
        ssh: { ...empty(), listen: 'unverified', address: '192.168.0.16', port: 8022 },
        intake: 'unverified',
        ...this.tasks(),
        remoteQueue: 'not-checked',
      };
    }
    const agent = this.status('termux-agent'),
      sourceSha = this.source();
    const ssh = this.status('a8-operator-sshd');
    return {
      version: 1,
      observedAt: new Date().toISOString(),
      agent: { ...agent, sourceSha, supportsPause: this.pauseCapable(agent, sourceSha) },
      ssh: { ...ssh, listen: await portCheck(), address: '192.168.0.16', port: 8022 },
      intake: this.marker(),
      ...this.tasks(),
      remoteQueue: 'not-checked',
    };
  }
  async apply(action: AgentAction): Promise<AgentOperationsSnapshot> {
    this.assertIdentity();
    const agent = this.status('termux-agent'),
      intake = this.marker();
    if (agent.state === 'unavailable' || intake === 'unverified' || intake === 'emergency-stop')
      throw Error('agent-state-not-confirmed');
    if (action === 'agent-pause' || action === 'agent-resume') {
      if (!this.pauseCapable(agent, this.source())) throw Error('pause-requires-updated-agent');
      const marker = path.join(this.root, 'INTAKE_PAUSED');
      if (action === 'agent-pause' && intake === 'active')
        writeFileSync(marker, 'paused\n', { flag: 'wx', mode: 0o600 });
      if (action === 'agent-resume' && intake === 'paused') {
        const s = lstatSync(marker);
        if (!s.isFile() || s.isSymbolicLink()) throw Error('invalid-pause-marker');
        unlinkSync(marker);
      }
      return this.inspect();
    }
    if (action === 'agent-stop' && this.tasks().current.length)
      throw Error('agent-active-task-not-finished');
    const name: Service = action.startsWith('ssh-') ? 'a8-operator-sshd' : 'termux-agent';
    const before = this.status(name);
    if (before.state === 'unavailable') throw Error('service-unverified');
    const op = action.endsWith('-start')
      ? 'up'
      : action.endsWith('-stop')
        ? 'down'
        : action === 'ssh-restart'
          ? 'restart'
          : null;
    if (!op) throw Error('invalid-action');
    if (
      (op === 'up' && before.state === 'running') ||
      (op === 'down' && before.state === 'stopped')
    )
      return this.inspect();
    const result = this.run(['-w', '7', op, this.service(name)], 9000);
    if (result.error || result.status !== 0) throw Error('runit-operation-failed');
    const after = this.status(name);
    if (after.state !== (op === 'down' ? 'stopped' : 'running'))
      throw Error('runit-postcondition-unverified');
    return this.inspect();
  }
}
