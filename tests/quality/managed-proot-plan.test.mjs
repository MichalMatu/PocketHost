import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManagedProotArgs } from '../../src/modules/host/managed-proot-plan.ts';

const plan = () => ({
  rootfs: '/managed/rootfs',
  binds: [
    { source: '/managed/work/source', target: '/mnt/source' },
    { source: '/managed/work/db', target: '/mnt/data' },
  ],
  workdir: '/mnt/source',
  command: ['/opt/app/python', '-m', 'uvicorn', 'server:app'],
});

test('generic PRoot launch plan supports a second app without PhotoMap values', () => {
  assert.deepEqual(buildManagedProotArgs(plan()), [
    '-R', '/managed/rootfs',
    '-b', '/managed/work/source:/mnt/source',
    '-b', '/managed/work/db:/mnt/data',
    '-w', '/mnt/source',
    '/opt/app/python', '-m', 'uvicorn', 'server:app',
  ]);
});

test('PRoot command cannot adopt foreign workdir or inject another bind', () => {
  for (const changed of [
    { rootfs: 'relative/rootfs' },
    { rootfs: '/managed/rootfs:foreign' },
    { workdir: '/mnt/not-bound' },
    { workdir: '/../foreign' },
    { binds: [{ source: '/managed/work:outside', target: '/mnt/source' }] },
    { binds: [{ source: '/foreign', target: '/mnt/../../foreign' }] },
    { binds: [{ source: '/one', target: '/mnt/source' }, { source: '/two', target: '/mnt/source' }] },
    { command: ['python', '-m', 'uvicorn'] },
    { command: ['/opt/app/python', 'a\0b'] },
  ]) {
    assert.throws(() => buildManagedProotArgs({ ...plan(), ...changed }), /Unsafe|workdir/);
  }
});

test('empty and oversized bind and command sets are rejected', () => {
  for (const changed of [
    { binds: [] },
    { binds: Array.from({ length: 17 }, (_, i) => ({ source: '/src/' + i, target: '/mnt/bind-' + i })) },
    { command: [] },
  ]) assert.throws(() => buildManagedProotArgs({ ...plan(), ...changed }), /Unsafe/);
});
