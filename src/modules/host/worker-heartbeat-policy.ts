import { randomUUID } from 'node:crypto';
import {
  constants, closeSync, existsSync, fstatSync, lstatSync, mkdirSync,
  openSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

/**
 * Optional, on-demand heartbeat evidence for the TWO fixed PocketHost worker
 * templates. It never creates an executable, probes an arbitrary endpoint,
 * or claims HTTP/application readiness for unrelated services.
 */
export type HeartbeatThresholdSeconds = 180 | 300 | 600;
export type FixedWorkerTemplate = 'heartbeat-worker-v1' | 'python-heartbeat-v1';
export type HeartbeatReadback = {
  mode: 'disabled' | 'log-heartbeat';
  staleAfterSeconds: HeartbeatThresholdSeconds | null;
  status: 'disabled' | 'fresh' | 'stale' | 'missing' | 'unknown';
  lastOutputAt: string | null;
};
type RecordEntry = { name: string; instanceId: string; staleAfterSeconds: HeartbeatThresholdSeconds };

const NAME = /^[a-z][a-z0-9-]{1,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIMIT = 4;
function threshold(value: unknown): value is HeartbeatThresholdSeconds {
  return value === 180 || value === 300 || value === 600;
}
function ownerFile(filename: string, max: number): string {
  const st = lstatSync(filename);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 ||
      st.uid !== process.getuid?.() || (st.mode & 0o077) !== 0 ||
      st.size > max) throw new Error('Untrusted PocketHost heartbeat file');
  const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = fstatSync(fd);
    if (!current.isFile() || current.ino !== st.ino || current.dev !== st.dev ||
        current.nlink !== 1 || current.uid !== st.uid || current.size > max)
      throw new Error('Heartbeat file changed during read');
    return readFileSync(fd, 'utf8');
  } finally { closeSync(fd); }
}

export class WorkerHeartbeatPolicy {
  private readonly file: string;
  constructor(stateDirectory: string) {
    this.file = path.join(stateDirectory, 'h3-worker-heartbeat.json');
  }
  private records(): RecordEntry[] {
    let raw: string;
    try { raw = ownerFile(this.file, 20000); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > LIMIT)
      throw new Error('Invalid heartbeat policies');
    const seen = new Set<string>();
    return data.map((item: unknown) => {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new Error('Invalid heartbeat entry');
      const value = item as Record<string, unknown>;
      if (Object.keys(value).sort().join(',') !== 'instanceId,name,staleAfterSeconds' ||
          typeof value.name !== 'string' || !NAME.test(value.name) ||
          typeof value.instanceId !== 'string' || !UUID.test(value.instanceId) ||
          !threshold(value.staleAfterSeconds) || seen.has(value.name))
        throw new Error('Unsafe heartbeat entry');
      seen.add(value.name);
      return value as unknown as RecordEntry;
    });
  }
  private save(records: RecordEntry[]): void {
    if (records.length > LIMIT) throw new RangeError('Heartbeat policy quota');
    const folder = path.dirname(this.file);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const stat = lstatSync(folder);
    if (!stat.isDirectory() || stat.isSymbolicLink() ||
        stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
      throw new Error('Unsafe heartbeat policy directory');
    this.records(); // refuse unsafe prior files, never overwrite blindly
    const temp = path.join(folder, '.heartbeat-' + randomUUID());
    writeFileSync(temp, JSON.stringify(records) + '\n', { flag: 'wx', mode: 0o600 });
    try { renameSync(temp, this.file); }
    finally { if (existsSync(temp)) rmSync(temp, { force: true }); }
  }
  configure(name: string, instanceId: string, seconds: HeartbeatThresholdSeconds | null): boolean {
    if (!NAME.test(name) || !UUID.test(instanceId) ||
        (seconds !== null && !threshold(seconds)))
      throw new RangeError('Invalid worker heartbeat request');
    const records = this.records();
    const old = records.find((entry) => entry.name === name);
    if (old && old.instanceId !== instanceId)
      throw new Error('Heartbeat policy bound to another instance');
    const changed = (old?.staleAfterSeconds ?? null) !== seconds;
    if (changed) {
      const updated = records.filter((entry) => entry.name !== name);
      if (seconds !== null) updated.push({ name, instanceId, staleAfterSeconds: seconds });
      this.save(updated);
    }
    return changed;
  }
  observe(
    name: string, instanceId: string, template: FixedWorkerTemplate,
    state: 'running' | 'stopped' | 'unknown', logFolder: string,
  ): HeartbeatReadback {
    if (!NAME.test(name) || !UUID.test(instanceId) ||
        (template !== 'heartbeat-worker-v1' && template !== 'python-heartbeat-v1'))
      throw new RangeError('Unverified heartbeat observation');
    const entry = this.records().find((candidate) => candidate.name === name);
    if (!entry) return { mode: 'disabled', staleAfterSeconds: null,
      status: 'disabled', lastOutputAt: null };
    if (entry.instanceId !== instanceId)
      throw new Error('Heartbeat policy identity mismatch');
    const base: HeartbeatReadback = { mode: 'log-heartbeat',
      staleAfterSeconds: entry.staleAfterSeconds, status: 'unknown', lastOutputAt: null };
    if (state === 'stopped') return { ...base, status: 'stale' };
    if (state !== 'running') return base;
    try {
      const dir = lstatSync(logFolder);
      const file = path.join(logFolder, 'current');
      if (!dir.isDirectory() || dir.isSymbolicLink() ||
          dir.uid !== process.getuid?.() || (dir.mode & 0o022) !== 0)
        return base;
      const stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
          stat.uid !== process.getuid?.() || (stat.mode & 0o022) !== 0 ||
          stat.size > 4 * 1024 * 1024 ||
          !Number.isFinite(stat.mtimeMs) || stat.mtimeMs < 0 ||
          stat.mtimeMs > Date.now() + 5000) return base;
      const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      let raw: string;
      try {
        const actual = fstatSync(fd);
        if (!actual.isFile() || actual.ino !== stat.ino ||
            actual.dev !== stat.dev || actual.nlink !== 1 ||
            actual.size > 4 * 1024 * 1024) return base;
        raw = readFileSync(fd, 'utf8');
      } finally { closeSync(fd); }
      const lines = raw.slice(-4096).trimEnd().split('\n');
      const lastLine = (lines[lines.length - 1] ?? '').replace(/\r$/, '');
      const runtime = template === 'python-heartbeat-v1' ? 'Python' : 'Node';
      const pattern = new RegExp('^@[a-fA-F0-9]{24} PocketHost ' + runtime + ' worker heartbeat$');
      if (!pattern.test(lastLine)) return { ...base, status: 'missing' };
      return { ...base,
        status: Date.now() - stat.mtimeMs <= entry.staleAfterSeconds * 1000 ? 'fresh' : 'stale',
        lastOutputAt: new Date(stat.mtimeMs).toISOString() };
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? { ...base, status: 'missing' } : base;
    }
  }
}
