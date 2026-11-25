import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  linkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, request } from 'node:http';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { NodeProjectDataScope } from '../../src/modules/host/node-project-data-scope.ts';
import { NodeSqliteStudio, parseSqliteQuery } from '../../src/modules/host/node-sqlite-studio.ts';
import { nodeProjectApi } from '../../apps/admin/plugins/node-project-api.ts';
import {
  parseSqliteRead,
  SQLITE_MAX_PAGE,
  SQLITE_PAGE_SIZE,
} from '../../src/shared/node-sqlite-studio.ts';

const catalogQuery = { databaseId: null, tableId: null, page: 1 };
const checksum = (filename) => createHash('sha256').update(readFileSync(filename)).digest('hex');
const queryFor = (databaseId, tableId = null, page = 1) => ({ databaseId, tableId, page });

function fixture(t) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-sqlite-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const projectRoot = path.join(temp, 'projects');
  const dataRoot = path.join(temp, 'data');
  const host = new NodeProjectHost(projectRoot);
  const project = host.create('SQLite fixture');
  const neighbor = host.create('Neighbor fixture');
  const root = path.join(dataRoot, project.id, 'db');
  const other = path.join(dataRoot, neighbor.id, 'db');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  mkdirSync(other, { recursive: true, mode: 0o700 });
  const scope = new NodeProjectDataScope(projectRoot, dataRoot);
  let stopped = false;
  const studio = new NodeSqliteStudio(scope, () => ({
    state: stopped ? 'stopped' : 'running',
    desired: stopped ? 'stopped' : 'running',
  }));
  return {
    temp,
    root,
    other,
    project,
    neighbor,
    studio,
    scope,
    stop: () => {
      stopped = true;
    },
  };
}
function createDatabase(filename, sql) {
  // The scope deliberately refuses group/world-readable files.
  writeFileSync(filename, '', { mode: 0o600 });
  const db = new DatabaseSync(filename);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}
async function choose(studio, project, name) {
  const catalog = await studio.read(project.id, catalogQuery);
  assert.equal(catalog.state, 'available', JSON.stringify(catalog));
  const found = catalog.databases.find((entry) => entry.name === name);
  assert.ok(found, 'missing ' + name);
  return found;
}
async function select(studio, project, db, name) {
  const tables = await studio.read(project.id, queryFor(db.id));
  assert.equal(tables.state, 'available', JSON.stringify(tables));
  const table = tables.tables.find((item) => item.name === name);
  assert.ok(table, 'missing table ' + name);
  return table;
}

test('owned database catalog, quoted identifiers, schema, exact integers, BLOB and bounded text pagination', async (t) => {
  const { root, other, project, neighbor, studio } = fixture(t);
  const filename = path.join(root, 'data.sqlite');
  createDatabase(
    filename,
    'CREATE TABLE "sales ""2026""" ("id" INTEGER PRIMARY KEY, "odd name" TEXT, payload BLOB, big INTEGER, nil TEXT);' +
      'CREATE VIEW "read view" AS SELECT "odd name" FROM "sales ""2026"""; CREATE TABLE empty (x TEXT);',
  );
  const db = new DatabaseSync(filename);
  const insert = db.prepare('INSERT INTO "sales ""2026""" VALUES (?, ?, ?, ?, NULL)');
  for (let i = 1; i <= 23; i++)
    insert.run(i, 'ż'.repeat(200), Buffer.alloc(80, 0xab), 9223372036854775807n);
  db.close();
  createDatabase(path.join(other, 'neighbor.sqlite'), 'CREATE TABLE secret(x);');
  const before = checksum(filename);
  const catalog = await studio.read(project.id, catalogQuery);
  assert.equal(catalog.state, 'available');
  assert.deepEqual(
    catalog.databases.map((entry) => entry.name),
    ['data.sqlite'],
  );
  assert.ok(!JSON.stringify(catalog).includes(root));
  const entry = catalog.databases[0];
  assert.match(entry.id, /^[a-f0-9]{64}$/);
  assert.equal((await studio.read(neighbor.id, queryFor(entry.id))).state, 'stale');
  const table = await select(studio, project, entry, 'sales "2026"');
  const first = await studio.read(project.id, queryFor(entry.id, table.id));
  assert.equal(first.state, 'available', JSON.stringify(first));
  assert.equal(first.rows.length, SQLITE_PAGE_SIZE);
  assert.equal(first.hasMore, true);
  assert.deepEqual(
    first.columns.map((col) => col.name),
    ['id', 'odd name', 'payload', 'big', 'nil'],
  );
  assert.equal(first.columns[0].primaryKey, 1);
  assert.deepEqual(first.rows[0][0], {
    kind: 'integer',
    value: '1',
    bytes: null,
    truncated: false,
  });
  assert.equal(first.rows[0][1].truncated, true);
  assert.equal(first.rows[0][1].bytes, 400);
  assert.deepEqual(first.rows[0][2], {
    kind: 'blob',
    value: 'ab'.repeat(16),
    bytes: 80,
    truncated: true,
  });
  assert.equal(first.rows[0][3].value, '9223372036854775807');
  assert.deepEqual(first.rows[0][4], { kind: 'null', value: null, bytes: null, truncated: false });
  const next = await studio.read(project.id, queryFor(entry.id, table.id, 2));
  assert.equal(next.state, 'available', JSON.stringify(next));
  assert.equal(next.rows.length, 3);
  assert.equal(next.rows[0][0].value, '21');
  assert.equal(next.hasMore, false);
  const view = await select(studio, project, entry, 'read view');
  assert.equal(view.type, 'view');
  assert.equal((await studio.read(project.id, queryFor(entry.id, view.id))).state, 'available');
  const empty = await select(studio, project, entry, 'empty');
  const emptyRows = await studio.read(project.id, queryFor(entry.id, empty.id));
  assert.equal(emptyRows.state, 'available');
  assert.deepEqual(emptyRows.rows, []);
  assert.equal(emptyRows.hasMore, false);
  assert.equal(checksum(filename), before);
  assert.deepEqual(readdirSync(root), ['data.sqlite']);
});

test('active WAL shows committed not uncommitted rows, preserves main/WAL bytes and refuses missing sidecars until offline', async (t) => {
  const { root, project, studio, stop } = fixture(t);
  const filename = path.join(root, 'wal.sqlite');
  writeFileSync(filename, '', { mode: 0o600 });
  const writer = new DatabaseSync(filename);
  let closed = false;
  t.after(() => {
    if (!closed) writer.close();
  });
  writer.exec(
    "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE sample (x TEXT); INSERT INTO sample VALUES ('committed'); BEGIN IMMEDIATE; INSERT INTO sample VALUES ('uncommitted');",
  );
  for (const name of readdirSync(root)) chmodSync(path.join(root, name), 0o600);
  const entry = await choose(studio, project, 'wal.sqlite');
  assert.equal(entry.mode, 'live-wal');
  const mainBefore = checksum(filename);
  const walBefore = checksum(filename + '-wal');
  const beforeFiles = readdirSync(root).sort();
  const table = await select(studio, project, entry, 'sample');
  const result = await studio.read(project.id, queryFor(entry.id, table.id));
  assert.equal(result.state, 'available', JSON.stringify(result));
  assert.deepEqual(
    result.rows.map((row) => row[0].value),
    ['committed'],
  );
  assert.equal(checksum(filename), mainBefore);
  assert.equal(checksum(filename + '-wal'), walBefore);
  assert.deepEqual(readdirSync(root).sort(), beforeFiles);
  writer.exec('COMMIT');
  const committed = await studio.read(project.id, queryFor(entry.id, table.id));
  assert.equal(committed.state, 'available', JSON.stringify(committed));
  assert.deepEqual(
    committed.rows.map((row) => row[0].value),
    ['committed', 'uncommitted'],
  );
  writer.close();
  closed = true;
  assert.deepEqual(readdirSync(root), ['wal.sqlite']);
  const blocked = await choose(studio, project, 'wal.sqlite');
  assert.equal(blocked.state, 'offline-only');
  assert.equal((await studio.read(project.id, queryFor(blocked.id))).state, 'offline-only');
  stop();
  const offline = await choose(studio, project, 'wal.sqlite');
  assert.equal(offline.mode, 'offline');
  const offlineHash = checksum(filename);
  const offlineTable = await select(studio, project, offline, 'sample');
  assert.equal(
    (await studio.read(project.id, queryFor(offline.id, offlineTable.id))).state,
    'available',
  );
  assert.deepEqual(readdirSync(root), ['wal.sqlite']);
  assert.equal(checksum(filename), offlineHash);
});

test('malformed database, hot-journal guard, identity replacement, path and scan isolation', async (t) => {
  const { root, other, project, studio } = fixture(t);
  const filename = path.join(root, 'app.sqlite');
  createDatabase(filename, 'CREATE TABLE sample(x);');
  writeFileSync(path.join(root, 'broken.db'), 'not sqlite', { mode: 0o600 });
  const malformed = await choose(studio, project, 'broken.db');
  assert.equal(malformed.state, 'corrupt');
  const entry = await choose(studio, project, 'app.sqlite');
  writeFileSync(filename + '-journal', 'fixture journal', { mode: 0o600 });
  assert.equal((await studio.read(project.id, queryFor(entry.id))).state, 'locked');
  rmSync(filename + '-journal');
  renameSync(filename, filename + '.old');
  createDatabase(filename, 'CREATE TABLE replacement(x);');
  assert.equal((await studio.read(project.id, queryFor(entry.id))).state, 'stale');
  const outside = path.join(other, 'other.db');
  createDatabase(outside, 'CREATE TABLE outside(x);');
  symlinkSync(outside, path.join(root, 'link.db'));
  assert.equal((await studio.read(project.id, catalogQuery)).state, 'unavailable');
  rmSync(path.join(root, 'link.db'));
  // An unsafe entry in another project's db is deliberately not traversed.
  symlinkSync(filename, path.join(other, 'link.db'));
  assert.equal((await studio.read(project.id, catalogQuery)).state, 'available');
  assert.equal((await studio.read('node-' + 'f'.repeat(32), catalogQuery)).state, 'unavailable');
});

test('hardlinked database rejected where Android permits hardlink creation', async (t) => {
  const { root, project, studio } = fixture(t);
  const filename = path.join(root, 'app.db');
  createDatabase(filename, 'CREATE TABLE sample(x);');
  try {
    linkSync(filename, path.join(root, 'linked.db'));
  } catch (error) {
    if (['EACCES', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EROFS'].includes(error.code)) {
      t.skip('Filesystem blocks hardlink creation');
      return;
    }
    throw error;
  }
  assert.equal((await studio.read(project.id, catalogQuery)).state, 'unavailable');
});

test('query and response scope, bounded pages, unsupported view functions and single concurrent reader', async (t) => {
  const { root, project, studio } = fixture(t);
  const filename = path.join(root, 'app.db');
  createDatabase(
    filename,
    'CREATE TABLE records(x); INSERT INTO records VALUES (1); CREATE VIEW heavy AS SELECT randomblob(100000000) AS x;',
  );
  const entry = await choose(studio, project, 'app.db');
  const table = await select(studio, project, entry, 'records');
  const query = queryFor(entry.id, table.id, SQLITE_MAX_PAGE);
  assert.deepEqual(
    parseSqliteQuery('/sqlite?db=' + entry.id + '&table=' + table.id + '&page=50'),
    query,
  );
  for (const suffix of [
    '?sql=SELECT+1',
    '?db=../../etc',
    '?db=' + entry.id + '&db=' + entry.id,
    '?db=' + entry.id + '&page=2',
    '?db=' + entry.id + '&table=' + table.id + '&page=51',
  ]) {
    assert.throws(() => parseSqliteQuery('/sqlite' + suffix));
  }
  const [a, b] = await Promise.all([
    studio.read(project.id, queryFor(entry.id, table.id)),
    studio.read(project.id, queryFor(entry.id, table.id)),
  ]);
  assert.equal(a.state, 'available');
  assert.equal(b.state, 'busy');
  assert.throws(() => parseSqliteRead(a, 'node-' + 'b'.repeat(32), queryFor(entry.id, table.id)));
  assert.throws(() => parseSqliteRead(a, project.id, query));
  const heavy = await select(studio, project, entry, 'heavy');
  const unsupported = await studio.read(project.id, queryFor(entry.id, heavy.id));
  assert.equal(unsupported.state, 'unsupported', JSON.stringify(unsupported));
  assert.deepEqual(unsupported.rows, []);
});

test('read-only HTTP API honors existing owner, scope, origin and rejects arbitrary SQL or mutation', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-sqlite-api-'));
  const keys = [
    'HOME',
    'POCKETHOST_ENABLE_OWNED_SITE_DEV',
    'POCKETHOST_ENABLE_NODE_HOSTING_DEV',
    'POCKETHOST_NODE_OWNER_TOKEN',
  ];
  const previous = keys.map((key) => process.env[key]);
  const token = 'a'.repeat(48);
  let server;
  try {
    process.env.HOME = tmp;
    process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV = '1';
    process.env.POCKETHOST_ENABLE_NODE_HOSTING_DEV = '1';
    process.env.POCKETHOST_NODE_OWNER_TOKEN = token;
    const project = new NodeProjectHost().create('SQLite HTTP fixture');
    const root = path.join(tmp, '.local/state/pockethost/node-project-data', project.id, 'db');
    mkdirSync(root, { recursive: true, mode: 0o700 });
    createDatabase(path.join(root, 'app.sqlite'), 'CREATE TABLE a(x); INSERT INTO a VALUES (7);');
    let handler;
    nodeProjectApi().configureServer({
      middlewares: {
        use(_route, cb) {
          handler = cb;
        },
      },
    });
    server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const call = (suffix, headers = {}, method = 'GET') =>
      new Promise((resolve, reject) => {
        const req = request(
          {
            hostname: '127.0.0.1',
            port: server.address().port,
            path: '/' + project.id + '/sqlite' + suffix,
            method,
            headers: { host: '127.0.0.1:8787', connection: 'close', ...headers },
          },
          (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
              try {
                resolve({
                  status: res.statusCode,
                  body: JSON.parse(Buffer.concat(chunks).toString()),
                });
              } catch (error) {
                reject(error);
              }
            });
          },
        );
        req.on('error', reject);
        req.setTimeout(6000, () => req.destroy(new Error('HTTP fixture timeout')));
        req.end();
      });
    const auth = { 'x-pockethost-node-owner': token };
    assert.equal((await call('')).status, 403);
    assert.equal((await call('', { ...auth, origin: 'https://foreign.invalid' })).status, 403);
    assert.equal((await call('', auth, 'POST')).status, 405);
    assert.equal((await call('?sql=DELETE', auth)).status, 400);
    const catalog = await call('', auth);
    assert.equal(catalog.status, 200);
    assert.equal(catalog.body.state, 'available', JSON.stringify(catalog));
    const database = catalog.body.databases[0];
    const tables = await call('?db=' + database.id, auth);
    assert.equal(tables.body.state, 'available', JSON.stringify(tables));
    const rows = await call(
      '?db=' + database.id + '&table=' + tables.body.tables[0].id + '&page=1',
      auth,
    );
    assert.equal(rows.body.state, 'available', JSON.stringify(rows));
    assert.equal(rows.body.rows[0][0].value, '7');
    assert.ok(!JSON.stringify(rows).includes(root));
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    keys.forEach((key, i) =>
      previous[i] === undefined ? delete process.env[key] : (process.env[key] = previous[i]),
    );
    rmSync(tmp, { recursive: true, force: true });
  }
});
