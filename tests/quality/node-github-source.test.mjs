import assert from 'node:assert/strict';
import test from 'node:test';
import { previewPublicGitHubNodeSource } from '../../src/modules/host/node-github-source.ts';

const sha = 'a'.repeat(40);
const manifest = {
  name: 'public-test-node',
  version: '1.0.0',
  scripts: { start: 'node server.mjs' },
};
const lockfile = {
  name: 'public-test-node',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: { '': { name: 'public-test-node', version: '1.0.0' } },
};
const entry = "console.log('public preview only')";
function fixture(overrides = {}) {
  const seen = [];
  const get = async (url, init) => {
    seen.push({ url, init });
    const name = url.split('/contents/')[1]?.split('?')[0];
    const entries = {
      'package.json': manifest,
      'package-lock.json': lockfile,
      'server.mjs': entry,
    };
    let response = url === 'https://api.github.com/repos/example/safe-node'
      ? { private: false, full_name: 'example/safe-node', default_branch: 'main' }
      : url.endsWith('/commits/main') ? { sha }
      : name ? {
          type: 'file', name, path: name, encoding: 'base64',
          content: Buffer.from(
            typeof entries[name] === 'string' ? entries[name] : JSON.stringify(entries[name]),
          ).toString('base64'),
        } : {};
    if (typeof overrides.change === 'function')
      response = overrides.change(url, response);
    const status = overrides.status ?? 200;
    return new Response(JSON.stringify(response), { status });
  };
  return { seen, get };
}

test('GitHub preview pins 3 exact root files to one immutable public commit', async () => {
  const { seen, get } = fixture();
  const preview = await previewPublicGitHubNodeSource('example/safe-node', get);
  assert.equal(preview.repository, 'example/safe-node');
  assert.equal(preview.commit, sha);
  assert.deepEqual(preview.source.packageJson, manifest);
  assert.deepEqual(preview.source.packageLock, lockfile);
  assert.equal(preview.source.serverSource, entry);
  assert.equal(preview.plan.dependencyCount, 0);
  assert.equal(seen.length, 5);
  assert.deepEqual(
    seen.slice(2).map((request) => request.url),
    ['package.json', 'package-lock.json', 'server.mjs'].map(
      (name) => 'https://api.github.com/repos/example/safe-node/contents/' + name + '?ref=' + sha,
    ),
  );
  for (const { url, init } of seen) {
    assert.equal(new URL(url).origin, 'https://api.github.com');
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, undefined);
  }
});


test('GitHub build preview imports bounded frontend text files at one pinned SHA', async () => {
  const requests = [];
  const buildManifest = {
    ...manifest, scripts: { start: 'node server.mjs', build: 'vite build' },
  };
  const extras = {
    'index.html': '<main id="app"></main>',
    'src/main.ts': 'document.body.textContent = "hello"',
    'src/style.css': 'body { color: red }',
    'vite.config.ts': 'export default {}',
  };
  const get = async (url, init) => {
    requests.push(url);
    const part = url.split('/contents/')[1]?.split('?')[0];
    const obj = url.endsWith('/safe-node') ?
      { private: false, full_name: 'example/safe-node', default_branch: 'main' } :
      url.endsWith('/commits/main') ? { sha } :
      url.includes('/git/trees/' + sha) ? {
        truncated: false, tree: Object.entries(extras).map(([path, value]) => ({
          path, type: 'blob', mode: '100644', size: Buffer.byteLength(value),
        })),
      } :
      part ? {
        type: 'file', name: part.split('/').at(-1), path: part, encoding: 'base64',
        content: Buffer.from(
          typeof ({ 'package.json': buildManifest, 'package-lock.json': lockfile,
            'server.mjs': entry, ...extras })[part] === 'string' ?
          ({ 'package.json': buildManifest, 'package-lock.json': lockfile,
            'server.mjs': entry, ...extras })[part] :
          JSON.stringify(({ 'package.json': buildManifest, 'package-lock.json': lockfile,
            'server.mjs': entry, ...extras })[part]),
        ).toString('base64'),
      } : {};
    return new Response(JSON.stringify(obj), { status: 200 });
  };
  const result = await previewPublicGitHubNodeSource('example/safe-node', get);
  assert.equal(result.commit, sha);
  assert.deepEqual(result.source.extraFiles, extras);
  assert.equal(requests.length, 10);
  assert.ok(requests.slice(3).every(url => url.endsWith('?ref=' + sha) ||
    url.endsWith('/git/trees/' + sha + '?recursive=1')));
});

test('GitHub build preview refuses symlink and binary file in public source tree', async () => {
  for (const path of ['public/logo.png', 'src/secrets/.env', 'src/config.ts']) {
    const get = async url => {
      const file = url.split('/contents/')[1]?.split('?')[0];
      const response = url.endsWith('/safe-node') ?
        { private: false, full_name: 'example/safe-node', default_branch: 'main' } :
        url.endsWith('/commits/main') ? { sha } :
        url.includes('/git/trees/') ? {
          truncated: false, tree: [{ path, type: 'blob',
            mode: path === 'src/config.ts' ? '120000' : '100644', size: 20 }],
        } :
        file ? {
          type: 'file', name: file.split('/').at(-1), path: file, encoding: 'base64',
          content: Buffer.from(file === 'package.json' ?
            JSON.stringify({ ...manifest, scripts: { start: 'node server.mjs', build: 'vite build' } }) :
            file === 'package-lock.json' ? JSON.stringify(lockfile) : entry).toString('base64'),
        } : {};
      return new Response(JSON.stringify(response), { status: 200 });
    };
    await assert.rejects(
      previewPublicGitHubNodeSource('example/safe-node', get),
      /Unsupported GitHub frontend source/,
    );
  }
});
test('GitHub preview rejects URLs, nested paths and hostile repo names without requesting network', async () => {
  let accessed = 0;
  const get = async () => {
    accessed++;
    throw new Error('No network call was permitted');
  };
  for (const name of [
    'https://github.com/example/safe-node',
    'example/safe-node/another',
    '../safe-node',
    'example/..',
    'example/safe-node.git',
    'example/x?ref=abc',
    'example/x#fragment',
    'example//safe-node',
  ]) {
    await assert.rejects(previewPublicGitHubNodeSource(name, get), /GitHub repository/);
  }
  assert.equal(accessed, 0);
});

test('GitHub preview rejects private or redirected repository metadata', async () => {
  const secret = fixture({
    change: (url, data) => url.endsWith('/safe-node') ? { ...data, private: true } : data,
  });
  await assert.rejects(previewPublicGitHubNodeSource('example/safe-node', secret.get), /public/);
  assert.equal(secret.seen.length, 1);
  const redirected = fixture({ status: 302 });
  await assert.rejects(previewPublicGitHubNodeSource('example/safe-node', redirected.get), /request failed/);
  assert.equal(redirected.seen.length, 1);
});

test('GitHub preview rejects a symlink or mismatched source identity', async () => {
  for (const alteration of [
    { type: 'symlink' },
    { path: 'nested/server.mjs' },
    { encoding: 'utf-16' },
    { content: '$not-base64$' },
  ]) {
    const { get } = fixture({
      change: (url, data) => url.includes('/contents/server.mjs?') ? { ...data, ...alteration } : data,
    });
    await assert.rejects(previewPublicGitHubNodeSource('example/safe-node', get), /root file|encoding/);
  }
});

test('GitHub preview enforces declared response budgets before consuming data', async () => {
  let calls = 0;
  const get = async () => {
    calls++;
    return new Response('{"data":"too-large"}', {
      status: 200,
      headers: { 'Content-Length': '1000000' },
    });
  };
  await assert.rejects(previewPublicGitHubNodeSource('example/safe-node', get), /exceeds limit/);
  assert.equal(calls, 1);
});

test('GitHub preview rejects mismatched manifest and lock without staging anything', async () => {
  const { get } = fixture({
    change: (url, data) => url.includes('/contents/package-lock.json?') ? {
      ...data,
      content: Buffer.from(JSON.stringify({ ...lockfile, version: '9.9.9' })).toString('base64'),
    } : data,
  });
  await assert.rejects(previewPublicGitHubNodeSource('example/safe-node', get), /identity differs/);
});
