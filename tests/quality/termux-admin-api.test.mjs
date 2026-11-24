import assert from 'node:assert/strict';
import test from 'node:test';
import { termuxAdminApi } from '../../apps/admin/plugins/termux-admin-api.ts';

function fixture(context) {
  let handler;
  const plugin = termuxAdminApi(context);
  assert.equal(plugin.apply, 'serve');
  plugin.configureServer({
    middlewares: {
      use(route, callback) {
        assert.equal(route, '/api/v1/termux-admin');
        handler = callback;
      },
    },
  });
  assert.equal(typeof handler, 'function');
  return async (changes = {}, body = '') => {
    let data;
    let ended = 0;
    const headers = new Map();
    const request = {
      method: 'GET',
      url: '/',
      headers: { host: '127.0.0.1:8787' },
      socket: { remoteAddress: '127.0.0.1' },
      setTimeout() {},
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(body);
      },
      ...changes,
    };
    const response = {
      statusCode: 200,
      setHeader(name, value) {
        headers.set(name.toLowerCase(), value);
      },
      end(value) {
        data = value;
        ended++;
      },
    };
    await handler(request, response);
    assert.equal(ended, 1);
    assert.equal(headers.get('cache-control'), 'no-store');
    return { status: response.statusCode, headers, data };
  };
}

const intent = {
  host: '127.0.0.1:8787',
  origin: 'http://127.0.0.1:8787',
  'x-pockethost-intent': 'termux-admin',
  'content-type': 'application/json',
};
const post = { method: 'POST', headers: intent };
const payload = (name) => JSON.stringify({ action: 'terminal', name });

test('Termux API preserves exact raw log bytes and read-only routing', async () => {
  const bytes = Buffer.from([0, 255, 10, 13]);
  let reads = 0;
  const api = fixture({
    rawAgentLog: {
      read(cursor) {
        assert.equal(cursor, '1:2:3');
        reads++;
        return { state: 'ok', bytes, cursor: '1:2:7', reset: false, more: true };
      },
    },
  });
  const url = '/?mode=local-agent-raw-log&cursor=1:2:3';
  assert.equal((await api({ url, headers: { host: 'foreign.test' } })).status, 403);
  assert.equal((await api({ url: '/invalid' })).status, 404);
  assert.equal((await api({ url: '/?mode=local-agent-raw-log&cursor=bad' })).status, 400);
  assert.equal(reads, 0);
  const result = await api({ url });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, bytes);
  assert.equal(result.headers.get('content-type'), 'application/octet-stream');
  assert.equal(result.headers.get('x-agent-log-cursor'), '1:2:7');
  assert.equal(result.headers.get('x-agent-log-more'), '1');
  assert.equal(reads, 1);
});

test('Termux API serializes typed actions and recovers the queue after a refusal', async () => {
  const calls = [];
  let release;
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const api = fixture({
    terminal: {
      async start() {
        calls.push('start');
        entered();
        await new Promise((resolve) => {
          release = resolve;
        });
        throw Error('fixture refusal');
      },
      stop() {
        calls.push('stop');
        return { state: 'stopped' };
      },
    },
  });
  assert.equal((await api({ method: 'POST' }, payload('start'))).status, 403);
  assert.equal((await api(post, '{"action":"terminal","extra":true}')).status, 409);
  assert.deepEqual(calls, []);
  const first = api(post, payload('start'));
  await started;
  const second = api(post, payload('stop'));
  await Promise.resolve();
  assert.deepEqual(calls, ['start']);
  release();
  assert.equal((await first).status, 409);
  const stopped = await second;
  assert.equal(stopped.status, 200);
  assert.deepEqual(JSON.parse(stopped.data), { terminal: { state: 'stopped' } });
  assert.deepEqual(calls, ['start', 'stop']);
});

test('Termux file actions distinguish omitted content from an empty file', async () => {
  const calls = [];
  const api = fixture({
    files: {
      apply(...args) {
        calls.push(args);
      },
    },
    fileRoots: {
      apply(...args) {
        calls.push(args);
        return { changed: true };
      },
    },
  });
  assert.equal(
    (await api(post, JSON.stringify({ action: 'file', name: 'mkdir', path: 'folder' }))).status,
    200,
  );
  assert.equal(
    (
      await api(
        post,
        JSON.stringify({
          action: 'full-file',
          name: 'save',
          root: 'home',
          path: 'a.txt',
          content: '',
        }),
      )
    ).status,
    200,
  );
  assert.deepEqual(calls, [
    ['mkdir', 'folder', {}],
    ['home', 'save', 'a.txt', { content: '' }],
  ]);
});
