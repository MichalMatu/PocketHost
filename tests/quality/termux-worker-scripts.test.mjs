import assert from 'node:assert/strict';
import test from 'node:test';
import {
  builtinWorkerRunScript,
  builtinWorkerLogScript,
  isStagedWorker,
  PREFIX,
  valid,
} from '../../src/modules/host/termux-worker-scripts.ts';

const target = PREFIX + '/var/sv/owned-worker';

test('fixed worker scripts select only reviewed runtimes and exact service roots', () => {
  for (const template of [
    'heartbeat-worker-v1',
    'python-heartbeat-v1',
    'python-source-v1',
    'node-source-v1',
  ]) {
    const script = builtinWorkerRunScript(template, target);
    assert.equal(script.startsWith('#!' + PREFIX + '/bin/sh\nexec '), true);
    assert.match(script, /HOME=\/data\/data\/com\.termux\/files\/usr\/var\/sv\/owned-worker/);
    assert.match(script, /TMPDIR=\/data\/data\/com\.termux\/files\/usr\/tmp/);
    assert.equal(isStagedWorker(template), template.endsWith('source-v1'));
    if (template === 'python-source-v1') {
      assert.match(script, /python -I -u .*worker\.py/);
    } else if (template === 'node-source-v1') {
      assert.match(script, /node .*worker\.mjs/);
    } else {
      assert.match(script, /worker heartbeat/);
    }
  }
  assert.equal(isStagedWorker('heartbeat-worker-v1'), false);
  assert.throws(() => builtinWorkerRunScript('unreviewed', target), /Invalid builtin worker/);
  assert.throws(
    () => builtinWorkerRunScript('node-source-v1', target + '/../foreign'),
    /Unexpected builtin target path/,
  );
});

test('fixed log source and names cannot become arbitrary runit commands', () => {
  const log = builtinWorkerLogScript('owned-worker');
  assert.equal(
    log,
    '#!' +
      PREFIX +
      '/bin/sh\nexec ' +
      PREFIX +
      '/bin/svlogd -tt ' +
      PREFIX +
      '/var/log/sv/owned-worker\n',
  );
  assert.doesNotThrow(() => valid('service-aa'));
  for (const name of ['../foreign', 'UPPER', 'a', 'worker/name', 'name with spaces'])
    assert.throws(() => valid(name), /Invalid runit service name/);
  assert.throws(() => builtinWorkerLogScript('../external'), /Invalid runit service name/);
});
