// One bounded, nonpersistent native SQLite reader. Only the host constructs its stdin.
import { DatabaseSync, constants } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  SQLITE_PAGE_SIZE,
  SQLITE_MAX_COLUMNS,
  SQLITE_MAX_TABLES,
  SQLITE_MAX_RESPONSE_BYTES,
  SQLITE_TEXT_BYTES,
  SQLITE_BLOB_BYTES,
} from '../../shared/node-sqlite-studio.ts';

const MAX_FILE = 16 * 1024 * 1024;
const failure = (state) => ({ state });
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const opaqueTable = (databaseId, type, name) =>
  createHash('sha256')
    .update(JSON.stringify([databaseId, type, name]))
    .digest('hex');

function checkedFile(filename, expected, main) {
  const stat = lstatSync(filename, { throwIfNoEntry: false });
  if (!expected) return !stat;
  return (
    !!stat &&
    stat.isFile() &&
    !stat.isSymbolicLink() &&
    stat.uid === process.getuid() &&
    (stat.mode & 0o077) === 0 &&
    stat.nlink === 1 &&
    stat.size <= MAX_FILE &&
    realpathSync(filename) === filename &&
    stat.dev === expected.dev &&
    stat.ino === expected.ino &&
    (!main ||
      (stat.size === expected.size &&
        stat.ctimeMs === expected.ctimeMs &&
        stat.mtimeMs === expected.mtimeMs))
  );
}
function verified(input) {
  return (
    checkedFile(input.filename, input.main, true) &&
    ['-wal', '-shm', '-journal'].every((suffix) =>
      checkedFile(input.filename + suffix, input.sidecars[suffix], false),
    )
  );
}

function tableCatalog(db, databaseId) {
  const tables = [];
  for (const row of db.prepare('PRAGMA table_list').iterate()) {
    if (row.schema !== 'main' || row.name.startsWith('sqlite_') || row.type === 'shadow') continue;
    if (
      !['table', 'view', 'virtual'].includes(row.type) ||
      typeof row.name !== 'string' ||
      row.name.length > 240 ||
      !Number.isSafeInteger(row.ncol) ||
      row.ncol < 0 ||
      row.ncol > 32767 ||
      tables.length >= SQLITE_MAX_TABLES
    )
      throw new RangeError('table budget');
    tables.push({
      id: opaqueTable(databaseId, row.type, row.name),
      name: row.name,
      type: row.type,
      columns: row.ncol,
      state:
        row.type === 'virtual' || row.ncol < 1 || row.ncol > SQLITE_MAX_COLUMNS
          ? 'unsupported'
          : 'available',
      withoutRowid: row.wr === 1,
    });
  }
  tables.sort((a, b) => a.name.localeCompare(b.name));
  return tables;
}

// Deny ATTACH, writes, virtual/shadow objects, extension loading and unknown functions.
// Functions needed by the fixed projection and common ordinary views are explicitly admitted.
const safeFunctions = new Set([
  'typeof',
  'hex',
  'substr',
  'substring',
  'length',
  'count',
  'sum',
  'total',
  'avg',
  'min',
  'max',
  'coalesce',
  'ifnull',
  'nullif',
  'lower',
  'upper',
  'trim',
  'ltrim',
  'rtrim',
  'round',
  'abs',
  'date',
  'time',
  'datetime',
  'strftime',
  'julianday',
  'unicode',
  'instr',
  'replace',
  'like',
  'glob',
  'group_concat',
  'concat',
  'concat_ws',
]);
function authorize(db, tables, selected) {
  const allowed = new Set(
    tables.filter((item) => item.type !== 'virtual').map((item) => item.name),
  );
  db.setAuthorizer((action, first, second, schema) => {
    if (
      action === constants.SQLITE_SELECT ||
      (action === constants.SQLITE_READ &&
        schema === 'main' &&
        (allowed.has(first) || first === 'sqlite_schema' || first === 'sqlite_master')) ||
      (action === constants.SQLITE_FUNCTION && safeFunctions.has(String(second).toLowerCase())) ||
      (action === constants.SQLITE_PRAGMA && first === 'table_xinfo' && second === selected.name)
    ) {
      return constants.SQLITE_OK;
    }
    return constants.SQLITE_DENY;
  });
}

function readColumns(db, table) {
  const columns = [];
  for (const row of db.prepare('PRAGMA table_xinfo(' + quote(table.name) + ')').iterate()) {
    if (
      row.hidden === 1 ||
      columns.length >= SQLITE_MAX_COLUMNS ||
      typeof row.name !== 'string' ||
      row.name.length > 240 ||
      !Number.isSafeInteger(row.pk) ||
      row.pk < 0 ||
      row.pk > SQLITE_MAX_COLUMNS
    ) {
      throw new RangeError('column budget');
    }
    columns.push({
      name: row.name,
      type: String(row.type).slice(0, 160),
      notNull: row.notnull === 1,
      primaryKey: row.pk,
      generated: row.hidden === 2 || row.hidden === 3,
    });
  }
  if (columns.length !== table.columns || columns.length === 0)
    throw new RangeError('schema changed');
  return columns;
}
function expression(column) {
  const q = quote(column.name);
  return [
    'typeof(' + q + ')',
    'CASE typeof(' +
      q +
      ") WHEN 'null' THEN NULL WHEN 'blob' THEN hex(substr(" +
      q +
      ',1,' +
      SQLITE_BLOB_BYTES +
      ")) WHEN 'text' THEN hex(substr(CAST(" +
      q +
      ' AS BLOB),1,' +
      SQLITE_TEXT_BYTES +
      ')) ELSE CAST(' +
      q +
      ' AS TEXT) END',
    'CASE WHEN typeof(' +
      q +
      ") IN ('text','blob') THEN length(CAST(" +
      q +
      ' AS BLOB)) ELSE NULL END',
  ];
}
function cell(kind, preview, bytes) {
  if (kind === 'null') return { kind, value: null, bytes: null, truncated: false };
  if (kind === 'integer' || kind === 'real') {
    return { kind, value: String(preview), bytes: null, truncated: false };
  }
  if (kind !== 'text' && kind !== 'blob') throw new RangeError('unknown SQLite value');
  return {
    kind,
    value: kind === 'text' ? Buffer.from(preview, 'hex').toString('utf8') : preview.toLowerCase(),
    bytes,
    truncated: bytes > (kind === 'text' ? SQLITE_TEXT_BYTES : SQLITE_BLOB_BYTES),
  };
}
function readRows(db, table, columns, page) {
  const primary = columns
    .filter((column) => column.primaryKey > 0)
    .sort((a, b) => a.primaryKey - b.primaryKey)
    .map((column) => quote(column.name));
  const names = new Set(columns.map((column) => column.name.toLowerCase()));
  const rowid = ['_rowid_', 'rowid', 'oid'].find((name) => !names.has(name));
  const order =
    table.type === 'table' ? [...primary, ...(!table.withoutRowid && rowid ? [rowid] : [])] : [];
  const stmt = db.prepare(
    'SELECT ' +
      columns.flatMap(expression).join(',') +
      ' FROM main.' +
      quote(table.name) +
      (order.length ? ' ORDER BY ' + order.join(',') : '') +
      ' LIMIT ? OFFSET ?',
  );
  stmt.setReturnArrays(true);
  const raw = stmt.all(SQLITE_PAGE_SIZE + 1, (page - 1) * SQLITE_PAGE_SIZE);
  return {
    columns,
    hasMore: raw.length > SQLITE_PAGE_SIZE,
    rows: raw
      .slice(0, SQLITE_PAGE_SIZE)
      .map((row) => columns.map((_, i) => cell(row[i * 3], row[i * 3 + 1], row[i * 3 + 2]))),
  };
}
function inspect(input) {
  if (!verified(input)) return failure('stale');
  let db;
  let result;
  try {
    const target = input.mode === 'offline' ? pathToFileURL(input.filename) : input.filename;
    if (target instanceof URL) target.search = 'immutable=1&mode=ro';
    db = new DatabaseSync(target, {
      readOnly: true,
      allowExtension: false,
      enableDoubleQuotedStringLiterals: false,
    });
    if (typeof db.setAuthorizer !== 'function') return failure('unsupported');
    db.exec(
      'PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA temp_store=MEMORY; ' +
        'PRAGMA busy_timeout=100; PRAGMA hard_heap_limit=16777216; BEGIN',
    );
    const tables = tableCatalog(db, input.databaseId);
    if (!input.tableId) {
      result = {
        state: 'available',
        tables: tables.map(({ id, name, type, columns, state }) => ({
          id,
          name,
          type,
          columns,
          state,
        })),
      };
    } else {
      const table = tables.find((item) => item.id === input.tableId);
      if (!table) result = failure('stale');
      else if (table.state !== 'available') result = failure('unsupported');
      else {
        authorize(db, tables, table);
        const columns = readColumns(db, table);
        result = { state: 'available', ...readRows(db, table, columns, input.page) };
      }
    }
  } finally {
    db?.close();
  }
  return verified(input) ? result : failure('stale');
}
function classify(error) {
  const code = Number(error?.errcode) & 255;
  if (code === 5 || code === 6) return 'locked';
  if (code === 11 || code === 26) return 'corrupt';
  if (
    code === 7 ||
    code === 18 ||
    code === 23 ||
    /not authorized|prohibited/i.test(String(error?.message)) ||
    error instanceof RangeError
  )
    return 'unsupported';
  if (error?.code === 'ENOENT') return 'stale';
  return 'unavailable';
}
let result;
try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  result = inspect(input);
} catch (error) {
  result = failure(classify(error));
}
const output = JSON.stringify(result);
console.log(
  Buffer.byteLength(output) <= SQLITE_MAX_RESPONSE_BYTES - 1024
    ? output
    : JSON.stringify(failure('unsupported')),
);
