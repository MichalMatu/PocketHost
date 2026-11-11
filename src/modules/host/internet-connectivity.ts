import { connect, type Socket } from 'node:net';

export type InternetConnectivity = {
  version: 1;
  source: 'termux';
  method: 'tcp-handshake';
  target: '1.1.1.1:443';
  observedAt: string;
  state: 'reachable' | 'unreachable';
  latencyMs: number | null;
};

/** On-demand TCP handshake to a fixed Internet endpoint; not ICMP ping or RX/TX. */
export function probeInternetConnectivity(
  dial: (target: { host: string; port: number }) => Socket = connect,
  clock: () => number = () => performance.now(),
  timestamp: () => string = () => new Date().toISOString(),
): Promise<InternetConnectivity> {
  return new Promise((resolve) => {
    const start = clock();
    let completed = false;
    let socket: Socket | null = null;
    const done = (reachable: boolean) => {
      if (completed) return;
      completed = true;
      const elapsed = clock() - start;
      socket?.destroy();
      resolve({
        version: 1,
        source: 'termux',
        method: 'tcp-handshake',
        target: '1.1.1.1:443',
        observedAt: timestamp(),
        state: reachable ? 'reachable' : 'unreachable',
        latencyMs:
          reachable && Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed * 10) / 10) : null,
      });
    };
    try {
      socket = dial({ host: '1.1.1.1', port: 443 });
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
      socket.once('timeout', () => done(false));
      socket.once('close', () => done(false));
      socket.setTimeout(2200);
    } catch {
      done(false);
    }
  });
}

export function allowsInternetProbeRequest(request: {
  host?: string;
  origin?: string;
  remote?: string;
  fetchSite?: string;
  method?: string;
  route?: string;
}): boolean {
  return (
    ['127.0.0.1:8787', 'localhost:8787'].includes(request.host ?? '') &&
    (!request.origin ||
      ['http://127.0.0.1:8787', 'http://localhost:8787'].includes(request.origin)) &&
    request.fetchSite !== 'cross-site' &&
    ['127.0.0.1', '::ffff:127.0.0.1'].includes(request.remote ?? '') &&
    request.method === 'GET' &&
    request.route === '/'
  );
}
