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
