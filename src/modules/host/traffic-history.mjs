/** Per-project, bounded HTTP response aggregates. No request bodies or identities. */
export const TRAFFIC_HOURS = 168;
export const TRAFFIC_PATH_LIMIT = 32;
export const TRAFFIC_PATH_LENGTH = 120;
const HOUR = 3600000;
const SECOND = 1000;
const count = (n) => Number.isSafeInteger(n) && n >= 0;
const positive = (n) => count(n) && n > 0;
const code = (n) => Number.isInteger(n) && n >= 100 && n <= 599;
const epoch = (n) => count(n) && n <= 8640000000000000;
const aligned = (n, unit) => epoch(n) && n % unit === 0;

export function trafficPath(uri) {
  if (typeof uri !== 'string') return null;
  const route = uri.split(/[?#]/, 1)[0];
  if (
    !route.startsWith('/') ||
    route.startsWith('//') ||
    route.length > TRAFFIC_PATH_LENGTH ||
    route.includes('\\')
  )
    return null;
  for (let index = 0; index < route.length; index++) {
    const character = route.charCodeAt(index);
    if (character <= 32 || character === 127) return null;
  }
  return route;
}

function newBucket(at) {
  return { at, requests: 0, bytes: 0, statuses: [], paths: [], otherPaths: 0 };
}

function sum(rows) {
  return rows.reduce((total, row) => total + row[1], 0);
}

function validPairs(rows, limit, key) {
  return (
    Array.isArray(rows) &&
    rows.length <= limit &&
    rows.every(
      (row) => Array.isArray(row) && row.length === 2 && key(row[0]) && positive(row[1]),
    ) &&
    new Set(rows.map((row) => row[0])).size === rows.length &&
    count(sum(rows))
  );
}

function validBucket(b) {
  return (
    b &&
    aligned(b.at, HOUR) &&
    positive(b.requests) &&
    count(b.bytes) &&
    count(b.otherPaths) &&
    validPairs(b.statuses, 500, code) &&
    validPairs(b.paths, TRAFFIC_PATH_LIMIT, (p) => trafficPath(p) === p && p !== null) &&
    sum(b.statuses) === b.requests &&
    sum(b.paths) + b.otherPaths === b.requests
  );
}

function increment(rows, key, cap) {
  const entry = rows.find((row) => row[0] === key);
  if (entry) entry[1]++;
  else if (rows.length < cap) rows.push([key, 1]);
  else return false;
  return true;
}

/**
 * One instance per attested project. Hour-aligned history includes the current
 * hour; live RPS is the count in the current and preceding 59 UTC seconds / 60.
 * Top-path counts are lower bounds when the explicit overflow counter is nonzero.
 */
export class TrafficHistory {
  #hours = [];
  #seconds = [];
  #startedAt;
  #lastAt;

  constructor(now = Date.now(), snapshot = null) {
    if (!epoch(now)) throw new RangeError('Invalid traffic clock');
    this.#startedAt = now;
    this.#lastAt = now;
    if (snapshot !== null) {
      if (
        snapshot?.schema !== 1 ||
        !epoch(snapshot.startedAt) ||
        !epoch(snapshot.lastAt) ||
        snapshot.startedAt > snapshot.lastAt ||
        snapshot.lastAt > now ||
        !Array.isArray(snapshot.hours) ||
        snapshot.hours.length > TRAFFIC_HOURS ||
        !snapshot.hours.every(validBucket) ||
        !validPairs(snapshot.seconds, 60, (n) => aligned(n, SECOND)) ||
        snapshot.hours.some((b) => b.at > snapshot.lastAt) ||
        snapshot.seconds.some(([at]) => at > snapshot.lastAt) ||
        snapshot.hours.some((b, index) => index > 0 && snapshot.hours[index - 1].at >= b.at)
      )
        throw new Error('Invalid traffic history');
      this.#startedAt = snapshot.startedAt;
      this.#lastAt = snapshot.lastAt;
      this.#hours = snapshot.hours.map((b) => ({
        at: b.at,
        requests: b.requests,
        bytes: b.bytes,
        statuses: b.statuses.map((row) => [...row]),
        paths: b.paths.map((row) => [...row]),
        otherPaths: b.otherPaths,
      }));
      this.#seconds = snapshot.seconds.map((row) => [...row]);
      this.#prune(now);
    }
  }

  #prune(now) {
    const hour = Math.floor(now / HOUR) * HOUR;
    const second = Math.floor(now / SECOND) * SECOND;
    this.#hours = this.#hours.filter((b) => b.at >= hour - (TRAFFIC_HOURS - 1) * HOUR);
    this.#seconds = this.#seconds.filter(([at]) => at >= second - 59 * SECOND);
  }

  record({ at, status, bytes, path } = {}) {
    if (!epoch(at) || at < this.#lastAt || !code(status) || !count(bytes)) return false;
    const hour = Math.floor(at / HOUR) * HOUR;
    const second = Math.floor(at / SECOND) * SECOND;
    if (
      hour !== Math.floor(this.#lastAt / HOUR) * HOUR ||
      second !== Math.floor(this.#lastAt / SECOND) * SECOND
    )
      this.#prune(at);
    let bucket = this.#hours.at(-1);
    if (bucket?.at !== hour) {
      bucket = newBucket(hour);
      this.#hours.push(bucket);
    }
    if (!count(bucket.requests + 1) || !count(bucket.bytes + bytes)) return false;
    bucket.requests++;
    bucket.bytes += bytes;
    increment(bucket.statuses, status, 500);
    const route = trafficPath(path);
    if (route === null || !increment(bucket.paths, route, TRAFFIC_PATH_LIMIT)) bucket.otherPaths++;
    increment(this.#seconds, second, 60);
    this.#lastAt = at;
    return true;
  }

  snapshot(now = Date.now()) {
    if (!epoch(now) || now < this.#lastAt) throw new RangeError('Invalid traffic clock');
    this.#prune(now);
    return {
      schema: 1,
      startedAt: this.#startedAt,
      lastAt: this.#lastAt,
      hours: this.#hours.map((b) => ({
        ...b,
        statuses: b.statuses.map((row) => [...row]),
        paths: b.paths.map((row) => [...row]),
      })),
      seconds: this.#seconds.map((row) => [...row]),
    };
  }

  summary(now = Date.now(), range = '24h') {
    if (range !== '24h' && range !== '7d') throw new RangeError('Unsupported traffic range');
    const snapshot = this.snapshot(now);
    const hours = range === '24h' ? 24 : TRAFFIC_HOURS;
    const from = (Math.floor(now / HOUR) - hours + 1) * HOUR;
    const buckets = snapshot.hours.filter((b) => b.at >= from);
    const statuses = new Map();
    const paths = new Map();
    let requests = 0;
    let bytes = 0;
    let otherPaths = 0;
    for (const bucket of buckets) {
      requests += bucket.requests;
      bytes += bucket.bytes;
      otherPaths += bucket.otherPaths;
      for (const [key, value] of bucket.statuses) statuses.set(key, (statuses.get(key) ?? 0) + value);
      for (const [key, value] of bucket.paths) paths.set(key, (paths.get(key) ?? 0) + value);
    }
    return {
      range,
      from,
      observedAt: now,
      startedAt: snapshot.startedAt,
      lastAt: snapshot.lastAt,
      requests,
      bytes,
      rps: sum(snapshot.seconds) / 60,
      statuses: [...statuses].sort((a, b) => a[0] - b[0]),
      topPaths: [...paths]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10),
      otherPaths,
      history: buckets.map(({ at, requests, bytes }) => ({ at, requests, bytes })),
    };
  }
}
