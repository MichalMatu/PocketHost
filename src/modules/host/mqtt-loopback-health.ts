import { createConnection } from 'node:net';

export interface MqttLoopbackHealth {
  version: 1;
  checkedAt: string;
  state: 'ready' | 'not-ready' | 'unverified';
  reason: 'mqtt-connack' | 'connect-refused' | 'mqtt-rejected' |
    'unexpected-response' | 'transport-unavailable';
}

/**
 * On-demand, fixed 127.0.0.1:1883 MQTT 3.1.1 CONNECT/CONNACK check.
 * No broker lifecycle authority, credentials, arbitrary destinations, topic
 * subscription, publishing, scheduled polling or network exposure.
 */
export function inspectMqttLoopbackHealth(): Promise<MqttLoopbackHealth> {
  const clientId = Buffer.from('pockethost-check', 'utf8');
  const header = Buffer.from([0, 4, 77, 81, 84, 84, 4, 2, 0, 5]);
  const remaining = header.length + 2 + clientId.length;
  const connect = Buffer.concat([
    Buffer.from([0x10, remaining]), header,
    Buffer.from([0, clientId.length]), clientId,
  ]);
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port: 1883 });
    let finished = false;
    let received = Buffer.alloc(0);
    const finish = (state: MqttLoopbackHealth['state'],
      reason: MqttLoopbackHealth['reason']) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({ version: 1, checkedAt: new Date().toISOString(), state, reason });
    };
    socket.on('connect', () => socket.write(connect));
    socket.on('data', chunk => {
      received = Buffer.concat([received, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);
      if (received.length < 4) return;
      if (received[0] !== 0x20 || received[1] !== 0x02 ||
          received[2] !== 0x00) {
        finish('not-ready', 'unexpected-response');
      } else if (received[3] !== 0x00) {
        finish('not-ready', 'mqtt-rejected');
      } else {
        finish('ready', 'mqtt-connack');
      }
    });
    socket.on('error', error => {
      const refused = (error as NodeJS.ErrnoException).code === 'ECONNREFUSED';
      finish(refused ? 'not-ready' : 'unverified',
        refused ? 'connect-refused' : 'transport-unavailable');
    });
    socket.setTimeout(2000, () => finish('unverified', 'transport-unavailable'));
    socket.on('close', () => finish('unverified', 'transport-unavailable'));
  });
}
