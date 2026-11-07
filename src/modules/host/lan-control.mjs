import os from 'node:os';
import net from 'node:net';
import { startLanGateway } from './lan-gateway.mjs';

/** Only exact private addresses assigned to this host are selectable. */
export function availableLanInterfaces(interfaces = os.networkInterfaces()) {
  return Object.entries(interfaces)
    .flatMap(([name, entries]) => (entries ?? []).filter((item) =>
      item.family === 'IPv4' && !item.internal &&
      net.isIP(item.address) === 4 &&
      (item.address.startsWith('10.') ||
        item.address.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(item.address))
    ).map((item) => ({ name, address: item.address })))
    .sort((a, b) => a.address.localeCompare(b.address));
}

/**
 * One Vite session owns only gateways it created itself.
 * Never inspect or signal an arbitrary process using a port or PID.
 */
export function createLanControl({
  interfaces = () => availableLanInterfaces(),
  start = (bind) => startLanGateway(bind, { registerSignals: false }),
} = {}) {
  let gateway = null;
  let inFlight = false;
  const status = () => ({
    version: 1,
    mode: 'manual',
    enabled: gateway !== null,
    bind: gateway?.bind ?? null,
    interfaces: interfaces(),
    adminUrl: gateway ? 'http://' + gateway.bind + ':18878/' : null,
    siteUrl: gateway ? 'http://' + gateway.bind + ':18879/' : null,
  });
  async function enable(bind) {
    if (inFlight) throw new Error('busy');
    if (typeof bind !== 'string' || !interfaces().some((item) => item.address === bind)) {
      throw new Error('invalid-lan-interface');
    }
    if (gateway) {
      if (gateway.bind !== bind) throw new Error('disable-before-switch');
      return status();
    }
    inFlight = true;
    try {
      const instance = await start(bind);
      gateway = { bind, close: instance.close };
      return status();
    } finally {
      inFlight = false;
    }
  }
  async function disable() {
    if (inFlight) throw new Error('busy');
    if (!gateway) return status();
    const instance = gateway;
    gateway = null;
    inFlight = true;
    try {
      await instance.close();
    } finally {
      inFlight = false;
    }
    return status();
  }
  return { status, enable, disable };
}
