import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { inspectMqttLoopbackHealth } from '../../src/modules/host/mqtt-loopback-health.ts';

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.writes = [];
    this.destroyed = false;
    this.timeout = null;
  }

  write(data) {
    this.writes.push(Buffer.from(data));
    return true;
  }

  setTimeout(_duration, callback) {
    this.timeout = callback;
    return this;
  }

  destroy() {
    this.destroyed = true;
    return this;
  }
}

function probe() {
  const socket = new MockSocket();
  const connections = [];
  const result = inspectMqttLoopbackHealth((options) => {
    connections.push(options);
    return socket;
  });
  assert.deepEqual(connections, [{ host: '127.0.0.1', port: 1883 }]);
  return { socket, result };
}

test('MQTT health verifies a split CONNACK using only a synthetic socket', async () => {
  const { socket, result } = probe();
  socket.emit('connect');
  assert.equal(socket.writes.length, 1);
  assert.equal(socket.writes[0][0], 0x10);
  assert.ok(socket.writes[0].includes(Buffer.from('pockethost-check')));
  socket.emit('data', Buffer.from([0x20, 0x02]));
  assert.equal(socket.destroyed, false);
  socket.emit('data', '\x00\x00');
  const health = await result;
  assert.equal(health.state, 'ready');
  assert.equal(health.reason, 'mqtt-connack');
  assert.equal(health.version, 1);
  assert.ok(Number.isFinite(Date.parse(health.checkedAt)));
  assert.equal(socket.destroyed, true);
});

test('MQTT health rejects invalid and negative CONNACK packets', async () => {
  for (const [packet, reason] of [
    [[0x20, 0x02, 0, 0x05], 'mqtt-rejected'],
    [[0x31, 0x02, 0, 0], 'unexpected-response'],
    [[0x20, 0x03, 0, 0], 'unexpected-response'],
  ]) {
    const { socket, result } = probe();
    socket.emit('data', Buffer.from(packet));
    assert.deepEqual(
      { state: (await result).state, reason: (await result).reason },
      { state: 'not-ready', reason },
    );
    assert.equal(socket.destroyed, true);
  }
});

test('MQTT health fails closed for refused connection, transport error and timeout', async () => {
  const refused = probe();
  refused.socket.emit('error', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
  assert.equal((await refused.result).reason, 'connect-refused');

  const transport = probe();
  transport.socket.emit('error', new Error('transport failed'));
  assert.equal((await transport.result).state, 'unverified');

  const delayed = probe();
  assert.equal(typeof delayed.socket.timeout, 'function');
  delayed.socket.timeout();
  assert.equal((await delayed.result).reason, 'transport-unavailable');
});
