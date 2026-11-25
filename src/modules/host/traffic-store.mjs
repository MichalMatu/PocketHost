import {
  constants,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  realpathSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { TrafficHistory } from './traffic-history.mjs';

const PROJECT = /^(?:site|node)-[a-f0-9]{32}$/;
const FILE = /^(?:site|node)-[a-f0-9]{32}\.(?:json|tmp)$/;
export const TRAFFIC_FILE_LIMIT = 4 * 1024 * 1024;
export const TRAFFIC_PROJECT_LIMIT = 24;
export const TRAFFIC_FLUSH_MS = 15000;

function location(root, id) {
  if (!PROJECT.test(id) || !path.isAbsolute(root) || path.resolve(root) !== root)
    throw new Error('Invalid analytics location');
  return path.join(root, id + '.json');
}

function directory(root) {
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(root) !== root)
    throw new Error('Unsafe analytics directory');
}

function optionalStat(file) {
  try {
    return lstatSync(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function safeFile(stat) {
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.uid !== process.getuid?.() ||
    stat.size > TRAFFIC_FILE_LIMIT
  )
    throw new Error('Unsafe analytics file');
}

function safeRead(file) {
  const expected = optionalStat(file);
  if (!expected) return null;
  safeFile(expected);
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const actual = fstatSync(fd);
    safeFile(actual);
    if (expected.ino !== actual.ino || expected.dev !== actual.dev)
      throw new Error('Analytics file changed during open');
    const bytes = Buffer.alloc(actual.size);
    let offset = 0;
    while (offset < bytes.length) {
      const length = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!length) throw new Error('Incomplete analytics snapshot');
      offset += length;
    }
    if (fstatSync(fd).size !== actual.size) throw new Error('Analytics file changed during read');
    return JSON.parse(bytes.toString('utf8'));
  } finally {
    closeSync(fd);
  }
}

function sessionValid(session) {
  return (
    session &&
    Number.isSafeInteger(session.pid) &&
    session.pid > 0 &&
    typeof session.startTicks === 'string' &&
    /^\d{1,24}$/.test(session.startTicks)
  );
}

export function trafficProcessIdentity() {
  const raw = readFileSync('/proc/self/stat', 'utf8');
  const startTicks = raw
    .slice(raw.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/)[19];
  const identity = { pid: process.pid, startTicks };
  if (!sessionValid(identity)) throw new Error('Missing analytics process identity');
  return identity;
}

function validatedDocument(document, projectId, now) {
  if (
    document?.schema !== 1 ||
    document.projectId !== projectId ||
    !sessionValid(document.session) ||
    !Number.isSafeInteger(document.persistedAt) ||
    document.persistedAt > now ||
    document.persistedAt < 0 ||
    !document.history ||
    typeof document.history !== 'object' ||
    document.history.lastAt > document.persistedAt
  )
    throw new Error('Invalid analytics document');
  return new TrafficHistory(now, document.history);
}

/** Read only; callers must attest project ownership before calling. */
export function readTraffic(root, projectId, range = '24h', now = Date.now()) {
  try {
    const file = location(root, projectId);
    if (!optionalStat(root)) return { state: 'missing' };
    directory(root);
    const document = safeRead(file);
    if (document === null) return { state: 'missing' };
    const history = validatedDocument(document, projectId, now);
    return {
      state: 'available',
      session: document.session,
      persistedAt: document.persistedAt,
      summary: history.summary(now, range),
    };
  } catch {
    return { state: 'unavailable' };
  }
}

function prepare(root, projectId) {
  const file = location(root, projectId);
  directory(path.dirname(root));
  if (!optionalStat(root)) {
    try {
      mkdirSync(root, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  directory(root);
  const entries = readdirSync(root);
  if (entries.length > TRAFFIC_PROJECT_LIMIT * 2 || entries.some((entry) => !FILE.test(entry)))
    throw new Error('Analytics directory budget or identity mismatch');
  const owners = new Set(entries.map((entry) => entry.replace(/\.(json|tmp)$/, '')));
  if (!owners.has(projectId) && owners.size >= TRAFFIC_PROJECT_LIMIT)
    throw new Error('Analytics project budget exceeded');
  return file;
}

/**
 * Single writer per project, enforced by the existing owned process lifecycle.
 * Only completed responses arm one unref'ed coalescing timer; no idle interval.
 * A failed or unsafe store never prevents an application from responding.
 */
export function createTrafficRecorder(
  root,
  projectId,
  { identity = trafficProcessIdentity(), clock = Date.now, flushMs = TRAFFIC_FLUSH_MS } = {},
) {
  let file;
  let history;
  try {
    if (!sessionValid(identity) || !Number.isSafeInteger(flushMs) || flushMs < 0 || flushMs > 60000)
      throw new Error('Invalid analytics recorder configuration');
    file = prepare(root, projectId);
    const now = clock();
    const prior = safeRead(file);
    history = prior === null ? new TrafficHistory(now) : validatedDocument(prior, projectId, now);
  } catch {
    return null;
  }
  const temporary = path.join(root, projectId + '.tmp');
  let dirty = true;
  let failed = false;
  let closed = false;
  let timer = null;
  let pending = null;

  async function persist() {
    const at = clock();
    const payload = JSON.stringify({
      schema: 1,
      projectId,
      session: identity,
      persistedAt: at,
      history: history.snapshot(at),
    });
    if (Buffer.byteLength(payload) > TRAFFIC_FILE_LIMIT)
      throw new Error('Analytics snapshot budget exceeded');
    directory(root);
    const existing = optionalStat(file);
    if (existing) safeFile(existing);
    const stale = optionalStat(temporary);
    if (stale) {
      safeFile(stale);
      await unlink(temporary);
    }
    await writeFile(temporary, payload, { flag: 'wx', mode: 0o600 });
    await rename(temporary, file);
  }

  function schedule() {
    if (closed || failed || timer !== null || pending !== null || !dirty) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, flushMs);
    timer.unref();
  }

  async function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending !== null) await pending;
    if (failed || !dirty) return !failed;
    dirty = false;
    pending = persist().catch(() => {
      failed = true;
    });
    await pending;
    pending = null;
    schedule();
    return !failed;
  }

  // Establish a real instrumentation session even when no requests arrive.
  void flush();
  return {
    record(observation) {
      if (closed || failed) return false;
      try {
        if (!history.record(observation)) return false;
        dirty = true;
        schedule();
        return true;
      } catch {
        failed = true;
        return false;
      }
    },
    flush,
    async close() {
      closed = true;
      return flush();
    },
  };
}
